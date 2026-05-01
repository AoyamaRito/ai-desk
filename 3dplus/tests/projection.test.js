// [ai_s_emblem:#high#logic Cpu3D-Tests]
// node --test で実行する。Zero-Dep。
//   node --test /Users/AoyamaRito/PJs/ai-desk/3dplus/tests/projection.test.js
//
// 思想: 行列・階層・3Dplus軸（時刻/α/可視）を「断定可能な数値」として検証する。
//      数値が正しいことが言えるということは、GPUと突合する資格があるということ。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectScene, assert_projectScene, _math } = require('../cpu3d.js');

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

// === 8. クォータニオン (Phase 1) ===
test('quatIdentity: (1,0,0) は不変', () => {
  const q = _math.quatIdentity();
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,0,0]],
      transform: { position:[0,0,0], rotation:[0,0,0], quaternion: q, scale:[1,1,1] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 1));
  assert.ok(close(v.world[1], 0));
  assert.ok(close(v.world[2], 0));
});

test('quatFromAxisAngle: Y軸π/2 で (1,0,0) → (0,0,-1)', () => {
  const q = _math.quatFromAxisAngle([0,1,0], Math.PI/2);
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,0,0]],
      transform: { position:[0,0,0], rotation:[0,0,0], quaternion: q, scale:[1,1,1] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 0));
  assert.ok(close(v.world[1], 0));
  assert.ok(close(v.world[2], -1));
});

test('quatFromEuler は Euler 行列と数値一致する', () => {
  const rx = 0.3, ry = 0.7, rz = 0.5;
  // Euler 経路
  const r1 = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,2,3]],
      transform: { position:[0,0,0], rotation:[rx,ry,rz], scale:[1,1,1] },
      parent: null
    }]
  }));
  // Quaternion 経路
  const q = _math.quatFromEuler(rx, ry, rz);
  const r2 = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,2,3]],
      transform: { position:[0,0,0], rotation:[0,0,0], quaternion: q, scale:[1,1,1] },
      parent: null
    }]
  }));
  for (let k = 0; k < 3; k++) {
    assert.ok(close(r1.objects[0].vertices[0].world[k], r2.objects[0].vertices[0].world[k], 1e-9));
  }
});

test('quaternion は rotation を上書きする', () => {
  // rotation はゴミ値、quaternion で正しく Y軸90度に
  const q = _math.quatFromAxisAngle([0,1,0], Math.PI/2);
  const r = projectScene(baseScene({
    objects: [{
      id:'p', vertices: [[1,0,0]],
      transform: { position:[0,0,0], rotation:[3.14, 0.99, -1.23], quaternion: q, scale:[1,1,1] },
      parent: null
    }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.world[0], 0));
  assert.ok(close(v.world[2], -1));
});

test('quatSlerp(a, a, t) = a', () => {
  const a = _math.quatFromAxisAngle([0,1,0], 0.7);
  const out = _math.quatSlerp(a, a, 0.5);
  for (let k = 0; k < 4; k++) assert.ok(close(out[k], a[k], 1e-9));
});

test('quatSlerp(id, q, 0) = id, slerp(id, q, 1) = q', () => {
  const id = _math.quatIdentity();
  const q = _math.quatFromAxisAngle([0,1,0], Math.PI/3);
  const at0 = _math.quatSlerp(id, q, 0);
  const at1 = _math.quatSlerp(id, q, 1);
  for (let k = 0; k < 4; k++) {
    assert.ok(close(at0[k], id[k], 1e-9));
    assert.ok(close(at1[k], q[k], 1e-9));
  }
});

test('quatMul(a, identity) = a', () => {
  const a = _math.quatFromAxisAngle([1,2,3], 0.4);
  const id = _math.quatIdentity();
  const out = _math.quatMul(a, id);
  for (let k = 0; k < 4; k++) assert.ok(close(out[k], a[k], 1e-12));
});

// === 9. lookAt カメラ (Phase 1) ===
test('lookAt: (0,5,5) から原点を見て、原点の頂点は screen 中央', () => {
  const r = projectScene(baseScene({
    camera: {
      position: [0, 5, 5],
      lookAt:   [0, 0, 0],
      fov: Math.PI/2, aspect: 800/600, near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[0,0,0]], transform: T0, parent: null }]
  }));
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.screen[0], 400, 1e-6));
  assert.ok(close(v.screen[1], 300, 1e-6));
});

test('lookAt: rotation より優先される', () => {
  // rotation はゴミ、lookAt で正しい view が取られるか
  const r = projectScene({
    camera: {
      position: [0, 0, 0],
      rotation: [1.2, 0.4, -0.7],   // ゴミ
      lookAt:   [0, 0, -5],         // -Z を見る = 既定向きと等価
      fov: Math.PI/2, aspect: 1, near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  });
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.screen[0], 400, 1e-6));
  assert.ok(close(v.screen[1], 300, 1e-6));
});

test('lookAt: 原点を見るカメラから +X の頂点は画面右側に出る', () => {
  const r = projectScene({
    camera: {
      position: [0, 0, 5],
      lookAt:   [0, 0, 0],
      fov: Math.PI/2, aspect: 1, near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[1,0,0]], transform: T0, parent: null }]
  });
  const v = r.objects[0].vertices[0];
  assert.ok(v.screen[0] > 400, `expected right-side, got screen.x=${v.screen[0]}`);
});

test('lookAt: up を反転すると上下も反転する', () => {
  const base = {
    camera: {
      position: [0, 0, 5],
      lookAt:   [0, 0, 0],
      fov: Math.PI/2, aspect: 1, near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[0,1,0]], transform: T0, parent: null }]  // 上方向の点
  };
  const r1 = projectScene(base);
  const r2 = projectScene({ ...base, camera: { ...base.camera, up: [0, -1, 0] } });
  // up反転: 同じ上方向の点が画面上下逆に出る
  // r1 では screen.y < 300（上半分）、r2 では screen.y > 300（下半分）
  assert.ok(r1.objects[0].vertices[0].screen[1] < 300);
  assert.ok(r2.objects[0].vertices[0].screen[1] > 300);
});

// === 10. 正射影 ortho (Phase 1) ===
test('ortho: 視錐台中心の頂点は screen 中央', () => {
  const r = projectScene({
    camera: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      ortho: { left: -5, right: 5, bottom: -5, top: 5 },
      near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[0,0,-10]], transform: T0, parent: null }]
  });
  const v = r.objects[0].vertices[0];
  assert.ok(close(v.screen[0], 400, 1e-6));
  assert.ok(close(v.screen[1], 300, 1e-6));
});

test('ortho: 透視と違って距離による拡縮が無い', () => {
  const cam = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    ortho: { left: -5, right: 5, bottom: -5, top: 5 },
    near: 0.1, far: 100
  };
  // 同じローカル(1,0,…)が、奥行きz違いでスクリーンX一致するか
  const r1 = projectScene({
    camera: cam, viewport: { width: 800, height: 600 },
    objects: [{ id:'a', vertices: [[1,0,-2]], transform: T0, parent: null }]
  });
  const r2 = projectScene({
    camera: cam, viewport: { width: 800, height: 600 },
    objects: [{ id:'a', vertices: [[1,0,-50]], transform: T0, parent: null }]
  });
  assert.ok(close(r1.objects[0].vertices[0].screen[0], r2.objects[0].vertices[0].screen[0], 1e-9));
});

test('ortho: 視錐台外は inFrustum=false', () => {
  const r = projectScene({
    camera: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      ortho: { left: -5, right: 5, bottom: -5, top: 5 },
      near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{ id:'p', vertices: [[10,0,-10]], transform: T0, parent: null }]
  });
  assert.equal(r.objects[0].vertices[0].inFrustum, false);
});

// === 11. assert_projectScene 突合API (Bible §7.1) ===
test('assert: Twin の出力を Twin で突合 → ok=true, maxError=0', () => {
  const scene = baseScene({
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  });
  const twin = projectScene(scene);
  // Twin が出した screen を expected として与える → 完全一致
  const expected = {
    objects: [{ id:'p', vertices: [twin.objects[0].vertices[0].screen.slice()] }]
  };
  const result = assert_projectScene(twin, expected, { stage:'screen', eps:1e-9 });
  assert.equal(result.ok, true);
  assert.equal(result.maxError, 0);
  assert.equal(result.mismatches.length, 0);
});

test('assert: 期待値が eps を超えてズレると ok=false かつ firstFailure 記録', () => {
  const scene = baseScene({
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  });
  const twin = projectScene(scene);
  const expected = {
    objects: [{ id:'p', vertices: [[399, 300]] }]   // 1px ズレ
  };
  const result = assert_projectScene(twin, expected, { stage:'screen', eps:0.5 });
  assert.equal(result.ok, false);
  assert.ok(result.firstFailure);
  assert.equal(result.firstFailure.objectId, 'p');
  assert.equal(result.firstFailure.vertexIndex, 0);
  assert.ok(result.maxError >= 1);
});

test('assert: stage="world" で world 座標を比較できる', () => {
  const scene = baseScene({
    objects: [{
      id:'p', vertices: [[0,0,0]],
      transform: { position:[2,3,-5], rotation:[0,0,0], scale:[1,1,1] },
      parent: null
    }]
  });
  const twin = projectScene(scene);
  const expected = {
    objects: [{ id:'p', vertices: [[2, 3, -5]] }]
  };
  const result = assert_projectScene(twin, expected, { stage:'world', eps:1e-9 });
  assert.equal(result.ok, true);
});

test('assert: 未知の object id は mismatch として記録', () => {
  const scene = baseScene({
    objects: [{ id:'p', vertices: [[0,0,-5]], transform: T0, parent: null }]
  });
  const twin = projectScene(scene);
  const expected = {
    objects: [{ id:'unknown', vertices: [[0, 0]] }]
  };
  const result = assert_projectScene(twin, expected, { stage:'screen', eps:0.5 });
  assert.equal(result.ok, false);
  assert.equal(result.mismatches[0].objectId, 'unknown');
  assert.match(result.mismatches[0].error, /not found/);
});

// === 12. 三角形ステージ (Phase 2a) ===
// CCW=表面の規約。カメラは原点で -Z を見ている。
// 頂点を CCW で並べた -Z 向きの三角形は backface=false（表向き）。

test('triangle: CCW で -Z を向く三角形は backface=false かつ法線が +Z（カメラ方向）', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[-1,-1,-5], [1,-1,-5], [0,1,-5]],
      triangles: [[0,1,2]],   // CCW from +Z view
      transform: T0, parent: null
    }]
  }));
  const tri = r.objects[0].triangles[0];
  assert.equal(tri.backface, false);
  // -Z 軸上の三角形を CCW で並べた → 法線は +Z 方向
  assert.ok(close(tri.worldNormal[0], 0, 1e-9));
  assert.ok(close(tri.worldNormal[1], 0, 1e-9));
  assert.ok(close(tri.worldNormal[2], 1, 1e-9));
});

test('triangle: CW で同じ点を並べると backface=true（法線反転）', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[-1,-1,-5], [1,-1,-5], [0,1,-5]],
      triangles: [[0,2,1]],   // CW
      transform: T0, parent: null
    }]
  }));
  const tri = r.objects[0].triangles[0];
  assert.equal(tri.backface, true);
  assert.ok(close(tri.worldNormal[2], -1, 1e-9));
});

test('triangle: worldCentroid は3頂点の平均', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[0,0,-5], [3,0,-5], [0,3,-5]],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  }));
  const c = r.objects[0].triangles[0].worldCentroid;
  assert.ok(close(c[0], 1));
  assert.ok(close(c[1], 1));
  assert.ok(close(c[2], -5));
});

test('triangle: area は世界空間での三角形面積', () => {
  // 直角三角形 (0,0)-(2,0)-(0,2) → 面積 = 2
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[0,0,-5], [2,0,-5], [0,2,-5]],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  }));
  assert.ok(close(r.objects[0].triangles[0].area, 2, 1e-9));
});

test('triangle: 退化三角形（同一点）は area=0、worldNormal=[0,0,0]、backface=false', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[0,0,-5], [0,0,-5], [0,0,-5]],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  }));
  const tri = r.objects[0].triangles[0];
  assert.equal(tri.area, 0);
  assert.equal(tri.worldNormal[0], 0);
  assert.equal(tri.worldNormal[1], 0);
  assert.equal(tri.worldNormal[2], 0);
  assert.equal(tri.backface, false);
});

test('triangle: allInFrustum は3頂点全て inFrustum の AND', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [
        [0,0,-5],         // 視錐台内
        [1,0,-5],         // 視錐台内
        [0,0, 5]          // カメラ背後 → 視錐台外
      ],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  }));
  assert.equal(r.objects[0].triangles[0].allInFrustum, false);
});

test('triangle: 親回転で法線も一緒に回る（180度回転で表裏反転）', () => {
  const r = projectScene(baseScene({
    objects: [{
      id:'tri',
      vertices: [[-1,-1,-5], [1,-1,-5], [0,1,-5]],
      triangles: [[0,1,2]],
      transform: { position:[0,0,0], rotation:[Math.PI,0,0], scale:[1,1,1] },
      parent: null
    }]
  }));
  const tri = r.objects[0].triangles[0];
  // 180度X軸回転 → 元は法線 +Z だったが、X軸回転で +Z → -Z
  assert.ok(close(tri.worldNormal[2], -1, 1e-9));
  assert.equal(tri.backface, true);
});

test('triangle: ortho カメラでも backface 判定が同じ向きで機能する', () => {
  const r = projectScene({
    camera: {
      position:[0,0,0], rotation:[0,0,0],
      ortho: { left:-5, right:5, bottom:-5, top:5 },
      near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{
      id:'tri',
      vertices: [[-1,-1,-5], [1,-1,-5], [0,1,-5]],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  });
  assert.equal(r.objects[0].triangles[0].backface, false);
});

test('triangle: lookAt カメラでも backface 判定が view forward に追従する', () => {
  // カメラを反対側 (+Z 側) に置いて -Z 向き三角形を見る → backface=true（裏側を見ている）
  const r = projectScene({
    camera: {
      position:[0, 0, -10], lookAt: [0, 0, 0],
      fov: Math.PI/2, aspect: 1, near: 0.1, far: 100
    },
    viewport: { width: 800, height: 600 },
    objects: [{
      id:'tri',
      vertices: [[-1,-1,-5], [1,-1,-5], [0,1,-5]],
      triangles: [[0,1,2]],
      transform: T0, parent: null
    }]
  });
  assert.equal(r.objects[0].triangles[0].backface, true);
});
// [/ai_s_emblem: Cpu3D-Tests]
