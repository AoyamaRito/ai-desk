# ai-desk (v3.5)

> **AI-Native software methodology — a working desk for the AI to build on.**
> AIが書きやすく、人がデバッグしやすい設計原則・道具・実装デモをひとつにまとめた体系。

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What is this

AI（LLM）がコードを書く時代に、**人間時代の「良い設計」（DRY・抽象化・カプセル化）はAIに対して情報を奪う**。
本リポは、その認知の非対称性を出発点に、**AIが迷わずバグを出さないコードを書くための原則・道具・実証実験**を一式で公開する。

中心となる思想は6本柱:

1. **認知の非対称性** — 複雑性は人の問題、隠匿はAIの問題（[Bible §0.0](AI_NATIVE_MASTER_BIBLE.md)）
2. **重厚関数（Heavy Functions）** — 共有禁止・インライン化・Emblem境界（[Bible §0.1](AI_NATIVE_MASTER_BIBLE.md)）
3. **条件畳み込み（Constraint Folding）** — if/elseの代わりに「全可能世界 → 制約filter」で結果を導出（[Bible §0.15](AI_NATIVE_MASTER_BIBLE.md)、[実装ガイド](PROMPT_constraint_folding.md)）
4. **鉱脈採掘パラダイム** — モンテカルロ + LLMによる法則解読 + 制約バリデーターの三段検証（[DISCUSSION](DISCUSSION_constraint_library.md)）
5. **複式数学 / 3Dplus検証層** — GPU出力と並走するCPU側の透明な算数で、3D・物理・アニメのバグを「論理バグ」と断定可能にする（[Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md)、[実装](3dplus/README.md)）
6. **自律観測インフラ (AI-Eyes)** — 画面やエラーを人間経由ではなく、AI自身がゼロ依存サーバーを通じて観測・リモート操作する（[Bible §1.5](AI_NATIVE_MASTER_BIBLE.md)）

---

## 30秒で動く実証

> **🎮 [Playable Demo (Action Constraint Lab) をブラウザで開く](https://aoyamarito.github.io/ai-desk/actions/index.html)**

```bash
# ローカルで動かす場合 (fighter-cancel)
open actions/index.html

# 19/19テスト（1920世界の網羅検証）を走らせる
node --test actions/tests/fighter-cancel.test.js
```

`actions/` は L3 Logic（純粋データ + 制約filter）と L1/L4（入力/描画）を分離した実装デモ。
キャンセル受付・先行入力・hit確認をすべて `if` ゼロ・データだけで宣言し、サイドペインに「現在状態に到達する全ルート」を**逆引きで常時表示**する。

---

## 測定値

`PROMPT_constraint_folding.md` に記載の 9 アクションゲームデモにおける実測:

| バグカテゴリ | 制約畳み込みで潰れる率 |
|---|---|
| 状態組み合わせ漏れ | **95%** |
| 仕様とコードの食い違い | **90%** |
| キャンセル・コンボ系 | **85%** |
| AI戦略遷移 | **80%** |
| フレームデータ矛盾 | **95%** |
| 物理系・描画 | 射程外 |

> **重み付き総合: アクションゲーム全体のバグ件数の 50–60% を構造的に絶滅。**

`fighter-cancel` 単体での網羅テスト: 1920世界を走査、矛盾ゼロ、テスト 19/19 PASS。

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | 全体の正典。認知非対称性 → 重厚関数 → 4層アーキテクチャ → REAL/SHADOW → 3Dplus → イベントソーシング → 複式数学 |
| [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) | AI認知特性の解説（±300行スポットライト、近接バイアス、ファイル切替コスト） |
| [`PROMPT_constraint_folding.md`](PROMPT_constraint_folding.md) | 制約畳み込みパターン LLM 適用ガイド（適用判定・テンプレ・測定エビデンス） |
| [`DISCUSSION_constraint_library.md`](DISCUSSION_constraint_library.md) | 鉱脈採掘パラダイムの完全解説（送料計算 PoC 含む） |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | アクションゲームへの適用ガイド（三層畳み込みアーキテクチャ） |
| [`3dplus/README.md`](3dplus/README.md) | 複式数学の3D実装ガイド。GPUと並走するCPU側検証層（cpu3d.js）の契約と使い方 |

---

## 実装と実証

### 道具（Tool）
このリポジトリは、AIがコードを編集する「手」と、実行結果を観測する「目」の2つのツールを提供する。

- **`ai-desk.js` (手)** — 巨大ファイルを Emblem タグで仮想分割し、`skeleton` / `focus` / `apply` の三段で AI が安全に局所更新するためのCLI

```bash
node ai-desk.js path/to/file.js skeleton                # 構造把握
node ai-desk.js path/to/file.js focus EmblemName        # 局所読込
node ai-desk.js path/to/file.js apply patch.js          # 部分適用
node ai-desk.js path/to/file.js check                   # 構造・一意性整合性チェック
```

- **`ai-eyes.js` (目)** — ブラウザエラーの自動収集、HTML/Canvasスナップショットの保存、構造投影の受け取り、動画（スライドショー）記録、およびAIからのリモート操作（Step-by-step デバッグ）を受け付けるゼロ依存ローカルサーバー

```bash
node ai-eyes.js  # サーバー起動 (http://localhost:3000)

# AI は以下のコマンドで自律的にデバッグ・観測を行う
curl -X POST localhost:3000/input -d '{"action":"eval", "code":"window.step_forward()"}'
curl -X POST localhost:3000/snapshot/request     # 最新状態のスクショ要求
curl -X POST localhost:3000/record/start         # 動画記録開始
curl -X POST localhost:3000/record/stop          # 動画記録停止（HTML生成）
curl localhost:3000/structures                   # 3D/構造投影データの確認
tail -1 error.log
```

### 最小実装
- [`constraint-janken.js`](constraint-janken.js) — 3人ジャンケン27世界。**まずこれを読め**

### アクションゲーム適用
- [**`action-demos.html`**](https://aoyamarito.github.io/ai-desk/action-demos.html) + `action-demos.js` — 9 アクションゲームアルゴリズム（プレイアブル）
- [**`actions/index.html`**](https://aoyamarito.github.io/ai-desk/actions/index.html) — 単一HTMLハブから複数JSデモを切替えるラボ。`fighter-cancel` 実装＋19/19網羅テスト

### 鉱脈採掘 PoC
- [`examples/`](examples/) — レガシー送料計算ロジックを 50 サンプルから 100% 復元した実証実験

```bash
node examples/blackbox_generator.js     # 50サンプル生成
node examples/verify_mining.js           # 復元コードを元データで検証
```

### 複式数学 / 3Dplus 検証層
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) — CPU側の透明な投影パイプライン（純粋関数のみ、Zero-Dep）
- [`3dplus/examples/point-projection.html`](3dplus/examples/point-projection.html) — WebGLが描いた立方体にCPU予測位置をマーカーで重ねるPoC
- [`3dplus/tests/`](3dplus/tests/) — 行列・階層・3Dplus軸・衝突・アニメーション 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js  # ネイティブテスト
open 3dplus/examples/point-projection.html    # GPU vs CPU 突合デモ
```

---

## 適用判定（使うべき／使ってはいけない）

`PROMPT_constraint_folding.md` §1 に詳細。要点:

### ✅ 制約畳み込みが効く領域
- ドメインが有限離散
- 複数の独立な状態軸（並行性）
- **逆引きが意味を持つ**（最強の判定基準）
- 業務ルール・ゲームルール・税務ロジック等

### ❌ 効かない領域
- 連続値の物理計算・補間
- リアルタイム描画ループ
- 木探索・グラフ探索
- 状態組合せが爆発する場合

> **「if を書く前に、可能世界を列挙できるかを問え。
>  列挙できるなら、その世界集合がそのままコードである。」**

---

## 構造

```
ai-desk/
├── README.md
├── LICENSE
├── ai-desk.js                          # Emblem操作ツール (手)
├── ai-eyes.js                          # 自律観測・デバッグサーバー (目)
├── AI_NATIVE_MASTER_BIBLE.md           # 正典
├── AI_UNDERSTANDING_MANIFESTO.md       # AI認知特性
├── PROMPT_constraint_folding.md        # 制約畳み込みガイド
├── DISCUSSION_constraint_library.md    # 鉱脈採掘パラダイム
├── constraint-janken.js                # 最小実装
├── action-demos.{html,css,js,-ui.js}   # 9アクションゲームデモ
├── examples/                           # 鉱脈採掘 PoC（送料計算）
├── 3dplus/                             # 複式数学の3D実装（CPU側検証層）
│   ├── README.md
│   ├── cpu3d.js
│   ├── examples/point-projection.html
│   └── tests/projection.test.js
└── actions/                            # 新ハブ + fighter-cancel + 19/19テスト
    ├── ACTION_NATIVE_FOLDING_GUIDE.md
    ├── index.html
    ├── demos/fighter-cancel.{logic,}.js
    └── tests/fighter-cancel.test.js
```

---

## 哲学

このリポは **認知の非対称性を出発点に、AIが迷わずバグを出さないコードを書くための原則を実装と数値で示す** ための検証装置である。
人間の美意識（短く・抽象化された）に反して見えるコードが、AI 時代には **保守性・再利用性・バグ耐性で人間時代を上回る** ことを示す。

新しい原則ではない。**業界が暗黙に知っていたが言語化していなかった原則** を、AI ネイティブ時代の文脈で再構成した。

---

## License

MIT — 自由に使い、変更し、再配布してよい。クレジット表記があると嬉しい。

## Author

[AoyamaRito](https://github.com/AoyamaRito)（蒼山りと）

---

## 引用したい方へ

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```
