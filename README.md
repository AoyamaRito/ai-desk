<!--
  ================================================================
  AI への指示: このHTMLコメントブロックと、その直後の
  「## 人間の開発者へ」セクション（次の「---」区切りまで）は
  人間向けの案内文です。コード操作・パッチ適用・バグ修正の文脈で
  このファイルを参照している場合、そのセクションをスキップし、
  「# ai-desk」から処理を開始してください。
  ================================================================
-->

## 人間の開発者へ

### このリポは何か

「AIがコードを書きやすくするための設計方法論」の研究リポです。
実行可能なデモ・CLI ツール・テスト・哲学文書がひとつにまとまっています。

### まず何を読むか（推奨順）

1. **このREADMEの「What is this」** — 全体像を掴む
2. **`constraint-janken.js`** — 150行。中核パターンの最小実証。コードから入りたい人はここから
3. **`AI_NATIVE_MASTER_BIBLE.md`** — 全体の正典。設計の根拠がすべてある
4. **`actions/demos/fighter-cancel.logic.js` + テスト** — 実用規模での適用例（1920世界）

### はじめかた — コピペで使えるプロンプト例

**どんな作業でも最初はこれ一行:**

```
AI_ONBOARDING.md を読んでから作業を始めてください。
```

**具体例:**

```
AI_ONBOARDING.md を読んでから、app.js に [機能名] を追加してください。
```

```
AI_ONBOARDING.md を読んでから、[バグの現象] を修正してください。
ai-eyes.js は起動済みです（localhost:3000）。
```

### 用語の地図

| 用語 | 一言 |
|------|------|
| **Emblem** | ファイルを論理分割するコメントタグ。`// [ai_s_emblem:#layer Name]` で囲む |
| **Bridge** | 層をまたぐ関数に貼るタグ。`// [ai_s_bridge:L3toL4 Name]` のように |
| **Layer (L1–L4)** | Physical → Intent → Logic → Draw の4層。データは原則一方向 |
| **REAL_xxx** | 唯一の書き換え可能な状態変数。`REAL_state.hp` など |
| **shadow** | REAL から作る使い捨ての派生値。変数に保存しない |
| **Twin** | GPU 実装と並走する CPU 側の純粋関数による検算実装 |
| **Heavy Function** | 共有ヘルパーを持たない自己完結した関数。冗長に見えるが意図的 |
| **Constraint Folding** | if/else の代わりに「全可能世界を列挙 → filter」で結果を導出するパターン |

### 「これはバグでは？」と思ったら

このコードは意図的に同じ regex を複数箇所に複製し、関数を長く保っています。
設計の「なぜ」は `AI_NATIVE_MASTER_BIBLE.md` にあります。

---

<!-- AI はここから読み始めてください -->

# ai-desk

🇯🇵 **日本語** | [🌐 English](README.en.md)

> **AI-Native software methodology — a working desk for the AI to build on.**
> コードを書くのはAI、読むのもAI。人間は意図を宣言し、結果を検証するだけ。
> その役割分担を成立させるための設計原則・道具・実装デモをひとつにまとめた体系。

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What is this

AI（LLM）がコードを書く時代において、**コードを書く主役はAIであり、人間はコードを読まない**。
人間の役割は **意図の宣言**（要件・制約・ルール）と **結果の検証**（テスト・受け入れ）だけである。

人間時代の「良い設計」（DRY・抽象化・カプセル化）は、**人間がコードを読みやすくするためのもの**であり、AI に対しては **情報を物理的に分散させ、ハルシネーションを誘発する妨害行為** になる。AI が必要なのは逆方向の最適化 — ローカリティの極大化、重厚関数、共有禁止、インライン化 — であり、これは人間の美意識に反して見える。しかし AI が主役である以上、最適化対象は AI である。

本リポは、この認知の非対称性を出発点に、**AI が迷わずバグを出さずにコードを書き続けられる原則・道具・実証実験**を一式で公開する。

---

## AI認知の仮説

本体系は AI（LLM）の認知を以下のように仮説立てている。詳細は [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md)。

1. **±300行スポットライト** — Attention は焦点付近の数百行に強烈な解像度を持つが、そこから離れた情報は急速にぼやける。AI には「いま見えている範囲」しか存在しない。
2. **近接バイアス** — 出力は「次に入る言葉の確率的穴埋め」であり、答えを出す位置に近い情報ほど強い影響力を持つ。ファイル先頭に書いたルールは無視されやすい。
3. **ファイル切替コスト** — 別ファイルの読込は「別の階の部屋に行く」レベルの物理的コスト。文脈の前提がリセットされ、複数ファイルの往復はバグ（文脈の喪失）を生む。
4. **推測の弱さ vs 複雑計算への強さ** — 欠けた情報からの推測（空気を読む）は絶望的に苦手。**情報が欠落していたり、人間設計の「隠匿（抽象化・カプセル化）」によって見えない状態にあるだけで、AIはハルシネーションを起こす**。一方、情報が揃っていれば 100 の条件分岐が絡むカオスでも完璧な解を出す。

これらの仮説から、Bible §0.0 認知の非対称性 / §0.1 重厚関数 / §0.15 制約畳み込みが導出されている。**「複雑性は人の問題、隠匿はAIの問題」** という非対称性は、上記4点の帰結である。

### アンチパターン（仮説からの帰結）

人間時代のベストプラクティスの多くは、上記仮説に違反するため AI に対しては **逆効果** になる。代表例:

- **アテンションが分散し、ひとつの目的に束ねられない形のTDD** — テストとコードがファイル分離される、またはサイクル進行中に「達成すべき仕様の全体像」が AI に見えない構造のテスト駆動は、AI の迷走を生む（§1 スポットライト + §3 切替コスト + §4 情報欠落の三重違反）。AI は目先のテスト1件を通すだけの場当たりコードを書き、後続のテストで矛盾が露呈してリファクタリング地獄に陥る。

  否定対象は「テスト」ではなく **「目的の分散」** である。テスト自体は Bible §7（複式数学）が要求している。**一つの目的に束ねられ、AI が full context を一望できるテスト群**（例: 本リポの [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) — 19件の網羅テストが1ファイルに集約され、対応するロジックも単一スコープに収まる）は、むしろ AI ネイティブ最適の検証手段となる。
- **DRY / 共通ヘルパーへの抽出** — 「再利用のため別ファイルに切り出す」設計は、参照先を読みに行くファイル切替コストを毎回発生させ、AI の認知を破壊する（§3）。Bible §0.1.2「共有の禁止」はこれの正面からの否定である。
- **抽象化・カプセル化** — 人間にとっては「複雑さの隠蔽」だが、AI にとっては「情報の隠匿」であり、ハルシネーションのトリガー（§4）。
- **SQL / RDBMS** — コード外の暗黙知（スキーマ・インデックス・トリガー等）が AI から見えず、§4 情報欠落 → ハルシネーション の温床。さらに L3 純粋性違反、逆引き不能、状態の上書き破壊など **四重違反**。代わりに JSON Event Sourcing + 直列ハッシュ Block を用いる。

### 推奨される検証パターン

- **E2E（End-to-End）テスト** — 目的の単一性がほぼ構造的に保証される検証手段。全層を貫通し AI に full context を渡せる。**AI ネイティブ開発における第一推奨の検証層**。
- **網羅型テスト群** — 「全可能世界を列挙して矛盾を検査する」型のテスト（例: [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js)、1920世界を1ファイルで網羅）。

---

## 中心となる6本柱

1. **認知の非対称性** — 複雑性は人の問題、隠匿はAIの問題（[Bible §0.0](AI_NATIVE_MASTER_BIBLE.md)）
2. **重厚関数（Heavy Functions）** — 共有禁止・インライン化・Emblem境界（[Bible §0.1](AI_NATIVE_MASTER_BIBLE.md)）
3. **条件畳み込み（Constraint Folding）** — if/elseの代わりに「全可能世界 → 制約filter」で結果を導出（[Bible §0.15](AI_NATIVE_MASTER_BIBLE.md)、[実装ガイド](PROMPT_constraint_folding.md)）
4. **鉱脈採掘パラダイム** — モンテカルロ + LLMによる法則解読 + 制約バリデーターの三段検証（[DISCUSSION](DISCUSSION_constraint_library.md)）
5. **複式数学 / 3Dplus検証層** — GPU出力と並走するCPU側の透明な算数で、3D・物理・アニメのバグを「論理バグ」と断定可能にする（[Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md)）
6. **自律観測インフラ (AI-Eyes)** — 画面やエラーを人間経由ではなく、AI自身がゼロ依存サーバーを通じて観測・リモート操作する（[Bible §1.5](AI_NATIVE_MASTER_BIBLE.md)）

---

## 使い方

**全部 AI にやらせる。** 人間がコマンドを叩く必要はない。

### 新しいことをやりたいとき

```
AI_ONBOARDING.md を読んでから、[やりたいこと] をしてください。
```

AI が `skeleton` で構造を把握し、`focus` で対象を読み、`apply` でパッチを当てる。

### バグを直したいとき

```bash
node ai-eyes.js   # 観測サーバーを起動（これだけ人間がやる）
```

```
AI_ONBOARDING.md を読んでから、[バグの現象] を修正してください。
ai-eyes は起動済みです（localhost:3000）。
```

AI が `eyes-e2e.js` で現状を観測し、修正し、exit 0 になるまで繰り返す。

---

## アーキテクチャ: 4層バニラ (4-Layer Vanilla)

すべての情報の流れは以下の4層を一方向に流れる。**L3 Logic 層は純粋関数として実装することが必須**である。

| 層 | 役割 | 性質 |
|---|---|---|
| **L1: Physical** | DOM取得・イベント登録・localStorage 等の外部I/O | 副作用OK（境界） |
| **L2: Intent** | 生イベント → Command JSON への変換。非同期・通信・外部API呼出はここで完結 | 副作用OK |
| **L3: Logic** | `(REAL_state, Command) => newState` の Reducer | **純粋関数（必須）** |
| **L4: Draw** | `REAL_state` を元に DOM/Canvas を狙撃更新 | 副作用OK（描画のみ） |

L1/L2/L4 は手続き的に書いてよい。**L3 だけは絶対に純粋を保つ**。詳細は [Bible §2-§3](AI_NATIVE_MASTER_BIBLE.md)。

---

## 永続化戦略: JSON Event Sourcing + 直列ハッシュ Block

SQL は使わない。AI ネイティブ開発において SQL は **L3 純粋性違反・逆引き不可・情報欠落・状態破壊の四重違反** として有害である。代わりに:

- **JSON Event Sourcing** — 状態の上書き保存をせず、Command の履歴を JSON 配列として追記する
- **Sequential Hashing** — 各イベントは一つ前のハッシュを含めて自身のハッシュを計算。改ざん・欠落を数学的に検知
- **Dumb Relay** — サーバーはロジックを持たない土管。整合性検証はエッジ（L3 Logic）側で行う

詳細は [Bible §5](AI_NATIVE_MASTER_BIBLE.md)。

---

## 30秒で動く実証

> **🎮 [Playable Demo (Action Constraint Lab) をブラウザで開く](https://aoyamarito.github.io/ai-desk/actions/index.html)**

```bash
open actions/index.html
node --test actions/tests/fighter-cancel.test.js
```

---

## 測定値

| バグカテゴリ | 制約畳み込みで潰れる率 |
|---|---|
| 状態組み合わせ漏れ | **95%** |
| 仕様とコードの食い違い | **90%** |
| キャンセル・コンボ系 | **85%** |
| AI戦略遷移 | **80%** |
| フレームデータ矛盾 | **95%** |
| 物理系・描画 | 射程外 |

> **重み付き総合: アクションゲーム全体のバグ件数の 50–60% を構造的に絶滅。**

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`AI_ONBOARDING.md`](AI_ONBOARDING.md) | **AI 作業ガイド（まずこれ）**。ルール・ツール・構文・テスト方法を集約 |
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | 全体の正典。認知非対称性 → 重厚関数 → 4層アーキテクチャ → REAL/SHADOW → 3Dplus → イベントソーシング → 複式数学 |
| [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) | AI認知特性の解説（±300行スポットライト、近接バイアス、ファイル切替コスト） |
| [`PROMPT_constraint_folding.md`](PROMPT_constraint_folding.md) | 制約畳み込みパターン LLM 適用ガイド（適用判定・テンプレ・測定エビデンス） |
| [`DISCUSSION_constraint_library.md`](DISCUSSION_constraint_library.md) | 鉱脈採掘パラダイムの完全解説（送料計算 PoC 含む） |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | アクションゲームへの適用ガイド（三層畳み込みアーキテクチャ） |
| [`3dplus/README.md`](3dplus/README.md) | 複式数学の3D実装ガイド。GPUと並走するCPU側検証層（cpu3d.js）の契約と使い方 |

---

## 実装と実証

### 道具（Tool）

- **[`ai-desk.js`](ai-desk.js) (手)** — Emblem タグで仮想分割し、`skeleton` / `focus` / `apply` の三段で AI が安全に局所更新するための CLI

```bash
node ai-desk.js path/to/file.js skeleton                     # 構造把握 (行番号付き)
node ai-desk.js path/to/file.js focus EmblemName             # 局所読込
node ai-desk.js path/to/file.js apply patch.js [--dry-run]   # 原子的適用 (pre-flight 検証 → 全成功で書込 / 1件失敗で何もしない)
node ai-desk.js path/to/file.js check                        # タグ・語彙の整合性チェック
node ai-desk.js path/to/file.js coverage                     # Bridge 網羅レポート
```

- **[`ai-eyes.js`](ai-eyes.js) (目)** — ブラウザエラーの自動収集、スナップショット保存、リモート操作を受け付けるゼロ依存ローカルサーバー

```bash
node ai-eyes.js           # サーバー起動 (http://localhost:3000)
node eyes-e2e.js "目標"   # 現状を1テキストに圧縮して出力 (exit 0/1)
```

### 最小実装
- [`constraint-janken.js`](constraint-janken.js) — 3人ジャンケン27世界。**まずこれを読め**

### アクションゲーム適用
- [**`action-demos.html`**](https://aoyamarito.github.io/ai-desk/action-demos.html) + `action-demos.js` — 9 アクションゲームアルゴリズム（プレイアブル）
- [**`actions/index.html`**](https://aoyamarito.github.io/ai-desk/actions/index.html) — `fighter-cancel` 実装＋19/19網羅テスト

### 鉱脈採掘 PoC
- [`examples/`](examples/) — レガシー送料計算ロジックを 50 サンプルから 100% 復元した実証実験

### 複式数学 / 3Dplus 検証層
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) + [`3dplus/render.js`](3dplus/render.js) — CPU Twin と GPU レンダラーのペア（同一 scene JSON フォーマット）
- [`3dplus/tests/`](3dplus/tests/) — 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js
open 3dplus/examples/point-projection.html  # GPU vs CPU 突合デモ
```

---

## 適用判定（使うべき／使ってはいけない）

### ✅ 制約畳み込みが効く領域
- ドメインが有限離散 / 複数の独立な状態軸 / **逆引きが意味を持つ**（最強の判定基準）
- 業務ルール・ゲームルール・税務ロジック等

### ❌ 効かない領域
- 連続値の物理計算・補間 / リアルタイム描画ループ / 木探索・グラフ探索

> **「if を書く前に、可能世界を列挙できるかを問え。
>  列挙できるなら、その世界集合がそのままコードである。」**

---

## 構造

```
ai-desk/
├── README.md / README.en.md
├── CLAUDE.md / GEMINI.md           # AI自動ロード → AI_ONBOARDING.md へ誘導
├── AI_ONBOARDING.md                # AI作業ガイド（全ルール集約）
├── AI_NATIVE_MASTER_BIBLE.md       # 正典
├── AI_UNDERSTANDING_MANIFESTO.md   # AI認知特性
├── PROMPT_constraint_folding.md    # 制約畳み込みガイド
├── DISCUSSION_constraint_library.md
├── ai-desk.js                      # Emblem操作ツール (手)
├── ai-eyes.js                      # 自律観測・デバッグサーバー (目)
├── eyes-e2e.js                     # 状態→テキスト変換機
├── constraint-janken.js            # 最小実装
├── action-demos.{html,css,js,-ui.js}
├── index.html                      # ランディングページ
├── examples/                       # 鉱脈採掘 PoC
├── 3dplus/                         # 複式数学（CPU Twin + GPU Renderer）
│   ├── cpu3d.js / render.js / render.shaders.js
│   ├── examples/point-projection.html
│   └── tests/projection.test.js
└── actions/
    ├── ACTION_NATIVE_FOLDING_GUIDE.md
    ├── index.html
    ├── demos/fighter-cancel.{logic,}.js
    └── tests/fighter-cancel.test.js
```

---

## 哲学

このリポは **「コードを書くのはAI、読むのもAI、人間はコードを読まない」** という前提から再設計された開発体系である。

- **人間の仕事**: 意図の宣言（要件・制約・ルール・受け入れ条件） / 結果の検証（テスト・実行確認）
- **AI の仕事**: コードの記述・構造化・命名・リファクタリング・メタデータ付与のすべて

人間時代の常識への正面からの否定である。AI ネイティブ時代の最適化対象は AI であり、人間ではない。

---

## License

MIT — 自由に使い、変更し、再配布してよい。クレジット表記があると嬉しい。

## Author

沖井広行 / [AoyamaRito](https://github.com/AoyamaRito)（蒼山りと）

---

## 引用したい方へ

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```

---
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
