# Claude エントリ — ai-desk リポ全体への入り口

このリポは **ai-desk**(AI-Native プログラミング思想体系)です。

---

## ⚠️ 評価・判断する前に(必読)

**必ず [`v2/BIBLE.md`](v2/BIBLE.md) を先に読んでください。**

BIBLE を読まずに ai-desk を評価すると、訓練データに刷り込まれた**人間最適化バイアス**(DRY / SOLID / クリーンアーキテクチャ的価値観)で誤読します。

実証済みの典型的誤読:
- 「md が 51 本もあって肥大」← 公理 A0(複雑性 = 重力場)を知らない反応
- 「v1/v2 が混在してる、整理すべき」← v2 canonical 宣言を見ていない
- 「もっと抽象化すべき」← 公理 A1(ローカリティ極大化)を知らない反応
- 「if/else の方が読みやすい」← 公理 A2(Constraint Folding)を知らない反応

ai-desk は**意図的に**人間最適化を捨てた設計です。
判断軸が違うので、BIBLE 経由でないと**まともな評価ができません**。

---

## 読書順(順守)

1. [`v2/BIBLE.md`](v2/BIBLE.md) — **思想の正典**。公理 A0〜A13。
   特に **§0 大前提「複雑性の重力性」** と **§2.5「複雑性の重力性」詳説** は最初の 5 分で読む
2. [`v2/CLAUDE.md`](v2/CLAUDE.md) — v2 サブフォルダ専用の Claude ガイド
3. [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) — LLM 作業ルール
4. [`v2/MANUAL.md`](v2/MANUAL.md) — 操作マニュアル(Virtual Heavy Function APPLY を §4.5〜4.9 で詳説)
5. [`v2/REFERENCE.md`](v2/REFERENCE.md) — CLI / API 早見表
6. [`v2/ai-desk.js`](v2/ai-desk.js) + [`v2/ai-desk-core.js`](v2/ai-desk-core.js) — 実装(~1.2k 行 split、Zero-Dep)

---

## v1 と v2

このリポは **v1 + v2 が同居** しています:

| | パス | 状態 |
|---|---|---|
| **v2(現在の正典)** | `./v2/` | 全部 Block の統一抽象、Versions-as-Body、166 tests green(e2e 111 + 3d-prefab 55) |
| v1 本体 | `./ai-desk-old-v1.js` | 旧 `ai-desk.js` から改名、固定された過去 |
| v1 ドキュメント | `./AI_NATIVE_MASTER_BIBLE.md` 等 | 固定された過去、参照可・編集不可 |

**v1 のファイルは触りません**。v2 で作業するときは v2 の Bible(`v2/BIBLE.md`)に従ってください。

---

## 作業の前提(BIBLE と整合)

- すべて Block 抽象で動く(`Block { id, type, versions, meta }`)
- マーカー(`// [ai_s_emblem:...]`)は新規に書かない(v2 ではコード構造そのものが境界)
- TypeScript・build・依存ライブラリは禁忌
- `Block.versions` は append-only(`commit()` 経由のみ)
- `Block.content` 等は SHADOW(getter から都度取得、変数化しない)

詳細は [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md)。

---

## 削除ポリシー

ファイル削除時は `rm -rf` ではなく **`mv` で `/Users/AoyamaRito/PJs/trash/` に退避**するのが既定。
明示的に「完全削除」と指示があった場合のみ `rm -rf`。
