// hud.js — HUD layer(A10 整合の screen-fixed UI 実装)。
//
// 設計(Bible A10):
//   - HUD は **ortho camera が見る world 領域**として実装
//   - HUD scene は別 scene、別 camera(orthographic、NDC-like 範囲)
//   - 主 render の後に autoClear=false で重ねる
//   - 内部記述は local coord(asset 原点基準)、外には world として出る
//
// 「画面右上の HP バー」のような screen-fixed 要素も、world 座標(ortho の)で書く:
//   x: -1 (left edge) .. 1 (right edge) / y: -1 (bottom) .. 1 (top)
//
// テキストは canvas → CanvasTexture で plane に貼る(WebGL 流儀、DOM overlay 禁止)。

import * as THREE from 'three';

export function createHud(renderer) {
  const hudScene = new THREE.Scene();
  // ortho camera: 画面 NDC 座標系を world coord として扱う
  // (左下 -1,-1 / 右上 1,1) — これが HUD の世界座標
  const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  hudCamera.position.z = 1;

  // info text plane(右上に固定 = world (0.7, 0.85))
  const { mesh: infoMesh, ctx: infoCtx, tex: infoTex } = makeTextPlane({
    width: 0.5, height: 0.16,
    canvasWidth: 512, canvasHeight: 160,
  });
  infoMesh.position.set(0.7, 0.85, 0);
  hudScene.add(infoMesh);

  // resize 時に ortho aspect 調整(縦横比に合わせる)
  const onResize = () => {
    const canvas = renderer.domElement;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    hudCamera.left = -aspect;
    hudCamera.right = aspect;
    hudCamera.updateProjectionMatrix();
    infoMesh.position.x = aspect - 0.3;
  };
  window.addEventListener('resize', onResize);
  onResize();

  function setInfo(lines) {
    infoCtx.clearRect(0, 0, 512, 160);
    infoCtx.fillStyle = 'rgba(0,0,0,0.6)';
    infoCtx.fillRect(0, 0, 512, 160);
    infoCtx.fillStyle = '#ddd';
    infoCtx.font = '20px monospace';
    let y = 28;
    for (const line of lines) {
      infoCtx.fillText(line, 12, y);
      y += 26;
    }
    infoTex.needsUpdate = true;
  }

  function render() {
    // 主 render の後に呼ぶ。Z buffer をクリアして overlay。
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hudScene, hudCamera);
    renderer.autoClear = true;
  }

  return { hudScene, hudCamera, setInfo, render };
}

// canvas + CanvasTexture を持つ text plane を作る。
// 内部記述は local coord(plane 原点基準)、外への placement は呼び出し側で。
//
// OffscreenCanvas を使う理由:
//   - DOM tree に乗らない(Taboo 15: No DOM overlay UI in world Block 整合)
//   - 純粋に WebGL texture 用の pixel buffer source
//   - 最終 render は world geometry の plane texture として scene に乗る
function makeTextPlane({ width, height, canvasWidth, canvasHeight }) {
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const geom = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(geom, mat);
  return { mesh, ctx, tex };
}
