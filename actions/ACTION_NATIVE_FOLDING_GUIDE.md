# ACTION-NATIVE 畳み込みガイド — アクションゲーム完全制御編

> 出典: AI-Native Master Bible §0.15 拡張版
> 目的: 複数変数からなる複雑なステートを「多段畳み込み」で処理し、バグの発生を物理的に封鎖する。

---

## 1. 核心概念：if文を捨て「世界」を畳み込め

アクションゲームのバグ（地面に埋まる、あり得ない技が出る等）の9割は、`if/else` の書き漏らしから生まれる。
本ガイドでは、**「全パターンの組み合わせ（世界）を生成し、ルールに合わないものを消す」**という逆転の発想でこれを解決する。

---

## 2. 三層の畳み込みアーキテクチャ

単一の大きなステートマシンを作るのではなく、以下の三段階でキャラの状態を決定する。

### 第1層：ドメイン個別畳み込み (Individual Domains)
身体の物理状況、取っているアクション、付加的な属性を個別に計算する。

- **物理ドメイン (Physics)**: `[GROUND, AIR, WALL, WATER]`
- **アクションドメイン (Action)**: `[IDLE, MOVE, ATTACK_A, ATTACK_B, DAMAGE]`
- **属性ドメイン (Attribute)**: `[NORMAL, INVINCIBLE, SUPER_ARMOR]`

### 第2層：合成畳み込み (State Join / State Resolution)
個別のドメインを掛け合わせ（直積）、「今、矛盾のない真の状態」を確定する。

- **合成ルール（制約）の例**:
  - 「`AIR`（空中）」かつ「`SQUAT_ATTACK`（しゃがみ攻撃）」の組み合わせは **消滅させる**。
  - 「`DAMAGE`（被弾）」かつ「`NORMAL`」なら仰け反るが、「`SUPER_ARMOR`」なら仰け反らない世界を残す。

### 第3層：遷移畳み込み (Transition Folding)
「今の状態 × 入力」から「次の状態」を**逆引き**で決定する。

```js
// 遷移可能世界（Transition Worlds）の定義
const TRANSITIONS = [
  { from: 'IDLE',     input: 'BTN_A', next: 'ATTACK_A', priority: 1 },
  { from: 'ATTACK_A', input: 'BTN_B', next: 'ATTACK_B', priority: 2 }, // コンボ
  { from: 'ANY',      input: 'HIT',   next: 'DAMAGE',   priority: 99 } // 強制割り込み
];
```

---

## 3. 実装のテンプレート (L3 Logic層)

```js
function resolveCharacterState(current, input, physics_env) {
  // 1. 全可能世界の生成 (Action x Physics x Attribute)
  let worlds = [];
  for (const a of ACTIONS) {
    for (const p of PHYSICS) {
      for (const t of ATTRIBUTES) {
        worlds.push({ action: a, physics: p, attr: t });
      }
    }
  }

  // 2. 制約によるフィルタリング (ここでバグを殺す)
  worlds = worlds.filter(w => {
    if (w.physics === 'AIR' && w.action === 'SQUAT') return false; // 空中しゃがみ禁止
    if (physics_env.isGrounded && w.physics === 'AIR') return false; // 接地中は空中フラグ禁止
    // ...その他のルール
    return true;
  });

  // 3. 入力に基づいた遷移の抽出
  const possibleTransitions = TRANSITIONS.filter(t => 
    (t.from === current.action || t.from === 'ANY') && t.input === input
  );

  // 4. 最適な世界の決定
  // 遷移先があればそれを、なければ現在の状態を維持する世界を返す
}
```

---

## 4. なぜ「面白いようにバグが取れる」のか？

1.  **「書き忘れ」の消滅**: 
    「空中ならこの技は出せない」というルールを1つ書けば、あらゆる状況でその組み合わせが封鎖される。
2.  **逆引きデバッグ**: 
    「なぜか空中でジャンプのポーズになった」という時、プログラムに「`physics: AIR` かつ `action: JUMP` になるルートを全部出せ」と問えば、原因が1秒で判明する。
3.  **格ゲー級の精度**: 
    技のキャンセル（弱→強）や先行入力の受付を、データ（遷移表）として管理できるため、複雑なコンボシステムが数行の filter で完結する。

---

## 5. 学生・エンジニアへのメッセージ

**「if文で迷路を作るのをやめて、ルールの地図を作れ。」**

この手法は、コードの行数を減らすためのものではない。
**「自分の脳が把握できない組み合わせの隙間」を、数学的に埋めるための武器**である。
複雑なアクションを実装して頭がパンクしそうになった時、このガイドに戻り、世界を畳み込み直せ。

---
**参考資料:**
- `/Users/AoyamaRito/PJs/ai-desk/PROMPT_constraint_folding.md` (理論編)
- `constraint-janken.js` (最小実装例)
