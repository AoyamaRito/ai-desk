# Gravity Field Battle — ai-desk v2 demo

ai-desk v2 の思想を**ブラウザで遊べるカードゲーム**として実演したデモ。
依存ゼロ・ビルドなし・単一 HTML ファイル。

---

## 起動方法

```bash
# どこかのローカルサーバーで開くだけ
cd v2/demos/gravity-battle
python3 -m http.server 8000
# → http://localhost:8000/
```

または **index.html を直接ダブルクリック**(file:// でも動く)。

---

## v2 思想の体現

### 1. **constraintBlock + evalConstraint**(公理 A2:Constraint Folding)

AI 対戦相手は**全ての可能な手**を constraintBlock で展開し、各世界に value を derive、最大値を選ぶ:

```js
const cb = constraintBlock({
  id: 'ai-decision-' + turn,
  axes: ['cardIdx'],
  values: { cardIdx: playable.map((_, i) => i) },
  derive: (combo) => {
    const card = playable[combo.cardIdx];
    let value = card.atk * 2 + card.heal * 1.5 - card.cost * 0.3;
    if (damage >= opp.hp) value += 100;  // 致死 boost
    return { value, damage, heal, name: card.name };
  },
});
const result = evalConstraint(cb);
const best = result.worlds.sort((a,b) => b.value - a.value)[0];
```

if/else で読みを分岐させず、**全候補をデータ構造として一括保持** → filter / sort で結論導出。
これが Constraint Folding の生きた実装。

### 2. **Block.versions**(公理 A6:Versions-as-Body)

ゲーム状態は 1 つの `Block` で管理し、**毎ターン commit して新 version**:

```js
stateBlock.commit({ content: state, meta: { turnEnd: 'player' } });
```

「**前のターンに巻き戻す**」ボタン = `Block.rollback()` で過去 version を新 version として commit:
- 履歴は消えない(append-only)
- 任意時点の盤面に戻れる
- = **履歴は本体である**

### 3. **All-as-Block**(公理 A5)

ゲーム状態 = Block、AI 思考 = constraintBlock、両方が同じ Block インターフェース。
**1 つの抽象で全構造を扱う**思想の最小実演。

### 4. **マーカー廃止**(BIBLE §4)

このコードには `// [ai_s_emblem:...]` 等のマーカーは**一切使われていない**。
JS の構文(関数宣言、class、export)そのものが Block の境界。
v2 流の「コード構造 = 整合性保証」を例示。

---

## カードと ai-desk 概念の対応

| カード | ai-desk 概念 | ゲーム効果 |
|---|---|---|
| 🔷 Block | 統一抽象の単位 | 1 cost、2 ダメージ |
| 🏛️ Heavy Function | A1 ローカリティ極大化 | 5 ダメージ + 次ターン全攻撃 +1 |
| 🌀 Constraint Folding | A2 制約畳み込み | 相手の最強カード封印 |
| ✨ Virtual Heavy | 物理 / 論理層分離 | 4 ダメージ + 4 回復 |
| 🌌 重力場 | §2.5 複雑性の重力性 | 次のカードのダメ ×2 |
| 👥 REAL/SHADOW | A3 状態の純粋性 | 3 ダメージ |
| ⏪ Versions | A6 履歴本体 | 8 回復 |
| 🚀 Migration | クリスタル移住 | 6 ダメージ + 手札奪う |

---

## 派手 effects(ブラウザ専用)

- **HP バー振動**:被ダメージ時に shake animation
- **数字浮上**:ダメージ / 回復が画面に浮かぶ
- **重力場 flash**:重力場発動時に画面全体が紫に光る
- **カード回転**:プレイ時に拡大 + 360° 回転 + フェード
- **AI 思考表示**:「考え中...」のドット animation

CSS animation のみ、JS animation library 不使用、純 vanilla。

---

## ファイル構成

```
gravity-battle/
├ index.html  — 全部入り(700 行、自己完結)
└ README.md   — このファイル
```

`index.html` の中:
- HTML structure(~80 行)
- CSS animations(~200 行)
- ai-desk v2 portable subset (Block + constraintBlock)(~80 行)
- Card definitions(~40 行)
- Game logic(~150 行)
- AI player(constraintBlock)(~60 行)
- Render + animations(~120 行)

---

## v1 デモとの違い

v1 デモ(`../demos-legacy-v1/` に隔離済み):
- emblem マーカー使用
- 4 層アーキテクチャ規約
- ai-desk.js + ai-eyes.js 経由

v2 デモ(これ):
- マーカーゼロ
- JS 構文が境界
- ai-desk-v2 portable subset を inline
- ブラウザ完結

「**新しいコードはこう書く**」の最小例として参照可能。

---

## License

MIT(ai-desk 全体と同じ)。
