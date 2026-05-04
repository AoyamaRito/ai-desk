// prefabs.test.js — Block 層の単体テスト(Node のみ、Zero-Dep)。
//
// behaviors / compose / makeTransition / coord helpers / inter-Block 通信 を一括検証。
// 旧 transition.test.js + inter-block.test.js を集約。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prefabs, behaviors, compose, transitionForEvent } from '../prefabs.js';
import { w, l, s, o, parseCoord, requireDomain } from '../coord.js';

// 旧 makeTransition 互換ヘルパー — flow.click を 1 回 transition として返す
function makeClickTransition(prefab) {
  const t = transitionForEvent(prefab, { kind: 'click' });
  return (state, event) => t(state, event);
}
function makeTickTransition(prefab) {
  const t = transitionForEvent(prefab, { kind: 'tick' });
  return (state, event) => t(state, event);
}
function makePeerTransition(prefab) {
  const t = transitionForEvent(prefab, { kind: 'peer-clicked' });
  return (state, event) => t(state, event);
}

// ============================================================
// coord.js — A11 Domain-Tagged Coordinates
// ============================================================

test('coord builders: 各 domain で string を返す', () => {
  assert.equal(w(5, 0, 2), 'world:5,0,2');
  assert.equal(l(0, 1, 0), 'local:0,1,0');
  assert.equal(s(300, 200), 'screen:300,200');
  assert.equal(o(0.7, 0.85), 'ortho:0.7,0.85');
});

test('parseCoord: domain と values を返す', () => {
  const c = parseCoord('world:5,0,2');
  assert.equal(c.domain, 'world');
  assert.deepEqual(c.values, [5, 0, 2]);
});

test('parseCoord: 負数 / 小数 / 指数表記をサポート', () => {
  assert.deepEqual(parseCoord('world:-1.5,0,3.14').values, [-1.5, 0, 3.14]);
  assert.deepEqual(parseCoord('local:1e-3,2,0').values, [0.001, 2, 0]);
});

test('parseCoord: 形式不正で throw', () => {
  assert.throws(() => parseCoord('5,0,2'), /missing domain prefix/);
  assert.throws(() => parseCoord('world:abc,0,0'), /parse failed/);
  assert.throws(() => parseCoord(123), /must be string/);
});

test('requireDomain: 一致で values、不一致で throw', () => {
  assert.deepEqual(requireDomain('world:5,0,2', 'world'), [5, 0, 2]);
  assert.throws(() => requireDomain('screen:300,200', 'world'), /domain mismatch/);
});

// ============================================================
// behaviors — 個別の遷移要素
// ============================================================

test('tickAge: tick で age++', () => {
  const out = behaviors.tickAge({ age: 5 }, { kind: 'tick' });
  assert.equal(out.age, 6);
});

test('tickAge: age 未定義のとき 1 から始まる', () => {
  const out = behaviors.tickAge({}, { kind: 'tick' });
  assert.equal(out.age, 1);
});

test('pulseDecay: tick で pulse が減衰、0 で止まる', () => {
  assert.equal(behaviors.pulseDecay({ pulse: 1 }, { kind: 'tick' }).pulse, 0.97);
  assert.equal(behaviors.pulseDecay({ pulse: 0 }, { kind: 'tick' }).pulse, 0);
  assert.equal(behaviors.pulseDecay({ pulse: 0.01 }, { kind: 'tick' }).pulse, 0);
});

test('reverseRotOnClick: click で rotSpeed 反転', () => {
  assert.equal(behaviors.reverseRotOnClick({ rotSpeed: 0.01 }, { kind: 'click' }).rotSpeed, -0.01);
  assert.equal(behaviors.reverseRotOnClick({ rotSpeed: 0.01 }, { kind: 'tick' }).rotSpeed, 0.01);
});

test('recordClickPos: click で lastClickWorldPos を world tagged で記録', () => {
  const out = behaviors.recordClickPos({}, { kind: 'click', worldPos: 'world:1,2,3' });
  assert.equal(out.lastClickWorldPos, 'world:1,2,3');
});

test('recordPeerTarget: peer-clicked で targetWorldPos と lastSourceId を記録', () => {
  const out = behaviors.recordPeerTarget({}, { kind: 'peer-clicked', worldPos: 'world:5,0,2', sourceId: 'cube' });
  assert.equal(out.targetWorldPos, 'world:5,0,2');
  assert.equal(out.lastSourceId, 'cube');
});

test('lerpToTarget: tick で currentWorldPos が target に近づく(world tagged)', () => {
  const out = behaviors.lerpToTarget(
    { currentWorldPos: w(0, 0, 0), targetWorldPos: w(10, 0, 0), lerpRate: 0.1 },
    { kind: 'tick' },
  );
  const cur = requireDomain(out.currentWorldPos, 'world');
  assert.ok(cur[0] > 0 && cur[0] < 10);
  assert.equal(cur[0], 1);   // 0 + (10 - 0) * 0.1
});

test('lerpToTarget: target が null なら currentWorldPos 不変', () => {
  const out = behaviors.lerpToTarget(
    { currentWorldPos: w(1, 2, 3), targetWorldPos: null },
    { kind: 'tick' },
  );
  assert.equal(out.currentWorldPos, w(1, 2, 3));
});

// ============================================================
// compose — behavior 配列 → 単一 transition
// ============================================================

test('compose: behaviors を順次適用する', () => {
  const t = compose(['tickAge', 'pulseDecay']);
  const out = t({ age: 0, pulse: 1 }, { kind: 'tick' });
  assert.equal(out.age, 1);
  assert.equal(out.pulse, 0.97);
});

test('compose: 不明な behavior id で throw', () => {
  assert.throws(() => compose(['unknownBehavior']), /unknown behavior/);
});

// ============================================================
// 各 prefab の統合(flow.tick / flow.click を transitionForEvent で取り出す)
// ============================================================

const dataPrefabs = ['cube', 'boxGlb', 'komaHu', 'character'];

for (const key of dataPrefabs) {
  const p = prefabs[key];
  const tickT  = makeTickTransition(p);
  const clickT = makeClickTransition(p);

  test(`${p.id}: tick で age が +1 される`, () => {
    const out = tickT(p.state, { kind: 'tick' });
    assert.equal(out.age, (p.state.age ?? 0) + 1);
  });

  test(`${p.id}: click で rotSpeed が反転`, () => {
    const out = clickT(p.state, { kind: 'click', worldPos: w(1, 2, 3) });
    assert.equal(out.rotSpeed, -p.state.rotSpeed);
  });

  test(`${p.id}: click は pulse=1 と lastClickWorldPos(world tagged)を立てる`, () => {
    const wp = w(4.5, -1, 2.25);
    const out = clickT(p.state, { kind: 'click', worldPos: wp });
    assert.equal(out.pulse, 1);
    assert.equal(out.lastClickWorldPos, wp);
    assert.equal(parseCoord(out.lastClickWorldPos).domain, 'world');
  });

  test(`${p.id}: 不明 event は state 不変(flow.<unknown> 無し)`, () => {
    const t = transitionForEvent(p, { kind: 'mystery' });
    assert.deepEqual(t(p.state, { kind: 'mystery' }), p.state);
  });

  test(`${p.id}: pure(初期 state を mutate しない)`, () => {
    const before = JSON.stringify(p.state);
    tickT(p.state, { kind: 'tick' });
    clickT(p.state, { kind: 'click', worldPos: w(0, 0, 0) });
    assert.equal(JSON.stringify(p.state), before);
  });
}

// ============================================================
// pointer の inter-Block 通信(flow.peer-clicked + flow.tick)
// ============================================================

const pointer = prefabs.pointer;
const pointerPeer = makePeerTransition(pointer);
const pointerTick = makeTickTransition(pointer);

test('pointer: peer-clicked で targetWorldPos と lastSourceId 更新', () => {
  const out = pointerPeer(pointer.state, {
    kind: 'peer-clicked',
    worldPos: w(3.5, 0.5, -1),
    sourceId: 'cube',
  });
  assert.equal(out.targetWorldPos, w(3.5, 0.5, -1));
  assert.equal(out.lastSourceId, 'cube');
});

test('pointer: tick を繰り返すと target に収束する', () => {
  let st = { ...pointer.state, currentWorldPos: w(0, 0, 0), targetWorldPos: w(10, 0, 0) };
  for (let i = 0; i < 200; i++) st = pointerTick(st, { kind: 'tick' });
  const cur = requireDomain(st.currentWorldPos, 'world');
  assert.ok(Math.abs(cur[0] - 10) < 0.01, `converged: ${cur[0]}`);
});

test('pointer: 自分宛て click は flow に無いので state 不変', () => {
  const t = transitionForEvent(pointer, { kind: 'click' });
  const out = t(pointer.state, { kind: 'click', worldPos: w(99, 99, 99) });
  assert.deepEqual(out, pointer.state);
});

test('pointer: targetWorldPos が null のとき tick は currentWorldPos 不変', () => {
  const seeded = { ...pointer.state, currentWorldPos: w(1, 2, 3), targetWorldPos: null };
  const out = pointerTick(seeded, { kind: 'tick' });
  assert.equal(out.currentWorldPos, w(1, 2, 3));
});

// ============================================================
// A11 整合: Block 内の coord はすべて domain-tagged string
// ============================================================

test('A11: 全 prefab の transform.position が world domain', () => {
  for (const [, p] of Object.entries(prefabs)) {
    assert.equal(parseCoord(p.transform.position).domain, 'world',
      `${p.id}: position must be world-tagged`);
  }
});

test('A11: pointer.state の coord 系 field はすべて world tagged または null', () => {
  for (const k of ['currentWorldPos', 'targetWorldPos']) {
    const v = pointer.state[k];
    if (v != null) assert.equal(parseCoord(v).domain, 'world', `${k} must be world tagged`);
  }
});

// ============================================================
// voxel-canvas — A11 voxel grid editor
// ============================================================

const voxel = prefabs.voxelCanvas;
const voxelT = makeClickTransition(voxel);   // voxel canvas は flow.click のみ

test('voxel: addOrRemoveVoxelOnClick で cell-center snap して voxels に add', () => {
  const out = voxelT(voxel.state, { kind: 'click', worldPos: w(0.7, 0, 0.3) });
  // cellSize 0.5、cell-center snap:
  //   x=0.7 → cell [0.5, 1.0]、center 0.75
  //   z=0.3 → cell [0,   0.5]、center 0.25
  //   y=0   → 地面、cy = max(0.25, -0.25) = 0.25
  assert.equal(Object.keys(out.voxels).length, 1);
  const key = Object.keys(out.voxels)[0];
  assert.equal(parseCoord(key).domain, 'world');
  const [x, y, z] = parseCoord(key).values;
  assert.equal(x, 0.75);
  assert.equal(z, 0.25);
  assert.equal(y, 0.25);
});

test('voxel: 同じ位置への click は上書き(色変更)', () => {
  let s = voxel.state;
  s = voxelT(s, { kind: 'click', worldPos: w(0, 0, 0) });
  s = { ...s, currentColor: 'hex:00ff00' };
  s = voxelT(s, { kind: 'click', worldPos: w(0, 0, 0) });
  assert.equal(Object.keys(s.voxels).length, 1);
  const key = Object.keys(s.voxels)[0];
  assert.equal(s.voxels[key].color, 'hex:00ff00');
});

test('voxel: tool=remove で voxel を削除、無い場合は no-op', () => {
  let s = voxel.state;
  s = voxelT(s, { kind: 'click', worldPos: w(1, 0, 1) });
  assert.equal(Object.keys(s.voxels).length, 1);
  s = { ...s, tool: 'remove' };
  s = voxelT(s, { kind: 'click', worldPos: w(1, 0, 1) });
  assert.equal(Object.keys(s.voxels).length, 0);
  // 無い voxel を remove しても state 不変
  const before = JSON.stringify(s);
  s = voxelT(s, { kind: 'click', worldPos: w(99, 99, 99) });
  assert.equal(JSON.stringify(s), before);
});

test('voxel: lastEditWorldPos が world tagged で記録される', () => {
  const out = voxelT(voxel.state, { kind: 'click', worldPos: w(2, 0, 2) });
  assert.ok(out.lastEditWorldPos);
  assert.equal(parseCoord(out.lastEditWorldPos).domain, 'world');
});

test('voxel: voxels dict の key はすべて world tagged', () => {
  let s = voxel.state;
  for (const [x, z] of [[0,0],[0.5,0],[1,1],[-1,2]]) {
    s = voxelT(s, { kind: 'click', worldPos: w(x, 0, z) });
  }
  for (const key of Object.keys(s.voxels)) {
    assert.equal(parseCoord(key).domain, 'world');
  }
});

test('voxel: pure(初期 state を mutate しない)', () => {
  const before = JSON.stringify(voxel.state);
  voxelT(voxel.state, { kind: 'click', worldPos: w(0, 0, 0) });
  voxelT(voxel.state, { kind: 'click', worldPos: w(1, 0, 1) });
  assert.equal(JSON.stringify(voxel.state), before);
});

test('voxel: tick / 不明 event は state 不変(voxel.flow に対応無し)', () => {
  const tickT = makeTickTransition(voxel);
  const s1 = tickT(voxel.state, { kind: 'tick' });
  assert.deepEqual(s1, voxel.state);
  const mysteryT = transitionForEvent(voxel, { kind: 'mystery' });
  const s2 = mysteryT(voxel.state, { kind: 'mystery' });
  assert.deepEqual(s2, voxel.state);
});

test('voxel: 連続 add で voxel 数が増える', () => {
  let s = voxel.state;
  for (let i = 0; i < 10; i++) {
    s = voxelT(s, { kind: 'click', worldPos: w(i * 0.5, 0, 0) });
  }
  assert.equal(Object.keys(s.voxels).length, 10);
});

// ============================================================
// floor-shift: 配置基準面の上下シフト
// ============================================================

const voxelFloor = transitionForEvent(voxel, { kind: 'floor-shift' });

test('voxel: floor-shift +1 で floorIndex が +1', () => {
  const out = voxelFloor(voxel.state, { kind: 'floor-shift', delta: +1 });
  assert.equal(out.floorIndex, 1);
});

test('voxel: floor-shift -1 で 地面より下に行かない(0 で clamp)', () => {
  const out = voxelFloor(voxel.state, { kind: 'floor-shift', delta: -1 });
  assert.equal(out.floorIndex, 0);   // 既に 0、変わらない
  assert.deepEqual(out, voxel.state); // state も完全不変
});

test('voxel: floor-shift で連続シフト累積', () => {
  let s = voxel.state;
  for (let i = 0; i < 5; i++) s = voxelFloor(s, { kind: 'floor-shift', delta: +1 });
  assert.equal(s.floorIndex, 5);
  for (let i = 0; i < 3; i++) s = voxelFloor(s, { kind: 'floor-shift', delta: -1 });
  assert.equal(s.floorIndex, 2);
});

test('voxel: floor-shift は pure(初期 state を mutate しない)', () => {
  const before = JSON.stringify(voxel.state);
  voxelFloor(voxel.state, { kind: 'floor-shift', delta: +1 });
  voxelFloor(voxel.state, { kind: 'floor-shift', delta: -1 });
  assert.equal(JSON.stringify(voxel.state), before);
});

// ============================================================
// flow object 構造 — heartbeat が読む LLM-friendly な event → behavior 列
// ============================================================

test('flow: 全 prefab に flow object が定義されている', () => {
  for (const [, p] of Object.entries(prefabs)) {
    assert.ok(p.flow && typeof p.flow === 'object', `${p.id}: flow missing`);
  }
});

test('flow: 全 entry の値は behavior id 配列で、すべて behaviors dict に存在する', () => {
  for (const [, p] of Object.entries(prefabs)) {
    for (const [eventKind, ids] of Object.entries(p.flow)) {
      if (eventKind === 'scheduled') continue;   // future
      assert.ok(Array.isArray(ids), `${p.id}.flow.${eventKind} must be array`);
      for (const id of ids) {
        assert.ok(behaviors[id], `${p.id}.flow.${eventKind}: unknown behavior "${id}"`);
      }
    }
  }
});

test('transitionForEvent: 該当 flow があれば behaviors を順次適用、無ければ no-op', () => {
  // voxel canvas の click → addOrRemoveVoxelOnClick が走る
  const click = transitionForEvent(prefabs.voxelCanvas, { kind: 'click' });
  const out = click(prefabs.voxelCanvas.state, { kind: 'click', worldPos: w(0, 0, 0) });
  assert.equal(Object.keys(out.voxels).length, 1);

  // voxel canvas に flow.tick は無い → no-op
  const tickT = transitionForEvent(prefabs.voxelCanvas, { kind: 'tick' });
  assert.deepEqual(tickT(prefabs.voxelCanvas.state, { kind: 'tick' }), prefabs.voxelCanvas.state);
});

// ============================================================
// Shadow_for_Flow: behavior 順序非依存性(直交 field なら並べ替え自由)
// ============================================================

test('Shadow_for_Flow: tick の behaviors を逆順にしても結果不変(age/pulse 直交)', () => {
  const seed = { age: 5, pulse: 0.5, pulseDecay: 0.03 };
  const t1 = compose(['tickAge', 'pulseDecay']);
  const t2 = compose(['pulseDecay', 'tickAge']);
  const out1 = t1(seed, { kind: 'tick' });
  const out2 = t2(seed, { kind: 'tick' });
  assert.deepEqual(out1, out2);
  assert.equal(out1.age, 6);
  assert.equal(out1.pulse, 0.47);
});

test('Shadow_for_Flow: click の behaviors を任意順にしても直交 field なら同結果', () => {
  const seed = { rotSpeed: 0.01, pulse: 0, lastClickWorldPos: null };
  const ev = { kind: 'click', worldPos: 'world:1,2,3' };
  const t1 = compose(['reverseRotOnClick', 'pulseOnClick', 'recordClickPos']);
  const t2 = compose(['recordClickPos', 'reverseRotOnClick', 'pulseOnClick']);
  const t3 = compose(['pulseOnClick', 'recordClickPos', 'reverseRotOnClick']);
  const o1 = t1(seed, ev);
  const o2 = t2(seed, ev);
  const o3 = t3(seed, ev);
  assert.deepEqual(o1, o2);
  assert.deepEqual(o2, o3);
  assert.equal(o1.rotSpeed, -0.01);
  assert.equal(o1.pulse, 1);
  assert.equal(o1.lastClickWorldPos, 'world:1,2,3');
});

test('Shadow_for_Flow: 各 behavior は shadow を読む(reduce じゃない)', () => {
  // tickAge は shadow.age を読んで +1、pulseDecay は shadow.pulse を読む。
  // reduce 形だと behavior の結果が次に渡るが、shadow 形は元 shadow を全員読む。
  // 同じ field を複数 behavior が触らない限り、reduce / shadow は同結果。
  // 触る場合は last-write-wins で配列順依存に戻るので、ここは最低限の独立性のみ確認。
  const seed = { age: 0, pulse: 0 };
  const out = compose(['tickAge', 'pulseDecay'])(seed, { kind: 'tick' });
  assert.equal(out.age, 1);
  assert.equal(out.pulse, 0);
  // shadow が freeze されてても問題なく動くこと
  Object.freeze(seed);
  const out2 = compose(['tickAge', 'pulseDecay'])(seed, { kind: 'tick' });
  assert.equal(out2.age, 1);
});
