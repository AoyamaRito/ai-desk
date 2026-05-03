const { projectScene, assert_projectScene, _math } = require('../cpu3d.js');
const test = require('node:test');
const assert = require('node:assert');

test('Skinning (LBS) logic', () => {
  // ボーンの初期状態（Bind Pose）
  // Bone0: 原点 [0,0,0]
  const b0_bind = _math.translation(0, 0, 0);
  const b0_invBind = _math.translation(0, 0, 0); // 逆行列も同じ

  // Bone1: [2,0,0] に位置する
  const b1_bind = _math.translation(2, 0, 0);
  const b1_invBind = _math.translation(-2, 0, 0); // 逆行列

  const scene = {
    camera: { position: [0, 0, 10], fov: Math.PI / 2, aspect: 1, near: 0.1, far: 100 },
    viewport: { width: 800, height: 600 },
    objects: [
      {
        id: 'bone0',
        transform: { position: [0, 0, 0], scale: [1, 1, 1] }
      },
      {
        id: 'bone1',
        parent: 'bone0',
        // 動かした状態: Bone1 が Y軸に 90度曲がり、上に移動する
        transform: { position: [2, 2, 0], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 1] } 
      },
      {
        id: 'mesh',
        // 頂点0: [0,0,0] は Bone0 に 100% 従う
        // 頂点1: [1,0,0] は Bone0 と Bone1 の中間にあり、50% ずつ影響を受ける
        // 頂点2: [2,0,0] は Bone1 に 100% 従う
        vertices: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
        transform: { position: [0, 0, 0], scale: [1, 1, 1] },
        skin: {
          bones: ['bone0', 'bone1'],
          bindPoses: [b0_invBind, b1_invBind],
          boneIndices: [
            [0, 0, 0, 0], // vert0 -> bone0
            [0, 1, 0, 0], // vert1 -> bone0, bone1
            [1, 0, 0, 0]  // vert2 -> bone1
          ],
          weights: [
            [1.0, 0.0, 0, 0], // vert0 -> 100% bone0
            [0.5, 0.5, 0, 0], // vert1 -> 50% bone0, 50% bone1
            [1.0, 0.0, 0, 0]  // vert2 -> 100% bone1
          ]
        }
      }
    ]
  };

  const result = projectScene(scene);
  const mesh = result.objects.find(o => o.id === 'mesh');
  
  // 検証
  // 頂点0: Bone0 は動いていないのでそのまま [0,0,0]
  assert.ok(Math.abs(mesh.vertices[0].world[0] - 0) < 1e-5);
  assert.ok(Math.abs(mesh.vertices[0].world[1] - 0) < 1e-5);

  // 頂点2: Bone1 は [2,2,0] に移動した。ローカル座標 [2,0,0] は Bone1空間の原点 [0,0,0] に相当。
  // そのため、ワールド座標では Bone1 の位置 [2,2,0] になる。
  assert.ok(Math.abs(mesh.vertices[2].world[0] - 2) < 1e-5);
  assert.ok(Math.abs(mesh.vertices[2].world[1] - 2) < 1e-5);

  // 頂点1: Bone0(50%) + Bone1(50%)
  // Bone0側から見た期待位置: [1,0,0] (動いていないためそのまま)
  // Bone1側から見た期待位置: ローカル [1,0,0] -> Bone1の逆行列で [-1,0,0]
  // -> これを Bone1 のワールド行列(Z回転90度, pos[2,2,0]) で変換:
  // [-1,0,0] 回転 -> [0,-1,0] -> 平行移動 -> [2,1,0]
  //
  // 50%合成:
  // X: (1 * 0.5) + (2 * 0.5) = 1.5
  // Y: (0 * 0.5) + (1 * 0.5) = 0.5
  assert.ok(Math.abs(mesh.vertices[1].world[0] - 1.5) < 1e-5);
  assert.ok(Math.abs(mesh.vertices[1].world[1] - 0.5) < 1e-5);
});
