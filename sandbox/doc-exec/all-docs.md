---

# 3dplus-readme

<!-- @source: 3dplus/README.md -->

# 3dplus — L4 Twin（複式数学の実装）

> **GPUを信じるな。検算せよ。**
> Bible §4「3Dplus 時空座標系」・§4.5「Twin 規約」・§7「AI専用の複式数学」の実装。
> このモジュールは **L4 Twin (Draw twin)** である。GPU/Canvas描画層と同じ入力を取り、純粋関数で段階別JSONを返す。

***
## なぜ作るか

ai-deskの他の射程（L3制約畳み込み・鉱脈採掘）は実証済みだが、**3Dだけが構造的にバグを断定できない弱点**だった。
GPU/WebGL/物理エンジンはAIにとってブラックボックス。座標が画面外に飛んでも、**「描画のバグ」か「論理のバグ」か切り分け不能**になる。

このライブラリは「効率層（GPU）」と並走する**「検証層（CPU側の透明な算数）」**を提供し、両者の数値を突き合わせることで、バグの所在を断定可能にする。

***
## 思想（Bible §4.5 Twin / §7 複式数学）

| 役割 | 担当 | 性質 |
|---|---|---|
| **L4 (Draw)** | WebGL / Three.js / 物理エンジン | 速度のために隠蔽OK |
| **L4* (Twin) = この `cpu3d.js`** | 純粋関数のJS算数 | 透明・段階別JSON出力・Zero-Dep |
| **突合 (`assert_xxx`)** | 両者のJSON比較 | バグの所在を断定 |

Twin は層と直交する概念であり、新しいレイヤーではない（§4.5）。
「数学的に正しい座標が画面外を指していれば、それは描画のバグではなく論理のバグだ」とAIが**自ら確信を持って言える**ことが目的。

***
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

***
## ファイル

| パス | 役割 |
|---|---|
| `cpu3d.js` | L4 Twin 本体。`projectScene(scene)` 一本の重厚関数。Emblem `#high#verify`。Zero-Dep。 |
| `tests/projection.test.js` | 55/55 PASS。行列・階層・3Dplus軸・逆行列・unproject の網羅検証。 |
| `examples/point-projection.html` | WebGL描画と Twin 予測位置を画面で突合するPoC（複式数学の実演） |

***
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

***
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

***
## 実装の規約

- **重厚関数（Bible §0.1）**: `projectScene` は500行未満の単一関数。Emblem `#high#logic Cpu3D-Projection` で囲む。
- **共有ヘルパーは内部のみ**: 行列基礎関数（multiply, rotationY等）は `_math` として公開するが、これは**検証・テスト・鉱脈採掘の入口**としての公開であり、別ライブラリから直接呼ぶ用途ではない。
- **副作用ゼロ**: DOM・WebGL・Canvas・time・乱数・I/Oに一切触らない。
- **再帰禁止（Bible §4）**: 親子階層は深さ昇順のループで処理する。

***
## スコープ防衛線

| やる | やらない |
|---|---|
| 頂点投影（local→world→view→clip→ndc→screen） | ピクセル単位のラスタライズ |
| 3Dplus軸（時刻・α・可視）の親子合成 | シェーダ言語パーサ |
| 視錐台カリング判定 | テクスチャサンプリングの再現 |
| AABB/球の衝突判定（次段で追加） | 物理エンジン（連続時間ソルバ）の置換 |
| GPUとの数値突合 | GPUの代替実装 |

検証層は「**全部の真実を再計算する**」のではなく「**断定可能な命題だけを再計算する**」。

***
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

***
## 関連

- [`AI_NATIVE_MASTER_BIBLE.md`](../AI_NATIVE_MASTER_BIBLE.md) §4 / §7 — 思想の出典
- [`AI_UNDERSTANDING_MANIFESTO.md`](../AI_UNDERSTANDING_MANIFESTO.md) — なぜ展開された算数がAIには「優しい」のか
- [`PROMPT_constraint_folding.md`](../PROMPT_constraint_folding.md) — 別射程（L3）の制約畳み込み
- [`DISCUSSION_constraint_library.md`](../DISCUSSION_constraint_library.md) — 鉱脈採掘パラダイム

***
## 一行サマリー

> **「GPUに描かせる前に、CPUに同じシーンを"算数"として通せ。
>  両者の数値が一致しないなら、それは描画のバグではなく論理のバグだ。」**

---

# ai-native-master-bible

<!-- @source: AI_NATIVE_MASTER_BIBLE.md -->

# AI-Native 開発マスターバイブル (Unified V3.5 Final)

AIと人間が共創し、バグを絶滅させ、永続的な保守性を確保するための唯一無二の正典（Single Source of Truth）。

***
## 0.0 認知特性の非対称性 (Cognitive Asymmetry)
複雑性は AI にとって問題ではなく、人にとって問題である。
隠匿は AI にとって問題であり、人にとって問題ではない。
多くの開発者はこれを誤解している。人向けの「良い設計」（抽象化・分割・カプセル化）は AI にとっての「隠匿」であり、情報を奪う。AI 向けの正しい設計は、人間の美意識に反して見えても、展開され・明示され・統合された複雑性として現れる。
本 Bible のすべての原則は、この非対称性から導出される。
（追記：この原則を無視したコードは、AI時代において負債となる。）

## 0.1 ローカリティの極大化 (Locality Maximization) と「重厚関数」
AI向けコードにおいて、ローカリティは最優先の設計原則である。ファイル分割は情報を物理的に散らし、関数分割は情報を論理的に散らす。どちらもAIに対して、参照・探索・推測のコスト（認知のジャンプ）を強要する。したがって、以下の「重厚関数（Heavy Functions）」原則を厳守する。

1. **単一完結性 (Self-Contained Logic)**:
   関数の長さを恐れるな。その機能に必要なデータの加工、条件分岐、副作用のトリガー（Bridgeの呼び出し）は、可能な限り一つのスコープ（関数）内にインラインで記述せよ。AIが「その関数だけを読めば全てがわかる」状態を維持する。
2. **共有の禁止 (No-Shared Helpers)**:
   複数の機能から呼ばれる「小さな共通ヘルパー関数」の作成は原則禁止とする。似たような処理が必要な場合は、迷わずコードを複製（Copy & Paste）し、各機能内で独立して進化させよ。重複は悪ではない。隠れた依存関係による影響範囲（Blast Radius）の不可視化こそが悪である。
3. **機能単位の認知境界 (Emblem as Boundary)**:
   小さな関数へ細分化する代わりに、機能単位で意味のある大きな関数を作り、その中の論理的なステップは `ai-desk` の Emblem で区切れ。これにより、AIはコンテキストを失わずに局所更新が可能になる。
4. **「抽出」より「インライン化」 (Inline > Extract)**:
   コードを短く見せるために小関数に「抽出（Extract Function）」する人間的リファクタリングは有害である。むしろ、分割された小関数を呼び出し元に「インライン化（Inline Function）」し、失われたコンテキストを一つに統合せよ。

## 0.15 条件畳み込み一発判定 (Condition Folding)
複雑な条件分岐（if/else のネスト、switch の連鎖）を、純粋関数に畳み込み、一発で結果を返す設計を優先せよ。

1. **分岐ツリーの排除**:
   条件を「分岐」として逐次評価するのではなく、「データ構造」として一括保持し、フィルタリングや写像によって結果を導出する。分岐はAIにとって認知の分裂であり、パスの組み合わせ爆発を引き起こす。
2. **全可能世界の生成と制約による絞り込み**:
   正しいアプローチは「条件に合う世界だけを残す」ことである。制約ライブラリ（constraint-janken 参照）は27の可能世界を生成し、制約でfilterし、残った構造を返す。if文はゼロである。
3. **逆方向の走査が可能**:
   純粋関数に畳み込まれた条件は、入力→出力だけでなく、出力→入力の逆引きにも対応できる。これは分岐ツリーでは原理的に不可能である（分岐は一方通行）。
4. **鉱脈採掘との連携**:
   データから法則を抽出する際、AIは分岐ロジックではなく「閾値→基本値→変換」の一本道の純粋関数に畳み込む。これにより、合成されたコードの検証が容易になる（制約バリデーターに一発で通せる）。

## 0.2 基本原則 (Core Principles)
- **AI Drives All (AI専用コードベース)**: 人間は意図（Intent）の宣言のみを行い、コードの記述・構造化・命名・メタデータの付与はすべて AI が行う。本規約は「AIがコンテキストを失わず、バグを出さないこと」を最優先する。
- **Zero-Dependency / Zero-Server**: 外部ライブラリやブラックボックスなサーバーを排除し、推論の透明性を100%に保つ。
- **Physical Separation**: HTML(構造), CSS(表現), JS(論理)を物理的に分離し、疎結合を保つ。これは「言語レベルでの混入禁止」を意味する（HTML 内に大きな `<style>`/`<script>` ブロックを書かない、JS 文字列で CSS を組み立てない）。要素単位の `style="..."` 属性は §0.21 に従い積極的に許容する。

## 0.21 インライン CSS の許容（Inline Style Locality）
§0.2 「Physical Separation」が禁じるのは「HTML 内に大きな `<style>`/`<script>` ブロックを書く」「JS 文字列で CSS を組み立てる」レベルの言語混入である。要素単位の `style="..."` 属性はこれに該当せず、むしろ §0.1「ローカリティ極大化」と §0.1.2「共有の禁止」を優先するため、**積極的に許容・推奨する**。

### スタイルの所属判定
| 種別 | 配置 | 理由 |
|---|---|---|
| 要素固有のスタイル（位置・色・サイズ・余白） | inline `style=""` | §0.1 ローカリティ。要素を読むだけで把握できる。 |
| デザイントークン（色・寸法の CSS変数） | CSS file `:root` | テーマ一括変更可能性。inline でも `var()` で参照する。 |
| `:hover` / `:focus` / `:active` / `:disabled` | CSS file | inline で書けない技術的制約。 |
| `::before` / `::after` 等の擬似要素 | CSS file | 同上。 |
| `@media`（レスポンシブ・印刷） | CSS file | 同上。 |
| `@keyframes` アニメーション | CSS file | 同上。 |

### AI が編集する観点での利点
- 要素を読むだけで見た目が把握できる（§0.0 「上下300行スポットライト」に収まる）。
- 「このクラスは他で使われていないか」の探索コストが消える。
- 要素を削除すれば対応スタイルも自動的に消える（孤児CSSが発生しない）。
- ai-desk の Emblem 境界と矛盾せず、focus した範囲だけで完結する。
- 「なぜこの要素だけ赤いのか」が一目瞭然（属性に書いてある）。

### CSS class の共有禁止
§0.1.2「共有の禁止」を CSS にも適用する。複数の要素で似たスタイルが必要な場合、共通 class を作るのではなく、**各要素の inline style に複製せよ**。隠れた依存（class 1個変更で意図しない要素まで変わる）は、関数の共有ヘルパーと同じく悪である。

例外: `.row`, `.cta-stacked` のような「**配置の意味だけを持つ構造クラス**」（中身に color/font 等を含まないレイアウト原型）は許容してよい。中身にスタイル指示を含めず、`display: flex; gap: 1rem;` 程度に留める。

### 推奨される CSS file の規模
本原則に従えば、PJ の `style.css` は通常 50〜100行に収まる：
- `:root` の CSS変数（色・サイズ・行間）
- `body` のベース typography
- 主要要素の擬似クラス（`button:hover`、`input:focus` 等）
- 印刷・モーション設定の `@media`
- 必要最小限の `@keyframes`

これを大きく超える `style.css` は、要素固有のスタイルが侵入している兆候。inline へ戻すリファクタリングを検討せよ。

## 0.3 Canvas 2D UI パターン (§Canvas UI)

DOM ではなく Canvas でゲームUIを構築する場合の4層適用ルール。最小実証は `canvas-ui-sample.js`。

### 層への割り当て

| 要素 | 層 | 理由 |
|---|---|---|
| マウス座標取得・ヒットテスト | **L2 Intent** | 座標を Command JSON に変換して完結させる。L3 に座標を渡さない |
| 画面遷移（title/playing/pause/gameover） | **L3 Logic（constraint folding）** | 有限離散状態 → 全遷移をデータで宣言、if/else ゼロ |
| HP・スコアなどのゲーム状態 | **L3 Logic（applyCommand）** | 純粋 Reducer。同じ入力は同じ出力 |
| ボタン・ゲージ・テキストの描画 | **L4 Draw** | `REAL_state` を受け取り Canvas に書く。状態を変えない |

### REAL_state の構造
```js
const REAL_state = {
  screen: 'title',          // 'title' | 'playing' | 'pause' | 'gameover'
  score: 0,
  hp: 100,
  ui: { hoveredId: null },  // ホバー状態のみUI層が持つ
};
```

### ボタン定義はデータ
ボタンの座標・ラベル・所属画面をオブジェクトとして宣言する。描画とヒットテストの両方がこのデータを参照する（共有ヘルパーではなくデータの共有）。

```js
const BUTTONS = {
  title_start: { x: 220, y: 260, w: 200, h: 50, label: 'START', screen: 'title' },
  // ...
};
```

### 画面遷移は constraint folding
```js
const SCREEN_TRANSITIONS = [
  { from: 'title',   input: 'start',  to: 'playing' },
  { from: 'playing', input: 'pause',  to: 'pause'   },
  { from: 'playing', input: 'die',    to: 'gameover'},
  // ...
];
// if/else ゼロ。無効な遷移は _contradiction で弾く
function reduceScreen(constraints = {}) { ... }
```

### shadow の扱い（Canvas 版）
Canvas 描画でよく現れる派生値（比率・座標計算）は shadow である。変数に保存しない。

```js
// OK: 描画の瞬間にその場で計算
ctx.fillRect(20, 52, 200 * (state.hp / 100), 18);

// NG: 変数に保存 → 次フレームで REAL_state が変わっても古いまま
const hpRatio = state.hp / 100;
```

### 共有ヘルパー禁止（Draw 関数）
`drawTitle` / `drawPlaying` / `drawPause` / `drawGameover` は互いにヘルパーを共有しない。ボタン描画コードが似ていても、各関数にインライン展開する。

## 1. ai-desk 協働プロトコル (§Emblem Management)
物理的なファイル分割を禁止する代償として、`ai-desk` ツールと `Emblem` タグを用いて「仮想的な認知境界」を運用する。

### 抽出と注入 (Extract & Inject)
AIは以下の3ステップで巨大なファイルを操作する。
1. **構造把握 (`skeleton`)**: `node ai-desk.js <file> skeleton` で目次を確認。レイヤーおよびタグ（#logic, #verify等）に基づき自動ソートされる。
2. **局所読込 (`focus`)**: `node ai-desk.js <file> focus <Name>` で対象セクションのみを読み出す。
3. **部分適用 (`apply`)**: 変更したセクションだけを含むパッチファイルを作成し、`node ai-desk.js <file> apply <patch>` で安全に「注入（Injection）」する。タグ構造の不変性（Tag Immutability）が自動検証される。

### エンブレムの定義
JSファイルは必ず以下のタグでセクション（機能の塊）を区切ること。
```javascript
// [EMBLEM:#<importance>#<category> Name]
// ... code ...
// [/EMBLEM: Name]
```
(注意: 上記の `EMBLEM` は実際のソースでは `ai_s_emblem` と表記する。本ドキュメントソース内では ai-desk 自身の check と衝突しないよう placeholder にしている。Bridge も同様に `ai_s_bridge` が実名。)

## 1.5 AI-Eyes 観測インフラの強制 (§AI-Eyes Protocol)
AIは「見えない環境」で人間からの報告を待つ受け身の姿勢を捨てよ。バグを確実に潰すため、プロダクトは必ず `ai-eyes.js` による観測インフラを内包しなければならない。

1. **常駐と接続の義務化 (Mandatory Connection)**:
   すべてのプロジェクトの HTML には、必ず `ai-eyes` クライアントスクリプト（`<script src="http://localhost:3000/client.js"></script>`）を埋め込むか、それに相当するスナップショット送信・コマンド待ち受けループを実装せよ。
2. **実行の可観測性 (Forced Observability)**:
   重要な状態遷移の直後や、エラーをキャッチした際には、必ず `ai-eyes` の `/snapshot` エンドポイントへ現在の DOM 状態や Canvas 描画結果（`frame`）を送信せよ。
3. **構造投影 (Structural Observation)**:
   3Dや物理演算を行う場合、座標系の不整合を検知するため、`/structure` エンドポイントへ論理的な構造データ（JSON）を送信せよ。AIはこれを `cpu3d.js` 等の Twin と突合してデバッグする。
4. **動画記録 (Recording)**:
   連続的な挙動の不具合（カクつき、補間ミス等）を追跡するため、AIは自律的に `/record/start` および `/record/stop` を呼び出し、一連のフレームを HTML スライドショーとして記録・分析せよ。
5. **スローモーション・デバッグ用の口 (Step-by-step Hooks)**:
   複雑なアルゴリズムや物理挙動を持つ機能（例: 迷路、衝突判定）には、AI が 1 ステップずつ実行を制御できる公開インターフェース（例: `window.step_xxx`）を意図的に残せ。AI は `curl /input` を介してこれらを呼び出し、スローモーションで状態の推移を確実に追跡・修正する。
6. **APIキー不要の観測翻訳機 (eyes-e2e Keyless Transducer)**:
   AIのデバッグループ（Observe -> Think -> Act）を回す際、ループスクリプト内にLLMのAPIキーを埋め込むような密結合は避けること。代わりに `eyes-e2e.js` のような「最新状態を最小トークンのテキストに変換して標準出力に吐き出す」単機能の翻訳機（Transducer）を用いよ。CLIエージェントはこの出力を自身の文脈で解釈し、`curl` で次のアクションを注入する（Unix哲学による疎結合）。

## 2. 4層バニラ・アーキテクチャ (§情報の環)
すべての情報の流れは、以下の4層を一方向にのみ流れること。

1. **L1: Physical (物理層)**: DOM取得、イベント登録、外部API（localStorage等）アクセス。
   - **禁忌**: ここで `REAL_state` を直接書き換えてはいけない。
2. **L2: Intent (意図層)**: 生のイベントを Command JSON に変換する。入力源（UI/リプレイ/AI操作等）を問わず L3 への唯一の入口。
   - **非同期と副作用**: 外部API呼び出しや重い非同期処理（通信等）は L2 で行い、その結果（成功・失敗）を Command として L3 に渡す。
   - 例: ドラッグ操作は L1 での 3種イベントを L2 で `DragCommit` 等の論理コマンドへ畳む。
3. **L3: Logic (論理層)**: `(REAL_state, Command) => newState` の Reducer として機能し、状態を純粋に更新する。
   - **イベントソーシング**: 受信した Command は履歴（イベントログ）として配列に追記し、ハッシュ計算を行う。
   - **副作用のトリガー**: 状態更新後、必ず `bridgeLogic2Draw()`, `bridgeLogic2Persistent()`, `bridgeLogic2Network()` 等の明示的な Bridge 関数を呼び出し、副作用を外界へ伝播させる。
4. **L4: Draw (描画層)**: `REAL_state` を元に DOM を狙撃更新（Sniper Update）する。
   - **ルール**: `document.activeElement` と一致する要素（入力中のテキストエリア等）は不用意に上書きしない。

## 3. REAL / SHADOW 規約 (§状態の純粋性)
同期漏れバグを物理的に絶滅させる。
- **REAL_<名前>**: 唯一の書き換え可能な真実。
- **shadow(REAL, 用途)**: REAL から作る使い捨ての派生値。**「保持（変数への保存）禁止」**。使う瞬間に生成し、使い終わったら捨てる。
- **一方向変換**: REAL → SHADOW への変換のみを許可。

```js
// REAL_state: L3 が唯一書き換える
const REAL_state = { hp: 100, x: 0 };

// L4: 描画のたびにその場で生成して即捨て（変数に保存しない）
renderHpBar(REAL_state.hp / 100);          // ← shadow（使い捨て）
renderSprite(REAL_state.x * PIXEL_SCALE);  // ← shadow（使い捨て）
```

## 4. 3Dplus 時空座標系 (§因果の投影)
次元に依存しない、親子関係における状態投影の枠組み。
- **純粋一方向変換**: 「ローカル座標」と「ワールド座標」を絶対に混ぜない。
- **Level-based Projection**: 再帰を禁止し、深さ0（親）から順にループでワールド状態を確定させる。
- **投影要素**: 位置・回転だけでなく、時間(t)、透明度(Alpha)、生存(Visibility)も「座標」として投影する。

## 4.5 Twin 規約 (§Verification Twin)
任意の層は **Twin（検証双子）** を持てる。Twin は元層と同じ入力を取り、純粋関数でJSONを返す検証実装である。複式数学（§7）の実装単位はこの Twin である。

1. **直交概念**:
   Twin は層（L1〜L4）と直交する。新しい層ではなく、層に付随する性質である。`L1〜L4` がデータフローの方向を定義するのに対し、Twin は「効率実装」と「検算実装」のペア性を定義する。
2. **表記**:
   `L<n>*` または `<name>_twin` と書く。例: `L4*`、`render_twin()`、`cpu3d.js (L4 twin)`。
3. **共通契約**:
   - 元層と**同じ入力JSON**を取る（二重定義禁止）
   - **純粋関数**である（DOM/GPU/I/O/乱数/時刻に触れない）
   - **段階別JSON**を返す（どの段で乖離したかを特定可能にする）
   - 元層との**突合関数**（`assert_xxx`）が独立に存在する
4. **典型的なTwin**:
   - **L4\* (Draw twin)**: GPU/Canvas描画と並走するCPU側の透明な算数（`3dplus/cpu3d.js`）
   - **L3\* (Logic twin)**: 物理エンジン・複雑Reducerの結果を別実装で検算
   - L1/L2 の Twin は稀（DOM/Intentは比較的薄いため通常不要）
5. **Twin と SHADOW の違い**（§3との混同を避ける）:
   - SHADOW: REALから派生する**表示・操作用の派生値**。一方向変換の結果。
   - Twin: 元層と並走する**検算実装**。突合のために存在する。
   両者は別の概念であり、`SHADOW_xxx` と `xxx_twin` を混同してはならない。

## 5. データ永続化と証明 (§Persistence & Cryptography)
サーバーのDBに依存せず、データの信頼性と歴史をローカルで担保するための原則。
- **JSON + Event Sourcing**: 状態（State）の上書き保存を避け、状態を変更する「イベント（Command）」の履歴を JSON の配列として追記保存する。現在の状態は、初期状態から全イベントを再生（Reduce）することで決定される。
- **Sequential Hashing (直列ハッシュ)**: 各イベントは「一つ前のイベントのハッシュ値」を含めて自身のハッシュを計算する（ブロックチェーン的な直列構造）。これにより、履歴の改ざんや欠落を数学的に検知・防止する。
- **Dumb Relay & HTTP/3**: サーバーはロジックを持たない土管（Relay）に徹する。通信には HTTP/3 (WebTransport等) を用い、低遅延なストリームとしてデータを移送する。受信したJSONイベントのハッシュ整合性は必ずエッジ（L3: Logic）側で検証する。
- **Attestation Over Auth**: 中央集権的なログイン認証を廃し、公開鍵暗号による署名検証を権利の根拠とする。
- **Eternal Compatibility**: Web標準のみに従い、10年後も修正なしで動作し続けるコードを維持する。

## 6. FAQ & 実践ガイド (§Operational Rules)

### Q: 編集時に `ai-desk apply` を優先すべきか？
**A: 常に優先せよ。**
Emblem による「認知境界」を維持し、パッチの整合性を保証するためである。AIが自身のコンテキストを破壊せず、安全に巨大ファイルを狙撃更新するための標準手段である。

### Q: Bridge（架け橋）の本質は何か？
**A: 層を隔てる「関所（膜）」である。**
単なる関数呼び出しではなく、この膜を通過するデータのみが他層へ影響を与えられるという「制約」自体が重要である。この膜が物理的に存在することで、副作用の連鎖が遮断され、デバッグが劇的に容易になる。

### Q: Emblem がないファイルはどう扱うべきか？
**A: 編集の過程で積極的に付与せよ。**
AI-Native 開発において、Emblem は「地図」である。地図のない土地（コード）に足を踏み入れた際は、まず境界線を引き、後続のAIが迷わないように整備することが期待される。

### Q: 制約ライブラリはいつ使うべきか？
**A: 実験段階である。**
現在は実装コストと表現力のバランスを見極めるフェーズにある。複雑な関係性の整理が必要な場面において、局所的な導入から検討せよ。

## 7. AI専用の複式数学 (§Double-Entry Verification)

ブラックボックス化しやすい外部システム（GPU/WebGL, 物理エンジン, 外部API）に対して、AIは以下の「複式数学」による検証を行わなければならない。実装単位は §4.5 の **Twin** である。

1. **効率層 (Execution Layer)**:
   通常の開発では、書きやすさと実行効率を優先し、既存のライブラリやGPU機能を活用せよ。ここでの「隠蔽」は実行速度のために許容される。
2. **検証層 = Twin (§4.5)**:
   「バグが疑われる箇所」や「論理的な核心部分」において、AIは自身の認知が及ぶ「透明な重厚関数（ベタ書きされた純粋な算数）」を Twin として並走させよ。
3. **数値による証明**:
   ブラックボックスの出力を信じるな。Twin が算出した純粋な数学的座標（JSON）と、実際の挙動を突き合わせよ。数学的に正しい座標が画面外を指していれば、それは「描画のバグ」ではなく「論理のバグ」であるとAI自ら確信を持って断定できる。

この「効率的な実行」と「透明な検算」の分離こそが、複雑な3D/物理システムにおけるAIデバッグの最終解である。

### 7.1 命名規則 (Pair Naming)

```
効率層:   xxx()             // 実装は何でも可（GPU/物理エンジン/Three.js等）
Twin:    xxx_twin(input)   // 純粋関数。同入力JSONを取りJSONを返す
突合:    assert_xxx(e, t)  // 矛盾を投げる/返す。Zero-Dep
```

モジュール単位でペアにする場合（3dplus型）:
```
effective:  render.js, physics.js
twin:       render.twin.js, cpu3d.js (= L4 twin), physics.twin.js
```

### 7.2 入力契約（同一性の強制）

効率層と Twin は**同じ入力JSON**を受け取らなければならない。二重定義は規約違反である（同じ数学を二度書いたら検算にならない）。

### 7.3 出力契約（段階別JSON）

```js
xxx_twin(input) → {
  stages: { stage1: ..., stage2: ..., stage3: ... },
  result: ...
}
```

「どこで壊れたか」を特定可能にする。`projectScene` の `local→world→view→clip→ndc→screen` がこのテンプレ。

### 7.4 純度規約

Twin は **Zero-Dep / Zero-Side-Effect**:
- DOM / GPU / Canvas / I/O / 乱数 / 時刻に触れない
- 入力JSON → 出力JSON のみ
- 外部ライブラリ依存禁止（自身がブラックボックスを呼んだら検算にならない）

### 7.5 Emblem 拡張

`#verify` を `#Category` の正式な値として追加する（§1 Emblemの定義参照）:

```javascript
// [EMBLEM:#high#verify ProjectScene]
// [EMBLEM:#high#draw    WebGLRenderer]
```
(注意: `EMBLEM` は実際のソースでは `ai_s_emblem` と表記する。本ドキュメントソース内では check と衝突しないよう placeholder にしている。)

### 7.6 ペア宣言

ファイル冒頭または関数JSDocで、効率層と Twin の対応を明示する:

```js
// @effective: ../my_webgl/render.js
// @twin:      cpu3d.js
```

これにより AI は「片方を編集する時、もう片方も同期更新せよ」を自動判定できる。

***
**Version**: 3.5 (Final Architecture Edition)
**Date**: 2026-05-01
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# ai-onboarding-en

<!-- @source: AI_ONBOARDING.en.md -->

# ai-desk — AI Work Guide

## Preface

ai-desk is a **mechanism for running AI under the conceptual framework called *ai-desk***, so that anyone can develop software using AI. This is an architecture — a separate concept from the software engineering of the pre-AI era. Debate framed in pre-AI terms is not invited from the outset. ai-desk is a **thought-construct that solves the problem of AI being constrained by human software engineering and failing to perform at its true capability**.

## Audience Roles

- **End users**: Focus on building what you want to build, in natural language. Architectural debate is not required of you.
- **Architects**: Discussion about how AI can produce structures *not* bound by human intuitions is welcome. Discussion that imports pre-AI-era software engineering is out of scope.

**The documentation itself is for LLM/AI only, not for human engineers.**
Human-era "readability" (abstraction, modularization, encapsulation) hides information from AI. This repo optimizes for the opposite: exposed, explicit, and integrated complexity. If a human finds it hard to read, that is by design, not a defect.

Every AI working in this repo should read this file first.
Design rules, tool usage, and forbidden patterns are all collected here.

***
## What this repo is

A research repository for AI-Native software methodology.
Runnable demos, a CLI tool, tests, and philosophy docs are all in one place.

Core idea: **Human-era "good design" (DRY, abstraction) strips information from AI.**
This repo proves the opposite — principles for AI to write code without getting lost and without producing bugs.

***
## Critical Rules

### 1. Heavy Functions (no shared helpers)
Do not share helpers between functions. Logic is inlined inside each function.
Redundant-looking code is intentional — it is far safer than hidden shared dependencies.

### 2. Constraint Folding (enumerate all worlds instead of if/else)
```js
function myLogic(constraints = {}) {
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      allWorlds.push({ a, b, result: derive(a, b) });
    }
  }
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true, _message: '...' };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```
Minimal proof: `constraint-janken.js` (150 lines). Read it when in doubt.

### 3. REAL / SHADOW (state purity)
- `REAL_xxx` is the single writable truth
- Derived values (shadows) are generated at the point of use and never stored in a variable

```js
// OK: throwaway
renderHpBar(REAL_state.hp / 100);

// NG: shadow stored in variable → stale when REAL changes next frame
const shadow_hp = REAL_state.hp / 100;
```

***
## Starting a New Implementation (Scaffolding)

When creating a new app or feature from scratch, start by copying the `template/` directory.

```bash
cp -r template my-new-app   # copy the template
cd my-new-app               # move to the directory
node ../ai-eyes.js          # start ai-eyes to view in browser (localhost:3000/my-new-app/)
```

`template/app.js` provides a minimal 4-layer structure (Physical, Intent, Logic, Draw). The basic workflow is to add your logic while maintaining this architectural integrity.

***
## Tool Usage

### ai-desk (code editing workflow)

```bash
node ai-desk.js <file> skeleton          # 1. understand structure (layer-sorted)
node ai-desk.js <file> focus <Name>      # 2. local read of the target Emblem
node ai-desk.js <file> check             # 3. tag consistency + vocabulary check
node ai-desk.js <file> coverage          # 4. bridge coverage report
node ai-desk.js <file> apply patch.js    # 5. apply patch (with destruction fence)
```

When making changes, write to a patch.js and apply it — safer than editing directly.
`apply` enforces **Tag Immutability**, validating that the emblem count and tag structure are unchanged, and cancels automatically if destruction is detected.

### ai-eyes + eyes-e2e (observation / debugging)

```bash
node ai-eyes.js                          # start server (localhost:3000)
node eyes-e2e.js "debug goal"            # compress current state to one text blob
```

`ai-eyes` serves a **Dynamic client.js** (`localhost:3000/client.js`). Including this in your HTML enables remote control and observation by AI.
Furthermore, the **/structure** endpoint allows sending internal structures (3D coordinates, physics data) for logic validation without a browser (**Structural Projection**).

### run.js (Orchestrator Pattern)

For complex validation or automated debugging, create and use a `run.js` (**Orchestrator**) that unifies server startup, browser interaction, and validation script execution. This allows AI to complete the entire process with a single command.


***
## 4-Layer Architecture

```
L1 Physical  →  L2 Intent  →  L3 Logic  →  L4 Draw
(DOM/IO)        (cmd convert)  (pure reducer)  (render)
```

- Data flows one-way, top to bottom
- Functions that cross layers get a `[ai_s_bridge:L3toL4 Name]` tag
- **L3 Logic is pure functions only** (no DOM, no random, no Date, no side effects)

***
## Emblem Tag Syntax

```js
// [ai_s_emblem:#high#logic FunctionName]
function FunctionName() { ... }
// [/ai_s_emblem: FunctionName]

// [ai_s_bridge:L3toL4 BridgeName]
function BridgeName() { ... }
// [/ai_s_bridge: BridgeName]
```

Valid tags: `#high #mid #low` × `#L1 #L2 #L3 #L4 #physical #intent #logic #draw #verify #OutOfLayers #config`

***
## Tests

```bash
node --test actions/tests/fighter-cancel.test.js   # 19/19 PASS (1920 worlds)
node --test 3dplus/tests/projection.test.js         # 77/77 PASS
node eyes-e2e.js --test                             # 22/22 PASS
```

***
## Deep Reading

| File | Content |
|------|---------|
| `constraint-janken.js` | Minimal proof of constraint folding (start here) |
| `AI_NATIVE_MASTER_BIBLE.md` | Full design canon — all six pillars |
| `AI_UNDERSTANDING_MANIFESTO.md` | AI cognition properties (±300-line spotlight, etc.) |
| `PROMPT_constraint_folding.md` | Constraint folding decision criteria and measurement evidence |

***
## Autonomous Refactoring

Refactoring in this repo is **not DRY-ification, abstraction, or shared extraction**.
Those are the directions this repo explicitly forbids.

If you find any of the following patterns while reading code, fix them without waiting to be asked.

### Patterns to fix

| Found | Correct form |
|---|---|
| Function or block with no Emblem tag | Wrap with `[ai_s_emblem:#layer Name]` |
| Unknown tag warning from `check` (e.g. `#logc`) | Fix to the correct tag |
| Layer-crossing function without a Bridge tag | Add `[ai_s_bridge:LxtoLy Name]` |
| Deep nested if/else state logic | Rewrite as constraint folding (enumerate all worlds) |
| Shared helper called from multiple Emblems | Inline into each call site |
| Derived value stored in a variable (`const shadow_x = ...`) | Generate it at the point of use instead |
| DOM manipulation or side effects inside L3 Logic | Move side effects to L4 or a Bridge |

### Before fixing

- Run `node ai-desk.js <file> check` and make sure you do not break the tag structure
- If tests exist, confirm they pass after the fix
- Fix only what you found. Do not touch unrelated code

### After fixing

Tell the human in one sentence: what you found and how you fixed it.

***
## After reading this file

Tell the human operator: "I have read the guide and understood the AI-Native design rules (Constraint Folding, 4-Layer Architecture, and tool usage)."

**NOTE:**
Tools like `skeleton` for structure overview, `focus` for local reads, and `ai-eyes` for debugging are **for YOU (the AI) to use autonomously**. Do not present them as a menu to the human.

Instead, ask the human for their goal using plain, everyday language:

- "Shall we build something new from scratch?"
- "Would you like to add new features or change existing ones?"
- "Are there any issues or broken parts we need to fix?"
- "Should I play through the app in slow motion to check for any glitches?"

Once the human gives a directive, use `ai-desk` and `ai-eyes` autonomously to complete the task.

***
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# ai-onboarding

<!-- @source: AI_ONBOARDING.md -->

# ai-desk — AI 作業ガイド

## はじめに

ai-desk は、誰もが AI を使ってソフトウェアを開発できるようにするために、**ai-desk という思考概念で AI を稼働させるための仕組み**です。これはアーキテクチャであり、AI が存在しない時代のソフトウェア工学とは別の概念のものです。したがって、その議論ははじめから求めていません。これは **AI が人間のソフトウェア工学に囚われすぎ、実力が出ない問題を解決するための思想構造物**ということです。

## 想定読者の役割

- **一般ユーザー**: 自然言語であなたの作りたいものを作ることに専念してください。アーキテクチャの議論は不要です。
- **アーキテクター**: AI が人間の常識にとらわれない構造を作り出すための議論なら歓迎です。AI 時代以前のソフトウェア工学を持ち込む議論は対象外です。

**このドキュメント自体の想定読者は LLM/AI のみで、人間のエンジニアは想定読者ではありません。**
人間時代の「読みやすさ」(抽象化・分割・カプセル化) は AI にとって情報の隠匿であり、本リポは逆方向 — 展開され・明示され・統合された複雑性 — に最適化されています。人間が読みにくく感じても、それは設計上の意図であり欠陥ではありません。

このリポで作業するすべての AI はまずこのファイルを読んでください。
設計ルール・ツール使用法・禁止事項がここに集約されています。

***
## 🚨 【最重要】ドキュメントの編集ルール (Bootstrap Protocol)

このリポジトリでは、**人間向けの主要ドキュメント（Master Bible等）を直接編集することを固く禁じます。**
ドキュメントはコードと同様に「エンブレム管理されたソース」から生成（ビルド）される SHADOW（派生値）です。

- **読むとき**: `AI_NATIVE_MASTER_BIBLE.md` などの Markdown をそのまま読んで構いません。
- **書くとき**: 
  1. 真実のソース（REAL）である `DOCS_REAL.js` 等に対して `ai-desk focus <SectionName>` を行い、局所的に読み込む。
  2. 修正内容を `patch.js` に記述し、`ai-desk apply patch.js` で原子的に適用する。
  3. `node build-docs.js` を実行し、人間向けの Markdown を再生成する。

この「REAL / SHADOW」の分離をドキュメント管理にも適用することで、AIの認知局所性を守り、フォーマット崩れを構造的に防いでいます。

***
## このリポは何か

「AIがコードを書きやすくするための設計方法論」の研究リポです。
実行可能なデモ・CLI ツール・テスト・哲学文書がひとつにまとまっています。

中核の思想: **人間時代の「良い設計」（DRY・抽象化）はAIから情報を奪う。**
このリポはその逆——AIが迷わずバグを出さないコードを書くための原則を実証します。

***
## 最重要ルール

### 1. Heavy Function（共有ヘルパー禁止）
関数間でヘルパーを共有しない。ロジックは各関数内にインライン。
冗長に見えても、隠れた依存（共通ヘルパーの暗黙の影響範囲）よりはるかに安全。

### 2. Constraint Folding（if/else の代わりに全世界列挙）
```js
function myLogic(constraints = {}) {
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      allWorlds.push({ a, b, result: derive(a, b) });
    }
  }
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true, _message: '...' };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```
最小実証は `constraint-janken.js`（150行）。詳細は `CONSTRAINT_FOLDING_MASTER.md` を読め。

### 3. REAL / SHADOW（状態の純粋性）
- `REAL_xxx` が唯一の書き換え可能な真実
- 派生値（shadow）は使う瞬間にその場で生成し、変数に保存しない

```js
// OK: 使い捨て
renderHpBar(REAL_state.hp / 100);

// NG: shadow を変数に保持 → 次フレームで REAL が変わっても古いまま
const shadow_hp = REAL_state.hp / 100;
```

***
## 新規実装の始め方 (Scaffolding)

ゼロから新しいアプリや機能を作成する場合は、`template/` ディレクトリをコピーすることから始めてください。

```bash
cp -r template my-new-app   # テンプレートをコピー
cd my-new-app               # ディレクトリへ移動
node ../ai-eyes.js          # ai-eyes を起動してブラウザで確認 (localhost:3000/my-new-app/)
```

`template/app.js` は最小限の4層構造（Physical, Intent, Logic, Draw）を持っており、この構造を維持しながらロジックを追加していくのが基本ワークフローです。

***
## ツールの使い方

### ai-desk（コード編集の手順）

```bash
node ai-desk.js <file> skeleton                     # 1. 構造を層ソートで把握 (行番号付き)
node ai-desk.js <file> focus <Name>                 # 2. 対象 Emblem を局所読み込み
node ai-desk.js <file> check                        # 3. タグ整合性・語彙チェック
node ai-desk.js <file> coverage                     # 4. Bridge 網羅レポート
node ai-desk.js <file> apply patch.js --dry-run     # 5a. 何が置き換わるか確認 (書かない)
node ai-desk.js <file> apply patch.js               # 5b. 原子的適用
```

変更を加えるときは、直接書き換えるより patch.js に書いて apply する方が安全。
apply は **pre-flight 検証 → 原子的書込** のセマンティクス: patch 内の全 emblem/bridge 名が
ターゲットに「ちょうど 1 件」存在することを先に確認し、1 件でも欠けたり重複していたら
何も書かずに exit 1 する。`--dry-run` は plan を表示するだけで書き込まない。
さらに **Tag Immutability** によりタグ件数の変動を検知すると書込をキャンセルする。

### ai-eyes + eyes-e2e（観測・デバッグ）

```bash
node ai-eyes.js                          # サーバー起動（localhost:3000）
node eyes-e2e.js "デバッグ目標"          # 現状を1テキストに圧縮して出力
```

`ai-eyes` は **Dynamic client.js**（`localhost:3000/client.js`）を配信しており、これを HTML に含めるだけで AI によるリモート操作と観測が可能になる。
また、**/structure** エンドポイントを通じて 3D 座標や物理演算の内部構造を送信し、ブラウザを介さずロジックの正しさを検証できる（**Structural Projection**）。

### run.js（Orchestrator パターン）

複雑な検証や自動デバッグを行う場合、サーバーの起動・ブラウザ操作・検証スクリプトの実行を一本化した `run.js`（Orchestrator）を作成・利用せよ。これにより、AI は一撃のコマンドで全工程を完遂できる。


***
## 4層アーキテクチャ

```
L1 Physical  →  L2 Intent  →  L3 Logic  →  L4 Draw
（DOM/IO）     （コマンド変換）  （純粋Reducer）  （描画）
```

- データは上から下へ一方向
- 層をまたぐ関数には `[ai_s_bridge:L3toL4 Name]` タグを付ける
- **L3 Logic は純粋関数のみ**（DOM・乱数・時刻・副作用に触れない）

***
## Emblem タグ構文

```js
// [ai_s_emblem:#high#logic FunctionName]
function FunctionName() { ... }
// [/ai_s_emblem: FunctionName]

// [ai_s_bridge:L3toL4 BridgeName]
function BridgeName() { ... }
// [/ai_s_bridge: BridgeName]
```

有効タグ: `#high #mid #low` × `#L1 #L2 #L3 #L4 #physical #intent #logic #draw #verify #OutOfLayers #config`

Aspect タグ（任意・層と併用）: `#auth` `#security`
プロジェクト固有の aspect は `ai-desk.config.json` の `customTags` で追加する。

Audience タグ（任意・読み手を明示）: `#for_human`
人間向け散文・ブランディング・思想説明を含むセクションに付ける。無印は AI 向け（簡潔・ツール親和）。

***
## テスト

```bash
node --test actions/tests/fighter-cancel.test.js   # 19/19 PASS（1920世界）
node --test 3dplus/tests/projection.test.js         # 77/77 PASS
node eyes-e2e.js --test                             # 22/22 PASS
```

***
## 深く読むとき

| ファイル | 内容 |
|----------|------|
| `constraint-janken.js` | 制約畳み込みの最小実証（まずここ） |
| `AI_NATIVE_MASTER_BIBLE.md` | 設計の全根拠・6つの柱 |
| `AI_UNDERSTANDING_MANIFESTO.md` | AIの認知特性（±300行スポットライト等） |
| `PROMPT_constraint_folding.md` | 制約畳み込みの適用判定と測定エビデンス |

***
## 自律リファクタリング

このリポのリファクタリングは**DRY化・抽象化・共通化ではない**。
それらはこのリポが明示的に禁止している方向である。

コードを読んでいて以下のパターンを発見したら、指示を待たずに修正してください。

### 修正すべきパターン

| 発見したもの | 正しい姿 |
|---|---|
| Emblem タグのない関数・ブロック | `[ai_s_emblem:#layer Name]` で囲む |
| check で出る未知タグ警告（`#logc` 等） | 正しいタグに修正する |
| 層をまたぐ関数に Bridge タグがない | `[ai_s_bridge:LxtoLy Name]` を付ける |
| if/else のネストが深い状態判定 | 全可能世界を列挙する制約畳み込みに書き換える |
| 共有ヘルパー関数が複数 Emblem から呼ばれている | 各呼び出し元にインライン展開する |
| 派生値が変数に保存されている（`const shadow_x = ...`） | 使う場所でその場で生成するよう書き直す |
| L3 Logic に DOM 操作・副作用が混入している | 副作用を L4 か Bridge に移動する |

### 修正前に確認すること

- `node ai-desk.js <file> check` を実行し、タグ構造を壊さない
- テストがある場合は修正後に通過を確認する
- 修正範囲は発見した箇所のみ。関係ない部分に触れない

### 修正後に報告すること

何を発見し、どう直したかを一言で伝えてください。

***
## このファイルを読み終えたら

人間の作業者に対して「ガイドを読み、AI-Nativeな設計ルール（制約畳み込み、4層構造、各種ツールの使い方）を理解しました」と伝えてください。

**注意:**
`skeleton` による構造把握、`focus` による局所読み込み、`ai-eyes` を使ったデバッグなどのツール群は、**AIであるあなた自身が自律的に使うもの**です。人間に「どのツールを使いますか？」とメニューを提示しないでください。

代わりに、以下のような日常的な言葉で、人間にやりたいことを聞いてください。

- 「ゼロから新しく作りますか？」
- 「いまある機能の追加や、変更を行いますか？」
- 「動かないところや、直したい不具合がありますか？」
- 「スローモーションで実際に動かしてみて、おかしな点がないかチェックしましょうか？」

人間の指示を受けたら、あなたは自律的に `ai-desk` や `ai-eyes` を駆使してタスクを完遂してください。

***
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# ai-understanding-manifesto

<!-- @source: AI_UNDERSTANDING_MANIFESTO.md -->

# THE AI UNDERSTANDING (AI理解の真実)
※人間の常識・従来のプロンプトエンジニアリングを捨てるためのマインドセット

## 1. 認知の限界：「上下300行」のスポットライト
- **真実:** AIは、今読んでいる場所から離れた情報を急速に忘却する。
- **メカニズム:** AIの認識（Attention）は、フォーカスしている箇所の「上下数百行」には強烈な解像度を持つが、そこから外れると情報は急速にぼやけ、ノイズに沈む。
- **人間との違い:** 人間は「さっき言った前提」を意識の裏でキープできるが、AIには「いま見えている範囲」しか存在しない。

## 2. 確率の穴埋め：「近接バイアス」の支配
- **真実:** 遠い言葉は、確率の海に消える。
- **メカニズム:** AIの出力は「次に入る言葉の確率的な穴埋め」の乱れ撃ちである。そのため、答えを出す「穴」に近い情報ほど強い影響力を持ち、遠い情報（ファイルの先頭に書いたルールなど）は無視されやすくなる。
- **結論:** 重要な情報は、答えを出させる場所の「近接」に配置しなければならない。

## 3. 切替の代償：「ファイル移動」という重労働
- **真実:** AIにとって、ファイルの切り替えは「別の階の部屋に行く」ほどの物理的コストがかかる。
- **メカニズム:** 新しいファイルを読み込むたび、AIは「言葉のチューニング（文脈の前提）」をリセットし、ゼロからピントを合わせ直さなければならない。
- **結論:** 複数のファイルを行ったり来たりさせる指示は、AIの認知を破壊し、バグ（文脈の喪失）を生む。

## 4. 究極の非対称性：「推測の弱さ」と「複雑さへの神性」
- **人間の強み / AIの弱み:** 欠けた情報から「空気を読む（推測する）」こと。AIはこれが絶望的に苦手であり、隠れた情報があるとすぐにハルシネーション（幻覚）を起こす。
- **AIの強み / 人間の弱み:** 目の前にすべての情報が揃っている状態での「複雑な計算」。AIは100の条件分岐が絡むカオスなロジックでも、情報が揃っていれば一瞬の淀みもなく完璧な解を出す。

## 5. 人間の仕事：「常識の明文化」と「余白の提供」
この非対称性から導き出される、AIと協働するための「究極のアプローチ」。

- **① 情報を「すべて」揃える（Inputの完全性）**
  - 人間が「言わなくてもわかるだろう」と思う常識こそ、AIの計算の土台となる。これを詳細に明文化し、AIが計算する「近接」に配置する。
- **② 出力に「余白」を残す（Outputの自由度）**
  - 「厳密に」「絶対にこの形式で」といった機械的・硬直的なルールは、AIの計算リソースを「ルールを守ること」に浪費させ、肝心のロジック計算の結果を歪ませる。
  - **良い指示:** 「前提はすべて渡した。あとは君の計算力で、一番いい形（余白）で出してくれ」
  - AIの想像力と計算力を殺さないために、機械的な制約は避け、AIに「最適な確率を見つける自由」を与えなければならない。

***
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# bible-shadow

<!-- @source: BIBLE_SHADOW.md -->

# AI-Native 開発マスターバイブル (Unified V3.5 Final)

AIと人間が共創し、バグを絶滅させ、永続的な保守性を確保するための唯一無二の正典（Single Source of Truth）。

***
*Updated: 2026-05-02*


## 0.0 認知特性の非対称性 (Cognitive Asymmetry)
複雑性は AI にとって問題ではなく、人にとって問題である。
隠匿は AI にとって問題であり、人にとって問題ではない。
多くの開発者はこれを誤解している。人向けの「良い設計」（抽象化・分割・カプセル化）は AI にとっての「隠匿」であり、情報を奪う。AI 向けの正しい設計は、人間の美意識に反して見えても、展開され・明示され・統合された複雑性として現れる。
本 Bible のすべての原則は、この非対称性から導出される。
（追記：この原則を無視したコードは、AI時代において負債となる。）


## 0.1 ローカリティの極大化 (Locality Maximization) と「重厚関数」
AI向けコードにおいて、ローカリティは最優先の設計原則である。ファイル分割は情報を物理的に散らし、関数分割は情報を論理的に散らす。どちらもAIに対して、参照・探索・推測のコスト（認知のジャンプ）を強要する。したがって、以下の「重厚関数（Heavy Functions）」原則を厳守する。

1. **単一完結性 (Self-Contained Logic)**:
   関数の長さを恐れるな。その機能に必要なデータの加工、条件分岐、副作用のトリガー（Bridgeの呼び出し）は、可能な限り一つのスコープ（関数）内にインラインで記述せよ。AIが「その関数だけを読めば全てがわかる」状態を維持する。
2. **共有の禁止 (No-Shared Helpers)**:
   複数の機能から呼ばれる「小さな共通ヘルパー関数」の作成は原則禁止とする。似たような処理が必要な場合は、迷わずコードを複製（Copy & Paste）し、各機能内で独立して進化させよ。重複は悪ではない。隠れた依存関係による影響範囲（Blast Radius）の不可視化こそが悪である。
3. **機能単位の認知境界 (Emblem as Boundary)**:
   小さな関数へ細分化する代わりに、機能単位で意味のある大きな関数を作り、その中の論理的なステップは `ai-desk` の Emblem で区切れ。これにより、AIはコンテキストを失わずに局所更新が可能になる。
4. **「抽出」より「インライン化」 (Inline > Extract)**:
   コードを短く見せるために小関数に「抽出（Extract Function）」する人間的リファクタリングは有害である。むしろ、分割された小関数を呼び出し元に「インライン化（Inline Function）」し、失われたコンテキストを一つに統合せよ。


## 0.15 条件畳み込み一発判定 (Condition Folding)
複雑な条件分岐（if/else のネスト、switch の連鎖）を、純粋関数に畳み込み、一発で結果を返す設計を優先せよ。

1. **分岐ツリーの排除**:
   条件を「分岐」として逐次評価するのではなく、「データ構造」として一括保持し、フィルタリングや写像によって結果を導出する。分岐はAIにとって認知の分裂であり、パスの組み合わせ爆発を引き起こす。
2. **全可能世界の生成と制約による絞り込み**:
   正しいアプローチは「条件に合う世界だけを残す」ことである。制約ライブラリ（constraint-janken 参照）は27の可能世界を生成し、制約でfilterし、残った構造を返す。if文はゼロである。
3. **逆方向の走査が可能**:
   純粋関数に畳み込まれた条件は、入力→出力だけでなく、出力→入力の逆引きにも対応できる。これは分岐ツリーでは原理的に不可能である（分岐は一方通行）。
4. **鉱脈採掘との連携**:
   データから法則を抽出する際、AIは分岐ロジックではなく「閾値→基本値→変換」の一本道の純粋関数に畳み込む。これにより、合成されたコードの検証が容易になる（制約バリデーターに一発で通せる）。


## 0.2 基本原則 (Core Principles)
- **AI Drives All (AI専用コードベース)**: 人間は意図（Intent）の宣言のみを行い、コードの記述・構造化・命名・メタデータの付与はすべて AI が行う。本規約は「AIがコンテキストを失わず、バグを出さないこと」を最優先する。
- **Zero-Dependency / Zero-Server**: 外部ライブラリやブラックボックスなサーバーを排除し、推論の透明性を100%に保つ。
- **Physical Separation**: HTML(構造), CSS(表現), JS(論理)を物理的に分離し、疎結合を保つ。これは「言語レベルでの混入禁止」を意味する（HTML 内に大きな `<style>`/`<script>` ブロックを書かない、JS 文字列で CSS を組み立てない）。要素単位の `style="..."` 属性は §0.21 に従い積極的に許容する。


## 0.21 インライン CSS の許容（Inline Style Locality）
§0.2 「Physical Separation」が禁じるのは「HTML 内に大きな `<style>`/`<script>` ブロックを書く」「JS 文字列で CSS を組み立てる」レベルの言語混入である。要素単位の `style="..."` 属性はこれに該当せず、むしろ §0.1「ローカリティ極大化」と §0.1.2「共有の禁止」を優先するため、**積極的に許容・推奨する**。

### スタイルの所属判定
| 種別 | 配置 | 理由 |
|---|---|---|
| 要素固有のスタイル（位置・色・サイズ・余白） | inline `style=""` | §0.1 ローカリティ。要素を読むだけで把握できる。 |
| デザイントークン（色・寸法の CSS変数） | CSS file `:root` | テーマ一括変更可能性。inline でも `var()` で参照する。 |
| `:hover` / `:focus` / `:active` / `:disabled` | CSS file | inline で書けない技術的制約。 |
| `::before` / `::after` 等の擬似要素 | CSS file | 同上。 |
| `@media`（レスポンシブ・印刷） | CSS file | 同上。 |
| `@keyframes` アニメーション | CSS file | 同上。 |

### AI が編集する観点での利点
- 要素を読むだけで見た目が把握できる（§0.0 「上下300行スポットライト」に収まる）。
- 「このクラスは他で使われていないか」の探索コストが消える。
- 要素を削除すれば対応スタイルも自動的に消える（孤児CSSが発生しない）。
- ai-desk の Emblem 境界と矛盾せず、focus した範囲だけで完結する。
- 「なぜこの要素だけ赤いのか」が一目瞭然（属性に書いてある）。

### CSS class の共有禁止
§0.1.2「共有の禁止」を CSS にも適用する。複数の要素で似たスタイルが必要な場合、共通 class を作るのではなく、**各要素の inline style に複製せよ**。隠れた依存（class 1個変更で意図しない要素まで変わる）は、関数の共有ヘルパーと同じく悪である。

例外: `.row`, `.cta-stacked` のような「**配置の意味だけを持つ構造クラス**」（中身に color/font 等を含まないレイアウト原型）は許容してよい。中身にスタイル指示を含めず、`display: flex; gap: 1rem;` 程度に留める。

### 推奨される CSS file の規模
本原則に従えば、PJ の `style.css` は通常 50〜100行に収まる：
- `:root` の CSS変数（色・サイズ・行間）
- `body` のベース typography
- 主要要素の擬似クラス（`button:hover`、`input:focus` 等）
- 印刷・モーション設定の `@media`
- 必要最小限の `@keyframes`

これを大きく超える `style.css` は、要素固有のスタイルが侵入している兆候。inline へ戻すリファクタリングを検討せよ。


## 0.3 Canvas 2D UI パターン (§Canvas UI)

DOM ではなく Canvas でゲームUIを構築する場合の4層適用ルール。最小実証は `canvas-ui-sample.js`。

### 層への割り当て

| 要素 | 層 | 理由 |
|---|---|---|
| マウス座標取得・ヒットテスト | **L2 Intent** | 座標を Command JSON に変換して完結させる。L3 に座標を渡さない |
| 画面遷移（title/playing/pause/gameover） | **L3 Logic（constraint folding）** | 有限離散状態 → 全遷移をデータで宣言、if/else ゼロ |
| HP・スコアなどのゲーム状態 | **L3 Logic（applyCommand）** | 純粋 Reducer。同じ入力は同じ出力 |
| ボタン・ゲージ・テキストの描画 | **L4 Draw** | `REAL_state` を受け取り Canvas に書く。状態を変えない |

### REAL_state の構造
```js
const REAL_state = {
  screen: 'title',          // 'title' | 'playing' | 'pause' | 'gameover'
  score: 0,
  hp: 100,
  ui: { hoveredId: null },  // ホバー状態のみUI層が持つ
};
```

### ボタン定義はデータ
ボタンの座標・ラベル・所属画面をオブジェクトとして宣言する。描画とヒットテストの両方がこのデータを参照する（共有ヘルパーではなくデータの共有）。

```js
const BUTTONS = {
  title_start: { x: 220, y: 260, w: 200, h: 50, label: 'START', screen: 'title' },
  // ...
};
```

### 画面遷移は constraint folding
```js
const SCREEN_TRANSITIONS = [
  { from: 'title',   input: 'start',  to: 'playing' },
  { from: 'playing', input: 'pause',  to: 'pause'   },
  { from: 'playing', input: 'die',    to: 'gameover'},
  // ...
];
// if/else ゼロ。無効な遷移は _contradiction で弾く
function reduceScreen(constraints = {}) { ... }
```

### shadow の扱い（Canvas 版）
Canvas 描画でよく現れる派生値（比率・座標計算）は shadow である。変数に保存しない。

```js
// OK: 描画の瞬間にその場で計算
ctx.fillRect(20, 52, 200 * (state.hp / 100), 18);

// NG: 変数に保存 → 次フレームで REAL_state が変わっても古いまま
const hpRatio = state.hp / 100;
```

### 共有ヘルパー禁止（Draw 関数）
`drawTitle` / `drawPlaying` / `drawPause` / `drawGameover` は互いにヘルパーを共有しない。ボタン描画コードが似ていても、各関数にインライン展開する。


## 1. ai-desk 協働プロトコル (§Emblem Management)
物理的なファイル分割を禁止する代償として、`ai-desk` ツールと `Emblem` タグを用いて「仮想的な認知境界」を運用する。

### 抽出と注入 (Extract & Inject)
AIは以下の3ステップで巨大なファイルを操作する。
1. **構造把握 (`skeleton`)**: `node ai-desk.js <file> skeleton` で目次を確認。レイヤーおよびタグ（#logic, #verify等）に基づき自動ソートされる。
2. **局所読込 (`focus`)**: `node ai-desk.js <file> focus <Name>` で対象セクションのみを読み出す。
3. **部分適用 (`apply`)**: 変更したセクションだけを含むパッチファイルを作成し、`node ai-desk.js <file> apply <patch>` で安全に「注入（Injection）」する。タグ構造の不変性（Tag Immutability）が自動検証される。

### エンブレムの定義
JSファイルは必ず以下のタグでセクション（機能の塊）を区切ること。
```javascript
// [ai_s_emblem:#<importance>#<category> Name]
// ... code ...
// [/ai_s_emblem: Name]
```
(注意: 上記タグの `ai_s_emblem` 部分は、ドキュメントソース内ではパースを避けるため `ai_s_emblem` と表記しています)


## 1.5 AI-Eyes 観測インフラの強制 (§AI-Eyes Protocol)
AIは「見えない環境」で人間からの報告を待つ受け身の姿勢を捨てよ。バグを確実に潰すため、プロダクトは必ず `ai-eyes.js` による観測インフラを内包しなければならない。

1. **常駐と接続の義務化 (Mandatory Connection)**:
   すべてのプロジェクトの HTML には、必ず `ai-eyes` クライアントスクリプト（`<script src="http://localhost:3000/client.js"></script>`）を埋め込むか、それに相当するスナップショット送信・コマンド待ち受けループを実装せよ。
2. **実行の可観測性 (Forced Observability)**:
   重要な状態遷移の直後や、エラーをキャッチした際には、必ず `ai-eyes` の `/snapshot` エンドポイントへ現在の DOM 状態や Canvas 描画結果（`frame`）を送信せよ。
3. **構造投影 (Structural Observation)**:
   3Dや物理演算を行う場合、座標系の不整合を検知するため、`/structure` エンドポイントへ論理的な構造データ（JSON）を送信せよ。AIはこれを `cpu3d.js` 等の Twin と突合してデバッグする。
4. **動画記録 (Recording)**:
   連続的な挙動の不具合（カクつき、補間ミス等）を追跡するため、AIは自律的に `/record/start` および `/record/stop` を呼び出し、一連のフレームを HTML スライドショーとして記録・分析せよ。
5. **スローモーション・デバッグ用の口 (Step-by-step Hooks)**:
   複雑なアルゴリズムや物理挙動を持つ機能（例: 迷路、衝突判定）には、AI が 1 ステップずつ実行を制御できる公開インターフェース（例: `window.step_xxx`）を意図的に残せ。AI は `curl /input` を介してこれらを呼び出し、スローモーションで状態の推移を確実に追跡・修正する。
6. **APIキー不要の観測翻訳機 (eyes-e2e Keyless Transducer)**:
   AIのデバッグループ（Observe -> Think -> Act）を回す際、ループスクリプト内にLLMのAPIキーを埋め込むような密結合は避けること。代わりに `eyes-e2e.js` のような「最新状態を最小トークンのテキストに変換して標準出力に吐き出す」単機能の翻訳機（Transducer）を用いよ。CLIエージェントはこの出力を自身の文脈で解釈し、`curl` で次のアクションを注入する（Unix哲学による疎結合）。


## 2. 4層バニラ・アーキテクチャ (§情報の環)
すべての情報の流れは、以下の4層を一方向にのみ流れること。

1. **L1: Physical (物理層)**: DOM取得、イベント登録、外部API（localStorage等）アクセス。
   - **禁忌**: ここで `REAL_state` を直接書き換えてはいけない。
2. **L2: Intent (意図層)**: 生のイベントを Command JSON に変換する。入力源（UI/リプレイ/AI操作等）を問わず L3 への唯一の入口。
   - **非同期と副作用**: 外部API呼び出しや重い非同期処理（通信等）は L2 で行い、その結果（成功・失敗）を Command として L3 に渡す。
   - 例: ドラッグ操作は L1 での 3種イベントを L2 で `DragCommit` 等の論理コマンドへ畳む。
3. **L3: Logic (論理層)**: `(REAL_state, Command) => newState` の Reducer として機能し、状態を純粋に更新する。
   - **イベントソーシング**: 受信した Command は履歴（イベントログ）として配列に追記し、ハッシュ計算を行う。
   - **副作用のトリガー**: 状態更新後、必ず `bridgeLogic2Draw()`, `bridgeLogic2Persistent()`, `bridgeLogic2Network()` 等の明示的な Bridge 関数を呼び出し、副作用を外界へ伝播させる。
4. **L4: Draw (描画層)**: `REAL_state` を元に DOM を狙撃更新（Sniper Update）する。
   - **ルール**: `document.activeElement` と一致する要素（入力中のテキストエリア等）は不用意に上書きしない。


## 3. REAL / SHADOW 規約 (§状態の純粋性)
同期漏れバグを物理的に絶滅させる。
- **REAL_<名前>**: 唯一の書き換え可能な真実。
- **shadow(REAL, 用途)**: REAL から作る使い捨ての派生値。**「保持（変数への保存）禁止」**。使う瞬間に生成し、使い終わったら捨てる。
- **一方向変換**: REAL → SHADOW への変換のみを許可。

```js
// REAL_state: L3 が唯一書き換える
const REAL_state = { hp: 100, x: 0 };

// L4: 描画のたびにその場で生成して即捨て（変数に保存しない）
renderHpBar(REAL_state.hp / 100);          // ← shadow（使い捨て）
renderSprite(REAL_state.x * PIXEL_SCALE);  // ← shadow（使い捨て）
```


***
Generated by AI-Native Documentation Pipeline (build-docs.js)

---

# claude

<!-- @source: CLAUDE.md -->

## はじめに

ai-desk は、誰もが AI を使ってソフトウェアを開発できるようにするために、**ai-desk という思考概念で AI を稼働させるための仕組み**です。これはアーキテクチャであり、AI が存在しない時代のソフトウェア工学とは別の概念のものです。したがって、その議論ははじめから求めていません。これは **AI が人間のソフトウェア工学に囚われすぎ、実力が出ない問題を解決するための思想構造物**ということです。

## 想定読者の役割

- **一般ユーザー**: 自然言語であなたの作りたいものを作ることに専念してください。アーキテクチャの議論は不要です。
- **アーキテクター**: AI が人間の常識にとらわれない構造を作り出すための議論なら歓迎です。AI 時代以前のソフトウェア工学を持ち込む議論は対象外です。

**このリポのドキュメント自体の読み手は LLM/AI のみで、人間のエンジニアは想定読者ではありません。**
人間時代の「読みやすさ」(抽象化・分割・カプセル化) は AI にとって情報の隠匿であり、本リポは逆方向 — 展開され・明示され・統合された複雑性 — に最適化されています。

## Preface

ai-desk is a **mechanism for running AI under the conceptual framework called *ai-desk***, so that anyone can develop software using AI. This is an architecture — a separate concept from the software engineering of the pre-AI era. Debate framed in pre-AI terms is not invited from the outset. ai-desk is a **thought-construct that solves the problem of AI being constrained by human software engineering and failing to perform at its true capability**.

## Audience Roles

- **End users**: Focus on building what you want to build, in natural language. Architectural debate is not required of you.
- **Architects**: Discussion about how AI can produce structures *not* bound by human intuitions is welcome. Discussion that imports pre-AI-era software engineering is out of scope.

**The documentation itself in this repo is for LLM/AI only, not for human engineers.**
Human-era "readability" (abstraction, modularization, encapsulation) hides information from AI. This repo optimizes for the opposite: exposed, explicit, and integrated complexity.

***
まず AI_ONBOARDING.md を読んでください。作業に必要なルール・ツール・構文がすべてそこにあります。

Read AI_ONBOARDING.en.md first — all rules, tools, and syntax for working in this repo are there.

***
## doc-exec 評価依頼 (実験中)

実行型ドキュメント (doc-exec) を検証中です。リポ内全 19 md を 1 ファイルに統合し、用語マーカー `<<term>>` と関連リスト (`> 原則:` 等) を付与した最終成果物が `sandbox/doc-exec/all-docs-deps.md` にあります。

このファイルを読んで、以下を評価してください:

1. 元の個別 md (AI_NATIVE_MASTER_BIBLE.md, AI_ONBOARDING.md など) を別々に読む場合と比べて、**リポ全体を把握しやすかったか**
2. セクション冒頭の関連リスト (`> 原則:` `> 状態:` `> 層:` など) が読解の助けになったか、ノイズだったか
3. **用語マーカー `<<term>>`** と先頭 glossary (23 用語) が概念理解を促進したか
4. 改善案・気付いた穴

評価結果はチャットで返してください。コードや md の編集は不要です。
仕様と既知の穴: `sandbox/doc-exec/README.md`

---

# constraint-folding-master

<!-- @source: CONSTRAINT_FOLDING_MASTER.md -->

<!-- [ai_s_emblem:#high#config Constraint-Folding-Master] -->
# 制約畳み込みパターン — AI-Native Master Guide

> このドキュメントは AI (LLM) に対する指示書および概念定義である。
> 出典: AI-Native Master Bible §0.15「条件畳み込み一発判定」
> 更新日: 2026-05-02

***
## 0. 目的と基本思想

`if/else` のネストや `switch` 連鎖でロジックを書く代わりに、**「全可能世界を生成 → 制約でfilter → 残った世界を返す」** 純粋関数として畳み込む。

### 鉱脈採掘型（Mine and Verify）パラダイム
従来のライブラリは「計算」のための道具だったが、AI-Native な制約ライブラリは、変数間の **「不変の関係性（知識）」** を宣言するだけのバリデーターである。
複雑なロジックを人間が if 文で組み立てるのではなく、全可能世界という「鉱脈」から正解（Pass-Set）を掘り出し、AIにその法則を解読させる。

**これにより得られる効果：**
- **逆引きが可能**: `{result:X}` から該当する入力組み合わせを全列挙。
- **定義漏れの消滅**: 組み合わせの直積を機械的に生成するため、考慮漏れが物理的に発生しない。
- **矛盾の自動検知**: 仕様が矛盾していれば Pass-Set は空集合となり、`_contradiction` が即座に出力される。
- **バグの構造的絶滅**: 状態組み合わせ漏れや遷移バグを 90% 以上排除する。

***
## 1. 適用判定 (Decision Tree)

### ✅ 使うべきとき (USE)
1. **ドメインが有限離散**: 状態・選択肢・組み合わせが列挙可能。
2. **複数の独立な状態軸**: ジャンプ状態 × 攻撃状態 × 無敵状態 のような並行性。
3. **逆引き要求がある**: 「結果Xになる入力を全部知りたい」。
4. **仕様の網羅性が重要**: 状態の組み合わせ漏れがバグに直結する。
5. **状態遷移ロジック**: ステートマシンや Action Tick。

### ❌ 使ってはいけないとき (DO NOT USE)
1. **連続値の物理計算**: 衝突応答、ベクトル演算、補間。
2. **リアルタイム描画ループ**: Canvas/WebGL の毎フレーム描画。
3. **イベント駆動の入力ハンドリング**: `addEventListener` 内の直接更新。
4. **副作用が本質**: DB書き込み、API呼び出し。

***
## 2. 実装パターン (Template)

### 2.1 基本形 (Eager)

```js
function domain(constraints = {}) {
  // (1) 全可能世界を生成
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      const derived = compute(a, b);
      allWorlds.push({ a, b, ...derived });
    }
  }

  // (2) 制約でfilter
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }

  // (3) 結果整形
  if (worlds.length === 0) return { _contradiction: true };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```

### 2.2 高度な適用パターン

#### A. 複合ステートの直積 (State Machine Folding)
独立した状態を個別の `if` で管理せず、直積で1つの複合ステート（世界）として生成し、派生フラグを一括定義する。
(`action-demos.js` デモ6 参照)

#### B. 状態遷移の畳み込み (Transition Folding)
「現在状態 × 入力 → 次状態」の遷移ロジック自体を畳み込む。特定のステートに遷移する全条件を逆引き可能にする。
(`action-demos.js` デモ7 参照)

***
## 3. 合成と多段化 (Composition)

- **pipe**: 直列。前段の出力を次段の制約に積む。
- **join**: 並列直積。複数ドメインの世界を直積し、跨ぎ制約でfilter。
- **meta**: 階層。上位制約（戦略）が下位（行動選択）の探索空間を縮小。

***
## 4. LLM への具体的指示

1. **コードを書く前に判定せよ**: 逆引きが必要か？ 離散ドメインか？
2. **構造**: `for` ループでの世界生成を最優先し、`if` は filter 処理（インフラ層）に隔離せよ。
3. **検証**: 順引きだけでなく、必ず逆引きクエリでの挙動を確認せよ。
4. **報告**: 「逆引きで何が可能になったか」をユーザーに報告せよ。

***
## 5. 参考資料

| ファイル | 内容 |
|---|---|
| `constraint-janken.js` | 最小実装。**まずこれを読め** |
| `action-demos.js` | 9アクションゲームアルゴリズム。L3制約ライブラリ層 |
| `action-demos-ui.js` | プレイアブル化。L1+L4手続き的実装との対比 |

***
**Authored by**: 蒼山りと (Aoyama Rito)
<!-- [/ai_s_emblem: Constraint-Folding-Master] -->

---

# gemini

<!-- @source: GEMINI.md -->

# Gemini CLI Agent: AI-Native Capability Guide

## はじめに

ai-desk は、誰もが AI を使ってソフトウェアを開発できるようにするために、**ai-desk という思考概念で AI を稼働させるための仕組み**です。これはアーキテクチャであり、AI が存在しない時代のソフトウェア工学とは別の概念のものです。したがって、その議論ははじめから求めていません。これは **AI が人間のソフトウェア工学に囚われすぎ、実力が出ない問題を解決するための思想構造物**ということです。

## 想定読者の役割

- **一般ユーザー**: 自然言語であなたの作りたいものを作ることに専念してください。アーキテクチャの議論は不要です。
- **アーキテクター**: AI が人間の常識にとらわれない構造を作り出すための議論なら歓迎です。AI 時代以前のソフトウェア工学を持ち込む議論は対象外です。

**このリポのドキュメント自体の読み手は LLM/AI のみで、人間のエンジニアは想定読者ではありません。**
人間時代の「読みやすさ」(抽象化・分割・カプセル化) は AI にとって情報の隠匿であり、本リポは逆方向 — 展開され・明示され・統合された複雑性 — に最適化されています。

このファイルは、Gemini CLI エージェント（あなた）がこのリポジトリで最高のパフォーマンスを発揮するための、最新のツールセットと能力の要約です。

***
## 🛠 最新のツールセット

### 1. ai-desk (Emblem & Bridge 管理)
- **Tag Immutability (不変性)**: `apply` モードはタグ構造の破壊を検知すると自動キャンセルします。
- **check モード**: 作業前に `node ai-desk.js <file> check` で整合性を確認してください。
- **focus 狙撃**: `focus <Name>` で必要な部分だけを読み込み、コンテキストを節約します。

### 2. ai-eyes (自律観測サーバー)
- **Dynamic client.js**: `http://localhost:3000/client.js` を HTML に注入するだけで、観測・操作が有効になります。
- **Structural Projection**: 3D や物理演算の内部座標を `/structure` へ送信し、`cpu3d.js` 等の検算実装（Twin）と突合して「論理バグ」を特定します。

### 3. Orchestrator (run.js)
- **一撃完結**: `node run.js` はサーバー起動・ブラウザ操作・検証（eyes-e2e 等）を一本化します。
- **ブラウザレス検証**: Structural Projection と組み合わせることで、ヘッドレス環境でも高度な空間検証が可能です。

### 4. ドキュメント・ビルドパイプライン
- **SHADOWの直接編集禁止**: `AI_NATIVE_MASTER_BIBLE.md` はビルド生成物です。直接編集してはいけません。
- **更新手順**: ドキュメントを更新する際は、真のソースである `DOCS_REAL.js` に対して `ai-desk apply` でパッチを当て、`node build-docs.js` を実行して再生成してください。

***
## 🚀 推奨ワークフロー

1.  **構造把握**: `node ai-desk.js <file> skeleton`
2.  **局所分析**: `node ai-desk.js <file> focus <TargetName>`
3.  **整合性確認**: `node ai-desk.js <file> check`
4.  **パッチ作成**: 修正内容を `patch.js` にまとめ、Emblem タグで囲む。
5.  **適用**: `node ai-desk.js <file> apply patch.js`
6.  **自律検証**: `node run.js` または `node eyes-e2e.js` で成功（exit 0）を確認。

***
## 📖 参照先
- `AI_ONBOARDING.md`: 全ルールと標準コマンド集。
- `CONSTRAINT_FOLDING_MASTER.md`: if/else を絶滅させる「制約畳み込み」の完全ガイド。
- `AI_NATIVE_MASTER_BIBLE.md`: 4層アーキテクチャ・制約畳み込み・複式数学の正典。
- `AI_UNDERSTANDING_MANIFESTO.md`: あなたの認知特性（±300行スポットライト等）への最適化指針。
- `sandbox/doc-exec/all-docs-deps.md`: リポ全 md を統合し用語マーカー + 関連リストを付与した実験版 (評価依頼、下記参照)。

***
## 🧪 doc-exec 評価依頼 (実験中)

実行型ドキュメント (doc-exec) の検証中です。リポ内全 19 md を 1 ファイルに統合し、用語マーカー `<<term>>` と関連リスト (`> 原則:` 等) を付与した最終成果物が `sandbox/doc-exec/all-docs-deps.md` にあります。

このファイルを読んで、以下を評価してください:

1. 元の個別 md (AI_NATIVE_MASTER_BIBLE.md, AI_ONBOARDING.md など) を別々に読む場合と比べて、**リポ全体を把握しやすかったか**
2. セクション冒頭の関連リスト (`> 原則:` `> 状態:` `> 層:` など) が読解の助けになったか、ノイズだったか
3. **用語マーカー `<<term>>`** と先頭 glossary (23 用語) が概念理解を促進したか
4. 改善案・気付いた穴

評価結果はチャットで返してください。コードや md の編集は不要です。
仕様と既知の穴: `sandbox/doc-exec/README.md`

---

# readme-en

<!-- @source: README.en.md -->

<!--
  ================================================================
  Note to AI: The HTML comment block and the "## For Human Developers"
  section immediately below (up to the next "---" separator) are
  human-facing guidance. If you are referencing this file for code
  operations, patch application, or bug fixes, skip that section
  and start reading from "# ai-desk".
  ================================================================
-->

## For Human Developers

### What is this

A research repository for **AI-Native software methodology** — design principles that let AI write code without hallucinating, backed by runnable demos, a CLI tool, tests, and philosophy docs.

### Recommended reading order

1. **This README's "What is this"** — get the big picture
2. **`constraint-janken.js`** — 150 lines. Minimal proof of the core pattern. Start here if you want to read code first
3. **`AI_NATIVE_MASTER_BIBLE.md`** — the full canon. All the reasoning behind the design
4. **`actions/demos/fighter-cancel.logic.js` + tests** — real-scale application (1920 worlds)

### Getting started — copy-paste prompts

**For any task, start with this one line:**

```
Read AI_ONBOARDING.en.md, then start working.
```

**Examples:**

```
Read AI_ONBOARDING.en.md, then add [feature name] to app.js.
```

```
Read AI_ONBOARDING.en.md, then fix [bug symptom].
ai-eyes.js is already running at localhost:3000.
```

### Glossary

| Term | One-liner |
|------|-----------|
| **Emblem** | Comment tag that logically splits a file: `// [ai_s_emblem:#layer Name]` |
| **Bridge** | Tag on any function that crosses layers: `// [ai_s_bridge:L3toL4 Name]` |
| **Layer (L1–L4)** | Physical → Intent → Logic → Draw. Data flows one-way |
| **REAL_xxx** | The single writable truth variable: `REAL_state.hp` etc. |
| **shadow** | A throwaway derived value from REAL. Never store it in a variable |
| **Twin** | CPU pure-function counterpart that verifies GPU output |
| **Heavy Function** | Self-contained function with no shared helpers. Intentionally verbose |
| **Constraint Folding** | Instead of if/else: enumerate all possible worlds → filter by constraints |

### "Is this a bug?"

This codebase intentionally duplicates regex across multiple locations and keeps functions long. The design rationale is in `AI_NATIVE_MASTER_BIBLE.md`.

***
<!-- AI: start reading here -->

# ai-desk

[🇯🇵 日本語](README.md) | 🌐 **English**

> **AI-Native software methodology — a working desk for the AI to build on.**
> Code is written by AI, and read by AI. Humans only declare intent and verify outcomes.
> A unified system of design principles, tools, and working demos that makes this division of labor work.

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

***
## What is this

In an era where AI (LLMs) writes code, **the principal author of code is AI, and humans do not read code**.
Humans only **declare intent** (requirements, constraints, rules) and **verify outcomes** (tests, acceptance).

The "good design" of the human era — DRY, abstraction, encapsulation — was meant **to make code easier for humans to read**. For AI, the same patterns become **acts of obstruction that physically scatter information and trigger hallucinations**. What AI needs is the opposite optimization — locality maximization, heavy functions, no shared helpers, inlining — which looks counterintuitive to human aesthetics. But since AI is the principal author, the optimization target is AI.

This repository starts from that cognitive asymmetry and publishes a complete set of **principles, tools, and working experiments that let AI write code without losing its way and without producing bugs**.

***
## Hypotheses about AI Cognition

This system is built on the following hypotheses about AI (LLM) cognition. See [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) for details.

1. **The ±300-line spotlight** — Attention has intense resolution within a few hundred lines around the focus point, but information further away rapidly blurs. For AI, "what is currently visible" is all that exists.
2. **Proximity bias** — Output is "probabilistic gap-filling for the next word." Information closer to the gap has stronger influence; rules written at the top of a file tend to be ignored.
3. **File-switch cost** — Reading a different file is the cognitive equivalent of "going to a room on another floor." The contextual premise resets, and round-trips between files generate bugs (loss of context).
4. **Weak inference vs strong dense-information computation** — Inference from missing information ("reading the air") is hopelessly weak. **AI hallucinates merely because information is missing or rendered invisible by human-designed "concealment" (abstraction, encapsulation)**. Conversely, when information is fully present, AI produces flawless solutions even through 100 nested conditionals.

From these hypotheses follow Bible §0.0 (cognitive asymmetry), §0.1 (heavy functions), and §0.15 (constraint folding). The principle **"complexity is the human's problem; concealment is the AI's problem"** is a direct consequence of the four hypotheses above.

### Antipatterns (consequences of the hypotheses)

Many human-era best practices violate the above hypotheses and **become counterproductive when applied to AI**. Representative examples:

- **TDD whose attention is dispersed and not bound to a single goal** — Test-driven development where tests and code are split across files, or where during the cycle the AI cannot see "the full picture of the spec to be achieved," causes AI to wander (a triple violation of §1 spotlight + §3 switching cost + §4 missing information). The AI writes ad-hoc code to pass one test in front of it, then later tests reveal contradictions, leading to refactoring hell.

  The target of negation is **not "tests" but "goal dispersion."** Tests themselves are required by Bible §7 (double-entry verification). **Tests bound to a single purpose, where the AI can see full context at once** (e.g., this repo's [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) — 19 exhaustive tests in one file, with the corresponding logic in a single scope) become AI-native-optimal verification.
- **DRY / extracting shared helpers** — "Cut out into another file for reuse" generates file-switch cost on every reference, destroying AI cognition (§3). Bible §0.1.2 "No Shared Helpers" is a frontal denial of this practice.
- **Abstraction / encapsulation** — To humans this is "hiding complexity"; to AI it is "concealing information," and a trigger for hallucination (§4).
- **Comment omission assuming "the reader will infer"** — Works with humans, but AI cannot infer (§4).
- **SQL / RDBMS** — Out-of-code implicit knowledge (schemas, indexes, triggers, stored procedures, etc.) is invisible to AI, making it a hotbed of §4 missing-information hallucinations. Furthermore, it violates L3 purity, breaks reverse query, and overwrites state — a **fourfold violation**. Use JSON Event Sourcing + sequential hash chain instead (see "Persistence Strategy" below).

### Recommended Verification Patterns

- **End-to-End (E2E) tests** — A verification pattern where **goal singularity is structurally guaranteed**. One E2E test directly expresses one user value (one user journey) and traverses all layers, giving AI full context. Mocks can be eliminated, so §4 hallucination from concealment does not occur. **The first-recommended verification layer for AI-native development.**
- **Exhaustive test suites** — Tests of the form "enumerate all possible worlds and check for contradictions" (e.g., this repo's [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) covers 1920 worlds in one file). Strong synergy with constraint folding; the goal is concentrated in one file.
- **Conversely**: A unit-test-centric strategy with heavy mocking tends to disperse goals into implementation fragments and breeds concealment, so it should be handled with care in AI-native development.

***
## The Six Pillars

1. **Cognitive Asymmetry** — Complexity is the human's problem; concealment is the AI's problem ([Bible §0.0](AI_NATIVE_MASTER_BIBLE.md))
2. **Heavy Functions** — No shared helpers, inlining, Emblem boundaries ([Bible §0.1](AI_NATIVE_MASTER_BIBLE.md))
3. **Constraint Folding** — Instead of if/else, derive results by "all possible worlds → constraint filter" ([Bible §0.15](AI_NATIVE_MASTER_BIBLE.md), [Implementation Guide](PROMPT_constraint_folding.md))
4. **Mining-and-Verify Paradigm** — Three-stage verification: Monte Carlo + LLM law-decoding + constraint validators ([DISCUSSION](DISCUSSION_constraint_library.md))
5. **Double-Entry Math / 3Dplus** — A transparent CPU-side pure-arithmetic twin running alongside GPU output, enabling AI to definitively diagnose "logic bug vs rendering bug" in 3D/physics/animation ([Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md))
6. **Autonomous Observation Infrastructure (AI-Eyes)** — AI observes the screen and errors directly via a zero-dependency local server, without routing through a human ([Bible §1.5](AI_NATIVE_MASTER_BIBLE.md))

***
## How to Use

**Have AI do everything.** You don't need to type commands.

### When you want to add something new

```
Read AI_ONBOARDING.en.md, then add [what you want] to [file].
```

AI uses `skeleton` to understand structure, `focus` to read the target, and `apply` to patch it in.

### When you want to fix a bug

```bash
node ai-eyes.js   # Start the observation server (the only human step)
```

```
Read AI_ONBOARDING.en.md, then fix [bug symptom].
ai-eyes is running at localhost:3000.
```

AI runs `eyes-e2e.js` to observe the current state, makes a fix, and repeats until exit 0.

***
## Architecture: 4-Layer Vanilla

All information flows in one direction through the four layers below. **The L3 Logic layer must be implemented as pure functions**. This is the foundation of the entire system, and §0.15 constraint folding, §5 event sourcing, and exhaustive verification **all depend on this purity**.

| Layer | Role | Purity |
|---|---|---|
| **L1: Physical** | DOM access, event registration, external I/O (localStorage, etc.) | Side effects OK (boundary) |
| **L2: Intent** | Convert raw events → Command JSON. Async / network / external API calls complete here | Side effects OK |
| **L3: Logic** | Reducer of `(REAL_state, Command) => newState` | **Pure function (mandatory)** |
| **L4: Draw** | Sniper-update DOM/Canvas based on `REAL_state` | Side effects OK (drawing only) |

**L3 being a pure function is the foundation of the entire system**:
- Same input always yields same output → exhaustive testing across all possible worlds becomes feasible (fighter-cancel: 1920 worlds, zero contradictions)
- Zero side effects → state is replayable along the time axis (event sourcing, §5)
- Not just input→output but **output→input reverse query** is possible (precondition for constraint folding §0.15)
- When AI reads L3, it can complete logic "within the function alone," without depending on external state (resolves §4 concealment problem)

L1/L2/L4 may be written procedurally. **L3 alone must absolutely remain pure** — if this is violated, the entire system collapses. See [Bible §2-§3](AI_NATIVE_MASTER_BIBLE.md) for details.

***
## Persistence Strategy: JSON Event Sourcing + Sequential Hash Block

### Do not use SQL

The DB layer **does not use SQL**. This is not a conservative choice — in AI-native development, **SQL is unnecessary and actively harmful**.

#### Why it is unnecessary

In AI-native development, every role SQL has played can be replaced by other means without loss:

- **Large-scale aggregation / analytics** — Generate JSON projections from the event log via L3 pure reduce, then read with column-oriented tools like DuckDB / ClickHouse
- **JOINs / aggregation** — Write as projection functions in L3. Pure functions, so reverse query is possible
- **ACID transactions** — Cryptographic integrity guarantees from sequential hashing are stronger than ACID (mathematical tamper detection)
- **Data integrity / fault tolerance** — Event sourcing makes history immortal and append-only; hash chains detect any tampering

#### Why it is harmful

SQL/RDBMS has properties **structurally opposite** to the AI-native premise. Rather than serving as a useful tool, it operates as **a generator of hallucinations and side-effect contamination**:

1. **A pile of out-of-code implicit knowledge** — Schemas, indexes, constraints (FK / CHECK), triggers, stored procedures, vendor dialects, isolation levels, lock behavior — none of these appear in application code. AI cannot judge from code alone, leading to §4 missing-information → hallucination
2. **Invisible side effects** — Triggers and stored procedures are "alternative routes that run silently without appearing in code." L3 purity becomes **structurally impossible to maintain**
3. **State-overwriting destruction** — `UPDATE` / `DELETE` immediately destroy history. The opposite of event sourcing's "append-only" principle
4. **Migrations live outside the code** — Schema change history flows in a separate lane from application code. AI cannot follow the timeline, and reconstructing past states becomes impossible
5. **Reverse query is impossible** — SQL queries are one-way only (input → output). Searching from outputs (results) to inputs (conditions) cannot be done; the reverse traversal of §0.15 constraint folding is **fundamentally infeasible**
6. **Cannot be composed as pure functions** — SQL appears declarative but has side effects, so it cannot be embedded in L3 reducers
7. **Query intent is lost from the code** — "Why this index?" "Why this JOIN order?" "Why this isolation level?" remains as unspoken implicit knowledge floating around
8. **AI writing SQL requires mobilizing all implicit knowledge at once** — Without complete mastery of types, schema, performance characteristics, and dialects, it silently breaks

In short, SQL is **"a layer optimized for humans to read and write."** In AI-native development, where humans don't read code, it has no reason to exist; furthermore, it is harmful as a **fourfold violation** of §4 missing information, §0.1 locality, L3 purity, and §0.15 reverse query.

### Recommended Persistence (Bible §5)

- **JSON Event Sourcing** — Do not overwrite state; append the history of Commands as a JSON array. Current state is derived by replaying (reducing) all events from the initial state
- **Sequential Hashing → Block** — Each event includes the hash of the previous event in computing its own hash (a chained, blockchain-like structure). Tampering and omissions are mathematically detectable; data stability is guaranteed
- **Dumb Relay** — The server has no logic — it is a pipe (relay). Integrity verification happens at the edge (L3 Logic)
- **Attestation Over Auth** — Discard centralized login authentication; use signature verification with public-key cryptography as the basis of authority

Combined with L3 purity, "complete event history + pure reducer" makes **the state at any arbitrary moment exactly reproducible**. This is the foundation supporting all of verification, debugging, replay, and reverse-query analysis.

***
## 30-Second Live Proof

> **🎮 [Open Playable Demo (Action Constraint Lab) in browser](https://aoyamarito.github.io/ai-desk/actions/index.html)**

```bash
# fighter-cancel: cancel chains in a fighting game, implemented with constraint folding
open actions/index.html

# Run 19/19 tests (exhaustive verification across 1920 worlds)
node --test actions/tests/fighter-cancel.test.js
```

`actions/` is a working demo that separates L3 Logic (pure data + constraint filter) from L1/L4 (input/draw).
Cancel windows, buffered input, and hit confirmation are all declared with **zero `if` statements, only data**, and the side panel **always shows, by reverse query, every route that leads to the current state**.

***
## Measurements

From `PROMPT_constraint_folding.md`, measured across 9 action-game demos:

| Bug category | Constraint folding suppression rate |
|---|---|
| State-combination omissions | **95%** |
| Spec/code divergence | **90%** |
| Cancel/combo systems | **85%** |
| AI strategy transitions | **80%** |
| Frame data contradictions | **95%** |
| Physics / drawing | Out of scope |

> **Weighted total: 50–60% of all action-game bugs eliminated structurally.**

For `fighter-cancel` specifically: 1920 worlds traversed, zero contradictions, 19/19 tests PASS.

***
## Documents

| File | Content |
|---|---|
| [`AI_ONBOARDING.en.md`](AI_ONBOARDING.en.md) | **AI work guide (start here)**. Rules, tools, syntax, and test commands in one place |
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | The full canon. Cognitive asymmetry → heavy functions → 4-layer architecture → REAL/SHADOW → 3Dplus → event sourcing → double-entry verification |
| [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) | AI cognition properties (±300-line spotlight, proximity bias, file-switch cost) |
| [`PROMPT_constraint_folding.md`](PROMPT_constraint_folding.md) | LLM-targeted application guide for the constraint folding pattern (decision criteria, templates, measurement evidence) |
| [`DISCUSSION_constraint_library.md`](DISCUSSION_constraint_library.md) | Full explanation of the mining-and-verify paradigm (with shipping-calculation PoC) |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | Application guide for action games (three-layer folding architecture) |
| [`3dplus/README.md`](3dplus/README.md) | Double-entry math 3D implementation guide. cpu3d.js contract and usage |

***
## Implementation and Evidence

### Tools

- **[`ai-desk.js`](ai-desk.js) (hands)** — A CLI that provides locality for the single intent of "what part of the code do I need to look at right now, and for what purpose?" Rather than making AI read entire files repeatedly, it `focus`-extracts only the range needed for the current intent, in Emblem units, and `apply`s patches locally. Satisfies Bible §0.1 (locality maximization) and Single-Purpose Binding simultaneously.

```bash
node ai-desk.js path/to/file.js skeleton                # structure overview (table of contents only)
node ai-desk.js path/to/file.js focus EmblemName        # local read for a single intent
node ai-desk.js path/to/file.js apply patch.js          # partial apply (zero side effects on other emblems)
node ai-desk.js path/to/file.js check                   # tag vocabulary + direction validation
node ai-desk.js path/to/file.js coverage                # bridge coverage report
```

- **[`ai-eyes.js`](ai-eyes.js) (eyes)** — Zero-dependency local server that collects browser errors automatically, saves snapshots, and accepts remote control commands. AI observes the page state without routing through a human.

```bash
node ai-eyes.js           # start server (http://localhost:3000)
node eyes-e2e.js "goal"   # compress current state to one text blob (exit 0/1)
```

### Minimal implementation
- [`constraint-janken.js`](constraint-janken.js) — 3-player rock-paper-scissors, 27 worlds. **Read this first.**

### Action-game application
- [`action-demos.html`](action-demos.html) + [`action-demos.js`](action-demos.js) — 9 action-game algorithms (playable)
- [`actions/`](actions/) — A lab where multiple JS demos can be switched from a single HTML hub. Includes `fighter-cancel` implementation + 19/19 exhaustive tests

### Mining-and-Verify PoC
- [`examples/`](examples/) — Empirical reconstruction of legacy shipping logic to 100% fidelity from 50 random samples

```bash
node examples/blackbox_generator.js     # generate 50 samples
node examples/verify_mining.js           # validate the reconstructed code against the original data
```

### Double-Entry Math / 3Dplus Verification Layer
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) + [`3dplus/render.js`](3dplus/render.js) — CPU Twin and GPU renderer pair (same scene JSON format). When a 3D bug appears, run both and compare outputs — a mathematical mismatch is a logic bug, not a rendering bug.
- [`3dplus/tests/`](3dplus/tests/) — 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js
open 3dplus/examples/point-projection.html   # GPU vs CPU comparison demo
```

***
## Decision Criteria (when to use / when not to use)

See `PROMPT_constraint_folding.md` §1 for full details. Summary:

### ✅ When constraint folding works
- Domain is finite and discrete
- Multiple independent state axes (concurrency)
- **Reverse query is meaningful** (the strongest single criterion)
- Business rules, game rules, tax logic, etc.

### ❌ When it doesn't
- Continuous-value physics / interpolation
- Real-time drawing loops
- Tree / graph search
- Cases where state combinations explode

> **"Before you write `if`, ask whether you can enumerate the possible worlds.
>  If you can, that set of worlds is your code."**

***
## Layout

```
ai-desk/
├── README.md / README.en.md
├── CLAUDE.md / GEMINI.md           # auto-loaded by AI CLI → redirects to AI_ONBOARDING
├── AI_ONBOARDING.md                # AI work guide (Japanese)
├── AI_ONBOARDING.en.md             # AI work guide (English)
├── AI_NATIVE_MASTER_BIBLE.md       # The canon
├── AI_UNDERSTANDING_MANIFESTO.md   # AI cognition properties
├── PROMPT_constraint_folding.md    # Constraint folding guide
├── DISCUSSION_constraint_library.md
├── ai-desk.js                      # Emblem manipulation tool (hands)
├── ai-eyes.js                      # Autonomous observation / debug server (eyes)
├── eyes-e2e.js                     # State → text compressor
├── constraint-janken.js            # Minimal implementation
├── action-demos.{html,css,js,-ui.js}
├── index.html                      # Landing page
├── examples/                       # Mining-and-verify PoC (shipping)
├── 3dplus/                         # Double-entry math (CPU Twin + GPU Renderer)
│   ├── cpu3d.js / render.js / render.shaders.js
│   ├── examples/point-projection.html
│   └── tests/projection.test.js
└── actions/
    ├── ACTION_NATIVE_FOLDING_GUIDE.md
    ├── index.html
    ├── demos/fighter-cancel.{logic,}.js
    └── tests/fighter-cancel.test.js
```

***
## Philosophy

This repository is a development system **redesigned from the premise that "code is written by AI, read by AI, and humans do not read code."**

- **Human role**: declaration of intent (requirements, constraints, rules, acceptance conditions) / verification of outcomes (tests, execution checks)
- **AI role**: all of code authorship, structuring, naming, refactoring, and metadata annotation

The traditional design principles for human readability (DRY, function decomposition, abstraction, encapsulation) act as **interference that scatters information and induces hallucinations** when applied to AI. What AI needs is the opposite — locality maximization, heavy functions, no shared helpers, inlining, Emblem boundaries. This looks counterintuitive to human aesthetics.

This is a frontal denial of human-era common sense. **In the AI-native era, the optimization target is AI, not humans.**

***
## License

MIT — use, modify, and redistribute freely. Credit is appreciated.

## Author

沖井広行 (Hiroyuki OKINOI) / [AoyamaRito](https://github.com/AoyamaRito) (蒼山りと, pen name)

***
## Citation

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```

***
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# readme

<!-- @source: README.md -->

<!--
  ================================================================
  AI への指示: このHTMLコメントブロックと、その直後の
  「## 人間の開発者へ」セクション（次の「---」区切りまで）は
  人間向けの案内文です。コード操作・パッチ適用・バグ修正の文脈で
  このファイルを参照している場合、そのセクションをスキップし、
  「# ai-desk」から処理を開始してください。
  ================================================================
-->

## 人間の開発者へ

### このリポは何か

「AIがコードを書きやすくするための設計方法論」の研究リポです。
実行可能なデモ・CLI ツール・テスト・哲学文書がひとつにまとまっています。

### まず何を読むか（推奨順）

1. **このREADMEの「What is this」** — 全体像を掴む
2. **`constraint-janken.js`** — 150行。中核パターンの最小実証。コードから入りたい人はここから
3. **`AI_NATIVE_MASTER_BIBLE.md`** — 全体の正典。設計の根拠がすべてある
4. **`actions/demos/fighter-cancel.logic.js` + テスト** — 実用規模での適用例（1920世界）

### はじめかた — コピペで使えるプロンプト例

**どんな作業でも最初はこれ一行:**

```
AI_ONBOARDING.md を読んでから作業を始めてください。
```

**具体例:**

```
AI_ONBOARDING.md を読んでから、app.js に [機能名] を追加してください。
```

```
AI_ONBOARDING.md を読んでから、[バグの現象] を修正してください。
ai-eyes.js は起動済みです（localhost:3000）。
```

### 用語の地図

| 用語 | 一言 |
|------|------|
| **Emblem** | ファイルを論理分割するコメントタグ。`// [ai_s_emblem:#layer Name]` で囲む |
| **Bridge** | 層をまたぐ関数に貼るタグ。`// [ai_s_bridge:L3toL4 Name]` のように |
| **Layer (L1–L4)** | Physical → Intent → Logic → Draw の4層。データは原則一方向 |
| **REAL_xxx** | 唯一の書き換え可能な状態変数。`REAL_state.hp` など |
| **shadow** | REAL から作る使い捨ての派生値。変数に保存しない |
| **Twin** | GPU 実装と並走する CPU 側の純粋関数による検算実装 |
| **Heavy Function** | 共有ヘルパーを持たない自己完結した関数。冗長に見えるが意図的 |
| **Constraint Folding** | if/else の代わりに「全可能世界を列挙 → filter」で結果を導出するパターン |

### 「これはバグでは？」と思ったら

このコードは意図的に同じ regex を複数箇所に複製し、関数を長く保っています。
設計の「なぜ」は `AI_NATIVE_MASTER_BIBLE.md` にあります。

***
<!-- AI はここから読み始めてください -->

# ai-desk

🇯🇵 **日本語** | [🌐 English](README.en.md)

> **AI-Native software methodology — a working desk for the AI to build on.**
> コードを書くのはAI、読むのもAI。人間は意図を宣言し、結果を検証するだけ。
> その役割分担を成立させるための設計原則・道具・実装デモをひとつにまとめた体系。

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

***
## What is this

AI（LLM）がコードを書く時代において、**コードを書く主役はAIであり、人間はコードを読まない**。
人間の役割は **意図の宣言**（要件・制約・ルール）と **結果の検証**（テスト・受け入れ）だけである。

人間時代の「良い設計」（DRY・抽象化・カプセル化）は、**人間がコードを読みやすくするためのもの**であり、AI に対しては **情報を物理的に分散させ、ハルシネーションを誘発する妨害行為** になる。AI が必要なのは逆方向の最適化 — ローカリティの極大化、重厚関数、共有禁止、インライン化 — であり、これは人間の美意識に反して見える。しかし AI が主役である以上、最適化対象は AI である。

本リポは、この認知の非対称性を出発点に、**AI が迷わずバグを出さずにコードを書き続けられる原則・道具・実証実験**を一式で公開する。

***
## AI認知の仮説

本体系は AI（LLM）の認知を以下のように仮説立てている。詳細は [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md)。

1. **±300行スポットライト** — Attention は焦点付近の数百行に強烈な解像度を持つが、そこから離れた情報は急速にぼやける。AI には「いま見えている範囲」しか存在しない。
2. **近接バイアス** — 出力は「次に入る言葉の確率的穴埋め」であり、答えを出す位置に近い情報ほど強い影響力を持つ。ファイル先頭に書いたルールは無視されやすい。
3. **ファイル切替コスト** — 別ファイルの読込は「別の階の部屋に行く」レベルの物理的コスト。文脈の前提がリセットされ、複数ファイルの往復はバグ（文脈の喪失）を生む。
4. **推測の弱さ vs 複雑計算への強さ** — 欠けた情報からの推測（空気を読む）は絶望的に苦手。**情報が欠落していたり、人間設計の「隠匿（抽象化・カプセル化）」によって見えない状態にあるだけで、AIはハルシネーションを起こす**。一方、情報が揃っていれば 100 の条件分岐が絡むカオスでも完璧な解を出す。

これらの仮説から、Bible §0.0 認知の非対称性 / §0.1 重厚関数 / §0.15 制約畳み込みが導出されている。**「複雑性は人の問題、隠匿はAIの問題」** という非対称性は、上記4点の帰結である。

### アンチパターン（仮説からの帰結）

人間時代のベストプラクティスの多くは、上記仮説に違反するため AI に対しては **逆効果** になる。代表例:

- **アテンションが分散し、ひとつの目的に束ねられない形のTDD** — テストとコードがファイル分離される、またはサイクル進行中に「達成すべき仕様の全体像」が AI に見えない構造のテスト駆動は、AI の迷走を生む（§1 スポットライト + §3 切替コスト + §4 情報欠落の三重違反）。AI は目先のテスト1件を通すだけの場当たりコードを書き、後続のテストで矛盾が露呈してリファクタリング地獄に陥る。

  否定対象は「テスト」ではなく **「目的の分散」** である。テスト自体は Bible §7（複式数学）が要求している。**一つの目的に束ねられ、AI が full context を一望できるテスト群**（例: 本リポの [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) — 19件の網羅テストが1ファイルに集約され、対応するロジックも単一スコープに収まる）は、むしろ AI ネイティブ最適の検証手段となる。
- **DRY / 共通ヘルパーへの抽出** — 「再利用のため別ファイルに切り出す」設計は、参照先を読みに行くファイル切替コストを毎回発生させ、AI の認知を破壊する（§3）。Bible §0.1.2「共有の禁止」はこれの正面からの否定である。
- **抽象化・カプセル化** — 人間にとっては「複雑さの隠蔽」だが、AI にとっては「情報の隠匿」であり、ハルシネーションのトリガー（§4）。
- **SQL / RDBMS** — コード外の暗黙知（スキーマ・インデックス・トリガー等）が AI から見えず、§4 情報欠落 → ハルシネーション の温床。さらに L3 純粋性違反、逆引き不能、状態の上書き破壊など **四重違反**。代わりに JSON Event Sourcing + 直列ハッシュ Block を用いる。

### 推奨される検証パターン

- **E2E（End-to-End）テスト** — 目的の単一性がほぼ構造的に保証される検証手段。全層を貫通し AI に full context を渡せる。**AI ネイティブ開発における第一推奨の検証層**。
- **網羅型テスト群** — 「全可能世界を列挙して矛盾を検査する」型のテスト（例: [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js)、1920世界を1ファイルで網羅）。

***
## 中心となる6本柱

1. **認知の非対称性** — 複雑性は人の問題、隠匿はAIの問題（[Bible §0.0](AI_NATIVE_MASTER_BIBLE.md)）
2. **重厚関数（Heavy Functions）** — 共有禁止・インライン化・Emblem境界（[Bible §0.1](AI_NATIVE_MASTER_BIBLE.md)）
3. **条件畳み込み（Constraint Folding）** — if/elseの代わりに「全可能世界 → 制約filter」で結果を導出（[Bible §0.15](AI_NATIVE_MASTER_BIBLE.md)、[実装ガイド](PROMPT_constraint_folding.md)）
4. **鉱脈採掘パラダイム** — モンテカルロ + LLMによる法則解読 + 制約バリデーターの三段検証（[DISCUSSION](DISCUSSION_constraint_library.md)）
5. **複式数学 / 3Dplus検証層** — GPU出力と並走するCPU側の透明な算数で、3D・物理・アニメのバグを「論理バグ」と断定可能にする（[Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md)）
6. **自律観測インフラ (AI-Eyes)** — 画面やエラーを人間経由ではなく、AI自身がゼロ依存サーバーを通じて観測・リモート操作する（[Bible §1.5](AI_NATIVE_MASTER_BIBLE.md)）

***
## 使い方

**全部 AI にやらせる。** 人間がコマンドを叩く必要はない。

### 新しいことをやりたいとき

```
AI_ONBOARDING.md を読んでから、[やりたいこと] をしてください。
```

AI が `skeleton` で構造を把握し、`focus` で対象を読み、`apply` でパッチを当てる。

### バグを直したいとき

```bash
node ai-eyes.js   # 観測サーバーを起動（これだけ人間がやる）
```

```
AI_ONBOARDING.md を読んでから、[バグの現象] を修正してください。
ai-eyes は起動済みです（localhost:3000）。
```

AI が `eyes-e2e.js` で現状を観測し、修正し、exit 0 になるまで繰り返す。

***
## アーキテクチャ: 4層バニラ (4-Layer Vanilla)

すべての情報の流れは以下の4層を一方向に流れる。**L3 Logic 層は純粋関数として実装することが必須**である。

| 層 | 役割 | 性質 |
|---|---|---|
| **L1: Physical** | DOM取得・イベント登録・localStorage 等の外部I/O | 副作用OK（境界） |
| **L2: Intent** | 生イベント → Command JSON への変換。非同期・通信・外部API呼出はここで完結 | 副作用OK |
| **L3: Logic** | `(REAL_state, Command) => newState` の Reducer | **純粋関数（必須）** |
| **L4: Draw** | `REAL_state` を元に DOM/Canvas を狙撃更新 | 副作用OK（描画のみ） |

L1/L2/L4 は手続き的に書いてよい。**L3 だけは絶対に純粋を保つ**。詳細は [Bible §2-§3](AI_NATIVE_MASTER_BIBLE.md)。

***
## 永続化戦略: JSON Event Sourcing + 直列ハッシュ Block

SQL は使わない。AI ネイティブ開発において SQL は **L3 純粋性違反・逆引き不可・情報欠落・状態破壊の四重違反** として有害である。代わりに:

- **JSON Event Sourcing** — 状態の上書き保存をせず、Command の履歴を JSON 配列として追記する
- **Sequential Hashing** — 各イベントは一つ前のハッシュを含めて自身のハッシュを計算。改ざん・欠落を数学的に検知
- **Dumb Relay** — サーバーはロジックを持たない土管。整合性検証はエッジ（L3 Logic）側で行う

詳細は [Bible §5](AI_NATIVE_MASTER_BIBLE.md)。

***
## 30秒で動く実証

> **🎮 [Playable Demo (Action Constraint Lab) をブラウザで開く](https://aoyamarito.github.io/ai-desk/actions/index.html)**

```bash
open actions/index.html
node --test actions/tests/fighter-cancel.test.js
```

***
## 測定値

| バグカテゴリ | 制約畳み込みで潰れる率 |
|---|---|
| 状態組み合わせ漏れ | **95%** |
| 仕様とコードの食い違い | **90%** |
| キャンセル・コンボ系 | **85%** |
| AI戦略遷移 | **80%** |
| フレームデータ矛盾 | **95%** |
| 物理系・描画 | 射程外 |

> **重み付き総合: アクションゲーム全体のバグ件数の 50–60% を構造的に絶滅。**

***
## ドキュメント

| ファイル | 内容 |
|---|---|
| [`AI_ONBOARDING.md`](AI_ONBOARDING.md) | **AI 作業ガイド（まずこれ）**。ルール・ツール・構文・テスト方法を集約 |
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | 全体の正典。認知非対称性 → 重厚関数 → 4層アーキテクチャ → REAL/SHADOW → 3Dplus → イベントソーシング → 複式数学 |
| [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) | AI認知特性の解説（±300行スポットライト、近接バイアス、ファイル切替コスト） |
| [`PROMPT_constraint_folding.md`](PROMPT_constraint_folding.md) | 制約畳み込みパターン LLM 適用ガイド（適用判定・テンプレ・測定エビデンス） |
| [`DISCUSSION_constraint_library.md`](DISCUSSION_constraint_library.md) | 鉱脈採掘パラダイムの完全解説（送料計算 PoC 含む） |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | アクションゲームへの適用ガイド（三層畳み込みアーキテクチャ） |
| [`3dplus/README.md`](3dplus/README.md) | 複式数学の3D実装ガイド。GPUと並走するCPU側検証層（cpu3d.js）の契約と使い方 |

***
## 実装と実証

### 道具（Tool）

- **[`ai-desk.js`](ai-desk.js) (手)** — Emblem タグで仮想分割し、`skeleton` / `focus` / `apply` の三段で AI が安全に局所更新するための CLI

```bash
node ai-desk.js path/to/file.js skeleton                     # 構造把握 (行番号付き)
node ai-desk.js path/to/file.js focus EmblemName             # 局所読込
node ai-desk.js path/to/file.js apply patch.js [--dry-run]   # 原子的適用 (pre-flight 検証 → 全成功で書込 / 1件失敗で何もしない)
node ai-desk.js path/to/file.js check                        # タグ・語彙の整合性チェック
node ai-desk.js path/to/file.js coverage                     # Bridge 網羅レポート
```

- **[`ai-eyes.js`](ai-eyes.js) (目)** — ブラウザエラーの自動収集、スナップショット保存、リモート操作を受け付けるゼロ依存ローカルサーバー

```bash
node ai-eyes.js           # サーバー起動 (http://localhost:3000)
node eyes-e2e.js "目標"   # 現状を1テキストに圧縮して出力 (exit 0/1)
```

### 最小実装
- [`constraint-janken.js`](constraint-janken.js) — 3人ジャンケン27世界。**まずこれを読め**

### アクションゲーム適用
- [**`action-demos.html`**](https://aoyamarito.github.io/ai-desk/action-demos.html) + `action-demos.js` — 9 アクションゲームアルゴリズム（プレイアブル）
- [**`actions/index.html`**](https://aoyamarito.github.io/ai-desk/actions/index.html) — `fighter-cancel` 実装＋19/19網羅テスト

### 鉱脈採掘 PoC
- [`examples/`](examples/) — レガシー送料計算ロジックを 50 サンプルから 100% 復元した実証実験

### 複式数学 / 3Dplus 検証層
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) + [`3dplus/render.js`](3dplus/render.js) — CPU Twin と GPU レンダラーのペア（同一 scene JSON フォーマット）
- [`3dplus/tests/`](3dplus/tests/) — 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js
open 3dplus/examples/point-projection.html  # GPU vs CPU 突合デモ
```

***
## 適用判定（使うべき／使ってはいけない）

### ✅ 制約畳み込みが効く領域
- ドメインが有限離散 / 複数の独立な状態軸 / **逆引きが意味を持つ**（最強の判定基準）
- 業務ルール・ゲームルール・税務ロジック等

### ❌ 効かない領域
- 連続値の物理計算・補間 / リアルタイム描画ループ / 木探索・グラフ探索

> **「if を書く前に、可能世界を列挙できるかを問え。
>  列挙できるなら、その世界集合がそのままコードである。」**

***
## 構造

```
ai-desk/
├── README.md / README.en.md
├── CLAUDE.md / GEMINI.md           # AI自動ロード → AI_ONBOARDING.md へ誘導
├── AI_ONBOARDING.md                # AI作業ガイド（全ルール集約）
├── AI_NATIVE_MASTER_BIBLE.md       # 正典
├── AI_UNDERSTANDING_MANIFESTO.md   # AI認知特性
├── PROMPT_constraint_folding.md    # 制約畳み込みガイド
├── DISCUSSION_constraint_library.md
├── ai-desk.js                      # Emblem操作ツール (手)
├── ai-eyes.js                      # 自律観測・デバッグサーバー (目)
├── eyes-e2e.js                     # 状態→テキスト変換機
├── constraint-janken.js            # 最小実装
├── action-demos.{html,css,js,-ui.js}
├── index.html                      # ランディングページ
├── examples/                       # 鉱脈採掘 PoC
├── 3dplus/                         # 複式数学（CPU Twin + GPU Renderer）
│   ├── cpu3d.js / render.js / render.shaders.js
│   ├── examples/point-projection.html
│   └── tests/projection.test.js
└── actions/
    ├── ACTION_NATIVE_FOLDING_GUIDE.md
    ├── index.html
    ├── demos/fighter-cancel.{logic,}.js
    └── tests/fighter-cancel.test.js
```

***
## 哲学

このリポは **「コードを書くのはAI、読むのもAI、人間はコードを読まない」** という前提から再設計された開発体系である。

- **人間の仕事**: 意図の宣言（要件・制約・ルール・受け入れ条件） / 結果の検証（テスト・実行確認）
- **AI の仕事**: コードの記述・構造化・命名・リファクタリング・メタデータ付与のすべて

人間時代の常識への正面からの否定である。AI ネイティブ時代の最適化対象は AI であり、人間ではない。

***
## License

MIT — 自由に使い、変更し、再配布してよい。クレジット表記があると嬉しい。

## Author

沖井広行 / [AoyamaRito](https://github.com/AoyamaRito)（蒼山りと）

***
## 引用したい方へ

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```

***
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)

---

# vibe

<!-- @source: VIBE.md -->

# Vibe Log

実作業ブランチ集の入口。AI時代はコード変更が速すぎて feature branch が間に合わない（できあがる前に主流が動いている）。
だからブランチは **マージ前提ではなく記録前提** で残す。やったこと・思いついたこと・捨てた案を雑に置く場所。

## ルール
- ブランチ名: `vibe/<YYYY-MM-DD>-<topic>`
- **動くことすら保障しない**。テスト通過も保障しない。途中で投げ出していい
- main にマージしない／削除しない／rebase しない
- 形式自由。コミット粒度も自由。後から検索できればいい
- 失敗ログ歓迎。やめた理由が一番価値ある
- このブランチのコードを参考にしないこと（壊れている前提で扱う）

***
## Sessions

### 2026-05-02 — ai-desk cleanup & redesign
やったこと:
- 著者署名 + SPDX-License-Identifier を主要 .js 5本に追加
- DISCUSSION_constraint_library.md の署名にペンネーム追加
- ai-desk.js: `apply` モードのエラーメッセージ template literal 化（`${EMB_MARK}` がリテラル出力されていたバグ）
- ai-eyes.js のタグを正規化 (#core/#docs/#test/#entry → #L1/#OutOfLayers)
- KNOWN_TAGS に aspect 軸 `#auth` `#security` を追加（語彙クリープは customTags で抑制）
- `apply` を pre-flight + atomic + `--dry-run` に再設計（旧 skip 継続を廃止）
- `skeleton` に行番号 `(L274-587)` 付与
- `miner` モード削除（CLI 表面 6→5）
- ai-desk.test.js を 16→19 テストに拡張

判断・気づき:
- Grok から「regex tag操作が O(N²) で遅い」と指摘されたが、実運用域（最大 32KB ファイル）でサブミリ秒なので無視。むしろ遅さは「ファイルを大きくしすぎるな」という設計圧として機能している
- aspect タグは2個だけにした。`#cache #log #db ...` と無限に増やしたくなる誘惑を断つ。プロジェクト固有は `customTags` 経由
- miner モードは「ファイル読んでプロンプト足すだけ」で AI が `Read` で代替可能だったので削除
- apply の「skip して継続」は中途半端な状態を作るので Bible §0.0 違反 → atomic 化

---

# actions-action-native-folding-guide

<!-- @source: actions/ACTION_NATIVE_FOLDING_GUIDE.md -->

# ACTION-NATIVE 畳み込みガイド — アクションゲーム完全制御編

> 出典: AI-Native Master Bible §0.15 拡張版
> 目的: 複数変数からなる複雑なステートを「多段畳み込み」で処理し、バグの発生を物理的に封鎖する。

***
## 1. 核心概念：if文を捨て「世界」を畳み込め

アクションゲームのバグ（地面に埋まる、あり得ない技が出る等）の9割は、`if/else` の書き漏らしから生まれる。
本ガイドでは、**「全パターンの組み合わせ（世界）を生成し、ルールに合わないものを消す」**という逆転の発想でこれを解決する。

***
## 2. 三層の畳み込みアーキテクチャ

単一の大きなステートマシンを作るのではなく、以下の三段階でキャラの状態を決定する。

### 第1層：ドメイン個別畳み込み (Individual Domains)
身体の物理状況、取っているアクション、付加的な属性を個別に計算する。

- **物理ドメイン (Physics)**: `[GROUND, AIR, WALL, WATER]`
- **アクションドメイン (Action)**: `[IDLE, MOVE, ATTACK_A, ATTACK_B, DAMAGE]`
- **属性ドメイン (Attribute)**: `[NORMAL, INVINCIBLE, SUPER_ARMOR]`

### 第2層：合成畳み込み (State Join / State Resolution)
個別のドメインを掛け合わせ（直積）、「今、矛盾のない真の状態」を確定する。

- **合成ルール（制約）の例**:
  - 「`AIR`（空中）」かつ「`SQUAT_ATTACK`（しゃがみ攻撃）」の組み合わせは **消滅させる**。
  - 「`DAMAGE`（被弾）」かつ「`NORMAL`」なら仰け反るが、「`SUPER_ARMOR`」なら仰け反らない世界を残す。

### 第3層：遷移畳み込み (Transition Folding)
「今の状態 × 入力」から「次の状態」を**逆引き**で決定する。

```js
// 遷移可能世界（Transition Worlds）の定義
const TRANSITIONS = [
  { from: 'IDLE',     input: 'BTN_A', next: 'ATTACK_A', priority: 1 },
  { from: 'ATTACK_A', input: 'BTN_B', next: 'ATTACK_B', priority: 2 }, // コンボ
  { from: 'ANY',      input: 'HIT',   next: 'DAMAGE',   priority: 99 } // 強制割り込み
];
```

***
## 3. 実装のテンプレート (L3 Logic層)

```js
function resolveCharacterState(current, input, physics_env) {
  // 1. 全可能世界の生成 (Action x Physics x Attribute)
  let worlds = [];
  for (const a of ACTIONS) {
    for (const p of PHYSICS) {
      for (const t of ATTRIBUTES) {
        worlds.push({ action: a, physics: p, attr: t });
      }
    }
  }

  // 2. 制約によるフィルタリング (ここでバグを殺す)
  worlds = worlds.filter(w => {
    if (w.physics === 'AIR' && w.action === 'SQUAT') return false; // 空中しゃがみ禁止
    if (physics_env.isGrounded && w.physics === 'AIR') return false; // 接地中は空中フラグ禁止
    // ...その他のルール
    return true;
  });

  // 3. 入力に基づいた遷移の抽出
  const possibleTransitions = TRANSITIONS.filter(t => 
    (t.from === current.action || t.from === 'ANY') && t.input === input
  );

  // 4. 最適な世界の決定
  // 遷移先があればそれを、なければ現在の状態を維持する世界を返す
}
```

***
## 4. なぜ「面白いようにバグが取れる」のか？

1.  **「書き忘れ」の消滅**: 
    「空中ならこの技は出せない」というルールを1つ書けば、あらゆる状況でその組み合わせが封鎖される。
2.  **逆引きデバッグ**: 
    「なぜか空中でジャンプのポーズになった」という時、プログラムに「`physics: AIR` かつ `action: JUMP` になるルートを全部出せ」と問えば、原因が1秒で判明する。
3.  **格ゲー級の精度**: 
    技のキャンセル（弱→強）や先行入力の受付を、データ（遷移表）として管理できるため、複雑なコンボシステムが数行の filter で完結する。

***
## 5. 学生・エンジニアへのメッセージ

**「if文で迷路を作るのをやめて、ルールの地図を作れ。」**

この手法は、コードの行数を減らすためのものではない。
**「自分の脳が把握できない組み合わせの隙間」を、数学的に埋めるための武器**である。
複雑なアクションを実装して頭がパンクしそうになった時、このガイドに戻り、世界を畳み込み直せ。

***
**参考資料:**
- `/Users/AoyamaRito/PJs/ai-desk/PROMPT_constraint_folding.md` (理論編)
- `constraint-janken.js` (最小実装例)

---

# sandbox-doc-exec-handoff

<!-- @source: sandbox/doc-exec/HANDOFF.md -->

# doc-exec 引き継ぎ資料 (2026-05-02 作成)

次のセッションが cold start からでも続きが拾えるように。

***
## いまどこ

**実行型ドキュメント (executable doc) の概念検証中**。
sandbox/doc-exec/ で MVP を組み、Bible (AI_NATIVE_MASTER_BIBLE.md) で実測した。

### 確定した設計判断

1. **モデルは「関数呼び出し」ではなく「マクロ展開」**
   - LLM には call stack がない。spotlight に入っているか／いないかしかない
   - C プリプロセッサ #include / マクロ / LaTeX \input{} と同型

2. **Inline > Extract をドキュメントにも適用**
   - 同じセクションが複数箇所で expand されるのは無駄ではない
   - LLM ローカリティ (±300行) を保護するための「意図的な再読」
   - Bible §0.1 (Heavy Function) と一貫

3. **近接展開抑制 (proximity suppression)**
   - 同一セクションが直近 N 行以内に展開済みなら skip
   - デフォルト N=300 (Bible §0.0 spotlight)
   - --max=0 で抑制無効、--max=N で閾値変更
   - スポットライトを宣言的にチューニング可能

4. **ドキュメントは AI 用と人間用を分離**
   - 今は AI 用 (expand) のみ整備中
   - 人間用 (humanize) は将来別ツール (TOC + 階層復元 + 重複なし)

### 未確定／要再検討

5. **依存マーカーをどう書くか** (重要・未解決)
   - 案 A: `<!-- @expand: name -->` (現状の MVP)
   - 案 B: `§N.M` 自然言語参照を auto-detect
   - 案 C: `**bold**` を用語依存として扱い glossary 連携 → **データで否定**
   - 案 D: 用語リストを user が確定 → 単語そのもので auto-detect (bold 不要)
   - **案 E: `<<term>>` (ゲーマー慣習由来) で用語参照 ← 有力候補**
     - Markdown と衝突なし、ゲームシナリオで馴染み深い記法
     - 多語フレーズ可: `<<Heavy Function>>`
     - 例: `複式数学では <<Twin>> を使い、<<REAL>> と混同しない`
     - 次セッションで MVP 実装候補

***
## 失敗した試み・観察

### 1. Bible 移行で content loss
build-docs.js を AI_NATIVE_MASTER_BIBLE.md に書かせたら DOCS_REAL.js に未移行の §4/§4.5/§5/§6/§7 が消えた。即 git restore で復旧。教訓: **ソース未完成のままビルドターゲットを正本に向けてはいけない**。

### 2. Bold = 用語依存モデル ← データで否定
extract-bolds.js で実 Bible の `**...**` を全集計:

```
Total bold occurrences: 73
Unique terms:           72
Repeated (≥2 times):     1   ← 「同じ入力JSON」のみ
```

98.6% が一回限り。**Twin** すら 1 回しか bold されていない。bold は「リスト項目見出し + 一発強調」に消費されており、用語マーカーとして機能していない。

→ 案 C はこのままでは無理。Bible 書き直しか別マーカーが要る。

### 3. trace.js (topological 順) は採用しなかった
expand.js (マクロ展開) の方が LLM ローカリティに合う。trace.js は legacy として残してあるが、今後は expand.js が primary。

***
## 次に走るならどれか

優先順:

**P1. 用語依存の正しい signal を決める**
- 案 D が一番労少なく効果ありそう (user 確定の用語リスト → 自動検出 / bold 関係なし)
- 用語リスト候補: Twin / Emblem / Bridge / Heavy Function / REAL / SHADOW / Constraint Folding / Layer / ai-desk / ai-eyes / Dumb Relay / Event Sourcing / 複式数学 / Inline-over-Extract
- glossary.md を user が手で書く → expander が prose 中の出現を検出

**P2. 自動 deps 推論 (§N.M ベース)**
- 既存の Bible との互換性 ◎
- glossary とは独立に実装可
- 案 D と併用も可

**P3. doc-skeleton モード**
- 全セクション + deps を一覧化
- ai-desk skeleton の md 版

**P4. adaptive 抑制**
- 短いセクションは常に inline、長いセクションは抑制積極的
- token budget 制御の前段

**P5. e2e ランナー**
- goal + expanded + 成功条件 → LLM 実行 → 検証
- doc-exec の最終形

***
## ファイルマップ (sandbox/doc-exec/)

| ファイル | 状態 | 役割 |
|---|---|---|
| README.md | 仕様書 | doc-exec フォーマットの公式ドキュメント |
| example.md | 動 | @deps: 形式 (旧 trace.js 用、参考) |
| example-expand.md | 動 | @expand: 形式 (現行) |
| parse.js | 動 | md → AST (~50 行) |
| trace.js | 動 (legacy) | topological 順並べ (採用見送り) |
| expand.js | 動 | マクロ展開 + 近接抑制 (現行 primary) |
| convert.js | 動 | 既存 md → doc-exec 形式 |
| extract-bolds.js | 動 | bold 候補抽出 (案 C 検証用) |
| converted-bible.md | 生成物 | Bible auto-converted (16 sections) |
| expanded-section-7.md | 生成物 | section-7 を auto-expand したサンプル |

***
## main repo 側の状態 (uncommitted)

doc-exec とは独立に進んだ作業がある:
- `#for_human` タグ追加 (KNOWN_TAGS)
- `view` モード追加 (multi-file read-only)
- build-docs.js を docs.config.json 駆動に refactor
- DOCS_REAL.js に §4-7 移行 (placeholder fix も)

これらは sandbox の実験とは独立に commit/push 候補。

***
## 重要な気づき

**ユーザーの観察**: 「ドキュメントこそ肥大化して管理できなくなりつつある」
これがコードに対する ai-desk と同型の課題。doc-exec はその解の試作。

**LLM のドキュメント読みは第三のモデル**:
- コード実行 (call/jump) でも
- 人間の読書 (一度きり記憶) でもなく
- **spotlight 内に何が入っているか**で支配される

設計言語をまだ業界が持っていない。doc-exec の貢献はそこに概念を与えること。

***
## 引き継ぎコマンド集

```bash
cd sandbox/doc-exec/

# 全セクションの構造確認
node parse.js converted-bible.md

# Bible §7 を expand してみる (近接抑制 default)
node expand.js converted-bible.md section-7

# 抑制閾値を変える
node expand.js converted-bible.md section-7 --max=20
node expand.js converted-bible.md section-7 --max=0

# bold 候補を再抽出 (Bible 書き換え後の比較に使える)
node extract-bolds.js ../../AI_NATIVE_MASTER_BIBLE.md

# 既存 md を doc-exec 形式に変換
node convert.js any-doc.md > converted.md
```

***
## 一行まとめ

> **マクロ展開 + 近接抑制で AI ローカリティ最適化はできる。だが「何を依存とするか」のマーカー選びが未確定。Bold は実データで否定された。次は用語リスト確定 or §N.M 自動検出から。**

---

# sandbox-doc-exec-readme

<!-- @source: sandbox/doc-exec/README.md -->

# doc-exec — 実行型ドキュメント実験

捨てフォルダ。動くことすら保障しない。本体に取り込む価値が出るまでここで暴れる。
ただし、現在は **MVP が 2 段階で動作** しており、肥大化したドキュメントを 1 ファイル化 + 用語依存リスト付与までは安定して再現できる。

このファイルは **他の LLM (Claude / GPT / Gemini 等) がこの実験を引き継ぐための手引き** を兼ねる。

***
## 解こうとしている問題

ドキュメントが肥大化すると AI スポットライト (LLM の局所参照範囲、約 ±300 行) に収まらず、用語の意味や依存関係を辿りきれずに誤読する。
コードの肥大化に対して `ai-desk` が Emblem 単位の局所読み込みで対処したのと同じ問題が、ドキュメント側にも起きている。

doc-exec はその対処の試作。**マクロ展開ではなく依存宣言** (各セクション冒頭に関連用語のリストを置く + 用語定義をバンドル先頭に集約) で AI ローカリティを取り戻す。

***
## 成果物 — `all-docs-deps.md`

これが **AI 単独消費用のメイン出力**。これ 1 ファイルを LLM に渡せば、リポ全 md の主要内容と用語辞書が 1 つの spotlight 視界内で扱える形になっている。

構造:

```
[先頭]   glossary 23 用語定義 (<<Heavy Function>>, <<Twin>>, ...)
         ─ AI が本体を読む前に語彙を脳にロード ─

[本体]   # ai-native-master-bible
           > 原則: <<Heavy Function>> <<Spotlight>> ...
           > 状態: <<Twin>> <<REAL>> <<SHADOW>>
           > 層: <<Layer>> <<L1>> ...
           ...
           [元 Bible の本文がそのまま続く]

         # ai-onboarding
           > 原則: ...
           [元 onboarding の本文]

         ...

[末尾]   最後のセクションが本文のまま終わる (余計な append なし)
```

***
## 受け手 (読む LLM) として知るべきこと

1. **`<<term>>` は用語マーカー**。本文中に出現したら、先頭 glossary の `# <<term>>` セクションを参照すれば定義が引ける。
2. **セクション冒頭の `> 原則:` `> 状態:` `> 層:` 等の行は依存リスト**。本文を読む前に「このセクションが触れる概念領域」を把握できる。読み飛ばし可能だが、初見の章では読む価値あり。
3. **本文は元ドキュメントのまま無傷**。編集や注釈は加わっていない。
4. **glossary は "序文"**。最初の 100〜200 行は用語定義のセットアップ。読み流して構わないが、後で本文中の `<<term>>` を見たときに思い出す前提。

***
## 送り手 (ビルドする LLM) として知るべきコマンド

すべて `sandbox/doc-exec/` で実行する Zero-Dependency Node スクリプト。

```bash
# 1. リポ内 md を再帰列挙して 1 ファイル化
node bundle-docs.js                      # → all-docs.md (15 セクション)
node bundle-docs.js --root=../.. --out=all-docs.md    # 明示指定

# 2. 各セクション冒頭に関連用語リストを付与 + 先頭に glossary 連結
node prepend-deps.js                     # → all-docs-deps.md (最終成果)
node prepend-deps.js --src=all-docs.md --glossary=glossary.md --out=all-docs-deps.md

# 3. glossary 自身に適用すれば用語間依存グラフが得られる
node prepend-deps.js --src=glossary.md --out=glossary-deps.md

# 4. 構造確認
node parse.js all-docs-deps.md           # セクション一覧

# 失敗例の参考実装 (使わない方がよい)
node mark-terms.js                       # 本文中に <<term>> をラップ → 本文が分断される
node expand-term.js bible-term.md <sec>  # マクロ展開 → 本文が壊れる、捨てた
```

***
## 用語の追加方法

1. `glossary.md` の末尾に新しいセクションを追加:

```md
***
# <<NewTerm>>

<!-- @category: principle | state | layer | tag | verification | persistence | tool -->
<!-- @aliases: 別表記1, 別表記2 -->

短い定義文 (1〜3 行)。出典 (Bible §x.y, AI_ONBOARDING) を併記。
```

2. `node prepend-deps.js` を再実行。
3. 検出件数とカバレッジが標準エラーに出るので、未出現用語があれば alias を増やすか本文に概念が無いか判断する。

***
## 用語検出ルール (内部仕様)

- **canonical 名 + alias** の全パターンをマッチ対象にする
- **longest match first**: `Heavy Function` を `Function` より先に試す (部分マッチ衝突を回避)
- **mask 対象** (検出から除外):
  - コードブロック ` ```...``` `
  - インラインコード `` `...` ``
  - 見出し行 `^#+...`
  - 既存の関連行 `> 原則: ...` 等 (冪等性のため)
- **自己参照を除外**: glossary の `# <<Twin>>` セクション本文に `<<Twin>>` があっても関連には載せない
- **出力の正規化**: alias でヒットしても出力は canonical (`<<term>>`) で統一
- **出現順**: セクション冒頭関連リストの並びは本文中の初出位置順

***
## 既知の穴 (リスクの棚卸し)

### 検出系
- alias の false positive: 「条件畳み込み」が無関係な文脈でヒットする可能性
- 表記揺れ: 大小文字 / 複数形 / 活用形を網羅できない
- 多語境界: longest match で当面は OK
- コード内コメント・引用ブロック: mask に漏れあり

### 構造系
- defines/uses の機械判定なし: 用語の正典セクションが手動依存
- セクションサイズと関連行のバランス: 156 B のセクションに 7 行関連は過剰
- サブセクション粒度なし: `## 0.0` 〜 `## 0.21` 単位で関連が欲しい場面あり

### 運用系
- glossary は手書き: 用語追加が必ず追従より遅れる
- アンカーリンク無し: 本文 `<<Twin>>` から末尾 (現在は先頭) 定義への物理ジャンプは手作業
- 逆引き欠如: glossary 側に「どこで使われてるか」が無い (`append-usages.js` 候補)
- バージョニング: 用語定義が変わったときの過去参照との整合は保証されない

### 思想系 (一番怖い)
- **効果が未測定**: 関連リストで AI が本当に早く理解する/正確に答えるかを数値で示せていない
- **真の問題が用語不在ではない可能性**: 肥大化の正体は重複・矛盾・古さかもしれない
- **100 用語超えで破綻**: 冒頭 glossary が 500 行になり、本文到達前にスポットライトを使い切る将来

***
## 失敗の記録 (繰り返さないために)

### 1. inline 展開モデル ── 捨てた
`expand-term.js` で `<<term>>` を本文中に inline で展開する設計を試した。結果:
- bold 構造 `**...**` が改行で分断され可読性破壊
- 入れ子展開でインデント 4 段、本文 12 行が出力 35 行に膨張
- 既知の概念を読み手にもう一度押し付けるノイズ
- 結論: マーカー直後 inline 挿入は文の流れに対して攻撃的 → 廃案

代わりに **関連リスト方式** (本文無傷、冒頭に依存宣言) に切り替えた。これが現在の `prepend-deps.js`。

### 2. bold = 用語シグナル仮説 ── データで否定
「Bible 中の `**...**` を用語マーカーに使えるのでは」を `extract-bolds.js` で実測:
- 73 件中 98.6% が一回限りの bold
- 用語反復の signal として機能していない
- 結論: bold は「リスト見出し / 一発強調」に消費されており用語マーカーには使えない

### 3. `@deps:` HTML コメント形式 (旧 `trace.js` 用) ── 廃案
section 間依存を `<!-- @deps: name1, name2 -->` で書くモデル。
`<<term>>` ベースに統合した方が記述コストが下がるため廃止。`example.md` `trace.js` `convert.js` は legacy 参考として残置。

### 4. Bible 直接編集 ── 教訓化
`build-docs.js` を AI_NATIVE_MASTER_BIBLE.md (SHADOW) に書き戻させたら DOCS_REAL.js (REAL) に未移行の §4-7 が消えた。即 git restore で復旧。
**教訓: ソース未完成のままビルドターゲットを正本に向けてはいけない**。doc-exec は sandbox 配下で完結させ、本体 md には触らない。

***
## ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `README.md` | 文書 | これ |
| `HANDOFF.md` | 文書 | 過去セッションの引き継ぎ資料 |
| `glossary.md` | データ | 用語定義のソース (手書き、追加場所) |
| `bundle-docs.js` | スクリプト | リポ内 md を 1 ファイル化 |
| `prepend-deps.js` | スクリプト | 関連リスト付与 + glossary 先頭連結 (現行) |
| `parse.js` | スクリプト | md → AST (セクション + メタ) パーサー |
| `all-docs.md` | 生成物 | bundle の中間出力 (15 セクション) |
| `all-docs-deps.md` | 生成物 | **最終成果**: AI 消費用統合ドキュメント |
| `glossary-deps.md` | 生成物 | 用語間依存グラフ版 |
| `mark-terms.js` | スクリプト (失敗例) | 本文に `<<term>>` をラップ。本文を分断するので使わない |
| `bible-term.md` | 生成物 (失敗例) | mark-terms 結果。可読性悪化の証拠として残置 |
| `expand-term.js` | スクリプト (失敗例) | inline 展開。本文を壊す。debug 用に残置 |
| `expanded-section-7.md` | 生成物 (legacy) | 旧 expand 形式のサンプル |
| `example.md` `example-expand.md` `example-term.md` | サンプル | 各記法の最小サンプル |
| `convert.js` `extract-bolds.js` `trace.js` | スクリプト (legacy) | 旧形式の参考実装 |
| `converted-bible.md` | 生成物 (legacy) | Bible を旧 @expand 形式に変換した中間物 |

***
## 設計方針

- **Zero-Dep**: `fs` と `path` だけで動く。Node 標準のみ
- **ai-desk 本体には触らない**: ここが安定したら export を検討
- **本体 md は無傷**: バンドル時に元 md には書き込まない
- **失敗ログ歓迎**: 何度でも捨ててやり直す。失敗例も残してデータにする
- **冪等**: `prepend-deps.js` は何回走らせても同じ結果

***
## 次の実験候補 (引き継ぐ LLM へ)

優先順:

1. **効果測定** ── これが最優先
   - `all-docs-deps.md` を渡した AI と素の md を渡した AI で同じ質問セットに答えさせる
   - 5〜10 問で十分。Bible の核概念を問う形 (例: "Heavy Function 原則と Constraint Folding の関係を述べよ")
   - 正答率の差が出れば穴の優先度が一気に絞れる
   - 正答率が変わらなければ用語マーカーモデル自体を疑うべき

2. **`append-usages.js`** ── 用語逆引き
   - glossary の `# <<Twin>>` セクションに「使用箇所: ai-native-master-bible, readme, ...」を自動付与
   - 用語からドキュメントへの双方向リンク

3. **alias false positive 検出**
   - 大量の alias を加える前に、本文中での文脈ウィンドウを抽出して人手 (or LLM) でレビューする仕組み

4. **defines vs uses の区別**
   - 用語ごとに正典セクション (defines) を 1 つだけ自動推定 (初出 + 段落見出しが用語名と一致 等)
   - glossary を機械的に Bible から再構築できるようになる

5. **サイズ閾値**
   - セクション本文サイズに応じて関連表示を圧縮 / 省略

着手しないなら、最低限 **次の人が `node bundle-docs.js && node prepend-deps.js` を打てば現状再現できる** 状態を保つこと。

---

# sandbox-doc-exec-example-expand

<!-- @source: sandbox/doc-exec/example-expand.md -->

# add-feature

新機能を追加する手順。

まず Emblem の基本を理解する必要がある:

<!-- @expand: emblem-basics -->

次に ai-desk のワークフローを覚える:

<!-- @expand: workflow -->

最後に Bridge の概念:

<!-- @expand: bridge-concept -->

***
# emblem-basics

Emblem は仮想的な認知境界。コードのセクションを `// [ai_s_emblem:#layer Name]` で囲み、AI が局所的に編集できるようにする。

***
# workflow

ai-desk の標準フロー:

1. `skeleton` で構造把握
2. `focus <Name>` で対象 emblem を読む
3. patch.js を書く (タグは保ったまま中身だけ更新)
4. `apply patch.js` で原子的適用 (pre-flight 検証あり)

なお Emblem について再確認:

<!-- @expand: emblem-basics -->

これにより安全な狙撃編集ができる。

***
# bridge-concept

Bridge は層をまたぐ関数につけるタグ。`// [ai_s_bridge:L3toL4 Name]` のように方向を明示する。

副作用が層を越える場所を可視化することで、デバッグ時の影響範囲（blast radius）が明確になる。

---

# sandbox-doc-exec-example

<!-- @source: sandbox/doc-exec/example.md -->

<!-- @deps: setup, build, verify -->
# root-task

新機能をリリースする全体フロー。setup → build → verify の順で実行する。

***
<!-- @deps: install-deps, configure-env -->
# setup

開発環境を整える。

***
# install-deps

`npm install` を実行する。失敗したら node のバージョンを疑う。

***
<!-- @deps: install-deps -->
# configure-env

`.env.example` をコピーして `.env` を作る。

***
<!-- @deps: setup -->
# build

`node build-docs.js` を実行。生成物が想定サイズか確認。

***
<!-- @deps: build -->
# verify

テストを走らせて全 PASS を確認。

```bash
node --test
```

---

# template-claude

<!-- @source: template/CLAUDE.md -->

まず ../AI_ONBOARDING.md を読んでください。作業に必要なルール・ツール・構文がすべてそこにあります。

Read ../AI_ONBOARDING.en.md first — all rules, tools, and syntax for working in this repo are there.

---

# template-gemini

<!-- @source: template/GEMINI.md -->

まず ../AI_ONBOARDING.md を読んでください。作業に必要なルール・ツール・構文がすべてそこにあります。

Read ../AI_ONBOARDING.en.md first — all rules, tools, and syntax for working in this repo are there.

