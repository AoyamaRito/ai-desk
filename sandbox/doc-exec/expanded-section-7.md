# section-7

> 7. AI専用の複式数学 (§Double-Entry Verification)

ブラックボックス化しやすい外部システム（GPU/WebGL, 物理エンジン, 外部API）に対して、AIは以下の「複式数学」による検証を行わなければならない。実装単位は §4.5 の **Twin** である。

# section-4-5

> 4.5 Twin 規約 (§Verification Twin)

任意の層は **Twin（検証双子）** を持てる。Twin は元層と同じ入力を取り、純粋関数でJSONを返す検証実装である。複式数学（§7）の実装単位はこの Twin である。

1. **直交概念**:
   Twin は層（L1〜L4）と直交する。新しい層ではなく、層に付随する性質である。`L1〜L4` がデータフローの方向を定義するのに対し、Twin は「効率実装」と「検算実装」のペア性を定義する。
2. **表記**:
   `L<n>*` または `<name>_twin` と書く。例: `L4*`、`render_twin()`、`cpu3d.js (L4 twin)`。
3. **共通契約**:
   - 元層と**同じ入力JSON**を取る（二重定義禁止）
   - **純粋関数**である（DOM/GPU/I/O/乱数/時刻に触れない）
   - **段階別JSON**を返す（どの段で乖離したかを特定可能にする）
   - 元層との**突合関数**（`assert_xxx`）が独立に存在する
4. **典型的なTwin**:
   - **L4\* (Draw twin)**: GPU/Canvas描画と並走するCPU側の透明な算数（`3dplus/cpu3d.js`）
   - **L3\* (Logic twin)**: 物理エンジン・複雑Reducerの結果を別実装で検算
   - L1/L2 の Twin は稀（DOM/Intentは比較的薄いため通常不要）
5. **Twin と SHADOW の違い**（§3との混同を避ける）:
   - SHADOW: REALから派生する**表示・操作用の派生値**。一方向変換の結果。
   - Twin: 元層と並走する**検算実装**。突合のために存在する。
   両者は別の概念であり、`SHADOW_xxx` と `xxx_twin` を混同してはならない。

# section-3

> 3. REAL / SHADOW 規約 (§状態の純粋性)

同期漏れバグを物理的に絶滅させる。
- **REAL_<名前>**: 唯一の書き換え可能な真実。
- **shadow(REAL, 用途)**: REAL から作る使い捨ての派生値。**「保持（変数への保存）禁止」**。使う瞬間に生成し、使い終わったら捨てる。
- **一方向変換**: REAL → SHADOW への変換のみを許可。

```js
// REAL_state: L3 が唯一書き換える
const REAL_state = { hp: 100, x: 0 };

// L4: 描画のたびにその場で生成して即捨て（変数に保存しない）
renderHpBar(REAL_state.hp / 100);          // ← shadow（使い捨て）
renderSprite(REAL_state.x * PIXEL_SCALE);  // ← shadow（使い捨て）
```

1. **効率層 (Execution Layer)**:
   通常の開発では、書きやすさと実行効率を優先し、既存のライブラリやGPU機能を活用せよ。ここでの「隠蔽」は実行速度のために許容される。
2. **検証層 = Twin (§4.5)**:
   「バグが疑われる箇所」や「論理的な核心部分」において、AIは自身の認知が及ぶ「透明な重厚関数（ベタ書きされた純粋な算数）」を Twin として並走させよ。
3. **数値による証明**:
   ブラックボックスの出力を信じるな。Twin が算出した純粋な数学的座標（JSON）と、実際の挙動を突き合わせよ。数学的に正しい座標が画面外を指していれば、それは「描画のバグ」ではなく「論理のバグ」であるとAI自ら確信を持って断定できる。

この「効率的な実行」と「透明な検算」の分離こそが、複雑な3D/物理システムにおけるAIデバッグの最終解である。

### 7.1 命名規則 (Pair Naming)

```
効率層:   xxx()             // 実装は何でも可（GPU/物理エンジン/Three.js等）
Twin:    xxx_twin(input)   // 純粋関数。同入力JSONを取りJSONを返す
突合:    assert_xxx(e, t)  // 矛盾を投げる/返す。Zero-Dep
```

モジュール単位でペアにする場合（3dplus型）:
```
effective:  render.js, physics.js
twin:       render.twin.js, cpu3d.js (= L4 twin), physics.twin.js
```

### 7.2 入力契約（同一性の強制）

効率層と Twin は**同じ入力JSON**を受け取らなければならない。二重定義は規約違反である（同じ数学を二度書いたら検算にならない）。

### 7.3 出力契約（段階別JSON）

```js
xxx_twin(input) → {
  stages: { stage1: ..., stage2: ..., stage3: ... },
  result: ...
}
```

「どこで壊れたか」を特定可能にする。`projectScene` の `local→world→view→clip→ndc→screen` がこのテンプレ。

### 7.4 純度規約

Twin は **Zero-Dep / Zero-Side-Effect**:
- DOM / GPU / Canvas / I/O / 乱数 / 時刻に触れない
- 入力JSON → 出力JSON のみ
- 外部ライブラリ依存禁止（自身がブラックボックスを呼んだら検算にならない）

### 7.5 Emblem 拡張

`#verify` を `#Category` の正式な値として追加する（§1 Emblemの定義参照）:

```javascript
// [EMBLEM:#high#verify ProjectScene]
// [EMBLEM:#high#draw    WebGLRenderer]
```
(注意: `EMBLEM` は実際のソースでは `ai_s_emblem` と表記する。本ドキュメントソース内では check と衝突しないよう placeholder にしている。)

### 7.6 ペア宣言

ファイル冒頭または関数JSDocで、効率層と Twin の対応を明示する:

```js
// @effective: ../my_webgl/render.js
// @twin:      cpu3d.js
```

これにより AI は「片方を編集する時、もう片方も同期更新せよ」を自動判定できる。

***
**Version**: 3.5 (Final Architecture Edition)
**Date**: 2026-05-01
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
