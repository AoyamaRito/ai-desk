# ai-desk-v2

**All-as-Block, Versions-as-Body** — AI-native code management.

> 思想の正典は [`BIBLE_v2.md`](./BIBLE_v2.md)。
> LLM が作業する時のルールは [`AI_ONBOARDING_v2.md`](./AI_ONBOARDING_v2.md)。

ai-desk(v1)の原理を**単一の抽象(Block)**に畳み込んだ実装。
コード片・ドキュメント・制約・観測 — すべてを **Block** として扱い、
**versions の羅列**を本体とする。

---

## 30 秒で何ができるか

```bash
# v1/v2 どちらの JS ファイルでも、構造を Block に分解できる
node ai-desk-v2.js skeleton ../ai-desk/ai-desk.js

# 関数・クラス・モジュールのグラフ構造を JSON 1ファイルに永続化
node ai-desk-v2.js save graph.json src/*.js

# 「この関数を変えたら何に影響する?」(forward/backward の推移閉包)
node ai-desk-v2.js impact src/foo.js src/foo.js:fn:bar

# content 検索(type/tag で絞り込み可)
node ai-desk-v2.js search src/foo.js 'TODO'

# 自己読み込み(ai-desk-v2.js が ai-desk-v2.js を解析する)
node ai-desk-v2.js self

# テスト走らせる(61 tests, all green)
npm test
```

依存ゼロ、build ゼロ、TypeScript ゼロ。`node` だけあれば動く。

---

## 設計の核心(BIBLE_v2 より抜粋)

### 1. Block = 統一単位

```js
Block   { id, type, versions: Version[], meta }
Version { content, refs, children, tags, timestamp, prevHash, hash }
```

関数・クラス・モジュール・ドキュメント・制約・観測 — すべて同じインターフェース。
LLM が**単一のモデル**で全構造を扱える(Bible v1 §0.0 認知非対称性の徹底)。

### 2. Versions = REAL、current = SHADOW

`Block.content` / `Block.refs` / `Block.tags` / `Block.children` は **getter のみ**。
最新 version から都度取り出す **派生値**。保持しない。

```js
const b = new Block({ id: 'a', type: 'function' });
b.commit({ content: 'function a(){}' });
b.commit({ content: 'function a(){ return 1; }' });

b.versions.length        // 2(これが本体)
b.content                // 'function a(){ return 1; }'(派生)
b.at(timestamp).content  // 過去のスナップショット
b.diff(0, 1)             // version 間の差分
b.rollback(0)            // 過去 version の状態を新 version として commit
```

### 3. グラフは Block.refs に内包

```js
g.forward('mod:fn:foo')   // foo が呼ぶ先
g.backward('mod:fn:foo')  // foo を呼ぶ元
g.impact('mod:fn:foo')    // foo を変更すると影響を受ける Block 全部(推移閉包)
g.at(timestamp)           // 全 Block を任意時点で評価したスナップショット
g.search('TODO')          // content 検索
g.byTag('export')         // タグでフィルタ
g.byType('class')         // type でフィルタ
```

### 4. マーカー廃止

v1 の `// [ai_s_emblem:#high#logic Foo]` のような注釈は不要。
JS の構文(`function` / `class` / `const x = () => ...` / `import`)を `parseJS()` が直接 Block に変換する。

ただし v1 マーカーが残っているファイルでも、`extractInlineTags()` が
**自動的に tags を取り込む**ため互換性は保たれる。

### 5. JS 完全主義

- TypeScript なし
- build / transpile なし
- 外部依存なし(Node 標準のみ)
- フレームワーク・preprocessor なし
- LLM の学習データに最も豊富で隠匿の少ない言語

---

## CLI コマンド一覧

| コマンド | 用途 |
|---|---|
| `node ai-desk-v2.js` | self-test(動作確認) |
| `skeleton <file>` | Block 構造を表示 |
| `focus <file> <id>` | 特定 Block の content を表示 |
| `graph <files...>` | 複数ファイルから Graph 抽出 → JSON 出力 |
| `impact <file> <id>` | 影響範囲(推移閉包) |
| `self` | 自分自身を解析(自己読み込み) |
| `tag <file> <tag>` | タグでフィルタ |
| `tags <file>` | 全タグの一覧と件数 |
| `save <out.json> <files...>` | Graph を JSON に永続化 |
| `load <in.json>` | JSON を読んで verify |
| `search <file> <query>` | content 検索 |
| `diff <file> <id> [i] [j]` | version 間の差分 |
| `blame <file> <id> <ref-target>` | ref が初めて追加された version |
| `apply <graph.json> <patch.js> <moduleId>` | パッチを既存 Graph に適用 |
| `resolve <graph.json>` | import 相対パスを Block ID に解決 |
| `e2e` | テスト実行 |

---

## API(モジュールとして使う)

```js
import {
  Block, Graph,
  parseJS, loadProject,
  saveGraph, loadGraph, buildAndSave,
  applyPatch, resolveImports,
  constraintBlock, evalConstraint,
  observationBlock,
} from './ai-desk-v2.js';
```

### Constraint Folding(Block 化された)

```js
const cb = constraintBlock({
  id: 'janken',
  axes: ['a', 'b'],
  values: { a: ['rock','paper','scissors'], b: ['rock','paper','scissors'] },
  derive: combo => ({ tie: combo.a === combo.b }),
});

evalConstraint(cb)                  // { _worlds: 9, worlds: [...] }
evalConstraint(cb, { tie: true })   // { _worlds: 3, worlds: [...] }
evalConstraint(cb, { unsat: true }) // { _contradiction: true }
```

### Observation Block(AI-Eyes 風)

```js
observationBlock({
  id: 'obs:001',
  observedId: 'mod:fn:bar',
  snapshot: { hp: 50, x: 10 },
  tags: ['ai-eyes'],
});
// → 観測対象 Block への ref を持つ第一級 Block
```

---

## v1 との違い(早見表)

| | v1 | v2 |
|---|---|---|
| セクション境界 | `// [ai_s_emblem:...]` | JS 構文そのもの(関数・class・module) |
| 状態モデル | 現在のファイル(state) | versions の羅列(REAL)+ getter 派生(SHADOW) |
| 抽象 | 関数/クラス/制約/ドキュメントを別物 | すべて Block |
| 履歴 | git に外部委託 | Block.versions に内蔵 |
| 関係 | コード読まないと辿れない | Block.refs として明示 |
| 影響分析 | 手動 or grep | グラフ走査(forward/backward/impact) |
| 言語 | JS/HTML/MD 混在 | JS のみ |
| 依存 | npm 一部使用(任意) | Node 標準のみ |

---

## v1 → v2 移行

v1 のコードは何の変更もせずに v2 で読める。

```bash
# v1 のコードを v2 で解析(マーカーは tags に自動取り込み)
node ai-desk-v2.js save v1-graph.json ../ai-desk/ai-desk.js ../ai-desk/action-demos.js
node ai-desk-v2.js load v1-graph.json
```

詳細は [`BIBLE_v2.md`](./BIBLE_v2.md) §9「v1 → v2 の移行指針」。

---

## ステータス

**MVP**(2026-05-03 朝)。
- 61 e2e tests, all green
- 自己読み込み・v1 リアルファイル(2269行)解析動作確認済み
- parseJS は正規表現ベース、文字列リテラル誤検出など既知の限界あり
- AST 化(Zero-Dep を保つなら自作 parser)は v2.1 以降

## v1(ai-desk)との関係

v1 は GitHub `aoyamarito.github.io/ai-desk` で公開中、stable。
v2 は思想実験として独立フォルダで進化させる。
育ったら独立リポとして公開する想定。

## License

MIT(v1 を継承)。

## Author

沖井広行 / [AoyamaRito](https://github.com/AoyamaRito)(蒼山りと)
