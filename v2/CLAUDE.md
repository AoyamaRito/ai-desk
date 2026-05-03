## このフォルダは ai-desk v2(All-as-Block, Versions-as-Body)

v2 は **v1 の原理を単一の抽象(Block)に畳み込んだ実装** です。
すべてが Block。Block の本体は versions の羅列(REAL)、現在の状態は派生(SHADOW)。

## 最初に読む

1. [`BIBLE.md`](./BIBLE.md) — 思想の正典(公理 A0〜A7)
2. [`AI_ONBOARDING.md`](./AI_ONBOARDING.md) — LLM の作業ルール
3. [`REFERENCE.md`](./REFERENCE.md) — CLI / API の早見表
4. [`ai-desk.js`](./ai-desk.js) — 唯一の実装ファイル(Zero-Dep、~1761 行)
5. [`e2e.js`](./e2e.js) — 105 テスト

## 想定読者

**このリポのドキュメントは LLM/AI 専用です。** 人間用に書かれていません。

人間時代の「読みやすさ」(抽象化・分割・カプセル化)は AI にとって**情報の隠匿**です。
本リポは逆方向 — **展開され・明示され・統合された複雑性**に最適化されています。

## v1 との関係

このリポ(`/PJs/ai-desk/`)に v1 + v2 が同居しています:
- v1 本体: `../ai-desk-old-v1.js`(旧 `ai-desk.js` から改名)
- v1 ドキュメント(`AI_NATIVE_MASTER_BIBLE.md` / `AI_ONBOARDING.md` / `README.md` 等): リポルート(`../`)
- **v1 のファイルは触りません**。固定された過去として保持。

v2 で作業するときは v2 の Bible(`./BIBLE.md` = このフォルダ)に従ってください。

## 作業の前提

- すべて Block 抽象で動く(`Block { id, type, versions, meta }`)
- マーカー(`// [ai_s_emblem:...]`)は新規に書かない
- TypeScript・build・依存ライブラリは禁忌
- `Block.versions` は append-only(`commit()` 経由のみ)
- `Block.content` 等は SHADOW(getter から都度取得、変数化しない)

詳細は `AI_ONBOARDING.md` を読む。
