const ik = require('../ik.js');
const test = require('node:test');
const assert = require('node:assert');

test('2-Bone IK: basic reach', () => {
  const root = [0, 0, 0];
  const target = [0, 2, 0]; // 真上に2ユニット
  const len1 = 1.0;
  const len2 = 1.0;
  const pole = [0, 0, 1]; // Z方向に膝を出そうとする（が、伸び切っているので関係ないはず）
  
  const res = ik.solveTwoBoneIK(root, target, len1, len2, pole);
  
  assert.strictEqual(res.ok, true);
  // 全長2に対してターゲット2なので、膝はちょうど中間 [0, 1, 0] になるはず
  // 浮動小数点の誤差を考慮して 1e-5 でチェック
  assert.ok(Math.abs(res.joint[0] - 0) < 1e-5, `Joint X error: ${res.joint[0]}`);
  assert.ok(Math.abs(res.joint[1] - 1) < 1e-5, `Joint Y error: ${res.joint[1]}`);
  assert.ok(Math.abs(res.joint[2] - 0) < 1e-5, `Joint Z error: ${res.joint[2]}`);
  assert.ok(Math.abs(res.end[0] - 0) < 1e-5);
  assert.ok(Math.abs(res.end[1] - 2) < 1e-5);
});

test('2-Bone IK: bending (knee)', () => {
  const root = [0, 0, 0];
  const target = [0, 1.41421356, 0]; // ターゲットが少し近い (sqrt(2))
  const len1 = 1.0;
  const len2 = 1.0;
  const pole = [1, 0, 0]; // 右側に膝を出したい
  
  const res = ik.solveTwoBoneIK(root, target, len1, len2, pole);
  
  assert.strictEqual(res.ok, true);
  // 直角二等辺三角形になるはずなので、膝 (Joint) は [0.707, 0.707, 0] 付近
  assert.ok(Math.abs(res.joint[0] - 0.7071) < 1e-3);
  assert.ok(Math.abs(res.joint[1] - 0.7071) < 1e-3);
});

test('2-Bone IK: out of reach (too far)', () => {
  const root = [0, 0, 0];
  const target = [0, 5, 0]; // 届かない
  const len1 = 1.0;
  const len2 = 1.0;
  const pole = [1, 1, 0];
  
  const res = ik.solveTwoBoneIK(root, target, len1, len2, pole);
  
  assert.strictEqual(res.ok, false);
  // 最大リーチの [0, 2, 0] まで伸びる
  assert.ok(Math.abs(res.end[1] - 2) < 1e-5);
});

test('2-Bone IK: out of reach (too close)', () => {
  const root = [0, 0, 0];
  const target = [0, 0.1, 0]; // 近すぎる（足が短すぎる）
  const len1 = 2.0;
  const len2 = 1.0;
  const pole = [1, 1, 0];
  
  const res = ik.solveTwoBoneIK(root, target, len1, len2, pole);
  
  assert.strictEqual(res.ok, false);
  // 最小リーチ (2-1=1.0) までしか縮まない
  assert.ok(Math.abs(res.end[1] - 1.0) < 1e-5);
});
