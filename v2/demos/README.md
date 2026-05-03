# ai-desk v2 demos

ai-desk v2 の主要機構を**動くもの**として実演するデモ集。

---

## [`gravity-battle/`](./gravity-battle/) — Gravity Field Battle

ブラウザで遊べる**カードゲーム**(単一 HTML、依存ゼロ、~1300 行)。

**v2 思想の体現**:
- **constraintBlock + evalConstraint**: AI が全可能 play を評価して最適選択(公理 A2)
- **Block.versions**: 各ターンの盤面が version、Undo は `rollback()`(公理 A6)
- **All-as-Block**: 状態・AI 思考すべて Block(公理 A5)
- **マーカーゼロ**: JS 構文だけで構造表現(BIBLE §4)

**カードは ai-desk 概念がテーマ**:
🔷 Block / 🏛️ Heavy Function / 🌀 Constraint Folding / ✨ Virtual Heavy / 🌌 Gravity Field / ⏪ Versions / 👥 REAL/SHADOW / 🚀 Migration

> ▶ **[プレイ(GitHub Pages)](https://aoyamarito.github.io/ai-desk/v2/demos/gravity-battle/)**

---

## このデモの意義

ai-desk v2 を使うと:
- **1 セッション**でカードゲームが完成
- **bug ゼロ**で動く
- 修正リクエスト 8 ラウンド以上連続で**何も壊れない**
- 普通の AI コーディングなら**数日かかる規模**

**このデモの存在自体が ai-desk の効果の実証**になっている。
コード(`gravity-battle/index.html`)を読めば、1 セッションでどこまで作れるかが見える。

---

## 今後の demos

候補(まだ未実装):
- TODO リスト(Block.versions が UI に出るやつ)
- Constraint Folding ソルバー(N-queen など)
- Virtual Heavy エディタ(複数 Block を 1 view で編集)
- AI 対戦将棋 / 詰将棋(constraintBlock の限界実証)

新規 demo を追加する場合:
- マーカー禁止(JS 構文のみ)
- 依存ゼロ(npm install なし)
- 単一ディレクトリで完結
- README.md を必ず添える
- v2 機構をひとつ以上体現する事
