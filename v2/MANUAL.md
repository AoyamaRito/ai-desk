# ai-desk 操作マニュアル

> 思想は [`BIBLE.md`](./BIBLE.md)、規律は [`AI_ONBOARDING.md`](./AI_ONBOARDING.md)、CLI 早見表は [`REFERENCE.md`](./REFERENCE.md)。
> このファイルは **使い方の実体** — 何を、どの順で、どう叩くか。LLM 専用。

---

> ## ⚡ 最初に必ず読む: §4 Virtual Heavy Function — 特に §4.5 〜 §4.9 の **APPLY(逆配分)**
>
> v2 の最重要概念。「展開」だけなら他ツールでもできる。
> v2 が成立するのは **expand → LLM 編集 → virtualApply で各 Block に確実に逆配分される往復**が
> 機構として保証されているから。Apply の規律(同じ opts・ヘッダ不変・スコープ閉鎖)を
> 守らないと、Block 履歴が壊れる/ズレる/取りこぼされる。

---

## 0. 用語の最短定義

| 語 | 定義 |
|---|---|
| Block | `{ id, type, versions[], meta }`。すべての構成要素の単位 |
| Version | Block のスナップショット `{ content, refs, children, tags, timestamp, prevHash, hash }`。**append-only**、これが REAL |
| head() | 最新 Version。`block.content` 等の getter は head() からの **派生(SHADOW)** |
| Graph | Block の集合 + 双方向走査(forward / backward / impact) |
| ref | `{ kind, target }`。kind は `import` / `calls` / `contains` / `link` / `observes` 等 |
| Virtual Heavy Function | root + forward 推移閉包を **1つの content に展開**して LLM に渡し、戻りを各 Block に逆配分する機構 |

---

## 1. 30 秒で動かす

```bash
cd /Users/AoyamaRito/PJs/ai-desk
npm test                           # 105 e2e tests, all green
node ai-desk.js                 # self-test(Block/Graph/parseJS の動作デモ)
node ai-desk.js self            # 自分自身を解析(自己読み込み)
```

依存ゼロ、build ゼロ。Node 20+ だけ。

---

## 2. 基本ワークフロー(典型的な 1 セッション)

### 2.1 既存 JS を Graph 化して保存する

```bash
# ファイル群 → graph.json
node ai-desk.js save graph.json src/foo.js src/bar.js

# import の相対パスを Block ID に解決(モジュール間 ref が繋がる)
node ai-desk.js resolve graph.json
```

`graph.json` が**永続のソース**。以降の `apply` / `apply-block` / `virtual-apply` はこれを書き換える(append のみ)。

### 2.2 構造を把握する

```bash
node ai-desk.js skeleton src/foo.js               # Block ID と refs 一覧
node ai-desk.js stats src/foo.js                  # block 数 / 種別分布 / 平均 refs
node ai-desk.js tags src/foo.js                   # 全タグ + 件数
node ai-desk.js mermaid src/foo.js                # flowchart 出力(README 貼り付け用)
```

### 2.3 1 Block にズームする

```bash
node ai-desk.js focus src/foo.js src/foo.js:fn:bar    # content だけ表示
node ai-desk.js context src/foo.js src/foo.js:fn:bar 1
# ↑ target + 1段の forward/backward を markdown で出す(LLM プロンプト用)
```

### 2.4 影響範囲を見る(変更前のリスク評価)

```bash
node ai-desk.js impact src/foo.js src/foo.js:fn:bar
# → bar を変えると壊れうる Block 全部(backward の推移閉包)
```

### 2.5 編集して反映する

3 つの粒度から選ぶ:

| やりたいこと | コマンド | 何が起きる |
|---|---|---|
| ファイル全体 patch | `apply graph.json patch.js <moduleId>` | patch を parseJS → Block 単位で diff → 変更分だけ commit |
| 1 関数だけ patch | `apply-block graph.json <blockId> patch.js` | mini-parse して refs/tags 自動再計算 → 1 Block に commit |
| 重厚関数(root + 依存)patch | `virtual-apply graph.json <rootId> patch.txt` | BLOCK ヘッダで分割 → 各 Block に逆配分 commit |

すべて **新 version を append** するだけ。古い version は不変。

### 2.6 履歴を見る

```bash
node ai-desk.js diff src/foo.js src/foo.js:fn:bar       # 直近 2 version の差分
node ai-desk.js diff src/foo.js src/foo.js:fn:bar 0 3   # version 0 と 3 を比較
node ai-desk.js blame src/foo.js src/foo.js:fn:bar src/foo.js:fn:baz
# ↑ bar が baz への ref を初めて持った version
```

### 2.7 Graph をコードに戻す

```bash
node ai-desk.js export graph.json src/foo.js out.js
# ↑ module Block の contains 順に Block の content を結合して再生成
# 注: import の named/default/namespace 区別は完全 round-trip しない(MVP の限界)
```

---

## 3. CLI コマンド全 22 種(用途別)

### 3.1 観測系(読むだけ・破壊しない)

| コマンド | 用途 |
|---|---|
| `skeleton <file>` | Block 一覧 + refs |
| `focus <file> <id>` | 指定 Block の content |
| `context <file> <id> [depth]` | target + 近傍を LLM 用 markdown に整形 |
| `stats <file>` | 集計(block 数・version 数・byType・byTag) |
| `tags <file>` | 全タグと件数 |
| `tag <file> <tag>` | あるタグを持つ Block 一覧 |
| `search <file> <query>` | content の部分一致検索 |
| `impact <file> <id>` | backward 推移閉包(変更時の影響範囲) |
| `diff <file> <id> [i] [j]` | version 間差分 |
| `blame <file> <id> <ref-target>` | ref が初めて追加された version |
| `mermaid <file>` | flowchart LR を stdout |
| `infer-tags <file> <id>` | content からタグ推論(test/io/pure 等) |
| `lint <file> [--summary] [--only=K1,K2]` | 8 種の整合性チェック(broken/orphan/circular/brace/calls/tags/empty/hash) |
| `self` | 自分自身(ai-desk.js)を解析 |

### 3.2 永続化系

| コマンド | 用途 |
|---|---|
| `save <out.json> <files...>` | ファイル群 → Graph → JSON 保存 |
| `load <in.json>` | JSON 読み込み + verify |
| `graph <files...>` | parseJS した結果を JSON で stdout |
| `resolve <graph.json>` | import の相対パスを Block ID に解決 |
| `export <graph.json> <moduleId> [out.js]` | Graph から JS 再生成 |

### 3.3 編集系(append-only)

| コマンド | 用途 |
|---|---|
| `apply <graph.json> <patch.js> <moduleId>` | ファイル単位 patch |
| `apply-block <graph.json> <blockId> <patch-file>` | 1 Block 単位 patch(`-` で stdin) |
| `virtual-apply <graph.json> <rootId> <patch-file>` | 仮想重厚関数の逆配分(`-` で stdin、後述) |

### 3.4 仮想重厚関数

| コマンド | 用途 |
|---|---|
| `heavy <file> <root-id> [--depth=N]` | root + 依存を 1 content に展開して stdout |

### 3.5 検証

| コマンド | 用途 |
|---|---|
| `e2e` | テスト実行(npm test と同じ) |

---

## 4. Virtual Heavy Function — v2 のキラー機能

> **この章は v2 の心臓部。** 飛ばさず順に読む。
> 特に §4.5〜§4.9 の **Apply(逆配分)** は規律違反するとデータが壊れる。

### 4.1 解く問題(なぜ重要か)

- **§0.1 重厚関数**: LLM は全文脈が 1 関数に集約された方が間違えない
- **Block 分割**: 管理・履歴・検索・refs グラフは細粒度な方が便利
- 普通は **二者択一**(統合か分割か) → v2 は**物理層と論理層を分離**して両取り

| 層 | 形 | 何を最適化 |
|---|---|---|
| **物理層**(graph.json 上の状態) | 細粒度 Block + versions 履歴 + refs | 管理・履歴・影響分析 |
| **論理層**(LLM に渡す content) | root + forward 推移閉包を **1 つの巨大 content** に展開 | LLM の認知(全文脈集約) |

両者を**往復させる機構**が Virtual Heavy Function。
**展開(expand)だけでは半分**。**逆配分(apply)があって初めて閉じる**。

### 4.2 全体フロー(往復が本体)

```
[graph.json]                                                 [graph.json]
  ├─ Block A (root) ─┐                                         ├─ Block A (root) ← v+1
  ├─ Block B        ├─→ heavy.txt ──→ LLM ──→ heavy.txt' ──→  ├─ Block B        ← v+1
  ├─ Block C        │   (1 content)         (編集済 1 content)  ├─ Block C        ← unchanged
  └─ Block D ───────┘                                          └─ Block D        ← v+1
        ↑                  ↑                                              ↑
   virtualHeavy        expandVirtualHeavy                          virtualApply
   (forward閉包を集める)   (1 content に連結)                       (各 Block に逆配分 commit)
```

**鍵**: 同じ root に対して expand と apply を呼べば、間にある LLM が任意のテキスト編集をしても、
Block 境界(`// --- BLOCK: <id> ---`)さえ壊さなければ機械的に元の Block 群に戻せる。
**全 Block が個別に append-only 履歴を持つ**ので、誰がどの version で何を変えたか後追いできる。

### 4.3 ワークフロー(コマンド実例)

```bash
# 1. graph.json が無ければ作る(永続のソース)
node ai-desk.js save graph.json src/foo.js
node ai-desk.js resolve graph.json

# 2. root を決めて重厚関数として展開(LLM プロンプト用)
node ai-desk.js heavy src/foo.js src/foo.js:fn:render --depth=3 > heavy.txt

# 3. heavy.txt を LLM に投げる
#    LLM は BLOCK ヘッダを残したまま、各 BLOCK の content を編集して返す

# 4. 戻ってきた heavy.txt' を逆配分(同じ rootId・同じ depth で)
node ai-desk.js virtual-apply graph.json src/foo.js:fn:render heavy.txt

# 5. 結果検証
node ai-desk.js diff src/foo.js src/foo.js:fn:render
node ai-desk.js lint src/foo.js --summary
```

### 4.4 展開フォーマット(LLM が見るもの)

```
// === Virtual Heavy Function rooted at <rootId> ===
// N blocks combined into one logical heavy function
// Edit the bodies; do not change the boundary headers.

// --- BLOCK: <id1> (<type>) ---
// tags: ...
// refs: ...
<content1>

// --- BLOCK: <id2> (<type>) ---
<content2>

// === end of virtual heavy ===
```

| 行 | 役割 | LLM は触ってよいか |
|---|---|---|
| `// === Virtual Heavy Function ... ===` | 全体ヘッダ | ❌ 残す(無くても動くが消す理由が無い) |
| `// --- BLOCK: <id> (<type>) ---` | **境界ヘッダ。Apply の分割キー** | ❌ **絶対に変えない・消さない・追加しない** |
| `// tags: ...` / `// refs: ...` | 参考表示(commit 時に除去される) | ⚪ 触っても無視される |
| `<content>` | Block の本体 | ✅ ここを編集する |
| `// === end of virtual heavy ===` | 終端マーカー | ❌ 残す |

---

### 4.5 ⚡ Apply(virtualApply)— 逆配分の正確な挙動

**ここが v2 の心臓**。`virtualApply(graph, rootId, expandedContent, opts = {})` の動作を 1 つずつ:

#### Step 1: スコープ集合の再計算
```js
const heavyBlocks = virtualHeavy(graph, rootId, opts);
const heavyById = new Map(heavyBlocks.map(b => [b.id, b]));
```
- **expand と同じ `opts`(depth, kind)で virtualHeavy を呼び直す**
- これが「Apply のスコープ」になる Block 集合

> 🚨 **expand と apply で opts(特に depth)が違うと、
> スコープがズレる**。expand 時に `--depth=3` で渡したなら apply も同じ depth で。

#### Step 2: 入力 content を BLOCK ヘッダで分割
```js
const segments = splitByBlockHeader(expandedContent);
```
- 正規表現: `/^\s*\/\/\s*---\s*BLOCK:\s*(\S+)\s*\(([^)]+)\)\s*---\s*$/gm`
- **行頭からヘッダを検出**し、次のヘッダ(または末尾)までを 1 segment の body とする
- body から末尾の `// === end of virtual heavy ===` を除去
- body から `// tags:` `// refs:` 行を除去

#### Step 3: 各 segment を Block に逆配分
```js
for (const seg of segments) {
  const target = heavyById.get(seg.id);
  if (!target) {
    updates.push({ action: 'skipped-out-of-scope', id: seg.id });  // ← 静かに無視
    continue;
  }
  const r = target.applyPatch(seg.content.trim());
  updates.push({ action: r.action, id: seg.id });   // 'updated' / 'created' / 'unchanged'
}
```

#### Step 4: applyPatch の中身(Block 単位)
```js
applyPatch(content, opts = {}) {
  const head = this.head();
  if (head && head.content === content
      && (opts.refs == null || sameRefs(opts.refs, head.refs))
      && (opts.tags == null || sameArr(opts.tags, head.tags))) {
    return { action: 'unchanged', block: this };          // ← 新 version 作らない
  }
  this.commit({
    content,
    refs: opts.refs ?? head?.refs ?? [],     // ← refs は head から継承
    children: opts.children ?? head?.children ?? [],
    tags: opts.tags ?? head?.tags ?? [],     // ← tags も head から継承
    meta: { ...(head?.meta ?? {}), ...(opts.meta ?? {}), appliedAt: Date.now() },
  });
  return { action: head ? 'updated' : 'created', block: this };
}
```

**つまり virtualApply 1 発で起きること**:
- スコープ内の Block: **content が変わっていれば新 version を append**(refs/tags は head 継承)
- スコープ内の Block: **content が同じなら何もしない**(version 履歴を汚さない)
- スコープ外の id: **静かに skip**(エラーにしない、log だけ)

---

### 4.6 ⚡ 「依存性ごと撃つ」が成立する仕組み

`virtualHeavy(graph, rootId, { kind: 'calls' })` は **forward の推移閉包**:

```
root → f1 → f2 → f3
   ↘  f4 → f5
```

root を 1 個指定すると、**呼ぶ先(forward)を再帰的に**集めて 1 content にする。
LLM は **呼び出し元と呼び出し先の整合を同時に**直せる。

| 観点 | v1 単体編集 | v2 仮想重厚関数 |
|---|---|---|
| LLM が見える文脈 | 1 関数のみ | root + 全依存先 |
| 整合の取り方 | 編集後に他関数を別途修正 | **同一プロンプト内で同時に** |
| 物理ファイル | 各関数は分散したまま | 同上(分散したまま) |
| 履歴 | 各関数 1 commit | **全関連 Block が同時に新 version** |
| v1 の「共有ヘルパー禁止」 | 維持 | 維持(物理は分散、論理だけ統合) |

> これが v2 が "**依存性ごと撃つ**" と呼ばれる所以。
> 1 root を撃つと、refs で繋がる関連 Block 全てが**1 トランザクションのように**更新される。
> append-only なので**ロールバックも自然**(各 Block を `rollback(prev_index)` するだけ)。

---

### 4.7 ⚡ Apply の戻り値(updates 配列)を必ず読む

```js
const updates = virtualApply(graph, rootId, content);
// → [{ action, id }, ...]
```

| action | 意味 | 取るべき行動 |
|---|---|---|
| `updated` | 既存 Block に新 version が append された | ✅ 期待通り |
| `created` | Block が無かったので新規作成された | ⚠ 本来はあり得ない(virtualHeavy が既存 Block を集めるため)。発生したら設計側のバグ |
| `unchanged` | content が head と同一だったので何もしなかった | ✅ 履歴を汚さない正しい挙動 |
| `skipped-out-of-scope` | 入力に **virtualHeavy 集合に無い id** のヘッダがあった | 🚨 **要確認**。LLM が新しい BLOCK ヘッダを勝手に追加した、または既存 id を改変した |

CLI 出力でも全 update が見える:
```
  updated              src/foo.js:fn:render
  unchanged            src/foo.js:fn:helper
  skipped-out-of-scope src/foo.js:fn:newOne
```

---

### 4.8 ⚡ Apply を壊す 6 パターン(避ける)

| # | やってしまう間違い | 何が起きるか | 直し方 |
|---|---|---|---|
| 1 | LLM が BLOCK ヘッダを書き換え/翻訳した | その segment が `skipped-out-of-scope` で消える | プロンプトに「ヘッダ行は絶対に変更しない」を明記 |
| 2 | LLM が新規 BLOCK ヘッダを追加して関数を生やした | `skipped-out-of-scope` で消える(既存 Block セットに無いため) | 別途 `apply-block` で新規追加するか、`apply` で patch.js として渡す |
| 3 | expand と apply で `--depth` が違う | スコープ集合がズレる → 一部 segment が skip される | **同じ depth・同じ kind を必ず使う** |
| 4 | apply 後に元の root を消した / id を改名した | 次回 expand で全く違う集合が出る | rename は `rollback` + 新 id 作成 → 旧 id を非推奨化、で段階的に |
| 5 | content の `{` `}` が崩れた | `commit` 自体は通るが後で `lint` の `brace-mismatch` が出る | `lint --only=brace` で即検出、再 expand → 修正 → re-apply |
| 6 | refs/tags 行を本気で書き換えた | **無視される**(commit 時に head から継承する) | refs/tags を変えたいなら別コマンド(`apply-block` で smart 再計算 / 手動 commit) |

---

### 4.9 ⚡ Apply の正しい使い方チェックリスト

往復の前後で **必ず** 確認:

```bash
# 【expand 前】
node ai-desk.js impact src/foo.js <rootId>     # 影響範囲を把握
node ai-desk.js heavy  src/foo.js <rootId> --depth=N | head -50   # 何 Block 入るか目視
```

**LLM への指示テンプレ**:
> 以下は Virtual Heavy Function。`// --- BLOCK: <id> (<type>) ---` のヘッダ行は **絶対に変えない・消さない・追加しない**。
> 各 BLOCK の content だけを編集して返してください。新規関数を追加したい場合は別途指示します。

```bash
# 【apply 後】
node ai-desk.js virtual-apply graph.json <rootId> heavy.txt | tee apply.log
grep skipped apply.log              # 取りこぼしの即検出
node ai-desk.js lint src/foo.js --summary
node ai-desk.js diff src/foo.js <rootId>
node ai-desk.js load graph.json   # verify を最後に必ず
```

> ✅ Apply は **append-only** なので、**何度やり直しても履歴は壊れない**(無駄 version は増える)。
> 失敗を恐れずに往復を回す。万一の時は `b.rollback(prevIndex)` で過去 version の状態を**新 version として**復元。

---

### 4.10 Apply の API 直接利用(プログラマティック)

CLI を介さず JS から:

```js
import { loadGraph, saveGraph, expandVirtualHeavy, virtualApply } from './ai-desk.js';

const g = loadGraph('graph.json');
const rootId = 'src/foo.js:fn:render';
const opts = { depth: 3, kind: 'calls' };   // ← expand と apply で同じ opts を使う

// 1. 展開
const expanded = expandVirtualHeavy(g, rootId, opts);

// 2. LLM に投げる(任意の経路で)
const edited = await callLLM(expanded);

// 3. 逆配分
const updates = virtualApply(g, rootId, edited, opts);

// 4. 取りこぼしを検出
const dropped = updates.filter(u => u.action === 'skipped-out-of-scope');
if (dropped.length) console.warn('dropped segments:', dropped);

// 5. 永続化
saveGraph(g, 'graph.json');
```

**opts を変数に切り出して expand / apply 両方に渡す**のが事故防止のイディオム。

---

## 5. プログラマティック API

```js
import {
  // 中核
  Block, Graph,
  // パース
  parseJS, parseMD, loadProject, checkBraces,
  // 永続化
  saveGraph, loadGraph, buildAndSave,
  // 編集
  applyPatch, applyToBlock, applyBlockSmart,
  resolveImports,
  // 仮想重厚関数
  virtualHeavy, expandVirtualHeavy, virtualApply,
  // 出力
  exportModule, exportToFile, exportMermaid,
  // 補助
  inferTags, graphStats, blockContext, formatContextForLLM,
  // 第一級 Block
  constraintBlock, evalConstraint,
  observationBlock,
} from './ai-desk.js';
```

### 5.1 Block の最小操作

```js
const b = new Block({ id: 'mod:fn:foo', type: 'function' });
b.commit({ content: 'function foo(){}' });           // v0
b.commit({ content: 'function foo(){ return 1; }' }); // v1

b.versions.length  // 2 (REAL)
b.content          // 'function foo(){ return 1; }' (SHADOW)
b.head()           // 最新 Version オブジェクト
b.at(timestamp)    // 任意時点(time travel)
b.diff(0, 1)       // 差分
b.blameRef('x')    // x への ref が初めて付いた version
b.rollback(0)      // 過去状態を「新しい past として」commit(履歴は保持)
b.verify()         // hash チェーン検証
```

### 5.2 Graph の核心メソッド

```js
const g = loadProject(['src/foo.js']);

g.forward(id, kind?)   // id が参照する先
g.backward(id, kind?)  // id を参照する元
g.impact(id, kind?)    // backward 推移閉包(変更時の影響範囲)

g.byType('function')
g.byTag('export')
g.search('TODO', { type: 'function', tag: 'pure', includeOldVersions: false })

g.at(timestamp)        // 任意時点の Graph スナップショット
g.lint({ orphan: false })  // 8 種の整合性チェック
g.verify()             // 全 Block の hash チェーン検証
```

### 5.3 Constraint Block

```js
const cb = constraintBlock({
  id: 'shipping',
  axes: ['weight', 'zone'],
  values: {
    weight: [0.5, 1, 5, 10],
    zone: ['kanto', 'kansai', 'kyushu'],
  },
  derive: combo => ({
    fee: (combo.weight <= 1 ? 300 : 500) +
         (combo.zone === 'kyushu' ? 200 : 0),
  }),
});

evalConstraint(cb)                // { _worlds: 12, worlds: [...] }
evalConstraint(cb, { fee: 700 })  // 該当する組み合わせを逆引き
evalConstraint(cb, { fee: 99999 }) // { _contradiction: true }
```

- **derive は純粋関数**(I/O・乱数・時刻に触れない)
- **filter は浅い等価**(`merged[k] === v`)。範囲条件は derive で派生フラグを作る
- 制約自体が Block なので `g.impact(constraintId)` で「この制約を変えたら壊れる関数」が即取れる

### 5.4 Observation Block

```js
observationBlock({
  id: 'obs:2026-05-03T10:00Z:001',  // タイムスタンプ + 連番
  observedId: 'mod:fn:render',
  snapshot: { hp: 50, x: 10, screen: 'playing' },
  tags: ['ai-eyes', 'frame'],
});
// → refs: [{ kind: 'observes', target: 'mod:fn:render' }] が自動付与
// → g.backward(renderId) で観測履歴が時系列で取れる
```

---

## 6. lint(整合性チェック 8 種)

| kind | 検出するもの | 切り方 |
|---|---|---|
| `broken-ref` | target が存在しない ref(import の外部モジュールは除外) | `{ broken: false }` |
| `orphan` | 誰からも参照されない非 module Block | `{ orphan: false }` |
| `circular` | forward の循環 | `{ circular: false }` |
| `brace-mismatch` | content の `{ }` が不揃い(文字列・regex は skip) | `{ brace: false }` |
| `calls-leak` | content に他関数呼び出しの形跡があるが calls ref が無い | `{ calls: false }` |
| `tag-mismatch` | type と tags が不整合(function なのに tags に function が無い 等) | `{ tags: false }` |
| `empty-block` | content も refs も children も空 | `{ empty: false }` |
| `hash-broken` | version の prevHash チェーン破損 | `{ hash: false }` |

```bash
node ai-desk.js lint src/foo.js --summary
node ai-desk.js lint src/foo.js --only=broken,calls
```

---

## 7. parseJS の挙動と限界

### 7.1 抽出するもの

| 構文 | 生成される Block / ref |
|---|---|
| ファイル全体 | `module` Block。refs に `import` と `contains` |
| `function foo(){}` / `export function` / `async function` | `function` Block(tags: `function`, `async`?, `export`?, `generator`?) |
| `const foo = () => {}` | `function` Block(tags: `function`, `arrow`) |
| `class Foo {}` / `export class` | `class` Block(tags: `class`, `export`?, `default`?) |
| `import ... from 'x'` | module の refs に `{ kind: 'import', target: 'x' }` |
| 同モジュール内の関数呼び出し | calls ref(名前ベース、後段で再 commit) |
| 直前コメントの `// [ai_s_emblem:#a#b Name]` / `// @tags: a, b` | tags に取込(v1 互換) |

### 7.2 文字列・コメント・regex の扱い

`matchPair` / `checkBraces` は以下を **skip** してから brace を数える:
- 文字列リテラル `'` `"` `` ` ``(template の `${}` ネストも追跡)
- 行コメント `//`、ブロックコメント `/* */`
- 正規表現リテラル `/.../flags`(直前トークンで context 判定)

### 7.3 既知の限界(MVP)

- 文字列リテラル中の `function` キーワードを誤検出することがある
- ネスト関数(関数の中の関数)は浅い捕捉のみ
- import の named/default/namespace の区別が保存されない → `export` での round-trip が雑
- decorator / private field 等は未対応(必要なら正規表現を拡張)

本格運用なら AST(自作 Zero-Dep parser)に置換予定。**境界の振る舞いは e2e.js で固定**してから直す。

---

## 8. 編集 API の選び分け

| 状況 | 使う API | 理由 |
|---|---|---|
| 1 関数の中身だけ書き換え | `applyToBlock(g, id, content)` | 最速。refs/tags は head 継承 |
| 1 関数を書き換えて refs/tags も再計算したい | `applyBlockSmart(g, id, content)` | mini-parse して反映 |
| ファイル全体を patch(複数 Block 同時) | `applyPatch(g, source, moduleId)` | parseJS → diff → commit |
| root + 依存をまとめて patch | `expandVirtualHeavy` → LLM → `virtualApply` | 仮想重厚関数 |
| 過去状態に戻す | `b.rollback(versionIndex)` | 履歴を消さず「新しい past」として commit |

**禁忌**: `b.versions = b.versions.slice(0, n)` のような直接削除。必ず commit / rollback 経由。

---

## 9. よくある詰まり

| 症状 | 原因 | 対処 |
|---|---|---|
| `block not found: <id>` | Block ID 規約(`<moduleId>:<prefix>:<name>`)を間違えている。`prefix` は `fn` か `class` | `skeleton` で実 ID を確認 |
| `lint` で `calls-leak` が大量 | 同名関数が偶然 content に出てる(文字列・コメント中など)。または **本物の漏れ** | 該当 Block を見て判別。漏れなら `applyBlockSmart` で再計算 |
| `virtual-apply` が `skipped-out-of-scope` | LLM が新規 Block を勝手に追加した、もしくは id を改変した | `apply-block` で個別に追加するか、root の depth を増やしてもう一度 |
| `export` した JS の import 文が壊れる | round-trip の限界(named/default 区別なし) | 手動修正、または import を改変しない方針で運用 |
| `verify` が `hash mismatch` | versions を直接書き換えた疑い | 直前の編集経路を確認。`commit()` 経由のみが正規 |
| `impact` が空 | 当該 id を呼ぶ Block が無い、もしくは `resolve` 未実行で import が文字列のまま | `resolve graph.json` を先に走らせる |

---

## 10. 安全な運用パターン

### 10.1 編集前の確認 3 点セット

```bash
node ai-desk.js focus   src/foo.js <id>     # 現状 content
node ai-desk.js context src/foo.js <id> 2   # 周辺(prompt に渡す)
node ai-desk.js impact  src/foo.js <id>     # 影響範囲
```

### 10.2 編集後の検証 3 点セット

```bash
node ai-desk.js diff   src/foo.js <id>
node ai-desk.js lint   src/foo.js --summary
node ai-desk.js load   graph.json           # verify が ok か
```

### 10.3 永続化の使い分け

| ファイル | 用途 |
|---|---|
| `graph.json` | 共有用(.gitignore 済み、必要なら commit) |
| `*.local.json` | 個人作業用(常に .gitignore) |
| `.js` ソース本体 | Eternal Compatibility のため**触る** — Graph はソースの上に構築される認知レイヤー、git は永続化レイヤー、共存する |

---

## 11. 設計時の禁忌(再掲)

`AI_ONBOARDING.md §1` を運用上いつでも参照すべき:

1. TypeScript / build / transpile 導入禁止
2. 外部依存禁止(Node 標準と Web 標準のみ)
3. フレームワーク禁止
4. **新規にコメントマーカーを書かない**(`// [ai_s_emblem:...]` は読むだけ)
5. **`Block.versions` 直接書き換え禁止**(`commit()` / `rollback()` 経由のみ)
6. **`Block.content` / `refs` / `tags` を変数化しない**(SHADOW、都度 getter)
7. **新しい Block type を増やす前に、既存で済まないか検討する**
8. **「人間の見やすさ」で判断しない**。LLM 視点の情報密度で判断する

---

## 12. ファイル早見表

| ファイル | 行数 | 役割 |
|---|---|---|
| `ai-desk.js` | 1761 | 全実装(Block / Graph / parse / apply / virtual heavy / CLI) |
| `e2e.js` | 1198 | 105 テストケース |
| `BIBLE.md` | — | 公理 A0〜A7。思想の正典 |
| `AI_ONBOARDING.md` | — | LLM の作業ルール |
| `REFERENCE.md` | — | CLI / API 早見表 |
| `CLAUDE.md` | — | リポ入り口 |
| `MANUAL.md` | このファイル | 操作マニュアル(何を・どの順で・どう叩くか) |

---

## 13. 公理との対応表(機能 ↔ 思想)

| 公理 | 実装上の場所 |
|---|---|
| A0 認知非対称性 | Block 統一抽象、parseJS が構造を全展開 |
| A1 ローカリティ極大化 | Heavy Function(物理)+ Virtual Heavy Function(論理) |
| A2 Constraint Folding | `constraintBlock` / `evalConstraint` |
| A3 REAL / SHADOW | `versions` = REAL、`content`/`refs`/`tags` getter = SHADOW |
| A4 Event Sourcing + Sequential Hashing | `commit()` の append-only、`hashVersion` の prev チェーン |
| A5 All-as-Block | function / class / module / section / code / constraint / observation すべて `Block` |
| A6 Versions-as-Body | head() が SHADOW、`at(t)` で time travel、`rollback` も新 version |
| A7 LLM-First Information Density | 全展開、refs 明示、Markdown も Block 化、`mermaid` で可視化 |

---

**Date**: 2026-05-03
**Status**: MVP(105 e2e tests green、self-parse 動作確認済み)
**正典**: [`BIBLE.md`](./BIBLE.md)
