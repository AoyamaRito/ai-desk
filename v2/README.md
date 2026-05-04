# ai-desk v2

ai-desk(v1)の原理を**単一の抽象(Block)**に畳み込んだ次世代実装。

## 構成

ai-desk v2 は **JS-as-doc**(.js が canonical、.md は派生 SHADOW)。
AI 用 doc は `AiRunAndRead_*.js`、人間用は本 README + 自動生成 .md。

| ファイル | 役割 |
|---|---|
| [`AiRunAndRead_BIBLE.js`](./AiRunAndRead_BIBLE.js) | **思想の正典**(公理 A0〜A13 + Physics + BlockSchema + Taboos + Vocabulary + Rituals) |
| [`AiRunAndRead_ONBOARDING.js`](./AiRunAndRead_ONBOARDING.js) | LLM が v2 で作業するときの規律集 |
| [`AiRunAndRead_MANUAL.js`](./AiRunAndRead_MANUAL.js) | 操作マニュアル(workflow / Virtual Heavy Function APPLY) |
| [`AiRunAndRead_CLAUDE.js`](./AiRunAndRead_CLAUDE.js) | Claude / GPT / Gemini が最初に当たる routing entry |
| [`ai-desk.js`](./ai-desk.js) + [`ai-desk-core.js`](./ai-desk-core.js) | 実装 split(Zero-Dep、~1.2k 行、core が pure logic、ai-desk が CLI shell) |
| [`e2e.js`](./e2e.js) | テスト(111 e2e tests) |
| [`package.json`](./package.json) | ESM 指定、`npm test` = e2e + 3d-prefab、計 166 tests, all green |
| [`BIBLE.md`](./BIBLE.md) | 自動生成 SHADOW(`node AiRunAndRead_BIBLE.js export-md` で再生成) |
## サブフォルダ

| フォルダ | status | 役割 |
|---|---|---|
| `3d-prefab/` | **active** | A10 + A11 + heartbeat / flow / Shadow_for_Flow の voxel editor demo(55 tests、`npm test` 対象) |
| `3dplus/` | **active**(別 channel) | CPU 3D Twin、3D / WebGL コードの突合層(81 tests、独立実行) |
| `demos/` | **active** | Bible 思想 demo(gravity-battle / kanban / node-graph 等、Block/version/refs 実利用) |
| `eyes/` | **active** | AI-Eyes 観測ハーネス(in-memory virtual canvas、draw_op log) |
| `aijs/` | experimental | Goja ベースの JS runtime(Node 不要化、Phase A 用)|
| `go-cli/` | experimental | Go binary 化、JS bundle embed |
| `crystallize/` | **proof complete, parked** | JS Block → Go 翻訳の Phase 1〜5(2026-05-04 撤退済、翻訳契約集として残置) |
| `go-kernel/` | archived | 性能 vs 思想で不採用(memo: `2026-05-04_perf-vs-doctrine.md`) |

## テスト正典

```bash
cd v2 && npm test       # ← 正典:e2e(111) + 3d-prefab(55) = 計 166 tests, all green
```

`3dplus/` の 81 tests は独立実行(`node 3dplus/tests/<name>.test.js`)、`npm test` には含まない別 channel。
ルートの `ai-desk.test.js` は v1 用で frozen(現在 broken、`/PJs/trash/` 退避予定)。

## 1 行で

すべて Block。Block の本体は versions の羅列(REAL)、現在の状態は派生(SHADOW)。
JS 完全主義(TS なし、build なし、依存なし)。

## クイックスタート

```bash
cd v2
npm test                                      # 166 tests (e2e 111 + 3d-prefab 55), all green
node ai-desk.js                                # self-test
node ai-desk.js self                           # 自分自身を Block 化
node ai-desk.js skeleton ai-desk.js
node ai-desk.js stats ai-desk.js
node ai-desk.js bible-info                     # 14 公理 / 7 BlockTypes / 15 Taboos / Vocabulary
node ai-desk.js bible-check ai-desk.js         # Bible 違反診断
node AiRunAndRead_BIBLE.js                     # canonical doctrine の自己開示
```

## v1 との関係

v1(このリポの本体)は維持されつつ、v2 は思想実験として並走します。
v1 のコードは何の変更もせず v2 で読めます(マーカーは tags に自動取り込み)。

```bash
node ai-desk.js save v1.json ../ai-desk.js ../action-demos.js
node ai-desk.js load v1.json
node ai-desk.js impact v1.json '../ai-desk.js:fn:runSkeleton'
```

詳細は [`AiRunAndRead_BIBLE.js`](./AiRunAndRead_BIBLE.js)(または auto-gen の [`BIBLE.md`](./BIBLE.md))の §9「v1 → v2 の移行指針」。

---

## 🎮 Demos

### [`demos/gravity-battle/`](./demos/gravity-battle/) — Gravity Field Battle
ブラウザで遊べるカードゲーム(constraintBlock で AI 思考、Block.versions で undo)。
🌐 [プレイ](https://aoyamarito.github.io/ai-desk/v2/demos/gravity-battle/)

### [`demos/block-spreadsheet/`](./demos/block-spreadsheet/) — Block Spreadsheet
セル = Block で実装した表計算(refs で依存、versions で履歴、impact で再計算、cycle 検出)。
🌐 [プレイ](https://aoyamarito.github.io/ai-desk/v2/demos/block-spreadsheet/)

### [`demos/node-graph/`](./demos/node-graph/) — Node Graph
ノード = Block、配線 = `Block.refs`。Const/Add/Mul/.../Output を繋いで dataflow。サイクル検出は `Graph.forwardClosure` で構造的拒否(専用 validator なし、A8 §4.1.1)。
🌐 [プレイ](https://aoyamarito.github.io/ai-desk/v2/demos/node-graph/)

### [`demos/kanban/`](./demos/kanban/) — Block Kanban
カード = Block、カラム = Block(`children` がカード順序の REAL)。移動 = 双方の column が children 更新する 2 commit。フラットデザイン。
🌐 [プレイ](https://aoyamarito.github.io/ai-desk/v2/demos/kanban/)

