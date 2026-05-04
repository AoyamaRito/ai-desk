// main.js — 3d-prefab demo entry。
//
// 1) scene 作る
// 2) prefab(cube.asset.js)を読み込み、scene に置く
// 3) tick ループ: prefab.dispatch({kind:'tick'}) → mesh.rotation.y を state.age 連動で更新
//
// すべて world coord(inter-Block)で住む。screen coord は render の出力境界のみ。

import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadPrefab } from './prefabLoader.js';
import { setupInput } from './input.js';
import * as cube from './assets/cube.asset.js';
import * as boxGlb from './assets/box-glb.asset.js';

const canvas = document.getElementById('canvas');
const { renderer, scene, camera } = createScene(canvas, { cameraPosition: [4, 3, 6] });

// GLB 用に最低限の light(MeshStandardMaterial が PBR で light 必須)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(3, 5, 4);
scene.add(dir);

// loadPrefab は async(GLB 読み込み待ち)、両 prefab を並列に読む
const [cubeHandle, boxHandle] = await Promise.all([
  loadPrefab(cube, scene),
  loadPrefab(boxGlb, scene),
]);

const handles = [cubeHandle, boxHandle];

// 入力 adapter 設置(A10 境界): mouse → ray cast → world hit → dispatch
setupInput(canvas, camera, handles);

// 60 frame ごとに ai-eyes に prefab state を送る(AI 観測 boundary)。
// screen coord は使わず、各 prefab の id / age / rotSpeed / pulse / lastClickWorldPos のみ。
let frameCount = 0;
function reportToAiEyes() {
  if (typeof window.aiEyes?.sendStructure !== 'function') return;
  const snapshot = handles.map(h => {
    const s = h.getState();
    return {
      id: h.mesh.userData.prefabId,
      worldPos: h.mesh.position.toArray(),
      state: { age: s.age, rotSpeed: s.rotSpeed, pulse: +s.pulse.toFixed(3), lastClickWorldPos: s.lastClickWorldPos },
    };
  });
  window.aiEyes.sendStructure({ kind: 'prefab-state', frame: frameCount, prefabs: snapshot });
}

function tick() {
  for (const h of handles) {
    h.dispatch({ kind: 'tick' });
    const s = h.getState();
    h.mesh.rotation.y = s.age * s.rotSpeed;

    // click pulse を scale で表現(intra-Block 視覚効果)
    const baseScale = h.mesh.userData.baseScale ?? h.mesh.scale.x;
    h.mesh.userData.baseScale = baseScale;
    const pulseScale = baseScale * (1 + s.pulse * 0.3);
    h.mesh.scale.setScalar(pulseScale);
  }
  renderer.render(scene, camera);
  frameCount++;
  if (frameCount % 60 === 0) reportToAiEyes();
  requestAnimationFrame(tick);
}
tick();
