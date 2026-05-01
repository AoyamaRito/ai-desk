// node --test 3dplus/tests/animation.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const anim = require('../animation.js');

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// === evaluateScalar ===
test('evaluateScalar: 区間内の線形補間', () => {
  const kf = [{ time: 0, value: 0 }, { time: 1, value: 10 }];
  assert.ok(close(anim.evaluateScalar(kf, 0.5), 5));
  assert.ok(close(anim.evaluateScalar(kf, 0.25), 2.5));
});

test('evaluateScalar: クランプ — t < 先頭は先頭値', () => {
  const kf = [{ time: 1, value: 5 }, { time: 2, value: 10 }];
  assert.ok(close(anim.evaluateScalar(kf, 0), 5));
});

test('evaluateScalar: クランプ — t > 末尾は末尾値', () => {
  const kf = [{ time: 0, value: 0 }, { time: 1, value: 100 }];
  assert.ok(close(anim.evaluateScalar(kf, 99), 100));
});

test('evaluateScalar: キーフレーム3本の中間区間', () => {
  const kf = [{ time: 0, value: 0 }, { time: 2, value: 20 }, { time: 4, value: 0 }];
  assert.ok(close(anim.evaluateScalar(kf, 1), 10));  // 前半の中間
  assert.ok(close(anim.evaluateScalar(kf, 3), 10));  // 後半の中間
});

// === evaluateVec3 ===
test('evaluateVec3: 位置の線形補間', () => {
  const kf = [
    { time: 0, value: [0, 0, 0] },
    { time: 1, value: [10, 20, 30] }
  ];
  const v = anim.evaluateVec3(kf, 0.5);
  assert.ok(close(v[0], 5));
  assert.ok(close(v[1], 10));
  assert.ok(close(v[2], 15));
});

test('evaluateVec3: クランプ (t=0)', () => {
  const kf = [{ time: 1, value: [1,2,3] }, { time: 2, value: [4,5,6] }];
  const v = anim.evaluateVec3(kf, 0);
  assert.deepStrictEqual(v, [1, 2, 3]);
});

// === evaluateQuat ===
test('evaluateQuat: t=0 は最初のクォータニオン', () => {
  const q0 = [0, 0, 0, 1]; // identity
  const q1 = [0, 1, 0, 0]; // 180deg around Y
  const kf = [{ time: 0, value: q0 }, { time: 1, value: q1 }];
  const v = anim.evaluateQuat(kf, 0);
  assert.ok(close(v[3], 1, 1e-9)); // w ≈ 1
});

test('evaluateQuat: t=1 は最後のクォータニオン', () => {
  const q0 = [0, 0, 0, 1];
  const q1 = [0, 1, 0, 0];
  const kf = [{ time: 0, value: q0 }, { time: 1, value: q1 }];
  const v = anim.evaluateQuat(kf, 1);
  assert.ok(close(v[1], 1, 1e-9)); // y ≈ 1
  assert.ok(close(v[3], 0, 1e-9)); // w ≈ 0
});

test('evaluateQuat: t=0.5 は 90deg 回転（slerp の中間）', () => {
  const q0 = [0, 0, 0, 1];
  const q1 = [0, 1, 0, 0]; // 180deg around Y
  const kf = [{ time: 0, value: q0 }, { time: 1, value: q1 }];
  const v = anim.evaluateQuat(kf, 0.5);
  // slerp の中間は 90deg → |y| = |w| = 1/√2
  const expected = Math.SQRT1_2;
  assert.ok(close(Math.abs(v[1]), expected, 1e-6));
  assert.ok(close(Math.abs(v[3]), expected, 1e-6));
  // 正規化されているはず
  const len = Math.hypot(v[0], v[1], v[2], v[3]);
  assert.ok(close(len, 1, 1e-9));
});

test('evaluateQuat: 空キーフレームは identity を返す', () => {
  const v = anim.evaluateQuat([], 0.5);
  assert.deepStrictEqual(v, [0, 0, 0, 1]);
});
