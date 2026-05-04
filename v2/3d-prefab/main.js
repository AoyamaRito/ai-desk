// main.js — 3d-prefab demo entry。
//
// 構成:
//  - cube       (inline BoxGeometry、MeshNormalMaterial、左)
//  - box-glb    (Khronos Box.glb、PBR、右)
//  - character  (AI 生成 GLB scaffold、assets/character.glb があれば見える、左寄り)
//  - pointer    (黄色い sphere、inter-Block 通信で他 prefab の click を追跡)
//  - HUD        (右上、ortho camera world に CanvasTexture text plane で表示)
//  - input      (mouse → ray cast → world hit、router 経由で peer-clicked broadcast)
//  - ai-eyes    (60 frame ごとに structure 送信)

import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadPrefab } from './prefabLoader.js';
import { setupInput } from './input.js';
import { createHud } from './hud.js';
import * as cube from './assets/cube.asset.js';
import * as boxGlb from './assets/box-glb.asset.js';
import * as character from './assets/character.asset.js';
import * as pointer from './assets/pointer.asset.js';

const canvas = document.getElementById('canvas');
const { renderer, scene, camera } = createScene(canvas, { cameraPosition: [4, 3, 7] });

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(3, 5, 4);
scene.add(dir);

// HUD setup(ortho camera world に住む overlay)
const hud = createHud(renderer);

// prefab を並列に読み込む。character.glb が無ければ skip(エラーは ai-eyes に流れる)。
async function loadOptional(asset) {
  try {
    return await loadPrefab(asset, scene);
  } catch (err) {
    console.warn(`prefab "${asset.id}" load failed (skipping):`, err.message);
    return null;
  }
}

const handles = (await Promise.all([
  loadPrefab(cube, scene),
  loadPrefab(boxGlb, scene),
  loadOptional(character),
  loadPrefab(pointer, scene),
])).filter(Boolean);

// inter-Block routing: clicked handle に click、他 handle に peer-clicked を送る
function router(clickedHandle, worldPos) {
  const sourceId = clickedHandle.mesh.userData.prefabId;
  clickedHandle.dispatch({ kind: 'click', worldPos });
  for (const h of handles) {
    if (h === clickedHandle) continue;
    h.dispatch({ kind: 'peer-clicked', worldPos, sourceId });
  }
}

setupInput(canvas, camera, handles, router);

// ai-eyes 観測 boundary
let frameCount = 0;
function reportToAiEyes() {
  if (typeof window.aiEyes?.sendStructure !== 'function') return;
  const snapshot = handles.map(h => {
    const s = h.getState();
    return {
      id: h.mesh.userData.prefabId,
      worldPos: h.mesh.position.toArray(),
      state: pickReportable(s),
    };
  });
  window.aiEyes.sendStructure({ kind: 'prefab-state', frame: frameCount, prefabs: snapshot });
}

function pickReportable(s) {
  // 浅い primitive のみ載せる(ai-eyes 側で読みやすい形に)
  const out = {};
  for (const k of Object.keys(s)) {
    const v = s[k];
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      out[k] = typeof v === 'number' ? +v.toFixed(3) : v;
    } else if (Array.isArray(v) && v.every(e => typeof e === 'number')) {
      out[k] = v.map(e => +e.toFixed(3));
    }
  }
  return out;
}

function tick() {
  for (const h of handles) {
    h.dispatch({ kind: 'tick' });
    const s = h.getState();
    const id = h.mesh.userData.prefabId;

    // pointer 以外は y 軸回転、pointer は currentWorldPos に従って位置更新
    if (id === 'pointer') {
      if (s.currentWorldPos) h.mesh.position.fromArray(s.currentWorldPos);
    } else {
      h.mesh.rotation.y = s.age * (s.rotSpeed ?? 0);
    }

    // pulse → scale
    const baseScale = h.mesh.userData.baseScale ?? h.mesh.scale.x;
    h.mesh.userData.baseScale = baseScale;
    const pulseScale = baseScale * (1 + (s.pulse ?? 0) * 0.3);
    h.mesh.scale.setScalar(pulseScale);
  }

  // 主 render
  renderer.render(scene, camera);

  // HUD 更新 + overlay render(ortho camera world)
  if (frameCount % 6 === 0) updateHud();
  hud.render();

  frameCount++;
  if (frameCount % 60 === 0) reportToAiEyes();
  requestAnimationFrame(tick);
}

function updateHud() {
  const ptr = handles.find(h => h.mesh.userData.prefabId === 'pointer');
  const ptrState = ptr?.getState();
  const lines = [
    `frame: ${frameCount}`,
    `prefabs: ${handles.length}`,
    `last click: ${ptrState?.lastSourceId ?? '(none)'}`,
    ptrState?.targetWorldPos
      ? `target world: [${ptrState.targetWorldPos.map(n => n.toFixed(2)).join(', ')}]`
      : '',
  ].filter(Boolean);
  hud.setInfo(lines);
}

tick();
