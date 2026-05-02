# doc-exec 引き継ぎ資料

最新更新: 2026-05-02 (案 E 実装完了後の追記版)
初版: 2026-05-02

---

## いまどこ

**実行型ドキュメント (executable doc) の MVP が動作中**。
sandbox/doc-exec/ で `bundle-docs.js` + `prepend-deps.js` の 2 段パイプラインが安定。
リポ内全 19 md → 1 ファイル化 + 用語マーカー `<<term>>` + 関連リスト付与までを再現可能。

最終成果物: **`all-docs-deps.md`** (AI 単独消費用、glossary 23 用語 + 15 セクション)

### 確定した設計判断

1. **モデルは「関数呼び出し」ではなく「マクロ展開」**
   - LLM には call stack がない。spotlight に入っているか／いないかしかない
   - C プリプロセッサ #include / マクロ / LaTeX \input{} と同型

2. **Inline > Extract をドキュメントにも適用**
   - 同じセクションが複数箇所で expand されるのは無駄ではない
   - LLM ローカリティ (±300 行) を保護するための「意図的な再読」
   - Bible §0.1 (Heavy Function) と一貫

3. **近接展開抑制 (proximity suppression)** — expand.js 系で実装
   - 同一セクションが直近 N 行以内に展開済みなら skip
   - デフォルト N=300 (Bible §0.0 spotlight)

4. **ドキュメントは AI 用と人間用を分離**
   - 今は AI 用 (`all-docs-deps.md`) のみ整備中
   - 人間用 (humanize) は将来別ツール

5. **【案 E 実装完了】用語マーカーは `<<term>>`**
   - bundle 後のファイル全体に対して `prepend-deps.js` が:
     - glossary.md (手書き 23 用語) を先頭に連結
     - 各セクション冒頭に関連リスト (`> 原則:` `> 状態:` `> 層:` `> タグ:` `> 検証:` `> 永続化:` `> ツール:`) を自動挿入
   - longest match first / canonical 統一 / コードブロック・見出し・既存関連行を mask
   - 自己参照を除外 (glossary 内の自己定義は関連に載せない)
   - **冪等**: 何回走らせても同じ結果

6. **回帰テスト + 効果測定ハーネス完備**
   - `test/pipeline.test.js` (6 tests: golden + idempotency + masking + alias + self-ref)
   - `eval/eval.js` (3 context: deps / bundle / direct を別 LLM に流して採点)

---

## 失敗の記録 (繰り返さないために)

### 1. inline 展開モデル — 捨てた
`expand-term.js` で `<<term>>` を本文中に inline 展開する設計を試した:
- bold 構造 `**...**` が改行で分断され可読性破壊
- 入れ子展開でインデント 4 段、本文 12 行が出力 35 行に膨張
- マーカー直後 inline 挿入は文の流れに対して攻撃的

→ 関連リスト方式 (本文無傷、冒頭に依存宣言) に切り替え = 現在の `prepend-deps.js`

### 2. Bold = 用語シグナル仮説 — データで否定
`extract-bolds.js` で実 Bible 計測:
```
Total bold occurrences: 73
Unique terms:           72
Repeated (≥2 times):     1   ← 「同じ入力JSON」のみ
```
98.6% が一回限り。bold は「リスト見出し / 一発強調」に消費されており用語マーカーには使えない。

### 3. `@deps:` HTML コメント形式 — 廃案
`<!-- @deps: name1, name2 -->` の旧モデル。`<<term>>` ベースに統合した方が記述コストが下がるため廃止。
`example.md` `trace.js` `convert.js` は legacy 参考として残置。

### 4. Bible 直接編集 — 教訓化
`build-docs.js` を AI_NATIVE_MASTER_BIBLE.md (SHADOW) に書き戻させたら DOCS_REAL.js に未移行の §4-7 が消えた。即 git restore で復旧。
**教訓: ソース未完成のままビルドターゲットを正本に向けてはいけない**。

---

## 評価依頼の進捗

CLAUDE.md と GEMINI.md に評価依頼セクションが入っている:
- リポ全 19 md → `all-docs-deps.md` 1 個に統合した結果について
- 評価軸: (1) 把握しやすさ (2) 関連リストの有用性 (3) 用語マーカー + glossary の効果 (4) 改善案

**2026-05-02 受領済みの評価サマリ** (Claude Opus 4.7 から):
- ◯ 1 ファイル化はファイル切替コスト消滅で有効、Bible 自身の主張と整合
- ◯ 関連リストはメタ目次として機能、カテゴリ分類が安定 (原則/状態/層/タグ/検証/永続化/ツール)
- △ glossary 23 用語の先頭 230 行が「本編到達前にスポットライトを消費」する将来コストあり
- △ readme 系セクションに同内容が複数バージョンで並ぶ → AI 視点では認知ノイズ
- 改善優先度高: (1) ja/en の重複圧縮 (2) セクション順を読む順に並べ替え (3) `bible-shadow` セクション除外
- 改善優先度中: (4) `append-usages.js` 用語逆引き (5) 関連リストに `> 出典: Bible §0.1` 追加
- 結論: MVP として有効だが、規模拡大時は glossary より先に **本文の冗長性** で破綻する

---

## 次に走るならどれか

優先順 (前回 P1〜P5 → 用語マーカーが解けたので組み直し):

**P1. eval ハーネス実走**
- `eval/eval.js prompt {deps,bundle,direct}` で 3 context 分の prompt 生成
- 別 LLM (Claude Web / GPT / Gemini 等) に投げて回答取得
- `eval/eval.js score all` で採点
- これで「用語マーカーが本当に AI 理解を助けるか」を数値で確定できる
- 効果無しなら `<<term>>` モデル自体を疑うべき

**P2. 重複セクション圧縮**
- `bible-shadow` セクション除外 (BIBLE_SHADOW.md は SHADOW 生成物、二重カウント)
- `ai-onboarding-en` を別 lang バンドルに分離する `--lang=ja` フィルタ
- readme-ai と readme-en の重複本文を圧縮 (ja のみ残す等)

**P3. セクション順の意味化**
- 現状アルファベット順？ → 「読む順」(onboarding → bible → constraint-folding-master → 各実装ガイド → vibe) に
- bundle-docs.js に明示的な order list を渡す対応

**P4. `append-usages.js` (用語逆引き)**
- glossary の `# <<Twin>>` セクションに「使用箇所: ai-native-master-bible, readme, ...」を自動付与
- 用語 ↔ ドキュメント双方向リンク

**P5. 関連リストに `> 出典:` 行追加**
- 各セクションが Bible のどの §に対応するかを明示
- `> 出典: Bible §0.1`
- マーカーより強力なナビゲーションになる可能性

**P6. defines/uses の自動推定**
- 用語の正典セクションを自動検出 (初出 + 段落見出しが用語名と一致 等)
- glossary を機械的に Bible から再構築可能にする

---

## ファイルマップ (sandbox/doc-exec/)

### 現行 (primary)
| ファイル | 役割 |
|---|---|
| README.md | doc-exec フォーマット仕様書 + 既知の穴 |
| HANDOFF.md | これ |
| glossary.md | 用語定義のソース (手書き、追加場所) |
| bundle-docs.js | リポ内 md を 1 ファイル化 |
| prepend-deps.js | 関連リスト付与 + glossary 先頭連結 (現行 primary) |
| parse.js | md → AST (セクション + メタ) パーサー |
| all-docs.md | bundle 中間出力 (15 セクション) |
| **all-docs-deps.md** | **最終成果**: AI 消費用統合ドキュメント |
| glossary-deps.md | 用語間依存グラフ版 |
| test/pipeline.test.js | 回帰テスト (6 tests) |
| eval/eval.js | 3 context prompt 生成 + 採点 |

### legacy / 失敗例 (残置)
| ファイル | 状態 | 役割 |
|---|---|---|
| example.md | 動 | @deps: 形式 (旧 trace.js 用) |
| example-expand.md | 動 | @expand: 形式 (旧) |
| example-term.md | 動 | <<term>> 形式の最小サンプル |
| trace.js | 動 (legacy) | topological 順並べ (採用見送り) |
| expand.js | 動 (legacy) | マクロ展開 + 近接抑制 |
| convert.js | 動 (legacy) | 既存 md → @deps 形式 |
| extract-bolds.js | 動 | bold 候補抽出 (案 C 検証用、データで否定済) |
| mark-terms.js | 失敗例 | 本文に <<term>> をラップ→分断する |
| expand-term.js | 失敗例 | inline 展開→本文壊す |
| bible-term.md | 失敗例の生成物 | mark-terms 結果 |
| converted-bible.md | legacy | 旧 @deps 形式変換物 |
| expanded-section-7.md | legacy | 旧 expand 形式サンプル |
| focus-md.js | 補助 | md セクションの focus 読み |
| all-docs-term.md | 旧生成物 | mark-terms 経由 |

---

## main repo 側の状態 (uncommitted)

doc-exec とは独立に進んだ作業:
- `#for_human` タグ追加 (KNOWN_TAGS)
- `view` モード追加 (multi-file read-only)
- build-docs.js を docs.config.json 駆動に refactor
- DOCS_REAL.js に §4-7 移行 (placeholder fix も)

これらは sandbox の実験とは独立に commit/push 候補。

---

## 重要な気づき

**ユーザーの観察**: 「ドキュメントこそ肥大化して管理できなくなりつつある」
これがコードに対する ai-desk と同型の課題。doc-exec はその解の試作。

**LLM のドキュメント読みは第三のモデル**:
- コード実行 (call/jump) でも
- 人間の読書 (一度きり記憶) でもなく
- **spotlight 内に何が入っているか**で支配される

設計言語をまだ業界が持っていない。doc-exec の貢献はそこに概念を与えること。

**用語マーカー実装後の発見**:
- 関連リストのカテゴリ (原則/状態/層/タグ/検証/永続化/ツール) は Bible の構造そのもの
  → 関連リスト = メタ目次として機能している
- glossary 23 用語は spotlight の先頭 230 行を占有 → 100 用語超で破綻するという README 既知問題が現実味を持って見える
- 評価で出た最大の穴は「用語の問題」ではなく「**本文の重複**」
  → 次の改善は P2 (重複圧縮) の方が効きそう

---

## 引き継ぎコマンド集

```bash
cd sandbox/doc-exec/

# 1. 現行パイプライン (再現)
node bundle-docs.js                      # → all-docs.md (15 セクション)
node prepend-deps.js                     # → all-docs-deps.md (最終成果)

# 2. 構造確認
node parse.js all-docs-deps.md           # セクション一覧

# 3. glossary 自身に適用 (用語間依存グラフ)
node prepend-deps.js --src=glossary.md --out=glossary-deps.md

# 4. 回帰テスト
node --test test/pipeline.test.js                      # 6 tests
UPDATE_GOLDEN=1 node --test test/pipeline.test.js      # 仕様変更時に golden 更新

# 5. 効果測定 (3 context 比較)
node eval/eval.js prompt deps      # → eval/prompts/deps.md
node eval/eval.js prompt bundle    # → eval/prompts/bundle.md
node eval/eval.js prompt direct    # → eval/prompts/direct.md
# (各 prompt を別 LLM にコピペ → 回答を eval/answers/<ctx>.md に保存)
node eval/eval.js score all

# 6. (legacy 参考)
node expand.js converted-bible.md section-7    # マクロ展開 + 近接抑制
node extract-bolds.js ../../AI_NATIVE_MASTER_BIBLE.md
```

---

## 一行まとめ

> **マクロ展開 + 用語マーカー `<<term>>` + 関連リスト付与で AI ローカリティ最適化の MVP は動いている。次の決定打は eval 実走 (数値) か、本文重複の圧縮 (構造) のどちらか。**
