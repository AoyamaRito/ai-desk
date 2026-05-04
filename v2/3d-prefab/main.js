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

function tick() {
  for (const h of handles) {
    h.dispatch({ kind: 'tick' });
    const s = h.getState();
    h.mesh.rotation.y = s.age * s.rotSpeed;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
