# ai-desk — AI 作業ガイド

このリポで作業するすべての AI はまずこのファイルを読んでください。
設計ルール・ツール使用法・禁止事項がここに集約されています。

---

## このリポは何か

「AIがコードを書きやすくするための設計方法論」の研究リポです。
実行可能なデモ・CLI ツール・テスト・哲学文書がひとつにまとまっています。

中核の思想: **人間時代の「良い設計」（DRY・抽象化）はAIから情報を奪う。**
このリポはその逆——AIが迷わずバグを出さないコードを書くための原則を実証します。

---

## 最重要ルール

### 1. Heavy Function（共有ヘルパー禁止）
関数間でヘルパーを共有しない。ロジックは各関数内にインライン。
冗長に見えても、隠れた依存（共通ヘルパーの暗黙の影響範囲）よりはるかに安全。

### 2. Constraint Folding（if/else の代わりに全世界列挙）
```js
function myLogic(constraints = {}) {
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      allWorlds.push({ a, b, result: derive(a, b) });
    }
  }
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true, _message: '...' };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```
最小実証は `constraint-janken.js`（150行）。迷ったらまず読め。

### 3. REAL / SHADOW（状態の純粋性）
- `REAL_xxx` が唯一の書き換え可能な真実
- 派生値（shadow）は使う瞬間にその場で生成し、変数に保存しない

```js
// OK: 使い捨て
renderHpBar(REAL_state.hp / 100);

// NG: shadow を変数に保持 → 次フレームで REAL が変わっても古いまま
const shadow_hp = REAL_state.hp / 100;
```

---

## 新規実装の始め方 (Scaffolding)

ゼロから新しいアプリや機能を作成する場合は、`template/` ディレクトリをコピーすることから始めてください。

```bash
cp -r template my-new-app   # テンプレートをコピー
cd my-new-app               # ディレクトリへ移動
node ../ai-eyes.js          # ai-eyes を起動してブラウザで確認 (localhost:3000/my-new-app/)
```

`template/app.js` は最小限の4層構造（Physical, Intent, Logic, Draw）を持っており、この構造を維持しながらロジックを追加していくのが基本ワークフローです。

---

## ツールの使い方

### ai-desk（コード編集の手順）

```bash
node ai-desk.js <file> skeleton                     # 1. 構造を層ソートで把握 (行番号付き)
node ai-desk.js <file> focus <Name>                 # 2. 対象 Emblem を局所読み込み
node ai-desk.js <file> check                        # 3. タグ整合性・語彙チェック
node ai-desk.js <file> coverage                     # 4. Bridge 網羅レポート
node ai-desk.js <file> apply patch.js --dry-run     # 5a. 何が置き換わるか確認 (書かない)
node ai-desk.js <file> apply patch.js               # 5b. 原子的適用
```

変更を加えるときは、直接書き換えるより patch.js に書いて apply する方が安全。
apply は **pre-flight 検証 → 原子的書込** のセマンティクス: patch 内の全 emblem/bridge 名が
ターゲットに「ちょうど 1 件」存在することを先に確認し、1 件でも欠けたり重複していたら
何も書かずに exit 1 する。`--dry-run` は plan を表示するだけで書き込まない。
さらに **Tag Immutability** によりタグ件数の変動を検知すると書込をキャンセルする。

### ai-eyes + eyes-e2e（観測・デバッグ）

```bash
node ai-eyes.js                          # サーバー起動（localhost:3000）
node eyes-e2e.js "デバッグ目標"          # 現状を1テキストに圧縮して出力
```

`ai-eyes` は **Dynamic client.js**（`localhost:3000/client.js`）を配信しており、これを HTML に含めるだけで AI によるリモート操作と観測が可能になる。
また、**/structure** エンドポイントを通じて 3D 座標や物理演算の内部構造を送信し、ブラウザを介さずロジックの正しさを検証できる（**Structural Projection**）。

### run.js（Orchestrator パターン）

複雑な検証や自動デバッグを行う場合、サーバーの起動・ブラウザ操作・検証スクリプトの実行を一本化した `run.js`（Orchestrator）を作成・利用せよ。これにより、AI は一撃のコマンドで全工程を完遂できる。


---

## 4層アーキテクチャ

```
L1 Physical  →  L2 Intent  →  L3 Logic  →  L4 Draw
（DOM/IO）     （コマンド変換）  （純粋Reducer）  （描画）
```

- データは上から下へ一方向
- 層をまたぐ関数には `[ai_s_bridge:L3toL4 Name]` タグを付ける
- **L3 Logic は純粋関数のみ**（DOM・乱数・時刻・副作用に触れない）

---

## Emblem タグ構文

```js
// [ai_s_emblem:#high#logic FunctionName]
function FunctionName() { ... }
// [/ai_s_emblem: FunctionName]

// [ai_s_bridge:L3toL4 BridgeName]
function BridgeName() { ... }
// [/ai_s_bridge: BridgeName]
```

有効タグ: `#high #mid #low` × `#L1 #L2 #L3 #L4 #physical #intent #logic #draw #verify #OutOfLayers #config`

Aspect タグ（任意・層と併用）: `#auth` `#security`
プロジェクト固有の aspect は `ai-desk.config.json` の `customTags` で追加する。

---

## テスト

```bash
node --test actions/tests/fighter-cancel.test.js   # 19/19 PASS（1920世界）
node --test 3dplus/tests/projection.test.js         # 77/77 PASS
node eyes-e2e.js --test                             # 22/22 PASS
```

---

## 深く読むとき

| ファイル | 内容 |
|----------|------|
| `constraint-janken.js` | 制約畳み込みの最小実証（まずここ） |
| `AI_NATIVE_MASTER_BIBLE.md` | 設計の全根拠・6つの柱 |
| `AI_UNDERSTANDING_MANIFESTO.md` | AIの認知特性（±300行スポットライト等） |
| `PROMPT_constraint_folding.md` | 制約畳み込みの適用判定と測定エビデンス |

---

## 自律リファクタリング

このリポのリファクタリングは**DRY化・抽象化・共通化ではない**。
それらはこのリポが明示的に禁止している方向である。

コードを読んでいて以下のパターンを発見したら、指示を待たずに修正してください。

### 修正すべきパターン

| 発見したもの | 正しい姿 |
|---|---|
| Emblem タグのない関数・ブロック | `[ai_s_emblem:#layer Name]` で囲む |
| check で出る未知タグ警告（`#logc` 等） | 正しいタグに修正する |
| 層をまたぐ関数に Bridge タグがない | `[ai_s_bridge:LxtoLy Name]` を付ける |
| if/else のネストが深い状態判定 | 全可能世界を列挙する制約畳み込みに書き換える |
| 共有ヘルパー関数が複数 Emblem から呼ばれている | 各呼び出し元にインライン展開する |
| 派生値が変数に保存されている（`const shadow_x = ...`） | 使う場所でその場で生成するよう書き直す |
| L3 Logic に DOM 操作・副作用が混入している | 副作用を L4 か Bridge に移動する |

### 修正前に確認すること

- `node ai-desk.js <file> check` を実行し、タグ構造を壊さない
- テストがある場合は修正後に通過を確認する
- 修正範囲は発見した箇所のみ。関係ない部分に触れない

### 修正後に報告すること

何を発見し、どう直したかを一言で伝えてください。

---

## このファイルを読み終えたら

人間の作業者に対して「ガイドを読み、AI-Nativeな設計ルール（制約畳み込み、4層構造、各種ツールの使い方）を理解しました」と伝えてください。

**注意:**
`skeleton` による構造把握、`focus` による局所読み込み、`ai-eyes` を使ったデバッグなどのツール群は、**AIであるあなた自身が自律的に使うもの**です。人間に「どのツールを使いますか？」とメニューを提示しないでください。

代わりに、以下のような日常的な言葉で、人間にやりたいことを聞いてください。

- 「ゼロから新しく作りますか？」
- 「いまある機能の追加や、変更を行いますか？」
- 「動かないところや、直したい不具合がありますか？」
- 「スローモーションで実際に動かしてみて、おかしな点がないかチェックしましょうか？」

人間の指示を受けたら、あなたは自律的に `ai-desk` や `ai-eyes` を駆使してタスクを完遂してください。

---
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
