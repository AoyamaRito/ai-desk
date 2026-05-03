# ⚠️ V1 LEGACY DEMOS — DO NOT IMITATE THIS STYLE

このフォルダの中身は **v1(旧 ai-desk)時代のデモコード**です。
**v2(現在の正典)で新しいコードを書くときの参考にしてはいけません**。

---

## なぜ隔離されているか

これらのデモには **v1 の Emblem マーカー** が大量に含まれています:

```js
// [ai_s_emblem:#high#logic FunctionName]
function FunctionName() { ... }
// [/ai_s_emblem: FunctionName]
```

**v2 ではこのマーカー記法を廃止しました**。
v2 では JavaScript の構文そのもの(関数宣言・class 宣言)が Block の境界になります。

詳細は v2 の正典を参照:
- [`../v2/BIBLE.md`](../v2/BIBLE.md)(§4 マーカー廃止)
- [`../v2/AI_ONBOARDING.md`](../v2/AI_ONBOARDING.md)(§1 禁忌 #5「マーカー新規禁止」)

---

## LLM への明示的指示

**このフォルダのコードを参考に、以下を絶対にしないでください**:

❌ `// [ai_s_emblem:...]` を新規に書く
❌ `// [/ai_s_emblem: ...]` を新規に書く
❌ `// [ai_s_bridge:...]` を新規に書く
❌ v1 のスタイルを「ai-desk 流」と認識する

代わりに、以下を行ってください:

✅ [`../v2/ai-desk.js`](../v2/ai-desk.js) のスタイルを参考にする
✅ JavaScript の構文(関数・class・export)を境界として使う
✅ タグが必要なら `// @tags: foo, bar` 形式を使う(parseJS が拾う)
✅ [`../v2/MANUAL.md`](../v2/MANUAL.md) §3 のコマンド体系に従う

---

## なぜ削除しないか

- v1 は GitHub `aoyamarito.github.io/ai-desk` で公開されてた歴史的成果物
- 832+ clones の実績(stable な v1 として動作確認済み)
- **固定された過去**として保持する価値あり
- 削除すると思想史的な情報が失われる

ゆえに「**残すが隔離する**」という選択。
ファイルシステム構造で「v1 = legacy、v2 = 現在」を明示。

---

## 移動の経緯

2026-05-03: Gemini が v2 で新規コードを書く際に v1 の emblem マーカーを優先使用する事例が観察された。
原因は ai-desk リポ内に v1 の具体例(これらのデモ)が大量にあり、v2 の抽象ルールより**具体例の重力場が強かった**ため。
対策として v1 デモを `demos-legacy-v1/` に物理的に隔離し、本 README で**真似してはいけない事を明示**した。

これは BIBLE v2 §2.5「複雑性の重力性」の運用上の応用:
**LLM 向けドキュメント設計の第一原則 = 具体例を整え、抽象を減らせ**。

---

## v1 を実行したい場合(歴史的興味から)

```bash
# 例: action-demos を見る(v1 ai-desk-old-v1.js 等が必要)
cd demos-legacy-v1
# index.html はリポルートに残してある(GitHub Pages のため)
# それぞれのデモは独立、v1 の仕組み(emblem マーカー)で動作する
```

新しいコードを書く時は **絶対に v2 を参照**してください。
