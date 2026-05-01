# 制約畳み込みパターン — LLM 適用ガイド

> このドキュメントは LLM (Claude等) に対する指示書である。
> 該当するタスクを与えられた時、本パターンを優先的に検討せよ。
> 出典: AI-Native Master Bible §0.15「条件畳み込み一発判定」
> 検証: `action-demos.js` / `action-demos-ui.js` (2026-04-30)

---

## 0. 目的

`if/else` のネストや `switch` 連鎖でロジックを書く代わりに、
**「全可能世界を生成 → 制約でfilter → 残った世界を返す」** 純粋関数として畳み込む。

これにより：
- **逆引きが可能** (`{result:X}` から該当する入力組み合わせを全列挙)
- **定義漏れが消える** (組み合わせの直積を機械的に生成するため)
- **仕様とコードの乖離が消える** (ルールがデータ化される)
- **退行バグの連鎖が止まる** (1箇所変えても矛盾は即時 `_contradiction` で発覚)

---

## 1. 適用判定 (Decision Tree)

### ✅ 使うべきとき (USE)
以下に該当する場合、`if/switch` で書く前に必ず本パターンを検討せよ：

1. **ドメインが有限離散** — 状態・選択肢・組み合わせが列挙可能
2. **複数の独立な状態軸** — ジャンプ状態 × 攻撃状態 × 無敵状態 のような並行性
3. **逆引き要求がある** — 「結果Xになる入力を全部知りたい」「+3有利になるフレームデータは？」
4. **仕様の網羅性が重要** — 状態の組み合わせ漏れがバグになる
5. **業務ルール・ゲームルール・税務ロジック等** — 宣言的に書ける性質
6. **キャンセル可否・許可マトリクス・遷移表** — そもそもデータ駆動で表現される性質

### ❌ 使ってはいけないとき (DO NOT USE)
以下に該当する場合、本パターンは害になる。素直に手続き的に書け：

1. **連続値の物理計算** — 衝突応答、ベクトル演算、補間
2. **リアルタイム描画ループ** — Canvas/WebGL の毎フレーム描画
3. **イベント駆動の入力ハンドリング** — `addEventListener` 内の状態更新
4. **逐次的パターンマッチ** — 文字列の部分列検索、入力履歴の時系列照合
5. **木探索・グラフ探索** — DFS/BFS は素直な再帰の方が短く正しい
6. **状態の組み合わせが爆発する** — 5次元 × 各10値 = 10万世界 を超えるなら、事前コンパイルや遅延展開を検討
7. **副作用が本質** — DB書き込み、API呼び出し、ファイル操作

### 判断基準: 「逆引きが意味を持つか？」
これが最強の判定基準。
- 「結果から入力を逆算したい場面」が想像できる → 制約畳み込みが効く
- 「入力から結果を計算するだけ」 → 普通の関数で十分

---

## 2. パターン本体 (Template)

### 2.1 単一ドメインの基本形

```js
function domain(constraints = {}) {
  // (1) 全可能世界を生成
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      for (const c of AXIS_C) {
        // 派生フィールドはここで計算（if文OK、世界生成時の閉じた式）
        const derived = computeFrom(a, b, c);
        allWorlds.push({ a, b, c, ...derived });
      }
    }
  }

  // (2) 制約でfilter
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }

  // (3) 結果整形
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `No world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```

### 2.2 多段化 (Composition)

3つの合成器を持つ：

```js
// pipe: 直列。前段の出力を次段の制約に積む。
function pipe(...fns) {
  return (initial = {}) => {
    let acc = { ...initial };
    for (const fn of fns) {
      const next = fn(acc);
      if (next._contradiction) return next;
      acc = { ...acc, ...next };
    }
    return acc;
  };
}

// join: 並列直積。複数ドメインの世界を直積し、跨ぎ制約でfilter。
function join(fns, link) {
  return (constraints = {}) => {
    const sets = fns.map(fn => fn(constraints)._worlds_raw || []);
    let joint = sets.reduce((acc, set) => acc.flatMap(a => set.map(s => [...a, s])), [[]]);
    if (link) joint = joint.filter(t => link(...t));
    if (joint.length === 0) return { _contradiction: true };
    return { _worlds: joint.length, _worlds_raw: joint };
  };
}

// meta: 階層。上位制約が下位の探索空間を縮小。
function meta(upper, lower) {
  return (uc = {}, lc = {}) => {
    const u = upper(uc);
    if (u._contradiction) return u;
    return lower({ ...u, ...lc });
  };
}
```

### 2.3 4層アーキテクチャ内での位置
本パターンは **L3 (Logic層) 専用** である。
- L1 (DOM/event) と L4 (描画) は手続き的に書け
- L2 (Intent変換) では「操作と意図の妥当な関係」を制約で表現できる場合がある
- 制約関数の出力は Bridge 経由で L4 に流す

---

## 3. 検証エビデンス (実測データ)

### 3.1 検証セットアップ
- 対象: アクションゲームのアルゴリズム 9 種
- ファイル: `action-demos.js` (制約ライブラリ層, 482行)
- ファイル: `action-demos-ui.js` (UI層, 699行) ※比較対照用
- 測定日: 2026-04-30

### 3.2 if 文の分布

| 層 | 総行数 | if 件数 | 性質 |
|---|---|---|---|
| L3 制約ライブラリ | 482 | 31 | うち23はインフラ定型、8がドメイン |
| L1+L4 UI | 699 | 94 | ほぼ全てイベント・描画の手続き |

**L3 ドメイン if 8件の内訳:**
- 入力バッファのパターン照合: 2件 (本質的に逐次)
- コンボファインダーのDFS: 5件 (再帰探索)
- enemy-AI 距離枝刈り: 1件 (畳み込み漏れ、修正可能)

→ **9デモ中7デモはドメイン if ゼロ** で書けた。

### 3.3 バグ消滅率 (デモ実装からの体感評価)

| バグカテゴリ | 制約畳み込みで潰れる率 |
|---|---|
| 状態組み合わせ漏れ | **95%** |
| 仕様とコードの食い違い | **90%** |
| キャンセル・コンボ系 | **85%** |
| AI戦略遷移 | **80%** |
| フレームデータ矛盾 | **95%** (逆引き網羅検証) |
| 入力受付（設計時） | 70% |
| 入力受付（実行時競合） | 30% |
| 多オブジェクト相互作用 | 40% |
| 物理系 | **10%** (射程外) |
| 描画ロジック不整合 | **0%** (射程外) |

**重み付き総合: アクションゲーム全体のバグ件数の 50-60% を構造的に絶滅。**

### 3.4 重要な観察
**「if が消えた」のではなく「if が危険な場所から安全な場所に移動した」**

- 旧: ドメイン分岐（バグの温床）に if が積み重なる
- 新: ドメインは宣言的、if は infrastructure (filter ループ等) に隔離

23件の boilerplate ifs はコストではなく **境界の代金**。

---

## 4. 適用例: 何が向くか/向かないか

### ✅ 向く例
- **キャンセルチェーン判定**: `cancelChain({moveB:'HAD', valid:true})` で HAD に繋がる入口全列挙
- **フレーム有利逆算**: `frameAdvantage({advantage:3})` で +3 有利になる構成328通り
- **AI戦略選択**: HP→strategy→action の階層を `meta` で表現
- **税務ロジック**: 端数処理・税区分の組み合わせを世界として持つ
- **会計仕訳の妥当性**: 借方×貸方×日付×税区分 を join

### ❌ 向かない例
- **キャラクターの位置補間**: `lerp(a, b, t)` を制約で書こうとするな
- **キーボード入力ハンドラ**: `addEventListener('keydown', e => ...)` 内
- **コンボルート探索**: DFS が短くて正しい
- **正規表現マッチ**: 既存の正規表現エンジンを使え
- **物理エンジンの当たり判定**: 連続値は別パラダイム

---

## 5. アンチパターン (避けよ)

### 5.1 全部畳み込もうとする
範囲が向かない場所まで畳み込もうとすると、可読性が壊滅する。
**判定: 「逆引きが意味を持つか？」 No なら使うな。**

### 5.2 世界数の爆発を放置
5軸×各10値 = 10万世界を毎呼び出しで生成するな。
- 軸を減らせないか検討
- 事前計算してキャッシュ
- 鉱脈採掘 (Bible §0.15.4) で純粋関数に焼き直し

### 5.3 共有 helper を作りすぎる
`applyConstraints()` のような小さなヘルパーを共通化したくなるが、
Bible §0.1.2 「共有の禁止」に従い、各ドメイン関数内にインラインで複製せよ。
重複は悪ではない。隠れた依存が悪。

### 5.4 UI層 (L1/L4) で使う
ゲームループ・キーハンドラ・描画は手続き的に書け。
本パターンを混ぜると、誰も読めなくなる。

---

## 6. LLM への具体的指示

新しいタスクを受けたら、**コードを書く前に以下を判定せよ:**

### Step 1: 適用判定
```
□ ドメインが有限離散か？
□ 複数の独立な状態軸を持つか？
□ 「結果から入力を逆引きしたい」場面が想像できるか？
□ 状態組み合わせの網羅性が重要か？

3つ以上 ✓ なら → 制約畳み込みで書く
2つ以下 → 普通に if/switch で書く
```

### Step 2: 適用時の構造
1. 全可能世界を生成する `for` ループを最初に書く
2. 派生フィールドは世界生成時に閉じた式で計算
3. `Object.entries(constraints)` で filter
4. `_contradiction` を返す経路を必ず用意
5. 多段化が必要なら `pipe` / `join` / `meta` を使う

### Step 3: 出力前に検証
- 順引き (`{state:X}` → 結果) が動くか
- 逆引き (`{result:Y}` → 状態列挙) が動くか
- 矛盾する制約 (`{a:1, derived_from_a:99}`) で `_contradiction` が出るか

### Step 4: 報告
ユーザーに対しては：
- 「if 何件減りました」ではなく「**逆引きで何が出せるようになりました**」を報告
- 適用範囲外の部分（UI、物理、探索）は素直にそう書け
- 適用率は数字で示せ (例: 「9デモ中7デモはドメイン if ゼロ」)

---

## 7. 参考実装

すべて `/Users/AoyamaRito/PJs/ai-desk/` にある:

| ファイル | 内容 |
|---|---|
| `constraint-janken.js` | 最小実装。3人ジャンケンの27世界。**まずこれを読め** |
| `action-demos.js` | 9アクションゲームアルゴリズム。L3制約ライブラリ層 |
| `action-demos-ui.js` | プレイアブル化。L1+L4は手続き的、対比のため |
| `action-demos.html` | 9ミニゲームの起動点 |
| `AI_NATIVE_MASTER_BIBLE.md` §0.15 | 思想の出典 |
| `DISCUSSION_constraint_library.md` | 鉱脈採掘パラダイムの完全解説 |

### 起動方法
```bash
cd /Users/AoyamaRito/PJs/ai-desk
node constraint-janken.js          # 最小実装の動作確認
node action-demos.js                # 9デモ全実行
open action-demos.html              # ブラウザでプレイ
node ai-desk.js action-demos.js skeleton    # 構造把握
node ai-desk.js action-demos.js focus Hitbox-Collision  # 局所読込
```

---

## 8. 一行サマリー

> **「if を書く前に、可能世界を列挙できるかを問え。
> 列挙できるなら、その世界集合がそのままコードである。」**
