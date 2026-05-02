<!-- [ai_s_emblem:#high#config Constraint-Folding-Master] -->
# 制約畳み込みパターン — AI-Native Master Guide

> このドキュメントは AI (LLM) に対する指示書および概念定義である。
> 出典: AI-Native Master Bible §0.15「条件畳み込み一発判定」
> 更新日: 2026-05-02

---

## 0. 目的と基本思想

`if/else` のネストや `switch` 連鎖でロジックを書く代わりに、**「全可能世界を生成 → 制約でfilter → 残った世界を返す」** 純粋関数として畳み込む。

### 鉱脈採掘型（Mine and Verify）パラダイム
従来のライブラリは「計算」のための道具だったが、AI-Native な制約ライブラリは、変数間の **「不変の関係性（知識）」** を宣言するだけのバリデーターである。
複雑なロジックを人間が if 文で組み立てるのではなく、全可能世界という「鉱脈」から正解（Pass-Set）を掘り出し、AIにその法則を解読させる。

**これにより得られる効果：**
- **逆引きが可能**: `{result:X}` から該当する入力組み合わせを全列挙。
- **定義漏れの消滅**: 組み合わせの直積を機械的に生成するため、考慮漏れが物理的に発生しない。
- **矛盾の自動検知**: 仕様が矛盾していれば Pass-Set は空集合となり、`_contradiction` が即座に出力される。
- **バグの構造的絶滅**: 状態組み合わせ漏れや遷移バグを 90% 以上排除する。

---

## 1. 適用判定 (Decision Tree)

### ✅ 使うべきとき (USE)
1. **ドメインが有限離散**: 状態・選択肢・組み合わせが列挙可能。
2. **複数の独立な状態軸**: ジャンプ状態 × 攻撃状態 × 無敵状態 のような並行性。
3. **逆引き要求がある**: 「結果Xになる入力を全部知りたい」。
4. **仕様の網羅性が重要**: 状態の組み合わせ漏れがバグに直結する。
5. **状態遷移ロジック**: ステートマシンや Action Tick。

### ❌ 使ってはいけないとき (DO NOT USE)
1. **連続値の物理計算**: 衝突応答、ベクトル演算、補間。
2. **リアルタイム描画ループ**: Canvas/WebGL の毎フレーム描画。
3. **イベント駆動の入力ハンドリング**: `addEventListener` 内の直接更新。
4. **副作用が本質**: DB書き込み、API呼び出し。

---

## 2. 実装パターン (Template)

### 2.1 基本形 (Eager)

```js
function domain(constraints = {}) {
  // (1) 全可能世界を生成
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      const derived = compute(a, b);
      allWorlds.push({ a, b, ...derived });
    }
  }

  // (2) 制約でfilter
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }

  // (3) 結果整形
  if (worlds.length === 0) return { _contradiction: true };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```

### 2.2 高度な適用パターン

#### A. 複合ステートの直積 (State Machine Folding)
独立した状態を個別の `if` で管理せず、直積で1つの複合ステート（世界）として生成し、派生フラグを一括定義する。
(`action-demos.js` デモ6 参照)

#### B. 状態遷移の畳み込み (Transition Folding)
「現在状態 × 入力 → 次状態」の遷移ロジック自体を畳み込む。特定のステートに遷移する全条件を逆引き可能にする。
(`action-demos.js` デモ7 参照)

---

## 3. 合成と多段化 (Composition)

- **pipe**: 直列。前段の出力を次段の制約に積む。
- **join**: 並列直積。複数ドメインの世界を直積し、跨ぎ制約でfilter。
- **meta**: 階層。上位制約（戦略）が下位（行動選択）の探索空間を縮小。

---

## 4. LLM への具体的指示

1. **コードを書く前に判定せよ**: 逆引きが必要か？ 離散ドメインか？
2. **構造**: `for` ループでの世界生成を最優先し、`if` は filter 処理（インフラ層）に隔離せよ。
3. **検証**: 順引きだけでなく、必ず逆引きクエリでの挙動を確認せよ。
4. **報告**: 「逆引きで何が可能になったか」をユーザーに報告せよ。

---

## 5. 参考資料

| ファイル | 内容 |
|---|---|
| `constraint-janken.js` | 最小実装。**まずこれを読め** |
| `action-demos.js` | 9アクションゲームアルゴリズム。L3制約ライブラリ層 |
| `action-demos-ui.js` | プレイアブル化。L1+L4手続き的実装との対比 |

---
**Authored by**: 蒼山りと (Aoyama Rito)
<!-- [/ai_s_emblem: Constraint-Folding-Master] -->
