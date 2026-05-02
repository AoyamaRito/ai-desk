# AI-Native 開発マスターバイブル (Unified V3.5 Final)

AIと人間が共創し、バグを絶滅させ、永続的な保守性を確保するための唯一無二の正典（Single Source of Truth）。

---

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


---
Generated by AI-Native Documentation Pipeline (build-docs.js)
