# Changelog

## [Unreleased] — 2026-05-03

### Added — v2 を組み込み(大きな変更)

ai-desk の原理を**単一の抽象(Block)**に畳み込んだ次世代実装 `v2/` をリポジトリに組み込みました。
v1(本体)は維持されつつ、v2 は思想実験として並走します。

**v2 の核心**:
- すべて Block(関数・class・module・section・code・constraint・observation を統一インターフェース)
- versions が本体(REAL)、現在の状態は派生(SHADOW、getter で都度計算)
- マーカー廃止、JS 構文そのものが境界
- JS 完全主義(TypeScript / build / 依存ライブラリ ゼロ)
- 「LLM は複雑でも問題ない、隠匿が問題」を Bible §0.0 から公理として徹底

**v2 で動く機能**:
- Block: versions / diff / blame / rollback / applyPatch
- Graph: forward / backward / impact / at(time travel)/ search / lint
- Persistence: save / load(JSON 1ファイル)
- Patch: applyPatch / applyToBlock / applyBlockSmart / resolveImports
- Codegen: exportModule(Block → JS 復元)
- Stats / Context: blockContext + formatContextForLLM(LLM 用 markdown)
- Visualization: exportMermaid(flowchart 出力)
- Tag inference: inferTags(content から tag を自動推論)
- Constraint Folding 統合: constraintBlock + evalConstraint
- AI-Eyes 統合: observationBlock
- Parsers: parseJS(function/arrow/class/import/calls/tags/v1emblem 互換)+ parseMD

**CLI 21 コマンド**:
`skeleton / focus / graph / impact / self / tag / tags / save / load / search /
diff / blame / apply / apply-block / resolve / lint / export / stats / context /
mermaid / infer-tags / e2e`

**品質**: 90 e2e tests all green、ai-desk-v2.js 自身が自己読み込み・解析・編集・検証できる完全ループを実装。

**ドキュメント**:
- [`v2/BIBLE_v2.md`](v2/BIBLE_v2.md) — 思想正典(公理 A0〜A7)
- [`v2/README_v2.md`](v2/README_v2.md) — CLI / API 早見表
- [`v2/AI_ONBOARDING_v2.md`](v2/AI_ONBOARDING_v2.md) — LLM 作業ルール
- [`v2/CLAUDE_V2.md`](v2/CLAUDE_V2.md) — Claude が v2 で作業する道標

### Notes

- **デモ(`actions/index.html`、`demos/*`、`en/index.html`、`presentations/*`)は v1 ベース**で動作しています。v2 用のデモはまだ作成されていません。
- v1 と v2 は **同一リポジトリ内で共存**しています。v1 は stable(GitHub Pages 公開済み、~832 cloned)、v2 は MVP。
- v1 のコードは何も変更されていません。v2 は `v2/` サブディレクトリに完全に隔離されています。

---

## v1(継続中)

v1 の機能は今までのまま。`ai-desk.js`(skeleton/focus/check/coverage/apply/view)、
`ai-eyes.js`(観測インフラ)、`action-demos.js`(プレイアブル demos)、
`constraint-janken.js`(Constraint Folding 最小例)等は変更ありません。

v1 の思想ドキュメント:
- [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md)
- [`AI_ONBOARDING.md`](AI_ONBOARDING.md)
- [`CONSTRAINT_FOLDING_MASTER.md`](CONSTRAINT_FOLDING_MASTER.md)
- [`README.ai.md`](README.ai.md)

---

## 命名規約

このリポジトリでは:

- **v1** — `ai-desk` の従来実装(リポジトリ本体、`ai-desk.js` を起点)
- **v2** — `v2/ai-desk-v2.js` を起点とする次世代実装

両者は併存し、v2 が成熟するまで v1 が main を担います。
