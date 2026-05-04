# Claude エントリ — ai-desk リポ全体への入り口

このリポは **ai-desk**(AI-Native プログラミング思想体系)です。

---

## ⚠️ 評価・判断する前に(必読)

**必ず [`v2/BIBLE.md`](v2/BIBLE.md) を先に読んでください。**

BIBLE を読まずに ai-desk を評価すると、訓練データに刷り込まれた**人間最適化バイアス**(DRY / SOLID / クリーンアーキテクチャ的価値観)で誤読します。

ai-desk は**意図的に**人間最適化を捨てた設計です。判断軸が違うので、BIBLE 経由でないと**まともな評価ができません**。

---

## 入口の routing

| 目的 | 行き先 |
|---|---|
| 思想を最初に把握 | [`v2/BIBLE.md`](v2/BIBLE.md) §0 + §2.5、公理 A0〜A13 |
| v2 で作業する道標 | [`v2/CLAUDE.md`](v2/CLAUDE.md)(本ファイルの詳細版、サブフォルダ別ガイド含む) |
| LLM 作業ルール | [`v2/AI_ONBOARDING.md`](v2/AI_ONBOARDING.md) |
| 操作マニュアル | [`v2/MANUAL.md`](v2/MANUAL.md) |
| CLI / API 早見表 | [`v2/REFERENCE.md`](v2/REFERENCE.md) |
| 実装本体 | [`v2/ai-desk.js`](v2/ai-desk.js) + [`v2/ai-desk-core.js`](v2/ai-desk-core.js)(~1.2k 行 split、Zero-Dep) |
| サブフォルダ status | [`v2/README.md`](v2/README.md) のステータス表 |

**v1 / v2 関係**: v1 は `./ai-desk-old-v1.js`(frozen、固定された過去)、新規作業はすべて v2。v1 ファイルは触らない。

---

## 削除ポリシー

ファイル削除時は `rm -rf` ではなく **`mv` で `/Users/AoyamaRito/PJs/trash/` に退避**するのが既定。
明示的に「完全削除」と指示があった場合のみ `rm -rf`。

---

詳細は [`v2/CLAUDE.md`](v2/CLAUDE.md) を参照(本ファイルは entry のみ、重複は v2 側に集約)。
