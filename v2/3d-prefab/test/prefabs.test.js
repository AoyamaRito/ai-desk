// prefabs.test.js — Block 層の単体テスト(Node のみ、Zero-Dep)。
//
// behaviors / compose / makeTransition / coord helpers / inter-Block 通信 を一括検証。
// 旧 transition.test.js + inter-block.test.js を集約。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prefabs, behaviors, compose, makeTransition } from '../prefabs.js';
import { w, l, s, o, parseCoord, requireDomain } from '../coord.js';

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
// 各 prefab の統合(makeTransition)
// ============================================================

const dataPrefabs = ['cube', 'boxGlb', 'komaHu', 'character'];

for (const key of dataPrefabs) {
  const p = prefabs[key];
  const t = makeTransition(p);

  test(`${p.id}: tick で age が +1 される`, () => {
    const out = t(p.state, { kind: 'tick' });
    assert.equal(out.age, (p.state.age ?? 0) + 1);
  });

  test(`${p.id}: click で rotSpeed が反転`, () => {
    const out = t(p.state, { kind: 'click', worldPos: w(1, 2, 3) });
    assert.equal(out.rotSpeed, -p.state.rotSpeed);
  });

  test(`${p.id}: click は pulse=1 と lastClickWorldPos(world tagged)を立てる`, () => {
    const wp = w(4.5, -1, 2.25);
    const out = t(p.state, { kind: 'click', worldPos: wp });
    assert.equal(out.pulse, 1);
    assert.equal(out.lastClickWorldPos, wp);
    // domain check
    assert.equal(parseCoord(out.lastClickWorldPos).domain, 'world');
  });

  test(`${p.id}: 不明 event は state 不変`, () => {
    assert.deepEqual(t(p.state, { kind: 'mystery' }), p.state);
  });

  test(`${p.id}: pure(初期 state を mutate しない)`, () => {
    const before = JSON.stringify(p.state);
    t(p.state, { kind: 'tick' });
    t(p.state, { kind: 'click', worldPos: w(0, 0, 0) });
    assert.equal(JSON.stringify(p.state), before);
  });
}

// ============================================================
// pointer の inter-Block 通信
// ============================================================

const pointer = prefabs.pointer;
const pointerT = makeTransition(pointer);

test('pointer: peer-clicked で targetWorldPos と lastSourceId 更新', () => {
  const out = pointerT(pointer.state, {
    kind: 'peer-clicked',
    worldPos: w(3.5, 0.5, -1),
    sourceId: 'cube',
  });
  assert.equal(out.targetWorldPos, w(3.5, 0.5, -1));
  assert.equal(out.lastSourceId, 'cube');
});

test('pointer: tick を繰り返すと target に収束する', () => {
  let st = { ...pointer.state, currentWorldPos: w(0, 0, 0), targetWorldPos: w(10, 0, 0) };
  for (let i = 0; i < 200; i++) st = pointerT(st, { kind: 'tick' });
  const cur = requireDomain(st.currentWorldPos, 'world');
  assert.ok(Math.abs(cur[0] - 10) < 0.01, `converged: ${cur[0]}`);
});

test('pointer: 自分宛て click は handler 無いので state 不変', () => {
  const out = pointerT(pointer.state, { kind: 'click', worldPos: w(99, 99, 99) });
  assert.deepEqual(out, pointer.state);
});

test('pointer: targetWorldPos が null のとき tick は currentWorldPos 不変', () => {
  const seeded = { ...pointer.state, currentWorldPos: w(1, 2, 3), targetWorldPos: null };
  const out = pointerT(seeded, { kind: 'tick' });
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
