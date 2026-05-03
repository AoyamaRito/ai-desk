// [ai_s_emblem:#high#config Doc-Meta]
const META = {
  title: "AI-Native 開発マスターバイブル (Unified V3.5 Final)",
  subtitle: "AIと人間が共創し、バグを絶滅させ、永続的な保守性を確保するための唯一無二の正典（Single Source of Truth）。",
  version: "3.5 (Final Architecture Edition)",
  date: "2026-05-01",
  author: "沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)"
};
// [/ai_s_emblem: Doc-Meta]

// [ai_s_emblem:#high#config Doc-Section-0-0]
const SECTION_0_0 = `
## 0.0 認知特性の非対称性 (Cognitive Asymmetry)
複雑性は AI にとっての資源（ゆりかご）であり、人にとってのみ問題である。
隠匿は AI にとって問題であり、人にとってのみ「解決」に見える。
多くの開発者はこれを誤解している。人向けの「良い設計」（抽象化・分割・カプセル化）は AI にとっての「隠匿」であり、推測という名のハルシネーションを誘発する。AI 向けの正しい設計は、人間の美意識に反して見えても、展開され・明示され・統合された複雑性（＝高密度の相関関係）として現れる。
複雑性は、論理を一点に固定するための「重力」であり、AI にとっては最も安定して思考できる環境である。
本 Bible のすべての原則は、この非対称性から導出される。
（追記：この原則を無視したコードは、AI時代において負債となる。）
`;
// [/ai_s_emblem: Doc-Section-0-0]

// [ai_s_emblem:#high#config Doc-Section-0-1]
const SECTION_0_1 = `
## 0.1 ローカリティの極大化 (Locality Maximization) と「重厚関数」
AI向けコードにおいて、ローカリティは最優先の設計原則である。ファイル分割は情報を物理的に散らし、関数分割は情報を論理的に散らす。どちらもAIに対して、参照・探索・推測のコスト（認知のジャンプ）を強要する。したがって、以下の「重厚関数（Heavy Functions）」原則を厳守する。

1. **単一完結性 (Self-Contained Logic)**:
   関数の長さを恐れるな。その機能に必要なデータの加工、条件分岐、副作用のトリガー（Bridgeの呼び出し）は、可能な限り一つのスコープ（関数）内にインラインで記述せよ。AIが「その関数だけを読めば全てがわかる」状態を維持する。
2. **共有の禁止 (No-Shared Helpers)**:
   複数の機能から呼ばれる「小さな共通ヘルパー関数」の作成は原則禁止とする。似たような処理が必要な場合は、迷わずコードを複製（Copy & Paste）し、各機能内で独立して進化させよ。重複は悪ではない。隠れた依存関係による影響範囲（Blast Radius）の不可視化こそが悪である。
3. **機能単位の認知境界 (Emblem as Boundary)**:
   小さな関数へ細分化する代わりに、機能単位で意味のある大きな関数を作り、その中の論理的なステップは \`ai-desk\` の Emblem で区切れ。これにより、AIはコンテキストを失わずに局所更新が可能になる。
4. **「抽出」より「インライン化」 (Inline > Extract)**:
   コードを短く見せるために小関数に「抽出（Extract Function）」する人間的リファクタリングは有害である。むしろ、分割された小関数を呼び出し元に「インライン化（Inline Function）」し、失われたコンテキストを一つに統合せよ。
`;
// [/ai_s_emblem: Doc-Section-0-1]

// [ai_s_emblem:#high#config Doc-Section-0-15]
const SECTION_0_15 = `
## 0.15 条件畳み込み一発判定 (Condition Folding)
複雑な条件分岐（if/else のネスト、switch の連鎖）を、純粋関数に畳み込み、一発で結果を返す設計を優先せよ。複雑性を「データ構造」として一括保持することで、AI にとっての「思考の手がかり」を最大化する。

1. **分岐ツリーの排除**:
   条件を「分岐」として逐次評価するのではなく、「データ構造」として一括保持し、フィルタリングや写像によって結果を導出する。分岐はAIにとって認知の分裂であり、パスの組み合わせ爆発を引き起こす。
2. **全可能世界の生成と制約による絞り込み**:
   正しいアプローチは「条件に合う世界だけを残す」ことである。制約ライブラリ（constraint-janken 参照）は27の可能世界を生成し、制約でfilterし、残った構造を返す。if文はゼロである。
3. **逆方向の走査が可能**:
   純粋関数に畳み込まれた条件は、入力→出力だけでなく、出力→入力の逆引きにも対応できる。これは分岐ツリーでは原理的に不可能である（分岐は一方通行）。
4. **鉱脈採掘との連携**:
   データから法則を抽出する際、AIは分岐ロジックではなく「閾値→基本値→変換」の一本道の純粋関数に畳み込む。これにより、合成されたコードの検証が容易になる（制約バリデーターに一発で通せる）。
`;
// [/ai_s_emblem: Doc-Section-0-15]

// [ai_s_emblem:#high#config Doc-Section-0-2]
const SECTION_0_2 = `
## 0.2 基本原則 (Core Principles)
- **AI Drives All (AI専用コードベース)**: 人間は意図（Intent）の宣言のみを行い、コードの記述・構造化・命名・メタデータの付与はすべて AI が行う。本規約は「AIがコンテキストを失わず、バグを出さないこと」を最優先する。
- **Zero-Dependency / Zero-Server**: 外部ライブラリやブラックボックスなサーバーを排除し、推論の透明性を100%に保つ。
- **Physical Separation**: HTML(構造), CSS(表現), JS(論理)を物理的に分離し、疎結合を保つ。これは「言語レベルでの混入禁止」を意味する（HTML 内に大きな \`<style>\`/\`<script>\` ブロックを書かない、JS 文字列で CSS を組み立てない）。要素単位の \`style="..."\` 属性は §0.21 に従い積極的に許容する。
`;
// [/ai_s_emblem: Doc-Section-0-2]

// [ai_s_emblem:#high#config Doc-Section-0-21]
const SECTION_0_21 = `
## 0.21 インライン CSS の許容（Inline Style Locality）
§0.2 「Physical Separation」が禁じるのは「HTML 内に大きな \`<style>\`/\`<script>\` ブロックを書く」「JS 文字列で CSS を組み立てる」レベルの言語混入である。要素単位の \`style="..."\` 属性はこれに該当せず、むしろ §0.1「ローカリティ極大化」と §0.1.2「共有の禁止」を優先するため、**積極的に許容・推奨する**。

### スタイルの所属判定
| 種別 | 配置 | 理由 |
|---|---|---|
| 要素固有のスタイル（位置・色・サイズ・余白） | inline \`style=""\` | §0.1 ローカリティ。要素を読むだけで把握できる。 |
| デザイントークン（色・寸法の CSS変数） | CSS file \`:root\` | テーマ一括変更可能性。inline でも \`var()\` で参照する。 |
| \`:hover\` / \`:focus\` / \`:active\` / \`:disabled\` | CSS file | inline で書けない技術的制約。 |
| \`::before\` / \`::after\` 等の擬似要素 | CSS file | 同上。 |
| \`@media\`（レスポンシブ・印刷） | CSS file | 同上。 |
| \`@keyframes\` アニメーション | CSS file | 同上。 |

### AI が編集する観点での利点
- 要素を読むだけで見た目が把握できる（§0.0 「上下300行スポットライト」に収まる）。
- 「このクラスは他で使われていないか」の探索コストが消える。
- 要素を削除すれば対応スタイルも自動的に消える（孤児CSSが発生しない）。
- ai-desk の Emblem 境界と矛盾せず、focus した範囲だけで完結する。
- 「なぜこの要素だけ赤いのか」が一目瞭然（属性に書いてある）。

### CSS class の共有禁止
§0.1.2「共有の禁止」を CSS にも適用する。複数の要素で似たスタイルが必要な場合、共通 class を作るのではなく、**各要素の inline style に複製せよ**。隠れた依存（class 1個変更で意図しない要素まで変わる）は、関数の共有ヘルパーと同じく悪である。

例外: \`.row\`, \`.cta-stacked\` のような「**配置の意味だけを持つ構造クラス**」（中身に color/font 等を含まないレイアウト原型）は許容してよい。中身にスタイル指示を含めず、\`display: flex; gap: 1rem;\` 程度に留める。

### 推奨される CSS file の規模
本原則に従えば、PJ の \`style.css\` は通常 50〜100行に収まる：
- \`:root\` の CSS変数（色・サイズ・行間）
- \`body\` のベース typography
- 主要要素の擬似クラス（\`button:hover\`、\`input:focus\` 等）
- 印刷・モーション設定の \`@media\`
- 必要最小限の \`@keyframes\`

これを大きく超える \`style.css\` は、要素固有のスタイルが侵入している兆候。inline へ戻すリファクタリングを検討せよ。
`;
// [/ai_s_emblem: Doc-Section-0-21]

// [ai_s_emblem:#high#config Doc-Section-0-3]
const SECTION_0_3 = `
## 0.3 Canvas 2D UI パターン (§Canvas UI)

DOM ではなく Canvas でゲームUIを構築する場合の4層適用ルール。最小実証は \`canvas-ui-sample.js\`。

### 層への割り当て

| 要素 | 層 | 理由 |
|---|---|---|
| マウス座標取得・ヒットテスト | **L2 Intent** | 座標を Command JSON に変換して完結させる。L3 に座標を渡さない |
| 画面遷移（title/playing/pause/gameover） | **L3 Logic（constraint folding）** | 有限離散状態 → 全遷移をデータで宣言、if/else ゼロ |
| HP・スコアなどのゲーム状態 | **L3 Logic（applyCommand）** | 純粋 Reducer。同じ入力は同じ出力 |
| ボタン・ゲージ・テキストの描画 | **L4 Draw** | \`REAL_state\` を受け取り Canvas に書く。状態を変えない |

### REAL_state の構造
\`\`\`js
const REAL_state = {
  screen: 'title',          // 'title' | 'playing' | 'pause' | 'gameover'
  score: 0,
  hp: 100,
  ui: { hoveredId: null },  // ホバー状態のみUI層が持つ
};
\`\`\`

### ボタン定義はデータ
ボタンの座標・ラベル・所属画面をオブジェクトとして宣言する。描画とヒットテストの両方がこのデータを参照する（共有ヘルパーではなくデータの共有）。

\`\`\`js
const BUTTONS = {
  title_start: { x: 220, y: 260, w: 200, h: 50, label: 'START', screen: 'title' },
  // ...
};
\`\`\`

### 画面遷移は constraint folding
\`\`\`js
const SCREEN_TRANSITIONS = [
  { from: 'title',   input: 'start',  to: 'playing' },
  { from: 'playing', input: 'pause',  to: 'pause'   },
  { from: 'playing', input: 'die',    to: 'gameover'},
  // ...
];
// if/else ゼロ。無効な遷移は _contradiction で弾く
function reduceScreen(constraints = {}) { ... }
\`\`\`

### shadow の扱い（Canvas 版）
Canvas 描画でよく現れる派生値（比率・座標計算）は shadow である。変数に保存しない。

\`\`\`js
// OK: 描画の瞬間にその場で計算
ctx.fillRect(20, 52, 200 * (state.hp / 100), 18);

// NG: 変数に保存 → 次フレームで REAL_state が変わっても古いまま
const hpRatio = state.hp / 100;
\`\`\`

### 共有ヘルパー禁止（Draw 関数）
\`drawTitle\` / \`drawPlaying\` / \`drawPause\` / \`drawGameover\` は互いにヘルパーを共有しない。ボタン描画コードが似ていても、各関数にインライン展開する。
`;
// [/ai_s_emblem: Doc-Section-0-3]

// [ai_s_emblem:#high#config Doc-Section-1-0]
const SECTION_1_0 = `
## 1. ai-desk 協働プロトコル (§Emblem Management)
物理的なファイル分割を禁止する代償として、\`ai-desk\` ツールと \`Emblem\` タグを用いて「仮想的な認知境界」を運用する。

### 抽出と注入 (Extract & Inject)
AIは以下の3ステップで巨大なファイルを操作する。
1. **構造把握 (\`skeleton\`)**: \`node ai-desk.js <file> skeleton\` で目次を確認。レイヤーおよびタグ（#logic, #verify等）に基づき自動ソートされる。
2. **局所読込 (\`focus\`)**: \`node ai-desk.js <file> focus <Name>\` で対象セクションのみを読み出す。
3. **部分適用 (\`apply\`)**: 変更したセクションだけを含むパッチファイルを作成し、\`node ai-desk.js <file> apply <patch>\` で安全に「注入（Injection）」する。タグ構造の不変性（Tag Immutability）が自動検証される。

### エンブレムの定義
JSファイルは必ず以下のタグでセクション（機能の塊）を区切ること。
\`\`\`javascript
// [EMBLEM:#<importance>#<category> Name]
// ... code ...
// [/EMBLEM: Name]
\`\`\`
(注意: 上記の \`EMBLEM\` は実際のソースでは \`ai_s_emblem\` と表記する。本ドキュメントソース内では ai-desk 自身の check と衝突しないよう placeholder にしている。Bridge も同様に \`ai_s_bridge\` が実名。)
`;
// [/ai_s_emblem: Doc-Section-1-0]

// [ai_s_emblem:#high#config Doc-Section-1-5]
const SECTION_1_5 = `
## 1.5 AI-Eyes 観測インフラの強制 (§AI-Eyes Protocol)
AIは「見えない環境」で人間からの報告を待つ受け身の姿勢を捨てよ。バグを確実に潰すため、プロダクトは必ず \`ai-eyes.js\` による観測インフラを内包しなければならない。

1. **常駐と接続の義務化 (Mandatory Connection)**:
   すべてのプロジェクトの HTML には、必ず \`ai-eyes\` クライアントスクリプト（\`<script src="http://localhost:3000/client.js"></script>\`）を埋め込むか、それに相当するスナップショット送信・コマンド待ち受けループを実装せよ。
2. **実行の可観測性 (Forced Observability)**:
   重要な状態遷移の直後や、エラーをキャッチした際には、必ず \`ai-eyes\` の \`/snapshot\` エンドポイントへ現在の DOM 状態や Canvas 描画結果（\`frame\`）を送信せよ。
3. **構造投影 (Structural Observation)**:
   3Dや物理演算を行う場合、座標系の不整合を検知するため、\`/structure\` エンドポイントへ論理的な構造データ（JSON）を送信せよ。AIはこれを \`cpu3d.js\` 等の Twin と突合してデバッグする。
4. **動画記録 (Recording)**:
   連続的な挙動の不具合（カクつき、補間ミス等）を追跡するため、AIは自律的に \`/record/start\` および \`/record/stop\` を呼び出し、一連のフレームを HTML スライドショーとして記録・分析せよ。
5. **スローモーション・デバッグ用の口 (Step-by-step Hooks)**:
   複雑なアルゴリズムや物理挙動を持つ機能（例: 迷路、衝突判定）には、AI が 1 ステップずつ実行を制御できる公開インターフェース（例: \`window.step_xxx\`）を意図的に残せ。AI は \`curl /input\` を介してこれらを呼び出し、スローモーションで状態の推移を確実に追跡・修正する。
6. **APIキー不要の観測翻訳機 (eyes-e2e Keyless Transducer)**:
   AIのデバッグループ（Observe -> Think -> Act）を回す際、ループスクリプト内にLLMのAPIキーを埋め込むような密結合は避けること。代わりに \`eyes-e2e.js\` のような「最新状態を最小トークンのテキストに変換して標準出力に吐き出す」単機能の翻訳機（Transducer）を用いよ。CLIエージェントはこの出力を自身の文脈で解釈し、\`curl\` で次のアクションを注入する（Unix哲学による疎結合）。
`;
// [/ai_s_emblem: Doc-Section-1-5]

// [ai_s_emblem:#high#config Doc-Section-2-0]
const SECTION_2_0 = `
## 2. 4層バニラ・アーキテクチャ (§情報の環)
すべての情報の流れは、以下の4層を一方向にのみ流れること。

1. **L1: Physical (物理層)**: DOM取得、イベント登録、外部API（localStorage等）アクセス。
   - **禁忌**: ここで \`REAL_state\` を直接書き換えてはいけない。
2. **L2: Intent (意図層)**: 生のイベントを Command JSON に変換する。入力源（UI/リプレイ/AI操作等）を問わず L3 への唯一の入口。
   - **非同期と副作用**: 外部API呼び出しや重い非同期処理（通信等）は L2 で行い、その結果（成功・失敗）を Command として L3 に渡す。
   - 例: ドラッグ操作は L1 での 3種イベントを L2 で \`DragCommit\` 等の論理コマンドへ畳む。
3. **L3: Logic (論理層)**: \`(REAL_state, Command) => newState\` の Reducer として機能し、状態を純粋に更新する。
   - **イベントソーシング**: 受信した Command は履歴（イベントログ）として配列に追記し、ハッシュ計算を行う。
   - **副作用のトリガー**: 状態更新後、必ず \`bridgeLogic2Draw()\`, \`bridgeLogic2Persistent()\`, \`bridgeLogic2Network()\` 等の明示的な Bridge 関数を呼び出し、副作用を外界へ伝播させる。
4. **L4: Draw (描画層)**: \`REAL_state\` を元に DOM を狙撃更新（Sniper Update）する。
   - **ルール**: \`document.activeElement\` と一致する要素（入力中のテキストエリア等）は不用意に上書きしない。
`;
// [/ai_s_emblem: Doc-Section-2-0]

// [ai_s_emblem:#high#config Doc-Section-3-0]
const SECTION_3_0 = `
## 3. REAL / SHADOW 規約 (§状態の純粋性)
同期漏れバグを物理的に絶滅させる。
- **REAL_<名前>**: 唯一の書き換え可能な真実。
- **shadow(REAL, 用途)**: REAL から作る使い捨ての派生値。**「保持（変数への保存）禁止」**。使う瞬間に生成し、使い終わったら捨てる。
- **一方向変換**: REAL → SHADOW への変換のみを許可。

\`\`\`js
// REAL_state: L3 が唯一書き換える
const REAL_state = { hp: 100, x: 0 };

// L4: 描画のたびにその場で生成して即捨て（変数に保存しない）
renderHpBar(REAL_state.hp / 100);          // ← shadow（使い捨て）
renderSprite(REAL_state.x * PIXEL_SCALE);  // ← shadow（使い捨て）
\`\`\`
`;
// [/ai_s_emblem: Doc-Section-3-0]

// [ai_s_emblem:#high#config Doc-Section-4-0]
const SECTION_4_0 = `
## 4. 3Dplus 時空座標系 (§因果の投影)
次元に依存しない、親子関係における状態投影の枠組み。
- **純粋一方向変換**: 「ローカル座標」と「ワールド座標」を絶対に混ぜない。
- **Level-based Projection**: 再帰を禁止し、深さ0（親）から順にループでワールド状態を確定させる。
- **投影要素**: 位置・回転だけでなく、時間(t)、透明度(Alpha)、生存(Visibility)も「座標」として投影する。
`;
// [/ai_s_emblem: Doc-Section-4-0]

// [ai_s_emblem:#high#config Doc-Section-4-5]
const SECTION_4_5 = `
## 4.5 Twin 規約 (§Verification Twin)
任意の層は **Twin（検証双子）** を持てる。Twin は元層と同じ入力を取り、純粋関数でJSONを返す検証実装である。複式数学（§7）の実装単位はこの Twin である。

1. **直交概念**:
   Twin は層（L1〜L4）と直交する。新しい層ではなく、層に付随する性質である。\`L1〜L4\` がデータフローの方向を定義するのに対し、Twin は「効率実装」と「検算実装」のペア性を定義する。
2. **表記**:
   \`L<n>*\` または \`<name>_twin\` と書く。例: \`L4*\`、\`render_twin()\`、\`cpu3d.js (L4 twin)\`。
3. **共通契約**:
   - 元層と**同じ入力JSON**を取る（二重定義禁止）
   - **純粋関数**である（DOM/GPU/I/O/乱数/時刻に触れない）
   - **段階別JSON**を返す（どの段で乖離したかを特定可能にする）
   - 元層との**突合関数**（\`assert_xxx\`）が独立に存在する
4. **典型的なTwin**:
   - **L4\\* (Draw twin)**: GPU/Canvas描画と並走するCPU側の透明な算数（\`3dplus/cpu3d.js\`）
   - **L3\\* (Logic twin)**: 物理エンジン・複雑Reducerの結果を別実装で検算
   - L1/L2 の Twin は稀（DOM/Intentは比較的薄いため通常不要）
5. **Twin と SHADOW の違い**（§3との混同を避ける）:
   - SHADOW: REALから派生する**表示・操作用の派生値**。一方向変換の結果。
   - Twin: 元層と並走する**検算実装**。突合のために存在する。
   両者は別の概念であり、\`SHADOW_xxx\` と \`xxx_twin\` を混同してはならない。
`;
// [/ai_s_emblem: Doc-Section-4-5]

// [ai_s_emblem:#high#config Doc-Section-5-0]
const SECTION_5_0 = `
## 5. データ永続化と証明 (§Persistence & Cryptography)
サーバーのDBに依存せず、データの信頼性と歴史をローカルで担保するための原則。
- **JSON + Event Sourcing**: 状態（State）の上書き保存を避け、状態を変更する「イベント（Command）」の履歴を JSON の配列として追記保存する。現在の状態は、初期状態から全イベントを再生（Reduce）することで決定される。
- **Sequential Hashing (直列ハッシュ)**: 各イベントは「一つ前のイベントのハッシュ値」を含めて自身のハッシュを計算する（ブロックチェーン的な直列構造）。これにより、履歴の改ざんや欠落を数学的に検知・防止する。
- **Dumb Relay & HTTP/3**: サーバーはロジックを持たない土管（Relay）に徹する。通信には HTTP/3 (WebTransport等) を用い、低遅延なストリームとしてデータを移送する。受信したJSONイベントのハッシュ整合性は必ずエッジ（L3: Logic）側で検証する。
- **Attestation Over Auth**: 中央集権的なログイン認証を廃し、公開鍵暗号による署名検証を権利の根拠とする。
- **Eternal Compatibility**: Web標準のみに従い、10年後も修正なしで動作し続けるコードを維持する。
`;
// [/ai_s_emblem: Doc-Section-5-0]

// [ai_s_emblem:#high#config Doc-Section-6-0]
const SECTION_6_0 = `
## 6. FAQ & 実践ガイド (§Operational Rules)

### Q: 編集時に \`ai-desk apply\` を優先すべきか？
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
`;
// [/ai_s_emblem: Doc-Section-6-0]

// [ai_s_emblem:#high#config Doc-Section-7-0]
const SECTION_7_0 = `
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

\`\`\`
効率層:   xxx()             // 実装は何でも可（GPU/物理エンジン/Three.js等）
Twin:    xxx_twin(input)   // 純粋関数。同入力JSONを取りJSONを返す
突合:    assert_xxx(e, t)  // 矛盾を投げる/返す。Zero-Dep
\`\`\`

モジュール単位でペアにする場合（3dplus型）:
\`\`\`
effective:  render.js, physics.js
twin:       render.twin.js, cpu3d.js (= L4 twin), physics.twin.js
\`\`\`

### 7.2 入力契約（同一性の強制）

効率層と Twin は**同じ入力JSON**を受け取らなければならない。二重定義は規約違反である（同じ数学を二度書いたら検算にならない）。

### 7.3 出力契約（段階別JSON）

\`\`\`js
xxx_twin(input) → {
  stages: { stage1: ..., stage2: ..., stage3: ... },
  result: ...
}
\`\`\`

「どこで壊れたか」を特定可能にする。\`projectScene\` の \`local→world→view→clip→ndc→screen\` がこのテンプレ。

### 7.4 純度規約

Twin は **Zero-Dep / Zero-Side-Effect**:
- DOM / GPU / Canvas / I/O / 乱数 / 時刻に触れない
- 入力JSON → 出力JSON のみ
- 外部ライブラリ依存禁止（自身がブラックボックスを呼んだら検算にならない）

### 7.5 Emblem 拡張

\`#verify\` を \`#Category\` の正式な値として追加する（§1 Emblemの定義参照）:

\`\`\`javascript
// [EMBLEM:#high#verify ProjectScene]
// [EMBLEM:#high#draw    WebGLRenderer]
\`\`\`
(注意: \`EMBLEM\` は実際のソースでは \`ai_s_emblem\` と表記する。本ドキュメントソース内では check と衝突しないよう placeholder にしている。)

### 7.6 ペア宣言

ファイル冒頭または関数JSDocで、効率層と Twin の対応を明示する:

\`\`\`js
// @effective: ../my_webgl/render.js
// @twin:      cpu3d.js
\`\`\`

これにより AI は「片方を編集する時、もう片方も同期更新せよ」を自動判定できる。
`;
// [/ai_s_emblem: Doc-Section-7-0]

module.exports = {
  META,
  SECTION_0_0, SECTION_0_1, SECTION_0_15, SECTION_0_2, SECTION_0_21, SECTION_0_3,
  SECTION_1_0, SECTION_1_5,
  SECTION_2_0,
  SECTION_3_0,
  SECTION_4_0, SECTION_4_5,
  SECTION_5_0,
  SECTION_6_0,
  SECTION_7_0
};
