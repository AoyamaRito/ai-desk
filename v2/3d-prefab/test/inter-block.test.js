// inter-block.test.js — inter-Block 通信(peer-clicked)の pure 検証。
//
// pointer prefab は他 prefab の click を peer-clicked event 経由で受信、
// targetWorldPos に lerp する。これらの遷移はすべて pure function、Node 単独で検証可能。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as pointer from '../assets/pointer.asset.js';

test('pointer: peer-clicked で targetWorldPos と lastSourceId が更新される', () => {
  const out = pointer.transition(pointer.state, {
    kind: 'peer-clicked',
    worldPos: [3.5, 0.5, -1],
    sourceId: 'cube',
  });
  assert.deepEqual(out.targetWorldPos, [3.5, 0.5, -1]);
  assert.equal(out.lastSourceId, 'cube');
});

test('pointer: tick で targetWorldPos に lerp する', () => {
  const seeded = {
    ...pointer.state,
    currentWorldPos: [0, 0, 0],
    targetWorldPos: [10, 0, 0],
  };
  const s1 = pointer.transition(seeded, { kind: 'tick' });
  assert.ok(s1.currentWorldPos[0] > 0, 'lerp moves toward target');
  assert.ok(s1.currentWorldPos[0] < 10, 'lerp does not jump to target');
  assert.equal(s1.age, seeded.age + 1);
});

test('pointer: targetWorldPos が null のとき tick は currentWorldPos を変えない', () => {
  const seeded = { ...pointer.state, currentWorldPos: [1, 2, 3], targetWorldPos: null };
  const s1 = pointer.transition(seeded, { kind: 'tick' });
  assert.deepEqual(s1.currentWorldPos, [1, 2, 3]);
});

test('pointer: tick を繰り返すと target に収束する(1 / lerpRate に近い回数)', () => {
  let s = { ...pointer.state, currentWorldPos: [0, 0, 0], targetWorldPos: [10, 0, 0] };
  for (let i = 0; i < 200; i++) s = pointer.transition(s, { kind: 'tick' });
  assert.ok(Math.abs(s.currentWorldPos[0] - 10) < 0.01, `converged: ${s.currentWorldPos[0]}`);
});

test('pointer: 自分宛て click event は無視される(passive observer)', () => {
  // pointer は 'click' kind を transition で扱わない(=peer-clicked のみ反応)
  const out = pointer.transition(pointer.state, {
    kind: 'click',
    worldPos: [99, 99, 99],
  });
  // click は handler に存在しないので state 不変
  assert.deepEqual(out, pointer.state);
});

test('pointer: peer-clicked.worldPos も world coord(3 要素配列、screen 系混入なし)', () => {
  const out = pointer.transition(pointer.state, {
    kind: 'peer-clicked',
    worldPos: [1.2, 3.4, 5.6],
    sourceId: 'box-glb',
  });
  assert.ok(Array.isArray(out.targetWorldPos));
  assert.equal(out.targetWorldPos.length, 3);
  // screen-coord 混入チェック
  assert.equal(out.targetWorldPos.clientX, undefined);
  assert.equal(out.targetWorldPos.pageY, undefined);
});

test('pointer: pure(初期 state を mutate しない)', () => {
  const beforeJSON = JSON.stringify(pointer.state);
  pointer.transition(pointer.state, { kind: 'peer-clicked', worldPos: [1,2,3], sourceId: 'x' });
  pointer.transition(pointer.state, { kind: 'tick' });
  assert.equal(JSON.stringify(pointer.state), beforeJSON);
});
