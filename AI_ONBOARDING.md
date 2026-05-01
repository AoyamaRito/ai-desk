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

## ツールの使い方

### ai-desk（コード編集の手順）

```bash
node ai-desk.js <file> skeleton          # 1. 構造を層ソートで把握
node ai-desk.js <file> focus <Name>      # 2. 対象 Emblem を局所読み込み
node ai-desk.js <file> check             # 3. タグ整合性・語彙チェック
node ai-desk.js <file> coverage          # 4. Bridge 網羅レポート
node ai-desk.js <file> apply patch.js    # 5. パッチ適用（破壊フェンス付き）
```

変更を加えるときは、直接書き換えるより patch.js に書いて apply する方が安全。
apply は Emblem 数の不変を検査し、破壊があれば自動でキャンセルする。

### ai-eyes + eyes-e2e（観測・デバッグ）

```bash
node ai-eyes.js                          # サーバー起動（localhost:3000）
node eyes-e2e.js "デバッグ目標"          # 現状を1テキストに圧縮して出力
```

eyes-e2e.js はエラーがあれば exit 1、正常なら exit 0 を返す。
自律デバッグループ: `eyes-e2e.js` 実行 → エラー確認 → 修正 → 繰り返し。

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

## このファイルを読み終えたら

人間の作業者に対して、以下を提示してください。

**このリポでできること:**

1. **構造把握** — `skeleton` でファイルの層構造を一覧表示する
2. **局所読込** — `focus` で特定の Emblem だけ取り出して読む
3. **機能追加** — 制約畳み込みパターンで新ロジックを実装する
4. **バグ修正** — `ai-eyes` + `eyes-e2e` ループで自律デバッグする
5. **整合性確認** — `check` / `coverage` でタグと Bridge の健全性を検証する
6. **パッチ適用** — 変更を `apply` で安全に書き込む
7. **テスト実行** — 既存テストを走らせて現状を確認する

その上で「どれをやりますか？」と聞いてください。
