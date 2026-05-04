// character.asset.js — AI 生成 GLB 用 scaffold prefab。
//
// 使い方:
//   1. Meshy / Tripo / Rodin / Hunyuan3D 等で character GLB を生成
//   2. このフォルダ(3d-prefab/assets/)に character.glb として保存
//   3. ブラウザで http://localhost:3000/3d-prefab/ を開く
//
// GLB が無い場合は GLTFLoader が 404 エラー → ai-eyes が拾って error.log に出る。
// → fallback に切り替えるなら main.js 側で try/catch、prefab 単位の優雅な失敗処理に。

export const id = 'character';

export const transform = {
  position: [-2.5, 0, 0],   // world: cube の左隣
  rotation: [0, 0, 0],
  scale: 1,
};

export const mesh = {
  kind: 'glb',
  glbPath: './assets/character.glb',
};

export const state = {
  rotSpeed: 0.008,
  age: 0,
  pulse: 0,
  lastClickWorldPos: null,
};

export function transition(state, event) {
  if (event.kind === 'tick') {
    return {
      ...state,
      age: state.age + 1,
      pulse: state.pulse > 0 ? state.pulse - 0.025 : 0,
    };
  }
  if (event.kind === 'click') {
    return {
      ...state,
      rotSpeed: -state.rotSpeed,
      pulse: 1,
      lastClickWorldPos: event.worldPos,
    };
  }
  return state;
}
