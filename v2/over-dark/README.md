# Over Dark

時間制限 RPG。闇に呑まれる前に dungeon を駆け抜ける。

> ai-desk v2 の prefab / flow / heartbeat / Bible 思想を実 game 開発の dogfood として走らせる project。
> 個人開発、6-12 ヶ月で release、3 ヶ月で demo を目指す。

## 設計(2026-05-04 〜 2026-05-05 議論で確定)

### theme
- **抽象「闇」**(specific 神話 / 設定 無し、pure 概念)
- 余分な lore 無し、ミニマル(Hyper Light Drifter 寄りの抽象美)
- 主人公: 「光を持つ者」(narrative 最小)

### core mechanic
- 闇 timer(`darkness:0 → 100`、tick で自動上昇、100 で instant death)
- 闇減少手段: 光 spell / 神具 / boss 撃破 / 救出 / 隠し祭壇
- 階層降下で闇 timer 加速 + 報酬増
- run goal: 闇の主を倒す前に闇 100 にならない

### system
- **戦闘**: 純 turn-based(計算可能、AI 拡張容易)
- **dungeon**: branching node graph(Slay the Spire 風地図)
- **run 長さ**: 5-15 分
- **meta**: roguelite、light shard で永続強化
- **describe**: 2D minimal abstract(個性 + scope 小、闇 % で画面の彩度落とす)

### AI 連携(LLM)
- 毎 run の **闇 theme**(寒系 / 血系 / 機械系 / 死霊系 etc.)を LLM 決定
- enemy / spell / 部屋名 が theme に連動
- enemy 名前 / flavor / 行動 description を AI 生成
- balance check(constraint folding で「この build で boss 倒せる?」を検算)

## ai-desk Bible との対応

| game 概念 | ai-desk 概念 |
|---|---|
| 1 run の進行 | heartbeat の tick(闇 +X per tick) |
| spell cooldown / DoT / 神具 effect | scheduled queue の event |
| 各 spell / 敵 / 部屋 | Block(versions で balance 履歴自動) |
| state(hp / mp / 闇 / 装備) | tagged values(`"darkness:67/100"`、`"hp:80/100"`) |
| 戦闘ロジック | flow + behaviors(`onTurn` / `onCast` / `onHit`) |
| run replay | A4 event log で完全再現(speedrun replay 無料) |

## MVP scope(1 ヶ月 demo)

### Week 1-2: core loop
- 闇 timer(0 → 100)
- 1 floor、3 部屋(敵 / 商人 / boss)
- turn-based 戦闘(自分 + 敵 1 体)
- 3 spell(攻撃 / 防御 / 闇減少)
- run 完了画面(time / 撃破数 / 闇進行)

### Week 3: AI 生成
- LLM が毎 run の theme 決定 → 名前 / flavor 連動
- AI が enemy ability description 生成

### Week 4: polish + 配信
- abstract 演出(闇 % で画面の彩度落とす)
- replay 機能(A4 event log 可視化)
- itch.io free release

## 構成(予定)

```
over-dark/
├── README.md                 (this file)
├── index.html                browser entry
├── main.js                   adapter 層: scene / input / hud / heartbeat
├── prefabs.js                Block 層: enemy / spell / room / boss data
├── coord.js                  A11 helpers(ai-desk から流用 or 共有)
├── ai-bridge.js              LLM 連携(theme / enemy / flavor 生成)
├── test/
│   └── prefabs.test.js       Block 層 Node test
└── assets/                   art / sound(必要時)
```

## 関連

- [`../AiRunAndRead_BIBLE.js`](../AiRunAndRead_BIBLE.js) — 思想の正典(A0〜A13、Physics.LLMTyping 等)
- [`../3d-prefab/`](../3d-prefab/) — voxel editor demo(prefab / flow / heartbeat / Shadow_for_Flow の参考実装)
- [`../ai-desk-core.js`](../ai-desk-core.js) — Block / Graph / parseJS 等の core lib

## status

2026-05-05: フォルダ作成、設計記録のみ。実装は次 session 開始。
