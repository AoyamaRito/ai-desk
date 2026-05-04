// scene.js — three.js renderer + camera + scene graph の最小 setup。
//
// A10 整合:
//  - すべての mesh は world coord で配置(scene.add ベース)
//  - screen coord は render output 境界でのみ存在(WebGLRenderer の projection)
//  - input adapter は別 module(後段)
//
// three.js は revision pin で Eternal Compat 確保。CDN は importmap 経由で
// index.html が解決する。

import * as THREE from 'three';

export function createScene(canvas, opts = {}) {
  const {
    background = 0x1a1a1a,
    fov = 50,
    near = 0.1,
    far = 1000,
    cameraPosition = [3, 3, 5],
    cameraLookAt = [0, 0, 0],
  } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  camera.position.fromArray(cameraPosition);
  camera.lookAt(...cameraLookAt);

  // resize handling
  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  return { renderer, scene, camera };
}
