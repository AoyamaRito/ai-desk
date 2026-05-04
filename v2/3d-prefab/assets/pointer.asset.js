// pointer.asset.js — inter-Block 通信を実証する prefab。
//
// 役割: 他 prefab(cube / box-glb / character)が click された world 座標を
//       追いかけて表示する小さな sphere。
//
// inter-Block 通信:
//   - 自分自身の click は受け取らない(passive observer)
//   - main.js の orchestrator が他 prefab の click 時に
//     `peer-clicked` event(world coord)を broadcast → 受信して targetWorldPos 更新
//   - tick で targetWorldPos に lerp(線形補間)
//
// すべて world coord、screen 系は触らない(A10 整合)。

export const id = 'pointer';

export const transform = {
  position: [0, 2.5, 0],   // world: 上空
  rotation: [0, 0, 0],
  scale: 1,
};

export const mesh = {
  kind: 'SphereGeometry',
  args: [0.2, 16, 12],
  material: { kind: 'MeshBasicMaterial', color: 0xffaa00 },
};

export const state = {
  targetWorldPos: null,
  currentWorldPos: [0, 2.5, 0],   // world(自身の現在位置、tick で更新)
  lerpRate: 0.08,                 // intra: scalar、coord 系外
  lastSourceId: null,             // どの prefab を最後に追跡したか
  age: 0,
};

export function transition(state, event) {
  if (event.kind === 'tick') {
    let next = state.currentWorldPos;
    if (state.targetWorldPos) {
      next = lerp3(state.currentWorldPos, state.targetWorldPos, state.lerpRate);
    }
    return { ...state, age: state.age + 1, currentWorldPos: next };
  }
  if (event.kind === 'peer-clicked') {
    // 他 prefab がクリックされた → 自分の追跡先を更新
    return {
      ...state,
      targetWorldPos: event.worldPos,
      lastSourceId: event.sourceId,
    };
  }
  return state;
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
