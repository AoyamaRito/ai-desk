# Gemini CLI Agent: AI-Native Capability Guide

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
- `AI_NATIVE_MASTER_BIBLE.md`: 4層アーキテクチャ・制約畳み込み・複式数学の正典。
- `AI_UNDERSTANDING_MANIFESTO.md`: あなたの認知特性（±300行スポットライト等）への最適化指針。
