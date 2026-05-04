# 3d-prefab — A10/A11 + heartbeat/flow + Shadow_for_Flow + voxel editor

Bible 公理 A10(Single Coordinate Domain)、A11(Domain-Tagged Values)、
A12(Universal Literalism)、A13(Shadow Projection)に従う 3D 描画 + voxel editor。
event system は **heartbeat + flow object + Shadow_for_Flow** で時間軸 / 順序依存
を構造的に消した実装。2026-05-03 voxel editor 3 試行失敗を構造的に回避した実証。

## 構造(4 ファイル + test 1 + assets)

```
3d-prefab/
├── coord.js              A11 helpers — w/l/s/o builders + parseCoord/requireDomain
├── prefabs.js            Block 層: prefab data + behaviors + flow + compose(crystallize 整合)
├── main.js               Adapter 層: scene + loader + input + hud + heartbeat(Three.js)
├── dev-server.js         no-cache 強制 dev server(Zero-Dep ~40 行、port 8080)
├── index.html            importmap で three@0.170.0 を pin
├── test/
│   └── prefabs.test.js   55 cases、ブラウザ不要、~90ms
└── assets/
    ├── box.glb           Khronos Sample (Apache 2.0)
    └── koma_hu.glb       (将棋 歩、~32MB)
```

## A11 — domain-tagged value(全 REAL 値が tagged string)

```js
import { w } from './coord.js';

transform: {
  position: w(5, 0, 2),     // → "world:5,0,2"
  rotation: [0, 0, 0],       // Euler radians、coord 系外
  scale: 1,
}

state: {
  voxels: { 'world:0.25,0.25,0.25': { color: 'hex:ff8844' } },  // key も tagged
  currentColor: 'hex:ff8844',
  lastEditWorldPos: w(1.5, 0.5, -1.2),
}
```

domain 群: `world:` / `local:` / `screen:` / `ortho:` / `hex:` / `usd:` / `time:` 等
拡張可。

## prefabs.js — Block 層(flow object + behaviors)

```js
voxelCanvas: {
  id: 'voxel-canvas',
  transform: { position: w(0, 0, 0), rotation: [0,0,0], scale: 1 },
  mesh: { kind: 'voxel-canvas', cellSize: 0.5, planeSize: 8, maxVoxels: 4096 },
  state: { voxels: {}, cellSize: 0.5, tool: 'add', currentColor: 'hex:ff8844', lastEditWorldPos: null },
  flow: {
    click: ['addOrRemoveVoxelOnClick'],   // event.kind → behavior 列
    // tick / hover は adapter 側(副作用は Block 層外)
  },
},
```

`flow.<eventKind>` の behavior 配列は **順序非依存**(直交 field なら)。
Shadow_for_Flow で構造的強制(下記)。

## heartbeat = Single Time Pump(main.js)

```js
let currentTick = 0;
const eventQueue = [];           // FIFO 外部 event(click 等)
const scheduledQueue = [];       // fireAt 昇順 sort

function heartbeat() {
  currentTick++;
  // 0. Frame begin: 全 handle の state → frozen Shadow_for_Flow に snapshot
  for (const h of handles) h.beginFrame();
  // 1. scheduled queue から fireAt <= currentTick を eventQueue に流す
  // 2. eventQueue を drain(各 dispatch は shadow を読み frameMerged に accumulate)
  // 3. 全 handle に tick event(flow.tick が走る)
  // 4. Frame end: frameMerged を REAL state に commit
  for (const h of handles) h.endFrame();
  // 5. adapter 副作用 + render
  rAF(heartbeat);
}
```

**達成した不変条件**:
- 同 event 内 behavior 配列の並べ替えで結果不変(直交 field 限り)
- 同 frame 内 event 順序の変更で結果不変(直交 field 限り)
- 「ある behavior の出力を別 behavior が読む」事故が原理不能
- async race / timing 依存が原理消滅

## 二段検証

| layer | 場所 | 検証 |
|---|---|---|
| Block(prefabs.js) | pure flow + behaviors + tagged coord | `npm run test:prefab`(Node、~90ms、55/55) |
| Adapter(main.js) | Three.js / DOM / heartbeat | ブラウザ + ai-eyes 観測 |

## 起動

```bash
# Block 層検証
cd v2
npm run test:prefab     # 55 tests, ~90ms

# 全テスト
npm test                # 166 tests (e2e 111 + prefab 55) all green

# Adapter 込みで動作確認(2 並走)
node 3d-prefab/dev-server.js 8080 .                                   # no-cache static、port 8080
PORT=3000 LOG_FILE=/tmp/ai-eyes-3dprefab.log SNAPSHOT_DIR=/tmp/ai-eyes-snapshots \
  node /Users/AoyamaRito/PJs/ai-eyes/ai-eyes.js                       # AI 観測層、port 3000

# →  http://localhost:8080/3d-prefab/
```

操作: 左クリック=voxel 配置 / 右ドラッグ=回転 / 中ドラッグ=ズーム / ホイール=ズーム

## 公理整合表(bible-check 自動検証対象)

| Axiom / Taboo | 強制方法 |
|---|---|
| A0 認知非対称性 | flow に挙動全展開、暗黙ゼロ |
| A1 ローカリティ極大化 | flow は prefab の隣 |
| A3 REAL/SHADOW | Shadow_for_Flow で frame 単位の凍結 SHADOW |
| A4 Event Sourcing | scheduled queue + event log で時間 append-only 表現可能 |
| A7 展開・明示 | 全 event / behavior が flat に列挙 |
| A9 Crystallization | tagged string は Go の string で 1:1 翻訳 |
| A10 Single Coord Domain | screen coord は input adapter 境界のみ |
| A11 Domain-Tagged Values | 全 REAL 値は tagged string、boundary で parse |
| A12 Universal Literalism | state はすべて文字列リテラル化候補 |
| A13 Shadow Projection | 演算用 numeric は frame 単位で settle して文字へ還元 |
| Taboo 13 No CSS 3D | three.js (WebGL) 強制、CSS transform 禁止 |
| Taboo 14 No screen coord in state | state / event は world tagged |
| Taboo 15 No DOM overlay | HUD は ortho camera world、UI は OffscreenCanvas + CanvasTexture |

## 学んだこと

- A11(tagged string)を入れると **prefab data が完全 self-describing** になり、ファイル分割の必要が薄れる
- 共通 transition を behavior 合成 + flow object で表現すると、5 prefab で同じ pattern を 5 回コピペしていたのが消える
- heartbeat + scheduled queue で **過去 / 現在 / 未来の時間 3 相** が axiom レベルで完結(A4 + A11 で吸える、新公理不要)
- Shadow_for_Flow で behavior 並べ替え自由 = LLM が修正で壊しにくい
- 2026-05-03 voxel editor 3 試行失敗(CSS 3D × 2 + CPU 3D)を **A10/A11 + 3d-prefab インフラ** で構造的に回避

## 関連 memo

- `/PJs/memo/2026-05-04_heartbeat-flow-event-system.md` — heartbeat + flow + Shadow_for_Flow 設計記録
- Bible v2.10 — A9 / A10 / A11 / Physics.LLMTyping(その後 user により A12 / A13 追加)
