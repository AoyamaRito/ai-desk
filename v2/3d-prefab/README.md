# 3d-prefab — A10 + A11 統合 prefab demo

Bible 公理 A10(Single Coordinate Domain) + A11(Domain-Tagged Coordinates)に
従う 3D 描画の実装。Block 層と Adapter 層を 2 つのファイルに集約。

## 構造(3 ファイル + test 1 + assets)

```
3d-prefab/
├── coord.js              A11 helpers — w/l/s/o builders + parseCoord/requireDomain
├── prefabs.js            Block 層: 全 prefab data + behaviors + compose(crystallize 整合)
├── main.js               Adapter 層: scene + loader + input + hud + entry(Three.js / DOM)
├── index.html            importmap で three@0.170.0 を pin
├── test/
│   └── prefabs.test.js   41 cases、ブラウザ不要、~90ms
└── assets/
    ├── box.glb           Khronos Sample (Apache 2.0)
    └── koma_hu.glb       (将棋 歩、~32MB)
```

## A11 — domain-tagged coord(全部 string)

すべての coord 値は `"<domain>:x,y[,z]"` で表現する:

```js
import { w } from './coord.js';

transform: {
  position: w(5, 0, 2),     // → "world:5,0,2"
  rotation: [0, 0, 0],       // Euler radians、coord ではないので tag なし
  scale: 1,
}

state: {
  lastClickWorldPos: w(1.5, 0.5, -1.2),   // inter-Block 共有値
  // raw 配列 [1.5, 0.5, -1.2] は A11 違反
}
```

domain 4 種:
- `world:` — scene graph / inter-Block / refs payload(絶対座標)
- `local:` — asset.js 内部の mesh.vertices / bones(asset 原点基準)
- `screen:` — render output / input adapter 境界のみ(Block 内禁止)
- `ortho:` — HUD ortho camera world 領域

## prefabs.js — Block 層

各 prefab は data + behavior id 配列で表現、共通 transition は behavior 合成で生成:

```js
const standardClickResponse = ['tickAge', 'pulseDecay', 'reverseRotOnClick', 'pulseOnClick', 'recordClickPos'];

export const prefabs = {
  cube: {
    id: 'cube',
    transform: { position: w(0, 0, 0), rotation: [0,0,0], scale: 1 },
    mesh: { kind: 'BoxGeometry', args: [1,1,1], material: { kind: 'MeshNormalMaterial' } },
    state: { rotSpeed: 0.01, age: 0, pulse: 0, lastClickWorldPos: null },
    behaviorIds: standardClickResponse,
  },
  // 他 prefab(boxGlb / komaHu / pointer / character)も同様、~10 行/個
};
```

旧 5 個の `*.asset.js` 別ファイルは `/PJs/trash/3d-prefab-pre-A11-2026-05-04/` に退避。

## main.js — Adapter 層

scene / loader / input / hud / 起動 ループを 1 ファイルに集約。各 boundary で
A11 tagged string を Three.js Vector3 に parse(`requireDomain`)。

## 二段検証

| layer | 場所 | 検証 |
|---|---|---|
| Block(prefabs.js) | pure transition + tagged coord | `npm run test:prefab`(Node、~90ms、41/41) |
| Adapter(main.js) | Three.js / DOM / pointer | ブラウザ + ai-eyes 観測 |

## 起動

```bash
# Block 層検証
cd v2
npm run test:prefab

# Adapter 込みで動作確認(ai-eyes 経由で AI 観測可能)
PORT=3000 LOG_FILE=/tmp/ai-eyes-3dprefab.log SNAPSHOT_DIR=/tmp/ai-eyes-snapshots \
  node /Users/AoyamaRito/PJs/ai-eyes/ai-eyes.js
# →  http://localhost:3000/3d-prefab/
```

## 公理整合表(bible-check 自動検証対象)

| Axiom / Taboo | 強制方法 |
|---|---|
| A10 Single Coord Domain | screen coord は input adapter 境界のみ、Block / event payload に侵入禁止 |
| A11 Domain-Tagged Coord | すべての coord は string、boundary で parse、不一致は runtime throw |
| A9 Crystallization | tagged string は Go の string で 1:1 受け、translation contract 単純化 |
| Taboo 13 No CSS 3D | three.js (WebGL) 強制、CSS transform 禁止 |
| Taboo 14 No screen coord in state | state は world tagged、event は world tagged |
| Taboo 15 No DOM overlay | HUD は ortho camera world、UI は OffscreenCanvas + CanvasTexture |

## 学んだこと

- A11(tagged string)を入れると **prefab data が完全 self-describing** になり、ファイル分割の必要が薄れる
- 共通 transition を behavior 合成にすると、5 prefab で同じ pattern を 5 回コピペしていたのが消える(A1 + A7 + Vocabulary `densify`)
- Block 層と Adapter 層の分離は維持(crystallize 可能性 vs Three.js 依存)
- voxel 失敗の原因「coord 系混入」は A10 + A11 で原理的に消えた
