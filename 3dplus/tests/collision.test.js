const collision = require('../collision.js');
const test = require('node:test');
const assert = require('node:assert');

test('AABB - computeAABB', () => {
  const vertices = [
    [1, 2, 3],
    [-1, -2, -3],
    [5, 0, 0]
  ];
  const aabb = collision.computeAABB(vertices);
  assert.deepStrictEqual(aabb.min, [-1, -2, -3]);
  assert.deepStrictEqual(aabb.max, [5, 2, 3]);
});

test('AABB - intersectAABB', () => {
  const a = { min: [0, 0, 0], max: [2, 2, 2] };
  const b = { min: [1, 1, 1], max: [3, 3, 3] }; // 重なっている
  const c = { min: [3, 3, 3], max: [5, 5, 5] }; // 重なっていない

  assert.strictEqual(collision.intersectAABB(a, b), true);
  assert.strictEqual(collision.intersectAABB(a, c), false);
});

test('Sphere - computeBoundingSphere', () => {
  const vertices = [
    [2, 0, 0],
    [0, -2, 0],
    [0, 0, 2]
  ];
  const center = [0, 0, 0];
  const sphere = collision.computeBoundingSphere(vertices, center);
  assert.deepStrictEqual(sphere.center, [0, 0, 0]);
  assert.strictEqual(sphere.radius, 2);
});

test('Sphere - intersectSphere', () => {
  const a = { center: [0, 0, 0], radius: 2 };
  const b = { center: [3, 0, 0], radius: 2 }; // 重なっている (距離3 < 半径和4)
  const c = { center: [5, 0, 0], radius: 2 }; // 重なっていない (距離5 > 半径和4)

  assert.strictEqual(collision.intersectSphere(a, b), true);
  assert.strictEqual(collision.intersectSphere(a, c), false);
});

test('Sphere vs AABB - intersectSphereAABB', () => {
  const aabb = { min: [0, 0, 0], max: [2, 2, 2] };
  const sphere1 = { center: [1, 1, 1], radius: 0.5 }; // AABBに完全に含まれる
  const sphere2 = { center: [3, 1, 1], radius: 1.5 }; // AABBの右面と交差
  const sphere3 = { center: [4, 1, 1], radius: 1.0 }; // 交差しない

  assert.strictEqual(collision.intersectSphereAABB(sphere1, aabb), true);
  assert.strictEqual(collision.intersectSphereAABB(sphere2, aabb), true);
  assert.strictEqual(collision.intersectSphereAABB(sphere3, aabb), false);
});

test('Ray vs AABB - intersectRayAABB', () => {
  const aabb = { min: [-1, -1, -1], max: [1, 1, 1] };
  
  // AABBを貫通するレイ
  const ray1 = { origin: [0, 0, 5], direction: [0, 0, -1] };
  const res1 = collision.intersectRayAABB(ray1, aabb);
  assert.ok(res1 !== null);
  assert.strictEqual(res1.t, 4); // [0,0,1] で交差
  assert.deepStrictEqual(res1.point, [0, 0, 1]);

  // AABBを外れるレイ
  const ray2 = { origin: [2, 0, 5], direction: [0, 0, -1] };
  const res2 = collision.intersectRayAABB(ray2, aabb);
  assert.strictEqual(res2, null);

  // AABBの内部から発射するレイ
  const ray3 = { origin: [0, 0, 0], direction: [0, 1, 0] };
  const res3 = collision.intersectRayAABB(ray3, aabb);
  assert.ok(res3 !== null);
  assert.strictEqual(res3.t, 1); // 内側から[0,1,0]へ向かい、Y=1の面で抜ける
  assert.deepStrictEqual(res3.point, [0, 1, 0]);
});

test('Ray vs Triangle - intersectRayTriangle', () => {
  // XY平面上の三角形 (Z=0)
  const v0 = [0, 1, 0];
  const v1 = [-1, -1, 0];
  const v2 = [1, -1, 0];

  // 三角形の中心を貫くレイ
  const ray1 = { origin: [0, 0, 5], direction: [0, 0, -1] };
  const res1 = collision.intersectRayTriangle(ray1, v0, v1, v2);
  assert.ok(res1 !== null);
  assert.strictEqual(res1.t, 5);
  assert.deepStrictEqual(res1.point, [0, 0, 0]);

  // 三角形の外をかすめるレイ
  const ray2 = { origin: [2, 0, 5], direction: [0, 0, -1] };
  const res2 = collision.intersectRayTriangle(ray2, v0, v1, v2);
  assert.strictEqual(res2, null);

  // レイが三角形と平行
  const ray3 = { origin: [0, 0, 0], direction: [1, 0, 0] };
  const res3 = collision.intersectRayTriangle(ray3, v0, v1, v2);
  assert.strictEqual(res3, null);

  // 三角形がカメラの後ろにある
  const ray4 = { origin: [0, 0, -5], direction: [0, 0, -1] };
  const res4 = collision.intersectRayTriangle(ray4, v0, v1, v2);
  assert.strictEqual(res4, null);
});
