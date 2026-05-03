# AI-Native Master Bible v2 — All-as-Block, Versions-as-Body

ai-desk v1 の実装と運用を経て、思想を**統一抽象**まで畳み込んだ最終形。
v1 を捨てるのではなく、v1 の全原理を**1つのデータ構造(Block)**の上に載せ直す。

---

## 0. v2 の存在意義

v1(ai-desk)は AI-Native 開発のための原理を 7 章 + 派生で展開した。
原理は揃ったが、**実装が複数のレイヤーに分散**していた:

- §1 Emblem は**コメントマーカー**で動く
- §3 REAL/SHADOW は**コードの書き方**で守る
- §5 Event Sourcing は**データ層だけ**の話
- §0.15 Constraint Folding は**個別の関数**として書く

つまり、**原理は1つでも実装は複数**。これは LLM 視点で見ると、
**同じ思想を異なるパターンで都度学習させる**ことになり、効率が悪い。

v2 は **すべての原理を Block という単一抽象で再構築**する。
コード片・ドキュメント・制約・観測・履歴 — すべてが Block。
LLM は **1 種類の操作モデル**で全構造を扱える。

これは Bible v1 §0.0「認知非対称性」を**抽象構造のレベル**まで徹底した結果。

---

## 1. v1 との関係

### 1.1 継承する原理

v1 の核心原理はそのまま継承する:

| v1 § | 内容 | v2 での扱い |
|---|---|---|
| §0.0 | 認知非対称性 | Block 統一抽象で徹底 |
| §0.1 | ローカリティ極大化(Heavy Functions) | Block の入れ子 |
| §0.15 | Constraint Folding | constraintBlock として Block 化 |
| §3 | REAL/SHADOW 規約 | versions=REAL, getter=SHADOW |
| §5 | JSON + Event Sourcing + Sequential Hashing | 各 Block.versions に内蔵 |
| §1.5 | AI-Eyes 観測インフラ | observationBlock として Block 化 |
| §7 | 複式数学(Twin) | 同一 id・別 type の Block 並走 |

### 1.2 v2 で書き換える原理

- **§1 Emblem Management** — マーカー(コメント注釈)廃止。
  v2 では JS の構文そのもの(関数宣言・class 宣言・モジュール境界)が
  Block の境界になる。v1 マーカー(`// [ai_s_emblem:#high#logic Foo]`)は
  parseJS が **tags として自動取り込み**するため、互換性は保たれる。

- **§0.2 Zero-Dependency / §5 Eternal Compatibility** — 「JS 完全主義」として強化。
  TypeScript・build step・transpile・framework・preprocessor を**禁忌**にする。

### 1.3 v2 で新規導入する原理

- **§0.16 All-as-Block** — すべての構成要素は Block インターフェースに従う。
- **§0.17 Versions-as-Body** — Block の本体は versions の羅列、現在は派生値。
- **§0.18 LLM-First Information Density** — 「LLM は複雑でも問題ない、隠匿が問題」を明示の原則に格上げ。

---

## 2. 公理体系 v2

v1 の 5 公理(共通CSSボタン問題に端を発する)に追加する形で、
v2 は **3 つの新公理**を導入する。

### 公理 A0(継承) — 認知非対称性

複雑性は AI にとって問題ではなく、人にとって問題である。
隠匿は AI にとって問題であり、人にとって問題ではない。

人向けの「良い設計」(抽象化・分割・カプセル化)は AI にとって**情報の隠匿**である。
AI 向けの正しい設計は、**展開され・明示され・統合された複雑性**として現れる。

### 公理 A1(継承) — ローカリティ極大化

機能に必要な情報は1つのスコープに集約する。
ファイル分割は情報を物理的に散らし、関数分割は情報を論理的に散らす。
共有ヘルパーを作らず、必要なら複製する。

### 公理 A2(継承) — Constraint Folding

複雑な条件分岐を**全可能世界 + 制約 filter** に畳み込む。
分岐ツリーではなく、データ構造として一括保持し、フィルタリング・写像で結果を導出する。

### 公理 A3(継承) — REAL / SHADOW

書き換え可能な唯一の真実を REAL とし、それ以外は SHADOW(派生値)。
SHADOW は**保持禁止**。使う瞬間に生成し、使い終わったら捨てる。

### 公理 A4(継承) — Event Sourcing + Sequential Hashing

状態(state)の上書き保存を避け、状態を変える**イベントの履歴**を時系列に追記する。
各イベントは前イベントのハッシュを含み、改ざん検知可能。

### 公理 A5(新規) — All-as-Block

ai-desk-v2 におけるすべての構成要素は Block インターフェースに従う:

```
Block { id, type, versions: Version[], meta }
Version { content, refs, children, tags, timestamp, prevHash, hash }
```

関数も、クラスも、モジュールも、ドキュメントセクションも、制約テーブルも、
観測スナップショットも、テストケースも、議論ログも — **すべて Block**。

LLM は単一の操作モデル(Block の生成・追記・参照・走査・検証)で
あらゆる構造を扱える。これは公理 A0 を抽象構造レベルで徹底した結果である。

### 公理 A6(新規) — Versions-as-Body

Block の唯一の状態は **versions: Version[]** である。
content / refs / children / tags は head() からの**派生値(SHADOW)**であり、
ゲッタを通して都度計算される — 変数として保持しない。

これは公理 A3(REAL/SHADOW)を**Block 自身の状態**に適用した結果。

```
[従来モデル]
state = current value
events = change history(状態と並列に存在する付加情報)

[v2 モデル]
versions = REAL(唯一の真実、本体)
current  = SHADOW(派生、その場で計算)
```

過去の version を参照することで任意時点の状態を再現できる(time travel)。
**履歴は捨てるべきものではなく、本体である。**

### 公理 A7(新規) — LLM-First Information Density

人間用の「簡素化」を捨て、LLM にとっての**情報密度**を最大化する。

| 観点 | 人間最適化 | LLM 最適化(v2) |
|---|---|---|
| 情報量 | 抽象化で減らす | 展開して全部見せる |
| 構造 | 階層・分類で整理 | 単一抽象に集約 |
| 関係 | 暗黙(慣習・読み取り) | refs として明示 |
| 履歴 | git 等の外部ツール | 各 Block に内蔵 |
| 区切り | コメント・装飾 | 言語構文そのもの |

LLM は複雑さを苦にしない。LLM が苦にするのは**隠匿**(必要な情報が見えない場所にある)である。
ゆえに v2 は**簡素化を捨て、複雑さを正直に展開する方向**に最適化する。

---

## 3. JS 完全主義(§0.2 / §5 の強化)

v2 では実装言語を **JavaScript に固定**する。

### 3.1 採用しない技術

- **TypeScript**(型情報を別レイヤーに分けることが隠匿の一種)
- **build / transpile step**(ソース ≠ 実行ファイル になる)
- **外部依存 / npm install**(Eternal Compatibility を脅かす)
- **フレームワーク**(暗黙の規約が大量に発生する)
- **preprocessor**(ソースの真の姿が見えなくなる)

### 3.2 採用する技術

- **vanilla JS(ESM)** — Node 20+ / モダンブラウザでそのまま動く
- **Web 標準のみ**(node:fs・node:path のような Node 標準もここに含む)
- **JSON**(永続化形式の統一)
- **HTML / CSS / Markdown**(ドキュメント・UI 用に最小限)

### 3.3 LLM-native の根拠

JS は LLM の学習データに最も豊富で、構文揺れが少なく、AST 解析も成熟している。
TypeScript で書くと、LLM は型の整合と実装の整合を**両方追う必要があり**、認知コストが上がる。
JS 単体なら**ロジックだけに集中**でき、構造解析(parseJS)も regex / AST レベルで完結する。

---

## 4. マーカー廃止(§1 の書き換え)

v1 の Emblem(`// [ai_s_emblem:#tag1#tag2 Name]`)は**コメントによる注釈**であり、
**コード構造とは独立したレイヤー**に存在していた。これは:

- 言語ごとに違う構文(JS は `//`、HTML は `<!-- -->`、Python は `#`)
- 手動管理(LLM がマーカーを正しく書く責任)
- マーカーの破損 / 不整合(コードと注釈の乖離)
- パーサーの追加(マーカー記法を読む処理)

…という**情報の二重管理**を生む。これは公理 A0(隠匿排除)に反する。

### v2 のアプローチ

JS の言語構文そのものを境界として使う:

| Block の type | 抽出元の構文 |
|---|---|
| module | ファイル全体 |
| function | function 宣言 / arrow function(`const f = () => {}`) |
| class | class 宣言 |
| import(ref) | import 文(モジュール間エッジ) |
| calls(ref) | 関数本体内の他関数名出現(同モジュール内) |

これにより:
- マーカーを書く / 維持する責任が消える
- JS の構文が壊れていればパーサーが即気付く(整合性が言語レベルで保証)
- 全言語で1つのパーサーがあれば足りる(JS 完全主義との整合)

### v1 互換

`// [ai_s_emblem:#high#logic Foo]` のような v1 マーカーが残っているコードは、
parseJS が**直前コメント行から自動的に tags を抽出**するため、
v1 → v2 移行時に書き換える必要はない。

`// @tags: high, logic` という v2 風の注釈も同等に扱う。

---

## 5. グラフ Event Sourcing(§0.16 の本体)

### 5.1 git との位置取り

git は人間チーム開発のために設計された:
- ファイル単位のスナップショット連鎖
- ブランチ・マージ・rebase といった人間用概念
- 一方向の歴史

v2 のグラフ Event Sourcing は LLM-native:
- Block 単位(関数・クラス・モジュール)の versions
- 双方向の参照(forward / backward)
- マージなし(LLM は順次変更すれば足りる)

両者は**競合しない**。git は永続化レイヤー、v2 は認知レイヤーとして共存できる。

### 5.2 双方向性

```
Graph.forward(id)  : block が参照している先(影響先)
Graph.backward(id) : block を参照している元(影響元)
Graph.impact(id)   : 推移閉包(全影響範囲)
```

「この関数を変えたら何が壊れる?」(forward)
「このバグの原因はどこ?」(backward)
両者が**同じグラフ走査**で扱える。git は backward(blame)に専用ツールが必要だが、
v2 では Block.refs の構造から自然に取れる。

### 5.3 任意時点の再現

```
Block.at(timestamp)   → 任意時点の Version
Graph.at(timestamp)   → 全 Block を任意時点で評価したスナップショット
Block.rollback(index) → 過去 version の状態を**新 version として** commit
```

rollback は履歴を消さず、**新しい past を current にする**操作。
履歴は全部残る(公理 A6)。

---

## 6. Constraint Block(§0.15 の Block 化)

v1 の Constraint Folding は「**ある関数の中でこう書く**」というスタイル原則だった。
v2 では Constraint そのものを **constraint type の Block** にする。

```js
const cb = constraintBlock({
  id: 'janken',
  axes: ['a', 'b'],
  values: { a: ['rock','paper','scissors'], b: ['rock','paper','scissors'] },
  derive: combo => ({ tie: combo.a === combo.b }),
});

evalConstraint(cb)                    // 全 9 世界
evalConstraint(cb, { tie: true })     // 引き分け 3 世界
evalConstraint(cb, { tie: 'always' }) // _contradiction(矛盾)
```

これにより:
- 制約は Block として**保存・参照・履歴管理**ができる
- 他の Block(関数)から `refs: [{ kind: 'uses', target: 'janken' }]` で参照できる
- グラフ走査で「この制約を変えると何が影響を受けるか」が即わかる

Constraint Folding は単なるパターンから**第一級の構造**になる。

---

## 7. Observation Block(§1.5 の Block 化)

AI-Eyes が記録するスナップショット(DOM・Canvas frame・状態 JSON)を、
**observation type の Block** として残す。

```js
observationBlock({
  id: 'obs:001',
  observedId: 'mod:fn:bar',
  snapshot: { hp: 50, x: 10, screen: 'playing' },
  tags: ['ai-eyes', 'frame'],
});
```

`refs: [{ kind: 'observes', target: observedId }]` で観測対象との関係を保持する。
グラフ走査で「あるバグが疑われる関数の観測履歴」が backward で取れる。
時系列に並べれば、状態の遷移が**Block の versions の集合**として可視化される。

---

## 8. Twin Block(§7 の自然な実装)

v1 の Twin(検証双子)は v2 で特別な仕組みを必要としない:

- 効率層 Block: `id = 'mod:fn:render'`, `type = 'function'`
- Twin Block:   `id = 'mod:fn:render_twin'`, `type = 'function'`, `tags: ['twin', 'verify']`

Twin と本体を refs で結ぶ:
```js
twin.refs = [{ kind: 'twin-of', target: 'mod:fn:render' }]
```

これだけで、グラフ走査・タグフィルタで Twin を識別でき、
「render が変わった時 Twin も同期更新するべき」という判断ができる。

---

## 9. v1 → v2 の移行指針

### 9.1 まず動かす

v1 のコードベースに何の変更もせず、ai-desk-v2.js で `loadProject` するだけで
**Block 構造として読み込める**。マーカーも自動で tags に反映される。

```bash
node ai-desk-v2.js save graph.json src/*.js
node ai-desk-v2.js skeleton graph.json
node ai-desk-v2.js impact graph.json mod:fn:foo
```

### 9.2 段階的にマーカーを外す

v1 マーカーは parseJS が tags に取り込むので、コード上のマーカーは**徐々に削除**できる。
削除しても tags は喪失するだけで、Block 構造そのものは維持される。

### 9.3 Constraint / Observation を Block 化

新しく書く制約・観測は v2 スタイル(constraintBlock / observationBlock)で書く。
既存コードは触らなくてよい。

### 9.4 永続化を JSON 1ファイルに

v1 では各種ファイル(コード・テスト・ドキュメント)が並列に存在した。
v2 では `saveGraph` で**全 Block を 1 つの JSON** に永続化できる。
コードはコードで残しつつ、解析結果・履歴・制約・観測は graph.json に集約する。

---

## 10. 設計指針(運用上の禁忌)

LLM が ai-desk-v2 上で作業するとき、以下を守る:

1. **新しい型を増やさない**。既存の type(function / class / module / constraint / observation)で表現できないか先に検討する。
2. **Block.versions を直接書き換えない**。必ず `commit()` 経由。
3. **content / refs / tags を変数化しない**。getter から都度読む(SHADOW 規約)。
4. **マーカーを足さない**。tags が必要なら `// @tags:` で書く(parseJS が拾う)。
5. **TypeScript / build step を導入しない**。JS 完全主義。
6. **依存ライブラリを足さない**。Web 標準と Node 標準のみ。
7. **「人間にとっての見やすさ」で判断しない**。LLM にとっての情報密度で判断する。

---

## 11. 結語

ai-desk v1 は AI-Native 開発の**原理**を確立した。
ai-desk v2 はその原理を**単一の構造(Block)**に畳み込み、LLM の認知に**より忠実な**実装を与える。

複雑性を恐れない。
履歴を捨てない。
構造を明示する。
言語を固定する。
人間の常識に従わない。

これが LLM が本来の力を発揮するための**情報構造**である。

---

**Version**: v2.0(MVP)
**Date**: 2026-05-03
**Author**: 沖井広行(蒼山りと)
**Implementation**: `ai-desk-v2.js` (~720 行、Zero-Dep、61 e2e tests passing)
