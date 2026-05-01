# 3dplus — L4 Twin（複式数学の実装）

> **GPUを信じるな。検算せよ。**
> Bible §4「3Dplus 時空座標系」・§4.5「Twin 規約」・§7「AI専用の複式数学」の実装。
> このモジュールは **L4 Twin (Draw twin)** である。GPU/Canvas描画層と同じ入力を取り、純粋関数で段階別JSONを返す。

---

## なぜ作るか

ai-deskの他の射程（L3制約畳み込み・鉱脈採掘）は実証済みだが、**3Dだけが構造的にバグを断定できない弱点**だった。
GPU/WebGL/物理エンジンはAIにとってブラックボックス。座標が画面外に飛んでも、**「描画のバグ」か「論理のバグ」か切り分け不能**になる。

このライブラリは「効率層（GPU）」と並走する**「検証層（CPU側の透明な算数）」**を提供し、両者の数値を突き合わせることで、バグの所在を断定可能にする。

---

## 思想（Bible §4.5 Twin / §7 複式数学）

| 役割 | 担当 | 性質 |
|---|---|---|
| **L4 (Draw)** | WebGL / Three.js / 物理エンジン | 速度のために隠蔽OK |
| **L4* (Twin) = この `cpu3d.js`** | 純粋関数のJS算数 | 透明・段階別JSON出力・Zero-Dep |
| **突合 (`assert_xxx`)** | 両者のJSON比較 | バグの所在を断定 |

Twin は層と直交する概念であり、新しいレイヤーではない（§4.5）。
「数学的に正しい座標が画面外を指していれば、それは描画のバグではなく論理のバグだ」とAIが**自ら確信を持って言える**ことが目的。

---

## 3Dplus（Bible §4）— 投影軸の拡張

通常の3Dライブラリは空間座標 `(x, y, z)` だけ扱う。
`cpu3d.js` は**親子階層を通る軸を一つの投影概念で統一**する：

| 投影軸 | 親→子の合成則 |
|---|---|
| 位置・回転・スケール | `worldM = parentWorldM × localM`（行列乗算） |
| **時刻 t** | `worldT = parentWorldT + localOffset`（加算） |
| **透明度 α** | `worldA = parentWorldA × localA`（乗算） |
| **生存 visibility** | `worldV = parentWorldV ∧ localV`（論理AND） |

これらすべてが**同じ level-based ループ**（深さ0から順、再帰禁止）で確定される。
時刻と透明度を「座標」として扱うこの設計は、アニメーション・フェード・親子連動のバグを複式数学の射程に入れる。

---

## ファイル

| パス | 役割 |
|---|---|
| `cpu3d.js` | L4 Twin 本体。`projectScene(scene)` 一本の重厚関数。Emblem `#high#verify`。Zero-Dep。 |
| `tests/projection.test.js` | 55/55 PASS。行列・階層・3Dplus軸・逆行列・unproject の網羅検証。 |
| `examples/point-projection.html` | WebGL描画と Twin 予測位置を画面で突合するPoC（複式数学の実演） |

---

## 入力契約 (scene JSON)

```js
{
  objects: [
    {
      id: 'cube',
      vertices:   [[x,y,z], ...],                     // ローカル座標
      triangles?: [[a,b,c], ...],                     // vertices インデックス、CCW=表面
      transform: {
        position:    [x,y,z],
        rotation:    [rx,ry,rz],                      // Euler XYZ extrinsic
        quaternion?: [x,y,z,w],                       // 任意。あれば rotation を上書き
        scale:       [sx,sy,sz]
      },
      parent: null | 'parentId' | parentIndex,
      time?:    { offset: 0 },                        // 親時刻 + offset
      alpha?:   1.0,                                  // 親α × self
      visible?: true                                  // 親 AND self
    }
  ],
  camera: {
    position:    [x,y,z],
    rotation:    [rx,ry,rz],                          // Euler、または
    quaternion?: [x,y,z,w],                           // あれば優先、または
    lookAt?:     [x,y,z],                             // あれば最優先（追従カメラ）
    up?:         [x,y,z],                             // lookAt 用、default [0,1,0]
    fov, aspect, near, far,                           // 透視投影用
    ortho?:      { left, right, bottom, top }         // あれば正射影に切替
  },
  viewport: { width, height },
  worldTime?: 0
}
```

**カメラ規約の優先順位**: `lookAt` > `quaternion` > `rotation`。
**投影規約**: `camera.ortho` があれば正射影、無ければ透視投影（`fov`/`aspect`必須）。

GPUに送るバッファとCPU検証への入力は**同じscene JSON**でなければならない。
二重定義は複式数学を成立させない（同じ数学を二度書いたら検算にならない）。

## 出力契約 (result JSON)

```js
{
  view: [16],                  // ビュー行列
  projection: [16],            // 射影行列
  worldForward: [x,y,z],       // カメラのワールド前方向（背面カリング用）
  objects: [
    {
      id, worldMatrix: [16],
      vertices: [
        {
          local:  [x,y,z],
          world:  [x,y,z],
          view:   [x,y,z],
          clip:   [x,y,z,w],
          ndc:    [x,y,z],
          screen: [px, py],   // viewport pixel
          inFrustum: true|false
        }
      ],
      triangles: [
        {
          indices:       [a,b,c],
          worldNormal:   [x,y,z],     // 単位ベクトル。退化なら [0,0,0]
          worldCentroid: [x,y,z],
          area:          number,      // 世界空間
          backface:      true|false,  // dot(worldForward, worldNormal) > 0
          allInFrustum:  true|false   // 3頂点全てが視錐台内
        }
      ],
      effective: { time, alpha, visible }
    }
  ]
}
```

**段階別に出すことが重要**。「画面外に飛んだ」が world か view か clip かのどこで起きたか即特定できる。
triangles ステージは「この面はカメラに向いているはずか」「視錐台にちゃんと入っているか」を断定するための層。

---

## 使い方（複式数学）

```js
const scene = { /* ... */ };

// CPU検証層 (Twin)
const twin = Cpu3D.projectScene(scene);

// GPU効率層（同じ行列を渡す）
gl.uniformMatrix4fv(uView,  false, twin.view);
gl.uniformMatrix4fv(uProj,  false, twin.projection);
for (const obj of twin.objects) {
  gl.uniformMatrix4fv(uModel, false, obj.worldMatrix);
  gl.drawElements(...);
}

// 突合：例えば「敵Aは画面に映っているはずか」をCPUの inFrustum で断定
assert(twin.objects[1].vertices[0].inFrustum === expectedVisible);
```

### `assert_projectScene` による段階別突合 (Bible §7.1)

GPU/手計算で得られた期待値と Twin の段階別出力を突き合わせる:

```js
const { projectScene, assert_projectScene } = require('./cpu3d.js');

const twin = projectScene(scene);

// 期待値（GPU readback / 手計算 / 旧実装からの値）
const expected = {
  objects: [
    { id: 'enemy', vertices: [[400, 300], [432, 280]] }    // screen pixels
  ]
};

const result = assert_projectScene(twin, expected, { stage: 'screen', eps: 0.5 });
//   { ok: bool, stage, eps, maxError,
//     mismatches: [{ objectId, vertexIndex, expected, actual, delta }],
//     firstFailure: 最初の不一致 | null }

if (!result.ok) {
  console.error(`stage=${result.stage} maxError=${result.maxError}`);
  console.error(result.firstFailure);
}
```

`stage` は `'screen' | 'world' | 'view' | 'ndc' | 'clip'` から選ぶ。
ズレた段階を変えながら呼ぶことで「どの段で論理が壊れたか」を二分探索できる。

### クォータニオン・lookAt・正射影の例

```js
const { _math } = require('./cpu3d.js');

// クォータニオン（ジンバルロックを避ける）
const q = _math.quatFromAxisAngle([0,1,0], Math.PI/2);
scene.objects[0].transform.quaternion = q;

// 追従カメラ
scene.camera.lookAt = [enemy.x, enemy.y, enemy.z];
scene.camera.up = [0, 1, 0];

// UI/2Dオーバーレイ用の正射影
scene.camera.ortho = { left: -10, right: 10, bottom: -7.5, top: 7.5 };

// アニメーション補間
const qStart = _math.quatFromAxisAngle([0,1,0], 0);
const qEnd   = _math.quatFromAxisAngle([0,1,0], Math.PI);
scene.objects[0].transform.quaternion = _math.quatSlerp(qStart, qEnd, t);
```

---

## 実装の規約

- **重厚関数（Bible §0.1）**: `projectScene` は500行未満の単一関数。Emblem `#high#logic Cpu3D-Projection` で囲む。
- **共有ヘルパーは内部のみ**: 行列基礎関数（multiply, rotationY等）は `_math` として公開するが、これは**検証・テスト・鉱脈採掘の入口**としての公開であり、別ライブラリから直接呼ぶ用途ではない。
- **副作用ゼロ**: DOM・WebGL・Canvas・time・乱数・I/Oに一切触らない。
- **再帰禁止（Bible §4）**: 親子階層は深さ昇順のループで処理する。

---

## スコープ防衛線

| やる | やらない |
|---|---|
| 頂点投影（local→world→view→clip→ndc→screen） | ピクセル単位のラスタライズ |
| 3Dplus軸（時刻・α・可視）の親子合成 | シェーダ言語パーサ |
| 視錐台カリング判定 | テクスチャサンプリングの再現 |
| AABB/球の衝突判定（次段で追加） | 物理エンジン（連続時間ソルバ）の置換 |
| GPUとの数値突合 | GPUの代替実装 |

検証層は「**全部の真実を再計算する**」のではなく「**断定可能な命題だけを再計算する**」。

---

## ロードマップ

**Phase 0 (完了)**:
- [x] 静止メッシュの頂点投影（5段パイプライン）
- [x] 親子ツリーの level-based 投影
- [x] 3Dplus軸（時刻・α・可視）
- [x] 視錐台カリング
- [x] WebGL突合PoC

**Phase 1 (完了)**:
- [x] クォータニオン（identity / fromAxisAngle / fromEuler / mul / normalize / slerp / toMatrix）
- [x] `transform.quaternion` で Euler を上書き
- [x] `camera.lookAt` + `camera.up` 追従カメラ
- [x] `camera.ortho` 正射影
- [x] `assert_projectScene` 段階別突合API（Bible §7.1）

**Phase 2a (完了)**:
- [x] 三角形ステージ（`objects[i].triangles`）
- [x] 世界空間の法線・重心・面積
- [x] 背面カリング（`backface`）— `worldForward` と `worldNormal` の内積で判定
- [x] `allInFrustum`（3頂点 AND）
- [x] 55/55 ネイティブテスト PASS（invertMatrix・normalMatrix・unproject・透視backface修正含む）

**Phase 2b (完了)**:
- [x] スキニング（ボーン変換）の Twin
  - skeleton + bindPose + per-vertex weights
  - LBS（Linear Blend Skinning）で世界座標を確定
  - スキニング専用ネイティブテスト（`skinning.test.js`）PASS

**Phase 3 (完了)**:
- [x] `collision.js` — AABB / 球 / Ray-Tri の Twin
  - ゼロ依存の純粋関数で基本的な交差判定（intersectAABB, intersectSphere, intersectRayTriangle 等）を実装
  - ネイティブテスト（`collision.test.js`）PASS
- [x] `animation.js` — evaluateScalar / evaluateVec3 / evaluateQuat（Slerp）。10/10 テスト PASS
- [ ] アニメーション補間の鉱脈採掘（GPUサンプル → CPU純粋関数を法則解読）

---

## 関連

- [`AI_NATIVE_MASTER_BIBLE.md`](../AI_NATIVE_MASTER_BIBLE.md) §4 / §7 — 思想の出典
- [`AI_UNDERSTANDING_MANIFESTO.md`](../AI_UNDERSTANDING_MANIFESTO.md) — なぜ展開された算数がAIには「優しい」のか
- [`PROMPT_constraint_folding.md`](../PROMPT_constraint_folding.md) — 別射程（L3）の制約畳み込み
- [`DISCUSSION_constraint_library.md`](../DISCUSSION_constraint_library.md) — 鉱脈採掘パラダイム

---

## 一行サマリー

> **「GPUに描かせる前に、CPUに同じシーンを"算数"として通せ。
>  両者の数値が一致しないなら、それは描画のバグではなく論理のバグだ。」**
