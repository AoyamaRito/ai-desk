// transition.test.js — prefab の transition() を Node 単体で検証。
//
// 二段構成の Node 側:
//   - prefab triple の state + transition は pure function → Node でテスト可能
//   - render + input は adapter layer → ブラウザ + ai-eyes に任せる
//
// Zero-Dep(Node 標準のみ):  node:test + node:assert/strict
// 実行:  node --test 3d-prefab/test/transition.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as cube from '../assets/cube.asset.js';
import * as boxGlb from '../assets/box-glb.asset.js';

const prefabs = [
  { name: 'cube', mod: cube },
  { name: 'box-glb', mod: boxGlb },
];

for (const { name, mod } of prefabs) {
  test(`${name}: tick で age が +1 される`, () => {
    const out = mod.transition(mod.state, { kind: 'tick' });
    assert.equal(out.age, mod.state.age + 1);
  });

  test(`${name}: tick は pulse を減衰させる(0 までで止まる)`, () => {
    const s1 = mod.transition({ ...mod.state, pulse: 1 }, { kind: 'tick' });
    assert.ok(s1.pulse < 1, 'pulse should decay');
    assert.ok(s1.pulse >= 0, 'pulse should not go negative');

    const s0 = mod.transition({ ...mod.state, pulse: 0 }, { kind: 'tick' });
    assert.equal(s0.pulse, 0, 'pulse=0 stays 0');
  });

  test(`${name}: click で rotSpeed が反転する`, () => {
    const out = mod.transition(mod.state, { kind: 'click', worldPos: [1, 2, 3] });
    assert.equal(out.rotSpeed, -mod.state.rotSpeed);
  });

  test(`${name}: click は pulse=1 と lastClickWorldPos を立てる`, () => {
    const wp = [4.5, -1, 2.25];
    const out = mod.transition(mod.state, { kind: 'click', worldPos: wp });
    assert.equal(out.pulse, 1);
    assert.deepEqual(out.lastClickWorldPos, wp);
  });

  test(`${name}: 知らない event は state を変えない`, () => {
    const out = mod.transition(mod.state, { kind: 'unknown' });
    assert.deepEqual(out, mod.state);
  });

  test(`${name}: transition は pure(入力 state を mutate しない)`, () => {
    const before = { ...mod.state };
    const beforeJSON = JSON.stringify(mod.state);
    mod.transition(mod.state, { kind: 'tick' });
    mod.transition(mod.state, { kind: 'click', worldPos: [0, 0, 0] });
    assert.equal(JSON.stringify(mod.state), beforeJSON, 'initial state object not mutated');
    // 浅い構造の他フィールドも確認
    assert.equal(mod.state.age, before.age);
    assert.equal(mod.state.rotSpeed, before.rotSpeed);
  });

  test(`${name}: 二回 click で rotSpeed が元に戻る(可逆性)`, () => {
    const s1 = mod.transition(mod.state, { kind: 'click', worldPos: [0, 0, 0] });
    const s2 = mod.transition(s1, { kind: 'click', worldPos: [1, 1, 1] });
    assert.equal(s2.rotSpeed, mod.state.rotSpeed);
  });
}

test('A10 整合: state.lastClickWorldPos は world coord(配列、3 要素)', () => {
  const out = cube.transition(cube.state, { kind: 'click', worldPos: [5, 0, -2] });
  assert.ok(Array.isArray(out.lastClickWorldPos));
  assert.equal(out.lastClickWorldPos.length, 3);
  // screen 系 field が混入していないことを軽く確認
  assert.equal(out.lastClickWorldPos.clientX, undefined);
  assert.equal(out.lastClickWorldPos.pageX, undefined);
});
