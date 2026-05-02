---

# Glossary (doc-exec 用語集)

二重山括弧マーカーで参照される用語の定義集。
本文中のマーカーは `expand-term.js` がこの md 末尾の `# 山括弧つき用語名` セクションを inline 展開する。

定義はリポ既存ドキュメント (Bible §0〜§7, AI_ONBOARDING.md, HANDOFF.md) を出典とした短い説明に揃える。
ドキュメント本体への用語マーカー埋め込みはここを基準に一つずつ進める。

各用語は `category` (グルーピング用) と `aliases` (別表記検出用) のメタを持つ。

---

# <<Heavy Function>>

<!-- @category: principle -->
<!-- @aliases: Heavy Functions, 重厚関数 -->

ロジックを各関数内に inline で書き、共有ヘルパーを作らない設計原則 (Bible §0.1)。
関数の長さよりも、AI が「その関数だけ読めば全部わかる」状態を優先する。
重複は悪ではない。隠れた依存による影響範囲の不可視化が悪。

---

# <<Constraint Folding>>

> ツール: <<ai-desk>>

<!-- @category: principle -->
<!-- @aliases: 条件畳み込み, Condition Folding, 制約畳み込み -->

if/else や switch の代わりに「全可能世界を生成 → 制約で filter」して結果を導出する設計 (Bible §0.15)。
分岐は AI にとって認知の分裂であり組み合わせ爆発を起こす。
最小実証は <<ai-desk>> リポの `constraint-janken.js`。

---

# <<Inline-over-Extract>>

<!-- @category: principle -->
<!-- @aliases: Inline > Extract, インライン化 -->

「抽出 (Extract Function)」より「インライン化 (Inline Function)」を優先する原則 (Bible §0.1.4)。
小関数に切り出すと AI のコンテキストが断絶する。
ドキュメント側にも同型 (同じセクションが複数箇所で展開されるのは無駄ではない)。

---

# <<Spotlight>>

> 原則: <<Heavy Function>>

<!-- @category: principle -->
<!-- @aliases: スポットライト, 上下300行, ±300行, ±300 行 -->

LLM の局所参照範囲。±300 行 (Bible §0.0)。
このウィンドウ内に必要情報が収まっているかが <<Heavy Function>> や近接抑制設計の根拠。

---

# <<REAL>>

> 状態: <<SHADOW>>

<!-- @category: state -->

唯一の書き換え可能な真実 (Bible §3)。`REAL_<名前>` で命名する。
派生値 (<<SHADOW>>) は使う瞬間に生成し、変数に保存しない。

---

# <<SHADOW>>

> 状態: <<REAL>>

<!-- @category: state -->

<<REAL>> から作られる使い捨ての派生値 (Bible §3)。
変数に保持禁止。使う瞬間に生成し、使い終わったら捨てる。
一方向変換 (REAL → SHADOW) のみ許可。

---

# <<Twin>>

> 状態: <<SHADOW>>

<!-- @category: state -->
<!-- @aliases: 検証双子 -->

任意の層に付随する検証双子 (Bible §4.5)。
元層と同じ入力 JSON を取り、純粋関数で段階別 JSON を返す検算実装。
表記は `L<n>*` または `<name>_twin`。<<SHADOW>> とは別概念。

---

# <<Layer>>

> 層: <<L1>> <<L2>> <<L3>> <<L4>>

<!-- @category: layer -->
<!-- @aliases: 4層 -->

4層バニラ・アーキテクチャの抽象 (Bible §2)。<<L1>> Physical → <<L2>> Intent → <<L3>> Logic → <<L4>> Draw の一方向フロー。

---

# <<L1>>

<!-- @category: layer -->

Physical 層 (Bible §2)。DOM 取得、イベント登録、localStorage 等の外部 API アクセス。
ここで `REAL_state` を直接書き換えてはならない。

---

# <<L2>>

> 層: <<L3>>

<!-- @category: layer -->

Intent 層 (Bible §2)。生のイベントを Command JSON に変換する <<L3>> への唯一の入口。
非同期処理・外部 API 呼び出しはここで行い、結果を Command として <<L3>> に渡す。

---

# <<L3>>

> タグ: <<Bridge>>

<!-- @category: layer -->

Logic 層 (Bible §2)。`(REAL_state, Command) => newState` の純粋 Reducer。
副作用は持たず、状態更新後に <<Bridge>> 関数を明示的に呼び出して外界へ伝播させる。

---

# <<L4>>

<!-- @category: layer -->

Draw 層 (Bible §2)。`REAL_state` を元に DOM を狙撃更新する。
`document.activeElement` と一致する要素は上書きしない。

---

# <<Emblem>>

> ツール: <<ai-desk>>

<!-- @category: tag -->
<!-- @aliases: エンブレム -->

<<ai-desk>> が認識する関数・ブロック単位の認知境界タグ (Bible §1)。
`[ai_s_emblem:#<importance>#<category> Name]` で開始し `[/ai_s_emblem: Name]` で閉じる。
有効タグ: `#high #mid #low` × `#L1 #L2 #L3 #L4 #physical #intent #logic #draw #verify #OutOfLayers #config`。

---

# <<Bridge>>

> 層: <<L1>> <<L2>> <<L3>> <<L4>>

<!-- @category: tag -->

層をまたぐ関数につけるタグ (AI_ONBOARDING)。`[ai_s_bridge:LxtoLy Name]` で記述する。
データは <<L1>>→<<L2>>→<<L3>>→<<L4>> の一方向に流れ、層境界を越える呼び出しは Bridge として明示する。

---

# <<Tag Immutability>>

> ツール: <<ai-desk>>

<!-- @category: tag -->
<!-- @aliases: タグ不変性 -->

<<ai-desk>> apply がパッチ適用時に検証する不変条件 (AI_ONBOARDING)。
タグ件数の変動を検知すると書込をキャンセルし、構造破壊を防ぐ。

---

# <<複式数学>>

> 状態: <<Twin>>

<!-- @category: verification -->
<!-- @aliases: Double-Entry, 複式 -->

ブラックボックス化しやすい外部システム (GPU/WebGL, 物理エンジン, 外部 API) を <<Twin>> による別実装で検算する手法 (Bible §7)。
段階別 JSON で乖離地点を特定する。

---

# <<Structural Projection>>

> 状態: <<Twin>>
> ツール: <<ai-eyes>>

<!-- @category: verification -->
<!-- @aliases: 構造投影, Structural Observation -->

<<ai-eyes>> の `/structure` エンドポイント経由で 3D 座標や物理演算の内部構造を JSON 送信する観測手法 (Bible §1.5)。
ブラウザ DOM を介さず <<Twin>> と突合してロジックの正しさを検証する。

---

# <<Event Sourcing>>

<!-- @category: persistence -->
<!-- @aliases: イベントソーシング, イベントログ -->

状態の上書き保存ではなく、状態を変える Command の履歴を JSON 配列として追記する永続化方式 (Bible §5)。
現在状態は初期状態から全イベントを Reduce して決定される。

---

# <<Dumb Relay>>

> 層: <<L3>>

<!-- @category: persistence -->
<!-- @aliases: ダム・リレー, 土管 -->

サーバーをロジックを持たない土管に徹させる方針 (Bible §5)。
HTTP/3 (WebTransport 等) でストリーム送受、ハッシュ整合性検証はエッジ (<<L3>>) で行う。

---

# <<Orchestrator>>

<!-- @category: tool -->
<!-- @aliases: オーケストレーター, run.js -->

サーバー起動・ブラウザ操作・検証スクリプト実行を一本化した `run.js` パターン (AI_ONBOARDING)。
AI が一撃のコマンドで全工程を完遂できる。

---

# <<ai-desk>>

> タグ: <<Emblem>>

<!-- @category: tool -->

このリポの中核 CLI。<<Emblem>> 単位の skeleton/focus/check/coverage/apply で巨大ファイルを認知局所性を保ちながら編集する。

---

# <<ai-eyes>>

> 検証: <<Structural Projection>>

<!-- @category: tool -->

`localhost:3000` で動く観測サーバー。Dynamic `client.js` を配信し、リモート操作・スナップショット・録画・<<Structural Projection>> を提供する。

---

# <<doc-exec>>

<!-- @category: tool -->
<!-- @aliases: 実行型ドキュメント, executable doc -->

実行型ドキュメントの概念検証。`sandbox/doc-exec/` 配下で MVP を組成中。
マクロ展開ではなく **依存宣言** (セクション冒頭の関連リスト) でドキュメントの認知局所性を取り戻す試み。
