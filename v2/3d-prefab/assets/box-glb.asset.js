// box-glb.asset.js — 外部 GLB を mesh source とする prefab。
// GLB は Khronos Sample Box.glb(Apache 2.0)。
// AI 生成 GLB(Meshy / Tripo / Rodin 等)に差し替えるときも同じ形式。

export const id = 'box-glb';

// inter-Block 境界(world coord)
export const transform = {
  position: [2.5, 0, 0],   // world: cube の右隣
  rotation: [0, 0, 0],
  scale: 0.8,
};

// intra-Block: GLB 内部は asset 原点基準 local coord、GLTF が hierarchy 持つ
export const mesh = {
  kind: 'glb',
  glbPath: './assets/box.glb',
};

export const state = {
  rotSpeed: -0.012,    // 反時計回り(cube と区別)
  age: 0,
};

export function transition(state, event) {
  if (event.kind === 'tick') return { ...state, age: state.age + 1 };
  return state;
}
