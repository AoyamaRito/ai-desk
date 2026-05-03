# ai-desk v2

ai-desk(v1)の原理を**単一の抽象(Block)**に畳み込んだ次世代実装。

## 構成

| ファイル | 役割 |
|---|---|
| [`BIBLE.md`](./BIBLE.md) | **思想の正典**(公理 A0〜A7、まずここから) |
| [`AI_ONBOARDING.md`](./AI_ONBOARDING.md) | LLM が v2 で作業するときのルール |
| [`REFERENCE.md`](./REFERENCE.md) | CLI / API 早見表、v1 との差分 |
| [`CLAUDE.md`](./CLAUDE.md) | Claude が v2 で作業するときの最初の道標 |
| [`ai-desk.js`](./ai-desk.js) | 唯一の実装ファイル(Zero-Dep、~1450行) |
| [`e2e.js`](./e2e.js) | テスト(105 tests, all green) |
| [`package.json`](./package.json) | ESM 指定、`npm test` 用 |

## 1 行で

すべて Block。Block の本体は versions の羅列(REAL)、現在の状態は派生(SHADOW)。
JS 完全主義(TS なし、build なし、依存なし)。

## クイックスタート

```bash
cd v2
npm test                           # 105 tests, all green
node ai-desk.js                 # self-test
node ai-desk.js self            # 自分自身を Block 化
node ai-desk.js skeleton ai-desk.js
node ai-desk.js stats ai-desk.js
```

## v1 との関係

v1(このリポの本体)は維持されつつ、v2 は思想実験として並走します。
v1 のコードは何の変更もせず v2 で読めます(マーカーは tags に自動取り込み)。

```bash
node ai-desk.js save v1.json ../ai-desk.js ../action-demos.js
node ai-desk.js load v1.json
node ai-desk.js impact v1.json '../ai-desk.js:fn:runSkeleton'
```

詳細は [`BIBLE.md`](./BIBLE.md) §9「v1 → v2 の移行指針」。
