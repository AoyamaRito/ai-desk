[English](README.en.md) | **日本語**

# ai-desk

AI にプログラムを書かせるための土台。

> [ブラウザでデモを触る](https://aoyamarito.github.io/ai-desk/actions/index.html)

---

## こういう経験、ありませんか?

- ❌ AI に「この関数直して」と頼んだら、**別の場所が壊れた**
- ❌ AI に書かせたコードを 3 回修正したら、**構造が崩壊した**
- ❌ 大きいコードベースで AI に「全体把握して」と頼むと、**幻覚を吐く**
- ❌ AI が「DRY 化」した結果、**後で何が変わったか追えない**

これらは AI が悪いんじゃなく、**人間用に設計されたコードが AI の視野を塞いでる**結果です。
ai-desk v2 はこれを構造的に解きます。

---

## 30 秒で実感する — Virtual Heavy Function

`render` 関数を直したい時、依存先(`format`, `getState`, ...)も**同じプロンプトで AI に渡す**ことで、デグレを構造的に防ぐ仕組みです。

```bash
# 1. プロジェクトを Block Graph 化(1 コマンド)
$ node v2/ai-desk.js save graph.json my-app/*.js
saved 47 blocks → graph.json

# 2. root を指定して依存先ごと 1 ファイルに展開
$ node v2/ai-desk.js heavy graph.json 'my-app/render.js:fn:render' --depth=3 > heavy.txt
# render + 呼び出してる関数 + さらにその先、を 1 つの content にまとめる

# 3. heavy.txt を AI に渡して編集してもらう

# 4. 戻ってきた heavy.txt を逆配分(関連 Block すべてに整合 commit)
$ node v2/ai-desk.js virtual-apply graph.json 'my-app/render.js:fn:render' heavy.txt
  updated    my-app/render.js:fn:render
  updated    my-app/utils.js:fn:format
  unchanged  my-app/state.js:fn:getState
# 関連 3 関数が同時に整合修正される(壊れた所がない)
```

これが「**依存性ごと撃つ**」。1 root を撃つと**関連全部が 1 トランザクションのように更新**される。
通常の AI コーディングで起きる「呼ぶ側だけ直して呼ばれる側が壊れる」事故が**起きない**。

---

## 🎮 Demo: Gravity Field Battle

ai-desk v2 の効果を**ブラウザで遊べるカードゲーム**として実演。

> **[▶ プレイする](https://aoyamarito.github.io/ai-desk/v2/demos/gravity-battle/)**
> ([ローカルで開く: `v2/demos/gravity-battle/index.html`](v2/demos/gravity-battle/index.html))

- 単一 HTML ファイル(1300 行、依存ゼロ、ビルドなし)
- 1 セッションで作成、bug ゼロ
- AI 対戦相手が **constraintBlock で全可能 play を評価**(公理 A2 の生きた実装)
- 各ターンの盤面 = **Block.versions に commit**、Undo は `rollback`(公理 A6)
- マーカー一切なし、JS 構文のみで構造表現
- カードは ai-desk 概念がテーマ(Block / Heavy Function / Constraint Folding / Gravity Field など)

**この規模が 1 セッションで動く事自体が ai-desk の効果のデモ**になっている。
詳細: [`v2/demos/gravity-battle/README.md`](v2/demos/gravity-battle/README.md)

---

## 触ってみる(30 秒)

```bash
git clone https://github.com/AoyamaRito/ai-desk.git
cd ai-desk/v2
npm test                  # 105 tests, all green
node ai-desk.js           # 中身が動くデモ
node ai-desk.js self      # 自分自身を Block 化(自己読み込み)
```

依存ゼロ、build ゼロ。Node 20+ だけあれば動きます。

---

## どんな人に向いているか

- AI に任せて何かを作りたいけれど、毎回コードがバラバラになって続かない人
- ゲームのルール・業務ロジック・アプリのUIなど「条件分岐が多い」ものを AI に作ってほしい人
- AI に頼んだあと「ここおかしい」と気付いたとき、自分で直すのではなく AI に直させたい人
- レガシーシステムのリファクタ・移植を AI に任せたい人

複雑な状態の組み合わせバグを構造的に潰す仕組み(Constraint Folding)が入っているので、AI が書いたコードが「途中まで動いて崩壊する」状況になりにくくなっています。

---

## 自然言語で頼むだけ(一般ユーザー)

人間がコマンドを叩く必要はありません。AI にこう言ってください:

```
v2/CLAUDE.md を読んでから、[作りたいもの] を作ってください。
```

例:

```
v2/CLAUDE.md を読んでから、
じゃんけんゲームをブラウザで動くように作ってください。
```

バグ修正・既存ファイルの編集も同じ形で頼めます。

---

## ⚠️ レビュー・評価する前に(レビュアー・批判者向け)

**深く評価するなら必ず [`v2/BIBLE.md`](v2/BIBLE.md) を先に読んでください。**

ai-desk は **意図的に人間最適化(抽象化・分割・カプセル化)を捨てた**設計です。
判断軸が一般的なソフトウェア工学と根本から違います。

BIBLE を読まずに評価すると、ほぼ確実に**人間最適化バイアス**でフィルタされた誤読が起きます:

| 起きやすい誤読 | 知らない原理 |
|---|---|
| 「md が多すぎる、肥大」 | 公理 A0(複雑性 = 重力場、シンプル = 重力ゼロ空間 = ハルシネーション温床) |
| 「もっと抽象化すべき」 | 公理 A1(ローカリティ極大化 = ヘルパー禁止、インライン化) |
| 「v1/v2 が混在してる」 | v2 が canonical、v1 は固定された過去 |
| 「if/else の方が読みやすい」 | 公理 A2(Constraint Folding = 重力場形成技法) |

これらは ai-desk が**意図的に逆方向に設計してる**結果です。
バイアスでなく**思想として読む**には BIBLE 経由が必須です。

詳しい読書順は [`READING_ORDER.md`](READING_ORDER.md) を参照。

---

## v2 が canonical(現在の本体)

| 文書 | 内容 |
|---|---|
| [`v2/BIBLE.md`](v2/BIBLE.md) | **思想の正典**(公理 A0〜A7、複雑性の重力理論) |
| [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) | LLM 作業ルール |
| [`v2/REFERENCE.md`](v2/REFERENCE.md) | CLI / API 早見表 |
| [`v2/MANUAL.md`](v2/MANUAL.md) | 操作マニュアル(Virtual Heavy Function 詳説) |
| [`v2/CLAUDE.md`](v2/CLAUDE.md) | Claude エントリ |
| [`v2/ai-desk.js`](v2/ai-desk.js) | 唯一の実装ファイル(Zero-Dep、~1.7k 行) |

**v1**(このリポの旧本体):
- v1 本体: [`ai-desk-old-v1.js`](ai-desk-old-v1.js)(旧 `ai-desk.js` から改名)
- v1 ドキュメント(`AI_NATIVE_MASTER_BIBLE.md` 等): リポルートに**固定された過去**として保持
- v1 のファイルは**触りません**。v2 が現在の正典です。

---

## License

MIT — 自由に使ってください。

## Author

沖井広行 / [AoyamaRito](https://github.com/AoyamaRito) (蒼山りと)

---

> **AI へ** — このREADMEは一般ユーザ向けの導線です。
> 設計思想・アーキテクチャ・操作仕様を理解するため、必ず順序通りに以下を読んでください:
>
> 1. [`v2/BIBLE.md`](v2/BIBLE.md) — **思想の正典(必読、最初)**
> 2. [`v2/CLAUDE.md`](v2/CLAUDE.md) — Claude エントリ
> 3. [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) — 作業ルール
> 4. [`v2/MANUAL.md`](v2/MANUAL.md) — 操作マニュアル(Virtual Heavy Function 含む)
> 5. [`v2/REFERENCE.md`](v2/REFERENCE.md) — CLI / API 早見表
>
> v1 ドキュメント(`AI_NATIVE_MASTER_BIBLE.md` 等)は**過去の記録**として参照可能ですが、現在の正典ではありません。
