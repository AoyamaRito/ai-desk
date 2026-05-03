# ai-desk v2

ai-desk(v1)の原理を**単一の抽象(Block)**に畳み込んだ次世代実装。

## 構成

| ファイル | 役割 |
|---|---|
| [`BIBLE_v2.md`](./BIBLE_v2.md) | **思想の正典**(公理 A0〜A7、まずここから) |
| [`AI_ONBOARDING_v2.md`](./AI_ONBOARDING_v2.md) | LLM が v2 で作業するときのルール |
| [`README_v2.md`](./README_v2.md) | CLI / API 早見表、v1 との差分 |
| [`CLAUDE_V2.md`](./CLAUDE_V2.md) | Claude が v2 で作業するときの最初の道標 |
| [`ai-desk-v2.js`](./ai-desk-v2.js) | 唯一の実装ファイル(Zero-Dep、~1450行) |
| [`e2e.js`](./e2e.js) | テスト(90 tests, all green) |
| [`package.json`](./package.json) | ESM 指定、`npm test` 用 |

## 1 行で

すべて Block。Block の本体は versions の羅列(REAL)、現在の状態は派生(SHADOW)。
JS 完全主義(TS なし、build なし、依存なし)。

## クイックスタート

```bash
cd v2
npm test                           # 90 tests, all green
node ai-desk-v2.js                 # self-test
node ai-desk-v2.js self            # 自分自身を Block 化
node ai-desk-v2.js skeleton ai-desk-v2.js
node ai-desk-v2.js stats ai-desk-v2.js
```

## v1 との関係

v1(このリポの本体)は維持されつつ、v2 は思想実験として並走します。
v1 のコードは何の変更もせず v2 で読めます(マーカーは tags に自動取り込み)。

```bash
node ai-desk-v2.js save v1.json ../ai-desk.js ../action-demos.js
node ai-desk-v2.js load v1.json
node ai-desk-v2.js impact v1.json '../ai-desk.js:fn:runSkeleton'
```

詳細は [`BIBLE_v2.md`](./BIBLE_v2.md) §9「v1 → v2 の移行指針」。
