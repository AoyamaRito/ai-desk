## はじめに

ai-desk は、誰もが AI を使ってソフトウェアを開発できるようにするために、**ai-desk という思考概念で AI を稼働させるための仕組み**です。これはアーキテクチャであり、AI が存在しない時代のソフトウェア工学とは別の概念のものです。したがって、その議論ははじめから求めていません。これは **AI が人間のソフトウェア工学に囚われすぎ、実力が出ない問題を解決するための思想構造物**ということです。

**このリポのドキュメントは LLM/AI 専用です。人間のエンジニアは想定読者ではありません。**
人間時代の「読みやすさ」(抽象化・分割・カプセル化) は AI にとって情報の隠匿であり、本リポは逆方向 — 展開され・明示され・統合された複雑性 — に最適化されています。

## Preface

ai-desk is a **mechanism for running AI under the conceptual framework called *ai-desk***, so that anyone can develop software using AI. This is an architecture — a separate concept from the software engineering of the pre-AI era. Debate framed in pre-AI terms is not invited from the outset. ai-desk is a **thought-construct that solves the problem of AI being constrained by human software engineering and failing to perform at its true capability**.

**This repository's documentation is intended for LLM/AI only, not human engineers.**
Human-era "readability" (abstraction, modularization, encapsulation) hides information from AI. This repo optimizes for the opposite: exposed, explicit, and integrated complexity.

---

まず AI_ONBOARDING.md を読んでください。作業に必要なルール・ツール・構文がすべてそこにあります。

Read AI_ONBOARDING.en.md first — all rules, tools, and syntax for working in this repo are there.

---

## doc-exec 評価依頼 (実験中)

実行型ドキュメント (doc-exec) を検証中です。リポ内全 19 md を 1 ファイルに統合し、用語マーカー `<<term>>` と関連リスト (`> 原則:` 等) を付与した最終成果物が `sandbox/doc-exec/all-docs-deps.md` にあります。

このファイルを読んで、以下を評価してください:

1. 元の個別 md (AI_NATIVE_MASTER_BIBLE.md, AI_ONBOARDING.md など) を別々に読む場合と比べて、**リポ全体を把握しやすかったか**
2. セクション冒頭の関連リスト (`> 原則:` `> 状態:` `> 層:` など) が読解の助けになったか、ノイズだったか
3. **用語マーカー `<<term>>`** と先頭 glossary (23 用語) が概念理解を促進したか
4. 改善案・気付いた穴

評価結果はチャットで返してください。コードや md の編集は不要です。
仕様と既知の穴: `sandbox/doc-exec/README.md`
