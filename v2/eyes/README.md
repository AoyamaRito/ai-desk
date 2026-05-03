# AI-Eyes — v2 観測ハーネス(Node, in-memory)

LLM が browser を起動せずに demo の挙動を **draw operation log として** witness するためのインフラ。

Bible v1 §1.5「AI-Eyes」を v2 の **All-as-Block** + **公理 A0(展開された複雑性)** に乗せ直した実装。

---

## 中核の発想

snapshot を **PNG(opaque pixels)でなく canvas API への呼び出し列(transparent algebra)** で取る。

```js
{
  op: 'set', prop: 'fillStyle', value: '#fafbfc'
}
{
  op: 'fillRect', args: [0, 0, 800, 600]
}
{
  op: 'beginPath', args: []
}
{
  op: 'moveTo', args: [100, 100]
}
...
```

LLM は **算術を直接読める**(diff 可能、Block 化可能、検算可能)。
3dplus(CPU 3D Twin)とは性質が同じ層 — 「描画の透明算術」を提供する。

---

## demo に求める観測可能性(v2 規約)

demo モジュールは ESM で以下を export する:

```js
export function initialState()                // → state(JSON-serializable)
export function dispatch(state, evt)          // → newState(pure)
export function render(ctx, state, dims)      // → void(pure render)
export const events = [{label, evt, snapshot?}, ...]   // 任意のシナリオ
```

これは **観測可能性 = pure 化** を demo に対する規律として要求する。
DOM 直接操作・グローバル変数・time-based 状態を render から追い出すことになる。
v2 demo は今後この形に揃えていく。

---

## CLI

```bash
# シナリオ実行 → ./ai-eyes-<demo>.json に Block Graph を書く
node v2/eyes/ai-eyes.js v2/eyes/example-headless-demo.js

# 出力先指定
node v2/eyes/ai-eyes.js path/to/demo.js -o /tmp/snap.json

# サマリだけ表示(graph は書かない)
node v2/eyes/ai-eyes.js path/to/demo.js -s

# キャンバス寸法
node v2/eyes/ai-eyes.js path/to/demo.js --width=1024 --height=768
```

出力された JSON は **`ai-desk.js loadGraph` がそのまま読める**:

```bash
node v2/ai-desk.js load /tmp/snap.json
# → loaded 14 blocks from /tmp/snap.json
#   verify: { ok: true }
```

---

## Block Graph スキーマ

```
session       Block { id:'session_<sid>', type:'session',
                      meta:{startedAt, dims, demo, ua},
                      versions:[
                        { content:{startedAt, dims}, children:[snap_001, tx_0001, ...] }
                      ] }

tx (操作)      Block { id:'session_<sid>_tx_<n>', type:'tx', meta:{seq, sessionId, label},
                      versions:[
                        { content:{events:[...], label},
                          refs:[{kind:'in-session', target:session_<sid>},
                                {kind:'after',      target:<前の閉じた tx の id>}] }
                      ] }

snapshot       Block { id:'session_<sid>_snap_<n>', type:'snapshot',
                      meta:{seq, sessionId, label},
                      versions:[
                        { content:{capturedAt, dims, state, draw_ops:[...], summary:{total, byOp}},
                          refs:[{kind:'observes', target:session_<sid>},
                                {kind:'after',    target:<最後に閉じた tx の id>}] }
                      ] }
```

- **因果は `refs` で**: 操作の順序、観測の位置、session への所属が全部 ref エッジ
- **state も snapshot に同梱** — 何が描かれているか + その時点の state を 1 セットで保存
- **summary** に `byOp` 件数集計が入っているので、`fillRect:7, beginPath:42` 等の粒度比較が即できる

---

## API(プログラマブル使用)

```js
import { runSession, dumpGraph, captureFrame } from './v2/eyes/ai-eyes.js';
import demo from './my-demo.js';

const { graph, finalState, sessionId } = runSession(demo, {
  dims: { w: 1280, h: 720 },
  events: [
    { label: 'click-A', evt: { type: 'click', target: 'A' } },
    { label: 'drag',    evt: { type: 'drag', dx: 50, dy: 0 } },
  ],
});
dumpGraph(graph, '/tmp/run.json');
```

`captureFrame(demo, state, dims)` は単発フレーム捕捉(Block でなく素の record を返す)。

---

## 例: 動作確認

```bash
node v2/eyes/ai-eyes.js v2/eyes/example-headless-demo.js -o /tmp/eyes-test.json
# → written: /tmp/eyes-test.json (14 blocks, session session_xxxx)

node v2/ai-desk.js load /tmp/eyes-test.json
# → loaded 14 blocks from /tmp/eyes-test.json
#   verify: { ok: true }
```

example-headless-demo.js は「点を動かす + trail を残す + 線を引く」だけの最小 demo。
6 ステップのシナリオで、初期 + 各 tx 後 = 7 snapshots を capture する。

---

## ファイル

| | 役割 |
|---|---|
| `virtual-canvas.js` | Canvas2D API を完全模倣、全描画コールを ops 配列に記録(~190行) |
| `ai-eyes.js`        | runSession / captureFrame / dumpGraph + CLI(~150行) |
| `example-headless-demo.js` | 観測可能性インターフェイスを満たす最小サンプル |

すべて Zero-Dep / ESM / 単一の `node` で動く。

---

## ロードマップ

- **Phase 0(完了)**: virtual-canvas + Node runner + Block Graph 出力
- **Phase 0.5**: 既存 demo(node-graph 等)の render を pure 化して AI-Eyes 化
- **Phase 1**: ai-desk.js の `eyes` サブコマンド + hint 統合
  (`canvas` 描画 demo を検出 → AI-Eyes 案内)
- **Phase 2**: replay engine(tx → dispatch 連鎖を再生)、rewind 後の **分岐 Block**
  (`refs:[{kind:'branch_from', target:旧tx}]` で git 的トポロジを first-class 化)
- **Phase 3**: 任意ピクセル化が必要なら、ops → 軽量純 JS rasterizer or node-canvas で PNG 生成

---

## 退避済み

旧 browser 版 ai-eyes.js(snapshot ボタン + DOM 監視 + download)は
`/PJs/trash/ai-eyes-browser-2026-05-04.js` に退避。

理由: AI-Eyes が browser 必要だと user 経由のラウンドトリップが残り、
解消したい問題そのものを内包する。LLM-Native = Node で完結する設計に揃える。
