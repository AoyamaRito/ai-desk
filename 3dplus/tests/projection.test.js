// [ai_s_emblem:#high#logic Cpu3D-Tests]
// node --test で実行する。Zero-Dep。
//   node --test /Users/AoyamaRito/PJs/ai-desk/3dplus/tests/projection.test.js
//
// 思想: 行列・階層・3Dplus軸（時刻/α/可視）を「断定可能な数値」として検証する。
//      数値が正しいことが言えるということは、GPUと突合する資格があるということ。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectScene, _math } = require('../cpu3d.js');

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// シーンのデフォルト土台（テストごとに必要部分だけ上書きする）
function baseScene(overrides) {
  return Object.assign({
    objects: [],
    camera: { position:[0,0,0], rotation:[0,0,0], fov: Math.PI/2, aspect: 1, near: 0.1, far: 100 },
    viewport: { width: 800, height: 600 }
  }, overrides);
}

const T0 = { position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] };

// === 1. 同次変換の素直さ ===
test('identity scene: 原点を視線方向 -Z=-5 に置けば screen 中央 (400,300)', () => {
  const r = projectScene(baseScene({
    objects: [{ id: 'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.screen[0], 400, 1e-6));
  assert.ok(close(v.screen[1], 300, 1e-6));
});

test('translation: object.position が world に乗る', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[0,0,0]],
      transform: { position:[2,3,-5], rotation:[0,0,0], scale:[1,1,1] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 2));
  assert.ok(close(v.world[1], 3));
  assert.ok(close(v.world[2], -5));
});

test('rotationY 90deg: (1,0,0) → (0,0,-1)', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,0,0]],
      transform: { position:[0,0,0], rotation:[0, Math.PI/2, 0], scale:[1,1,1] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 0));
  assert.ok(close(v.world[1], 0));
  assert.ok(close(v.world[2], -1));
});

test('scale: (1,1,1)に scale [2,3,4] が乗る', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,1,1]],
      transform: { position:[0,0,0], rotation:[0,0,0], scale:[2,3,4] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 2));
  assert.ok(close(v.world[1], 3));
  assert.ok(close(v.world[2], 4));
});

// === 2. 親子階層 (Bible §4 Level-based Projection) ===
test('parent-child: 子は親の変換を継承する', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'p', vertices: [], transform: { position:[5,0,0], rotation:[0,0,0], scale:[1,1,1] }, parent: null },
      { id:'c', vertices: [[0,0,0]], transform: { position:[0,1,0], rotation:[0,0,0], scale:[1,1,1] }, parent: 'p' }
    ]
  }));
  const v = r.objects[1].vertices[0];
  assert.ok(close(v.world[0], 5));
  assert.ok(close(v.world[1], 1));
  assert.ok(close(v.world[2], 0));
});

test('parent-child: 親が回転すると子の位置も回る', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'p', vertices: [], transform: { position:[0,0,0], rotation:[0, Math.PI/2, 0], scale:[1,1,1] }, parent: null },
      { id:'c', vertices: [[0,0,0]], transform: { position:[1,0,0], rotation:[0,0,0], scale:[1,1,1] }, parent: 'p' }
    ]
  }));
  // 親がY軸90度回転している状態で、子が親ローカルで(1,0,0) → ワールド(0,0,-1)
  const v = r.objects[1].vertices[0];
  assert.ok(close(v.world[0], 0));
  assert.ok(close(v.world[1], 0));
  assert.ok(close(v.world[2], -1));
});

test('parent-child: 親が動くと子も動く（武器を持つキャラのテスト相当）', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'hand', vertices: [], transform: { position:[10,0,-5], rotation:[0,0,0], scale:[1,1,1] }, parent: null },
      { id:'sword', vertices: [[0,1,0]], transform: { position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }, parent: 'hand' }
    ]
  }));
  const v = r.objects[1].vertices[0];
  assert.ok(close(v.world[0], 10));
  assert.ok(close(v.world[1], 1));
  assert.ok(close(v.world[2], -5));
});

// === 3. 3Dplus軸（時刻・α・可視） ===
test('alpha projection: child.alpha = parent.alpha × self.alpha', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'p', vertices: [], transform: T0, parent: null, alpha: 0.5 },
      { id:'c', vertices: [], transform: T0, parent: 'p', alpha: 0.4 }
    ]
  }));
  assert.ok(close(r.objects[0].effective.alpha, 0.5));
  assert.ok(close(r.objects[1].effective.alpha, 0.2));
});

test('visibility projection: 親が不可視なら子も不可視（AND連鎖）', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'p', vertices: [], transform: T0, parent: null, visible: false },
      { id:'c', vertices: [], transform: T0, parent: 'p', visible: true }
    ]
  }));
  assert.equal(r.objects[1].effective.visible, false);
});

test('visibility projection: 親が可視・子が不可視なら子のみ不可視', () => {
  const r = projectScene(baseScene({
    objects: [
      { id:'p', vertices: [], transform: T0, parent: null, visible: true },
      { id:'c', vertices: [], transform: T0, parent: 'p', visible: false }
    ]
  }));
  assert.equal(r.objects[0].effective.visible, true);
  assert.equal(r.objects[1].effective.visible, false);
});

test('time projection: world時刻 = baseTime + 親offset累積 + 自offset', () => {
  const r = projectScene(baseScene({
    worldTime: 10,
    objects: [
      { id:'p', vertices: [], transform: T0, parent: null, time: { offset: 2 } },
      { id:'c', vertices: [], transform: T0, parent: 'p', time: { offset: 0.5 } }
    ]
  }));
  assert.ok(close(r.objects[0].effective.time, 12));
  assert.ok(close(r.objects[1].effective.time, 12.5));
});

// === 4. 投影パイプライン段階別 ===
test('NDC: 視錐台中心の点は (0,0)', () => {
  const r = projectScene(baseScene({
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.ndc[0], 0, 1e-9));
  assert.ok(close(v.ndc[1], 0, 1e-9));
});

test('clip.w: -view.z に等しい（OpenGL透視投影の規約）', () => {
  const r = projectScene(baseScene({
    objects: [{ id:'p', vertices: [[0,0,-7]], transform: T0, parent: null }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.clip[3], 7));
});

// === 5. 視錐台カリング（Visibility ProjectionとGPUの突合に使う本命） ===
test('frustum: カメラ背後の頂点は inFrustum=false', () => {
  const r = projectScene(baseScene({
    objects: [{ id:'p', vertices: [[0,0,5]], transform: T0, parent: null }]
  }));
  assert.equal(r.objects[0].vertices[0].inFrustum, false);
});

test('frustum: 視錐台内の頂点は inFrustum=true', () => {
  const r = projectScene(baseScene({
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  }));
  assert.equal(r.objects[0].vertices[0].inFrustum, true);
});

test('frustum: far平面より遠い頂点は inFrustum=false', () => {
  const r = projectScene(baseScene({
    objects: [{ id:'p', vertices: [[0,0,-200]], transform: T0, parent: null }]
  }));
  assert.equal(r.objects[0].vertices[0].inFrustum, false);
});

// === 6. 矛盾検出（contradictionは即座に発覚させる） ===
test('cycle hierarchy: 循環参照は throw', () => {
  assert.throws(() => projectScene(baseScene({
    objects: [
      { id:'a', vertices: [], transform: T0, parent: 'b' },
      { id:'b', vertices: [], transform: T0, parent: 'a' }
    ]
  })));
});

test('unknown parent id: throw', () => {
  assert.throws(() => projectScene(baseScene({
    objects: [
      { id:'a', vertices: [], transform: T0, parent: 'nonexistent' }
    ]
  })));
});

// === 7. 行列基礎の単独検算（鉱脈採掘の入口） ===
test('multiply: identity * identity = identity', () => {
  const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const out = _math.multiply(I, I);
  for (let i = 0; i < 16; i++) assert.equal(out[i], I[i]);
});

test('multiply: T(1,2,3) * T(10,20,30) = T(11,22,33)', () => {
  const out = _math.multiply(_math.translation(1,2,3), _math.translation(10,20,30));
  // column-major: 平行移動成分は m[12], m[13], m[14]
  assert.ok(close(out[12], 11));
  assert.ok(close(out[13], 22));
  assert.ok(close(out[14], 33));
});

test('rotationY(π) * (1,0,0,1) = (-1,0,0,1)', () => {
  const m = _math.rotationY(Math.PI);
  const out = _math.transformVec4(m, [1,0,0,1]);
  assert.ok(close(out[0], -1, 1e-9));
  assert.ok(close(out[1], 0, 1e-9));
  assert.ok(close(out[2], 0, 1e-9));
});
// [/ai_s_emblem: Cpu3D-Tests]
