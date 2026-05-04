// main.js — 3d-prefab demo entry。
//
// 1) scene 作る
// 2) prefab(cube.asset.js)を読み込み、scene に置く
// 3) tick ループ: prefab.dispatch({kind:'tick'}) → mesh.rotation.y を state.age 連動で更新
//
// すべて world coord(inter-Block)で住む。screen coord は render の出力境界のみ。

import { createScene } from './scene.js';
import { loadPrefab } from './prefabLoader.js';
import * as cube from './assets/cube.asset.js';

const canvas = document.getElementById('canvas');
const { renderer, scene, camera } = createScene(canvas);

const cubeHandle = loadPrefab(cube, scene);

function tick() {
  cubeHandle.dispatch({ kind: 'tick' });
  const s = cubeHandle.getState();
  // intra-Block: rotSpeed は asset 内部 scalar、coord 系外
  cubeHandle.mesh.rotation.y = s.age * s.rotSpeed;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
