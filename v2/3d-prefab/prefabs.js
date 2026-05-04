// prefabs.js — 全 prefab を data として並べる(Block 層、crystallize 整合)。
//
// 構造(各 prefab):
//   id        : string
//   transform : { position: 'world:x,y,z', rotation: [rx,ry,rz], scale: number }
//   mesh      : { kind, args?, material?, glbPath? }
//   state     : object(coord 値は world / ortho 等の tagged string)
//   behaviors : behavior id 配列(transition は behavior の合成で生成)
//
// behaviors は pure functions、(state, event) → state。順に reduce で適用。
// → 重複 transition コードを排除、A1 ローカリティ + A7 展開・明示 + A11 構造化。

import { w, parseCoord, requireDomain } from './coord.js';

// ============================================================
// Behaviors — 共通の遷移 building block
// ============================================================

export const behaviors = {
  // tick: age をインクリメント
  tickAge: (s, ev) => ev.kind === 'tick' ? { ...s, age: (s.age ?? 0) + 1 } : s,

  // tick: pulse を減衰(rate は state.pulseDecay または 0.03)
  pulseDecay: (s, ev) => {
    if (ev.kind !== 'tick') return s;
    const rate = s.pulseDecay ?? 0.03;
    const cur = s.pulse ?? 0;
    return { ...s, pulse: cur > 0 ? Math.max(0, cur - rate) : 0 };
  },

  // click: rotSpeed を反転
  reverseRotOnClick: (s, ev) =>
    ev.kind === 'click' ? { ...s, rotSpeed: -(s.rotSpeed ?? 0) } : s,

  // click: pulse=1 を立てる
  pulseOnClick: (s, ev) =>
    ev.kind === 'click' ? { ...s, pulse: 1 } : s,

  // click: world coord を state.lastClickWorldPos に記録
  recordClickPos: (s, ev) =>
    ev.kind === 'click' ? { ...s, lastClickWorldPos: ev.worldPos } : s,

  // peer-clicked: 他 prefab の click を targetWorldPos に記録(inter-Block)
  recordPeerTarget: (s, ev) =>
    ev.kind === 'peer-clicked'
      ? { ...s, targetWorldPos: ev.worldPos, lastSourceId: ev.sourceId }
      : s,

  // tick: targetWorldPos に向けて currentWorldPos を lerp(両方 world coord)
  lerpToTarget: (s, ev) => {
    if (ev.kind !== 'tick' || !s.targetWorldPos || !s.currentWorldPos) return s;
    const cur = requireDomain(s.currentWorldPos, 'world');
    const tgt = requireDomain(s.targetWorldPos, 'world');
    const r = s.lerpRate ?? 0.08;
    const next = cur.map((v, i) => v + (tgt[i] - v) * r);
    return { ...s, currentWorldPos: w(...next) };
  },
};

// behavior id 配列 → 単一 transition 関数(reduce で順次適用)
export function compose(behaviorIds) {
  const fns = behaviorIds.map(id => {
    const fn = behaviors[id];
    if (!fn) throw new Error(`unknown behavior: "${id}"`);
    return fn;
  });
  return (state, event) => fns.reduce((s, b) => b(s, event), state);
}

// ============================================================
// Prefab data(全 prefab をここに並べる)
// ============================================================

const standardClickResponse = ['tickAge', 'pulseDecay', 'reverseRotOnClick', 'pulseOnClick', 'recordClickPos'];

export const prefabs = {
  cube: {
    id: 'cube',
    transform: { position: w(0, 0, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'BoxGeometry', args: [1, 1, 1], material: { kind: 'MeshNormalMaterial' } },
    state: { rotSpeed: 0.01, age: 0, pulse: 0, lastClickWorldPos: null },
    behaviorIds: standardClickResponse,
  },

  boxGlb: {
    id: 'box-glb',
    transform: { position: w(2.5, 0, 0), rotation: [0, 0, 0], scale: 0.8 },
    mesh: { kind: 'glb', glbPath: './assets/box.glb' },
    state: { rotSpeed: -0.012, age: 0, pulse: 0, pulseDecay: 0.04, lastClickWorldPos: null },
    behaviorIds: standardClickResponse,
  },

  komaHu: {
    id: 'koma-hu',
    transform: { position: w(0, 0, -3), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'glb', glbPath: './assets/koma_hu.glb' },
    state: { rotSpeed: 0.005, age: 0, pulse: 0, pulseDecay: 0.025, lastClickWorldPos: null },
    behaviorIds: standardClickResponse,
    optional: true,   // GLB 不在時は HEAD probe で skip
  },

  pointer: {
    id: 'pointer',
    transform: { position: w(0, 2.5, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'SphereGeometry', args: [0.2, 16, 12], material: { kind: 'MeshBasicMaterial', color: 0xffaa00 } },
    state: {
      currentWorldPos: w(0, 2.5, 0),
      targetWorldPos: null,
      lerpRate: 0.08,
      lastSourceId: null,
      age: 0,
    },
    behaviorIds: ['tickAge', 'recordPeerTarget', 'lerpToTarget'],
  },

  // character: AI 生成 GLB scaffold(default disabled、glb 置いて optional:false に)
  character: {
    id: 'character',
    transform: { position: w(-2.5, 0, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'glb', glbPath: './assets/character.glb' },
    state: { rotSpeed: 0.008, age: 0, pulse: 0, pulseDecay: 0.025, lastClickWorldPos: null },
    behaviorIds: standardClickResponse,
    optional: true,
    disabled: true,   // import のみ、load しない(glb 置いたら false に)
  },
};

// 各 prefab の transition 関数を build(behaviorIds → composed function)
export function makeTransition(prefab) {
  return compose(prefab.behaviorIds);
}
