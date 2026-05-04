// cube.asset.js — prefab JS module(A10 / Vocabulary.prefab に従う最初の例)
//
// prefab 構造(triple):
//   - export const transform : world coord(inter-Block 境界)
//   - export const mesh      : intra-Block 内部記述(local coord OK)
//   - export const state     : Block state(inter-Block 共有 値は world coord)
//   - export function transition(state, event) : 畳込み遷移、pure function

export const id = 'cube';

// ─── inter-Block 境界(world coord) ────────────────────────────────
export const transform = {
  position: [0, 0, 0],   // world
  rotation: [0, 0, 0],   // world (radian)
  scale: 1,
};

// ─── intra-Block(local coord OK) ─────────────────────────────────
// 形状は asset 原点基準の local 記述。renderer 側で transform を介して
// world に乗る。
export const mesh = {
  kind: 'BoxGeometry',
  args: [1, 1, 1],          // width, height, depth(local)
  material: { kind: 'MeshNormalMaterial' },
};

// ─── Block state(畳込み遷移の対象) ───────────────────────────────
// inter-Block で共有する位置情報を持つ場合は world coord。
// asset 内部だけで使う scratch 値は local OK。
export const state = {
  rotSpeed: 0.01,           // rad/tick(internal scalar、coord 系外)
  age: 0,                   // tick count(internal)
  pulse: 0,                 // click pulse(0→1 で減衰、scale 効果用)
  lastClickWorldPos: null,  // inter-Block 共有値: world coord([x,y,z])
};

// ─── 畳込み遷移関数(pure) ─────────────────────────────────────────
// state, event → newState。副作用なし、A0/A4 整合。
export function transition(state, event) {
  if (event.kind === 'tick') {
    return {
      ...state,
      age: state.age + 1,
      pulse: state.pulse > 0 ? state.pulse - 0.03 : 0,
    };
  }
  if (event.kind === 'click') {
    // 反転 + pulse、click 位置を world coord で記録(inter-Block 共有可能)
    return {
      ...state,
      rotSpeed: -state.rotSpeed,
      pulse: 1,
      lastClickWorldPos: event.worldPos,
    };
  }
  return state;
}
