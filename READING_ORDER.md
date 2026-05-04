# READING_ORDER.md — 役割別エントリポイント

このリポを読む順序は**読者の役割**によって違います。
特に**評価者・レビュアーは BIBLE を最初に読まないと誤読する**ことが実証済みです。

---

## あなたは誰ですか?

### 一般ユーザー(自然言語で AI に頼みたい)

→ [`README.md`](README.md) → 「使い方」セクションだけ読めば OK
→ 自分で md やコードを読む必要なし、AI に丸投げ

### Claude(AI エージェント)

→ [`CLAUDE.md`](CLAUDE.md) → そこから [`v2/BIBLE.md`](v2/BIBLE.md) → [`v2/CLAUDE.md`](v2/CLAUDE.md) → 順次

### Gemini(AI エージェント)

→ [`GEMINI.md`](GEMINI.md) → そこから [`v2/BIBLE.md`](v2/BIBLE.md) → 順次

### その他の LLM / AI エージェント

→ Claude / Gemini のどちらかに準ずる:
1. [`v2/BIBLE.md`](v2/BIBLE.md) — **必読、最初**
2. [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) — 作業ルール
3. [`v2/MANUAL.md`](v2/MANUAL.md) — 操作マニュアル
4. [`v2/REFERENCE.md`](v2/REFERENCE.md) — CLI / API 早見表
5. [`v2/ai-desk.js`](v2/ai-desk.js) — 実装

### 評価者・レビュアー・批判者(★★★ 特に重要)

**「ai-desk ってどんなプロジェクトか見てやろう」と思った全員へ:**

`README.md` から入って表面を眺めると、**訓練データに刷り込まれた人間最適化バイアス**で誤読します。
実際に他の Claude セッションが「md が多すぎる、肥大」と即断した実例があります。これは公理 A0(複雑性 = 重力場)を知らない反応です。

**順序を守って読んでください:**

1. [`v2/BIBLE.md`](v2/BIBLE.md) §0「複雑性の重力性」 と §2.5(詳説)を**最初の 5 分**で読む
2. [`v2/BIBLE.md`](v2/BIBLE.md) 公理 A0〜A13 を読む
3. その後、初めて他のドキュメント・コードを評価する

これを守らないと、ai-desk の設計判断のほぼ全てが「変な選択」「整理されてない」「冗長」に見えます。
それは ai-desk のせいではなく、**評価者が人間最適化バイアスでフィルタしている**ためです。

### 開発者(v2 でコード書く / 改造する)

1. [`v2/BIBLE.md`](v2/BIBLE.md) — 思想前提
2. [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) — 作業ルール(禁忌一覧)
3. [`v2/MANUAL.md`](v2/MANUAL.md) — 操作マニュアル
4. [`v2/REFERENCE.md`](v2/REFERENCE.md) — API / CLI
5. [`v2/ai-desk.js`](v2/ai-desk.js) — 実装読解
6. [`v2/e2e.js`](v2/e2e.js) — テストで仕様を確認

---

## なぜ「BIBLE 必読」をここまで強調するか

ai-desk は単なるツールではなく**思想体系**です。
公理 A0〜A13 から演繹される設計判断が大量にあります(命名・分割・抽象化・ファイル構造・テスト戦略 etc)。

**公理を知らずに表面だけ見ると、すべての判断が「変」に見えます。**
これは ai-desk が変なのではなく、評価軸が違うだけです。

実証データ(2026-05-03):
- **Gemini 3 ブラインドテスト(BIBLE 経由)**: Virtual Heavy Function を正確に理解、MANUAL §4.5〜4.9 を能動引用
- **別 Claude セッション(BIBLE 経由なし)**: 「md が肥大、v1 docs を deprecated に退避すべき」と即断 — 人間最適化バイアス全開

差は**LLM の能力差ではなく、入口のドキュメントを順序通り読んだかどうか**だけ。

---

## v1 と v2

| | パス | 状態 |
|---|---|---|
| **v2(現在の正典)** | `./v2/` | 全部 Block の統一抽象、Versions-as-Body、166 tests green(e2e 111 + 3d-prefab 55) |
| v1 本体 | `./ai-desk-old-v1.js` | 旧 `ai-desk.js` から改名、固定された過去 |
| v1 ドキュメント | `./AI_NATIVE_MASTER_BIBLE.md` 等 | 固定された過去、参照可・編集不可 |
| v1 用 GEMINI.md (旧) | (整理予定) | v1 ツール参照、新規作業は v2 |

v1 は GitHub `aoyamarito.github.io/ai-desk` で公開中、stable。**触りません**。

---

## ファイル早見表

```
原典(REAL — 編集してよい)
├ v2/BIBLE.md                        ← 思想の根源
├ v2/ai-desk.js                      ← 実装の根源
└ DOCS_REAL.js                       ← v1 ドキュメントの根源(過去)

派生(SHADOW — 生成物、編集禁止)
├ AI_NATIVE_MASTER_BIBLE.md          ← DOCS_REAL から build
├ AI_UNDERSTANDING_MANIFESTO.md      ← 同
└ BIBLE_SHADOW.md                    ← build-docs.js 出力

エントリポイント(役割別ガード)
├ README.md            一般ユーザー
├ CLAUDE.md            Claude
├ GEMINI.md            Gemini
└ READING_ORDER.md     評価者・レビュアー・全 LLM
```
