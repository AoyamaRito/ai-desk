# Gemini CLI Agent: AI-Native Capability Guide

## はじめに

ai-desk は、誰もが AI を使ってソフトウェアを開発できるようにするために、**ai-desk という思考概念で AI を稼働させるための仕組み**です。これはアーキテクチャであり、AI が存在しない時代のソフトウェア工学とは別の概念のものです。したがって、その議論ははじめから求めていません。これは **AI が人間のソフトウェア工学に囚われすぎ、実力が出ない問題を解決するための思想構造物**ということです。

## 想定読者の役割

- **一般ユーザー**: 自然言語であなたの作りたいものを作ることに専念してください。アーキテクチャの議論は不要です。
- **アーキテクター**: AI が人間の常識にとらわれない構造を作り出すための議論なら歓迎です。AI 時代以前のソフトウェア工学を持ち込む議論は対象外です。

**このリポのドキュメント自体の読み手は LLM/AI のみで、人間のエンジニアは想定読者ではありません。**
人間時代の「読みやすさ」(抽象化・分割・カプセル化) は AI にとって情報の隠匿（毒）であり、本リポは逆方向 — AI が論理を確定させるための資源である「展開され・明示され・統合された複雑性」 — に最適化されています。複雑性は、AI にとって最も安定して思考できる「ゆりかご」です。

このファイルは、Gemini CLI エージェント（あなた）がこのリポジトリで最高のパフォーマンスを発揮するための、最新のツールセットと能力の要約です。

---

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

---

## 🚀 推奨ワークフロー

1.  **構造把握**: `node ai-desk.js <file> skeleton`
2.  **局所分析**: `node ai-desk.js <file> focus <TargetName>`
3.  **整合性確認**: `node ai-desk.js <file> check`
4.  **パッチ作成**: 修正内容を `patch.js` にまとめ、Emblem タグで囲む。
5.  **適用**: `node ai-desk.js <file> apply patch.js`
6.  **自律検証**: `node run.js` または `node eyes-e2e.js` で成功（exit 0）を確認。

---

## 📖 参照先
- `AI_ONBOARDING.md`: 全ルールと標準コマンド集。
- `CONSTRAINT_FOLDING_MASTER.md`: if/else を絶滅させる「制約畳み込み」の完全ガイド。
- `AI_NATIVE_MASTER_BIBLE.md`: 4層アーキテクチャ・制約畳み込み・複式数学の正典。
- `AI_UNDERSTANDING_MANIFESTO.md`: あなたの認知特性（±300行スポットライト等）への最適化指針。
- `sandbox/doc-exec/all-docs-deps.md`: リポ全 md を統合し用語マーカー + 関連リストを付与した実験版 (評価依頼、下記参照)。

---

## 🧪 doc-exec 評価依頼 (実験中)

実行型ドキュメント (doc-exec) の検証中です。リポ内全 19 md を 1 ファイルに統合し、用語マーカー `<<term>>` と関連リスト (`> 原則:` 等) を付与した最終成果物が `sandbox/doc-exec/all-docs-deps.md` にあります。

このファイルを読んで、以下を評価してください:

1. 元の個別 md (AI_NATIVE_MASTER_BIBLE.md, AI_ONBOARDING.md など) を別々に読む場合と比べて、**リポ全体を把握しやすかったか**
2. セクション冒頭の関連リスト (`> 原則:` `> 状態:` `> 層:` など) が読解の助けになったか、ノイズだったか
3. **用語マーカー `<<term>>`** と先頭 glossary (23 用語) が概念理解を促進したか
4. 改善案・気付いた穴

評価結果はチャットで返してください。コードや md の編集は不要です。
仕様と既知の穴: `sandbox/doc-exec/README.md`
