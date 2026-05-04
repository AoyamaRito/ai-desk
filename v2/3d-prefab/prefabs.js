// prefabs.js — 全 prefab を data として並べる(Block 層、crystallize 整合)。
//
// 構造(各 prefab):
//   id        : string
//   transform : { position: 'world:x,y,z', rotation: [rx,ry,rz], scale: number }
//   mesh      : { kind, args?, material?, glbPath? }
//   state     : object(coord 値は world / ortho 等の tagged string)
//   flow      : { <eventKind>: [behaviorId, ...], scheduled?: [{at, behaviors}] }
//
// flow は heartbeat が読む LLM-friendly な event → behavior 列の object。
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

  // click: voxel を cell-center snap して add / remove(state.tool で切替)
  // ev.worldPos = "world:x,y,z" raw click hit、cellSize の cell に snap して voxel key を作る。
  // 各 cell の中心 = floor(coord / cs) * cs + cs/2(Minecraft 流、格子の交点ではなく cell 内に配置)
  // state.voxels = { "world:0.25,0.25,0.25": { color: "hex:ff8844" }, ... }
  addOrRemoveVoxelOnClick: (s, ev) => {
    if (ev.kind !== 'click') return s;
    const [x, y, z] = requireDomain(ev.worldPos, 'world');
    const cs = s.cellSize ?? 0.5;
    const cx = Math.floor(x / cs) * cs + cs / 2;
    // y は最低 cs/2(地面の上)、それより上は cell-center snap
    const cy = Math.max(cs / 2, Math.floor(y / cs) * cs + cs / 2);
    const cz = Math.floor(z / cs) * cs + cs / 2;
    const key = w(cx, cy, cz);
    const tool = s.tool ?? 'add';
    if (tool === 'remove') {
      if (!s.voxels[key]) return s;
      const voxels = { ...s.voxels };
      delete voxels[key];
      return { ...s, voxels, lastEditWorldPos: key };
    }
    // add(default、既存上書き)
    return {
      ...s,
      voxels: { ...s.voxels, [key]: { color: s.currentColor ?? 'hex:ff8844' } },
      lastEditWorldPos: key,
    };
  },

  // peer-clicked: voxel canvas 自身は他 prefab の click を無視(自分宛て click のみ)
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

// flow + event.kind から「実行する behavior 列」を取り出して 1 transition にする。
// flow.<event.kind> が無い event は no-op(state 不変)。
export function transitionForEvent(prefab, event) {
  const ids = prefab.flow?.[event.kind];
  if (!ids || ids.length === 0) return (s) => s;
  return compose(ids);
}

// ============================================================
// Prefab data(全 prefab をここに並べる)
// ============================================================

// 共通 click flow(disabled 旧 prefab 用)
const standardFlow = {
  tick:  ['tickAge', 'pulseDecay'],
  click: ['reverseRotOnClick', 'pulseOnClick', 'recordClickPos'],
};

export const prefabs = {
  cube: {
    id: 'cube',
    transform: { position: w(0, 0, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'BoxGeometry', args: [1, 1, 1], material: { kind: 'MeshNormalMaterial' } },
    state: { rotSpeed: 0.01, age: 0, pulse: 0, lastClickWorldPos: null },
    flow: standardFlow,
    disabled: true,
  },

  boxGlb: {
    id: 'box-glb',
    transform: { position: w(2.5, 0, 0), rotation: [0, 0, 0], scale: 0.8 },
    mesh: { kind: 'glb', glbPath: './assets/box.glb' },
    state: { rotSpeed: -0.012, age: 0, pulse: 0, pulseDecay: 0.04, lastClickWorldPos: null },
    flow: standardFlow,
    disabled: true,
  },

  komaHu: {
    id: 'koma-hu',
    transform: { position: w(0, 0, -3), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'glb', glbPath: './assets/koma_hu.glb' },
    state: { rotSpeed: 0.005, age: 0, pulse: 0, pulseDecay: 0.025, lastClickWorldPos: null },
    flow: standardFlow,
    optional: true,
    disabled: true,
  },

  voxelCanvas: {
    id: 'voxel-canvas',
    transform: { position: w(0, 0, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'voxel-canvas', cellSize: 0.5, planeSize: 8, maxVoxels: 4096 },
    state: {
      voxels: {},
      cellSize: 0.5,
      tool: 'add',
      currentColor: 'hex:ff8844',
      lastEditWorldPos: null,
    },
    flow: {
      click: ['addOrRemoveVoxelOnClick'],
      // tick / hover は adapter 側で処理(syncInstances / moveCursor は副作用なので Block 層外)
    },
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
    flow: {
      tick: ['tickAge', 'lerpToTarget'],
      'peer-clicked': ['recordPeerTarget'],
    },
    disabled: true,
  },

  character: {
    id: 'character',
    transform: { position: w(-2.5, 0, 0), rotation: [0, 0, 0], scale: 1 },
    mesh: { kind: 'glb', glbPath: './assets/character.glb' },
    state: { rotSpeed: 0.008, age: 0, pulse: 0, pulseDecay: 0.025, lastClickWorldPos: null },
    flow: standardFlow,
    optional: true,
    disabled: true,
  },
};
