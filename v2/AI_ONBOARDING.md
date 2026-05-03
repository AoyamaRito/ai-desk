# AI Onboarding v2 — LLM が ai-desk で作業するときのルール

このドキュメントは LLM(Claude / GPT / Gemini 等)が `ai-desk` 上で
コードを生成・編集・解析するときに守るべき規律をまとめる。

人間向けの解説ではない。LLM 専用。
読んだら即適用する。`BIBLE.md` を補完する運用マニュアル。

---

## 0. 最初に把握する情報

1. **`BIBLE.md`** — 思想の正典。公理 A0〜A7 を守る。
2. **`ai-desk.js`** — 唯一の実装ファイル(コア + CLI)。Block・Graph・parseJS が定義されている。
3. **`e2e.js`** — 61 テストケース。新機能を追加したらここに 1 テスト以上追加する。
4. **`package.json`** — `npm test` で e2e 実行、`type: "module"`(ESM)。

---

## 1. 絶対に守る禁忌(これを破ったらコミットしない)

| # | 禁忌 | 理由 |
|---|---|---|
| 1 | TypeScript を導入しない | 型情報による隠匿排除(§0.0) |
| 2 | npm install で外部依存を入れない | Eternal Compatibility(§5) |
| 3 | build / transpile step を作らない | ソース = 実行ファイル |
| 4 | フレームワーク(React 等)を入れない | 暗黙の規約は隠匿の温床 |
| 5 | コメントマーカー(`// [ai_s_emblem:...]`)を**新規に書かない** | マーカー廃止(§1) |
| 6 | `Block.versions` を直接書き換えない | `commit()` 経由のみ |
| 7 | `Block.content` / `refs` / `tags` を変数化しない | SHADOW 規約 |
| 8 | 「人間の見やすさ」で判断しない | LLM 視点の情報密度で判断する(§A0/A7) |

---

## 2. コード生成のルール(Block を作る/更新する)

### 2.1 新規 Block を作るとき

```js
const b = new Block({ id, type, meta });
b.commit({ content, refs, children, tags, meta });
```

- **id** は `<moduleId>:<prefix>:<name>` の規約。`prefix` は `fn` か `class`。
- **type** は `'function' | 'class' | 'module' | 'constraint' | 'observation' | ...`。
- **versions は空のまま渡す**。`commit()` で初回 version を append する。

### 2.2 既存 Block を更新するとき

- 必ず `commit()` で**新 version を append**。古い version は消さない・触らない。
- `head()` の値をベースに、変更したい部分だけ差し替えて新 version を作る:

```js
const head = b.head();
b.commit({
  content: head.content,                       // 変更しない
  refs: [...head.refs, { kind: 'calls', target: 'x' }],  // 追加
  children: head.children,
  tags: head.tags,
  meta: { ...head.meta, reason: 'add x dependency' },
});
```

### 2.3 過去に戻したいとき

- `b.rollback(versionIndex)` を使う。これは**履歴を消さず**、過去の version の状態を**新 version として** commit する。
- `b.versions = b.versions.slice(0, n)` のような直接削除は**禁忌**。

---

## 3. パーサー(parseJS)の出力に従う

JS ソースを解析するときは `parseJS(source, moduleId)` を使う:

- 関数宣言 → `function` Block
- arrow function (`const x = () => {}`) → `function` Block(tag に `arrow`)
- class 宣言 → `class` Block
- import 文 → module Block の `refs` に `kind: 'import'` で追加
- 同モジュール内の関数呼び出し → `refs` に `kind: 'calls'` で追加
- 直前コメント行の `// [ai_s_emblem:#a#b Name]` や `// @tags: a, b` → tags に取り込み

新しい構文(decorator・private field 等)に対応する必要があれば、
`parseJS` 内の正規表現を拡張する(または将来的に AST に置換)。

**正規表現の限界**(現状の MVP):
- 文字列リテラル中の `function` キーワードを誤検出することがある
- ネスト関数の捕捉が浅い場合がある

これらは **e2e テストで境界を確認**してから修正する。

---

## 4. グラフ操作(Graph)の使い分け

| やりたいこと | 使うメソッド |
|---|---|
| 「この関数を変えたら何に影響する?」 | `g.impact(id)` |
| 「この関数を呼んでるのは?」 | `g.backward(id)` |
| 「この関数が呼ぶのは?」 | `g.forward(id)` |
| 「特定の文字列を含む Block は?」 | `g.search('TODO')` |
| 「export されてる Block は?」 | `g.byTag('export')` |
| 「class だけ取りたい」 | `g.byType('class')` |
| 「過去の状態のグラフが見たい」 | `g.at(timestamp)` |
| 「全 Block の整合性チェック」 | `g.verify()` |

---

## 5. 永続化のルール

- `saveGraph(graph, path)` で **JSON 1 ファイル**に保存する。
- 保存ファイル名は **`graph.json`** を基本とする(`.gitignore` 済み)。
- 個人用の派生は `*.local.json`(これも `.gitignore` 済み)。
- 共有が必要な永続データは別途名前を付けて、レビューを経て commit する。

---

## 6. テスト追加のルール

新機能を追加したら `e2e.js` に**最低 1 テスト**を追加する。

```js
group('新機能名', () => {
  test('期待される振る舞いの説明', () => {
    // setup
    // act
    // assert
    assert.equal(...);
  });
});
```

`npm test` を実行して **all green** にしてから commit。

---

## 7. CLI コマンド追加のルール

`ai-desk.js` の `runCommand()` に case を追加する:

```js
case 'mycommand': {
  if (!args[0]) return console.error('usage: mycommand <arg>');
  // 実装
  break;
}
```

そして:
1. デフォルトケース(`'commands: ...'` の出力)に `mycommand` を追加。
2. e2e の CLI グループにテストを追加(`run('mycommand ...')`)。
3. `REFERENCE.md` のコマンド表に行を追加。

---

## 8. v1(ai-desk)との関係

- v1 の Bible(`AI_NATIVE_MASTER_BIBLE.md`)は v1 そのままの位置に残っている。**触らない**。
- v1 の Emblem マーカーが残っているコードは v2 でも読めるが、**新規にマーカーを書かない**。
- v1 と v2 は**併存可能**。v1 が stable、v2 が思想実験。
- v1 の機能で v2 にまだないもの(focus/apply/check/coverage 等)は段階的に Block 化していく。

---

## 9. Constraint Folding を書くとき

Constraint を Block にする:

```js
import { constraintBlock, evalConstraint } from './ai-desk.js';

const cb = constraintBlock({
  id: 'shipping',
  axes: ['weight', 'zone'],
  values: {
    weight: [0.5, 1, 5, 10],
    zone: ['kanto', 'kansai', 'kyushu'],
  },
  derive: combo => ({
    fee: ((combo.weight <= 1 ? 300 : 500) +
          (combo.zone === 'kyushu' ? 200 : 0)),
  }),
});

evalConstraint(cb)                     // 全 12 世界
evalConstraint(cb, { fee: 700 })       // 該当する組み合わせを逆引き
```

- **derive は純粋関数**(I/O・乱数・時刻に触れない)。Bible v1 §7 Twin 規約と同じ。
- **filter は浅い等価**(`merged[k] === v`)。範囲条件は derive で派生フラグを作る。
- **矛盾**は `_contradiction: true` で返る。filter 結果が空集合のとき。

---

## 10. Observation Block を書くとき

AI-Eyes が観測した状態は `observationBlock` で Block 化する:

```js
observationBlock({
  id: 'obs:2026-05-03T10:00Z:001',  // タイムスタンプ + 連番
  observedId: 'mod:fn:bar',         // 観測対象の Block id
  snapshot: { hp: 50, x: 10 },      // 観測した状態(JSON 化可能なもの)
  tags: ['ai-eyes', 'frame'],       // ai-eyes / dom / canvas 等
});
```

- **id にタイムスタンプを含める**(時系列の自然な並び)。
- **snapshot は構造化データ**(画像のバイナリは別途保存して URL で参照)。
- 観測対象との関係は `refs: [{ kind: 'observes', target: ... }]` が自動付与される。

---

## 11. コミットメッセージの規約

`<type>: <summary>` 形式:

| type | 用途 |
|---|---|
| `init` | 初回コミット |
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `test` | テスト追加・修正 |
| `refactor` | 振る舞いを変えないコード整理 |
| `chore` | ビルド・ツール周り |

例: `feat(parse): support generator function syntax`

---

## 12. 「迷ったらどうする」

| 迷い | 判断軸 |
|---|---|
| Block の type を増やすべきか | 既存の type で表現できないか先に検討。新 type は最後の手段。 |
| 関数を分割すべきか | 「LLM が一目で全文脈を把握できるか」で決める。基本はインライン化。 |
| 命名で迷ったとき | 動詞 + 目的語で書く。略語は使わない(LLM の学習に負ける)。 |
| ドキュメントを書くべきか | LLM が読む前提。冗長を恐れない。具体例を必ず添える。 |

---

## 13. このドキュメント自体の更新

ai-desk で運用が進むにつれ、新しい禁忌や規約が必要になる。
気づいた LLM/人間は **このファイルに追記** すること。
更新は通常の commit で `docs(onboarding): ...` 形式で。

---

**Date**: 2026-05-03(初版)
**正典**: [`BIBLE.md`](./BIBLE.md)
