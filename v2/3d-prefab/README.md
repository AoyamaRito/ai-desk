# 3d-prefab — A10 prefab triple の最小実装

A10 Single Coordinate Domain に従う 3D 描画の最初の例。
`name.asset.js`(prefab)= world transform + mesh(local coord)+ state + transition の triple。

## 起動

ローカル http server で起動(ESM + importmap が file:// で動かないため):

```bash
# v2 直下から
python3 -m http.server 8080
# →  http://localhost:8080/3d-prefab/
```

回転する cube が見えれば OK。

## 構造

```
3d-prefab/
├── index.html              importmap で three@0.170.0 を pin
├── main.js                 entry: scene 作って prefab 配置 → tick loop
├── scene.js                three.js の scene/camera/renderer setup(world coord)
├── prefabLoader.js         asset.js → THREE.Mesh の境界 layer
└── assets/
    └── cube.asset.js       最初の prefab(inline BoxGeometry、GLB なし)
```

## prefab (`name.asset.js`) の規約 — A10 の prefab triple

```js
export const id = 'cube';

// inter-Block 境界: world coord
export const transform = { position:[0,0,0], rotation:[0,0,0], scale:1 };

// intra-Block: local coord OK(asset 原点基準)
export const mesh = { kind: 'BoxGeometry', args:[1,1,1], material:{ kind:'MeshNormalMaterial' } };

// Block state(畳込み遷移の対象)
export const state = { rotSpeed: 0.01, age: 0 };

// 畳込み遷移: pure function、(state, event) → newState
export function transition(state, event) {
  if (event.kind === 'tick') return { ...state, age: state.age + 1 };
  return state;
}
```

### A10 整合チェック

| 場所 | coord | 例 |
|---|---|---|
| `transform.position` | world | `[5, 0, 0]` |
| `mesh.args` (vertex 系) | local | `BoxGeometry(1,1,1)` は asset 原点基準 |
| `state.lastWorldPos`(他 asset 共有) | world | inter-Block 通信用 |
| `state.rotSpeed`(internal scalar) | coord 外 | rad/tick |
| canvas pixel / screen coord | 不可侵 | render output 境界のみ |

## 二段構成 — Node テスト + ブラウザ + ai-eyes

prefab triple は **state + transition が pure function** なので、Block の論理は
ブラウザ不要で Node 単独で検証できる。render + input は adapter layer なので
ブラウザに任せ、AI 観測は ai-eyes 経由にする:

| layer | 場所 | 検証 |
|---|---|---|
| `state` + `transition()` | `assets/*.asset.js`(pure) | `node --test` で単体テスト |
| `mesh` 構造 / GLB load | prefabLoader(adapter) | ブラウザで描画確認 |
| input(ray cast / pointer) | input.js(adapter 境界) | ブラウザ + ai-eyes remote eval |
| 視覚結果 | three.js scene render | ai-eyes /snapshot + structures/ |

### Node 単体テストの実行

```bash
cd v2
node --test 3d-prefab/test/transition.test.js
```

15 件: tick / click / 純粋性 / 可逆性 / A10 整合(state.lastClickWorldPos が world coord 配列)。

### ai-eyes 起動 + ブラウザ AI 観測

```bash
cd v2
PORT=3000 LOG_FILE=/tmp/ai-eyes-3dprefab.log SNAPSHOT_DIR=/tmp/ai-eyes-snapshots \
  node /Users/AoyamaRito/PJs/ai-eyes/ai-eyes.js
# →  http://localhost:3000/3d-prefab/

# AI 側観測:
# - エラー: tail /tmp/ai-eyes-3dprefab.log
# - 60 frame ごとの prefab state: ls /tmp/ai-eyes-snapshots/structures/
# - HTML snapshot: ls /tmp/ai-eyes-snapshots/*.html
# - 任意 eval: curl -X POST -d '{"action":"eval","code":"..."}' localhost:3000/input
```

これで「人間がブラウザを目視 → AI に報告」往復が原理的に消える。

---

## 次の段

- [x] BoxGeometry inline で prefab 動作確認
- [ ] GLTFLoader 統合 → `mesh: { kind:'glb', glbPath:'./character.glb' }` 形式追加
- [ ] AI 生成 GLB(Meshy / Tripo / Rodin 等)を 1 個読み込んで描画
- [ ] 入力 adapter(mouse → ray cast → world hit → prefab.dispatch)
- [ ] HUD layer(camera-following ortho camera、screen-fixed UI を world で表現)
- [ ] 複数 prefab + 他 prefab 参照(world coord で位置共有)

## Bible 整合(自動チェック対象)

```bash
node ../ai-desk.js bible-check 3d-prefab/main.js
node ../ai-desk.js bible-check 3d-prefab/scene.js
node ../ai-desk.js bible-check 3d-prefab/prefabLoader.js
node ../ai-desk.js bible-check 3d-prefab/assets/cube.asset.js
```

A10 / Taboo 13-15(CSS 3D / screen-coord / DOM overlay)違反がないことを確認。
