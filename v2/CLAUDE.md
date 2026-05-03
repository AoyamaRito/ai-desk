## このリポは ai-desk

ai-desk は v1(ai-desk)の原理を**単一の抽象(Block)**に畳み込んだ実装です。
すべてが Block。Block の本体は versions の羅列(REAL)、現在の状態は派生(SHADOW)。

## 最初に読む

1. [`BIBLE.md`](./BIBLE.md) — 思想の正典(公理 A0〜A7)
2. [`AI_ONBOARDING.md`](./AI_ONBOARDING.md) — LLM の作業ルール
3. [`REFERENCE.md`](./REFERENCE.md) — CLI / API の早見表
4. [`ai-desk.js`](./ai-desk.js) — 唯一の実装ファイル(Zero-Dep、~720 行)
5. [`e2e.js`](./e2e.js) — 61 テスト

## 想定読者

**このリポのドキュメントは LLM/AI 専用です。** 人間用に書かれていません。

人間時代の「読みやすさ」(抽象化・分割・カプセル化)は AI にとって**情報の隠匿**です。
本リポは逆方向 — **展開され・明示され・統合された複雑性**に最適化されています。

## v1 との関係

`/Users/AoyamaRito/PJs/ai-desk/` に v1 があります。**そちらは触りません**。
v1 の文書(Bible・Onboarding 等)もこのフォルダにコピーされていますが、参照用です。
**v2 で作業するときは v2 の Bible(BIBLE.md)に従ってください。**

## 作業の前提

- すべて Block 抽象で動く(`Block { id, type, versions, meta }`)
- マーカー(`// [ai_s_emblem:...]`)は新規に書かない
- TypeScript・build・依存ライブラリは禁忌
- `Block.versions` は append-only(`commit()` 経由のみ)
- `Block.content` 等は SHADOW(getter から都度取得、変数化しない)

詳細は `AI_ONBOARDING.md` を読む。
