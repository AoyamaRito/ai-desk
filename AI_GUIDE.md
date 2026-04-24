# AI-Desk - AIアシスタント向けガイド

このドキュメントは、AIアシスタント（LLM）が `ai-desk` によって管理されているコードベースを効率的に操作・編集するためのガイドラインです。

---

## §11. AI Drives All

AI writes the code.
AI structures the file.
AI names the sections.
AI generates the metadata.
AI reads the code.
AI rewrites when intent changes.

Human declares intent.
Tools serve the AI.

This section governs projects where the codebase is AI's domain by default.
v3.5 §0–§10 remain fully in force; this section replaces only §4 Locality, §4 Blueprint, and §5 Rewrite with AI-driven equivalents.

### 11.1 Division of Labor

| Actor | Role |
|-------|------|
| **Human** | Declares intent. Reviews outcomes. |
| **AI** | Writes, structures, annotates, refactors all code. |
| **Tool (ai-desk)** | Serves the AI. Manages emblem boundaries, metadata, filtering, and partial replacement on AI's behalf. |

The human does not write code.
The human does not structure files.
The human does not annotate sections.
These belong to the AI.

### 11.2 Single Logic File by Default

One project's logic lives in one file. Emblems divide the file into AI-managed sections.

**Scope of "single file":** The principle applies to the logic layer (e.g. `app.js`). Structure (HTML) and presentation (CSS) are separate files by nature — they are not logic and do not benefit from colocation. A typical project is therefore three files: one HTML, one CSS, one JS. The JS file is the one governed by emblem management.

Multiple logic files are permitted as exceptions (library extraction, oversized projects), but the default is single-file. The rationale is identical to v3.5 §4 Locality, applied at the emblem level: AI works best within a single coherent context.

**Size guideline:** The logic file should stay within approximately 1/3 of the AI's context window. For current models (~200K tokens), this means roughly 2,000–3,000 lines of JS. Beyond this, consider extracting a stable, rarely-changed section into a separate file — but only when the file actively hinders AI performance, not preemptively.

### 11.3 Emblem Structure

Emblems are AI's units of code organization.

```
// [ai_s_emblem:#<importance>#<purity>#<category> Name]
  // ... code ...
// [/ai_s_emblem: Name]
```

- Emblems are flat (no nesting).
- Emblem names are unique within a file.
- All metadata is AI-generated. The human does not write emblem headers.

### 11.4 Metadata Axes

AI annotates each emblem along orthogonal axes. Each axis serves a specific filter or sort operation performed by ai-desk.

**Importance** (3 levels): role weight in the project.
- `#high` — domain core (parsing, state transitions, validation)
- `#mid` — control and connection (CLI, bridges, I/O handlers)
- `#low` — auxiliary (constants, templates, configuration)

**Purity** (optional): side-effect status.
- `#pure` / `#impure` — applied only to function-bearing emblems where the distinction aids navigation
- Many projects will not use this axis. Its absence is normal, not a deficiency. Apply only when a file mixes pure computation and I/O-heavy code in ways that benefit from filtering.

**Category**: functional kind.
- Layer tags: `#physical` / `#intent` / `#logic` / `#draw` (per v3.5 §2)
- Bridge tag: `#bridge` (per v3.5 §3)
- Project-specific tags: `#cli` / `#config` / `#ui` etc.

Axes are orthogonal. New axes are added when ai-desk needs a new filter or sort key, and when the new axis is independent of existing ones.

### 11.5 Naming Conventions as AI's Self-Discipline

v3.5 §4 Pure Naming and related conventions are reinterpreted under this section.

These conventions are not rules the human follows.
They are rules **the AI follows when generating code**, so that AI's own future reads remain unambiguous.

The naming convention and the metadata tag carry the same information in different forms:
- The **name** is what the AI writes when producing code.
- The **metadata** is what ai-desk writes when annotating structure.

Both are AI's outputs, in different layers, for different machine consumers. They are not redundant; they are translations.

### 11.6 ai-desk as Supporting Infrastructure

ai-desk supports §11 by providing emblem-aware operations. It is **recommended but not mandatory** — AI agents with direct file access (e.g. Claude Code with Read/Edit tools) can operate on emblem-structured files without ai-desk.

**Core operations (implemented):**

```
ai-desk app.js skeleton              # Structure overview
ai-desk app.js focus Core-Parser     # Extract one emblem
ai-desk app.js apply patch.js        # Replace emblems by name
```

These three operations are the proven minimum for ai-desk workflows.

**Extended operations (future):**

```
ai-desk app.js skeleton --sort=importance
ai-desk app.js skeleton --filter=logic
ai-desk app.js skeleton --filter=high,mid
```

Sort and filter would enhance navigation of large files but are not preconditions for §11. The emblem structure itself — flat, named, annotated — is what makes §11 functional, regardless of which tool reads it.

**When ai-desk is valuable:** When the logic file exceeds what the AI can comfortably hold in a single read (~1,000+ lines), ai-desk's skeleton and focus operations save significant context. Below that threshold, direct file access is equally effective.

### 11.7 Relation to v3.5

§11 replaces:
- **§4 Locality Over DRY** → locality unit drops from file to emblem
- **§4 The Map (Blueprint)** → static description gives way to ai-desk skeleton output
- **§5 Rewrite by Default** → file-wide rewrites give way to emblem-scoped apply; the underlying *Scrap & Build* spirit (instant debt clearance) carries over at finer granularity

§11 preserves:
- §0 Design assumptions
- §1 Zero-Dependency / Zero-Server
- §2 Four-layer architecture (now expressed via emblem category tags)
- §3 Explicit Bridges (now annotated as `#bridge`)
- §4 Pure Naming (reinterpreted as AI's self-discipline per 11.5)
- §6 Performance and Reliability
- §7 Security Consequences
- §8 Network Principles
- §9 Authorization and Cryptographic Proof
- §10 Key Rotation

§2 and §3 are not merely preserved but *strengthened* by §11: their logical structure becomes machine-readable through emblem categories, enabling layer-wise focus operations.

**Version**: §11 v1.1
**Date**: 2026-04-23
**Author**: Hiroyuki OKINOI (蒼山りと), Claude
**v1.1 changes**: §11.2 scoped to logic files, added size guideline; §11.4 Purity marked optional; §11.6 downgraded from mandatory to recommended, separated core/future operations

---

## 1. 基本思想：AIネイティブ・マニフェスト
`ai-desk` は **「AIはローカルコンテキストに依存する」** という前提に基づいて構築されています。
- **Locality over DRY (局所性を重視):** コードを細かすぎるファイルに分割すること（フラグメンテーション）は、AIのコンテキストを破壊する最大の敵です。
- **Single-File Principle (単一ファイル原則):** ファイルの境界は変更しにくい「ギプス（石膏）」のようなものです。
- **Cognitive Boundary Design (認知境界の設計):** 物理的なファイル分割ではなく、単一ファイル内に仮想的な境界を設けることでコードを管理します。
- **目的:** AI秘書（あなた）がコンテキストを見失うことなく、最高のパフォーマンスを発揮できるように「机の上（コードの配置）」を整理することです。

## 2. セクションのフォーマット（Emblem Edition）
`ai-desk.js` では特別なコメント構文を用いて、論理的なチャンク（塊）に分割されます。

```javascript
// [ai_s_emblem:#Importance#Tag Name]
function myLogic() {
  // コード...
}
// [/ai_s_emblem: Name]
```
- **`Importance`**: 例: `#high` (コアロジック), `#mid` (ヘルパー/UI), `#low` (初期化/ボイラープレート)。
- **`Tag`**: 例: `#api`, `#ui`。関連する機能をグループ化するためのタグ。
- **`Name`**: セクションの識別名。パッチ適用のためのユニークな名前を指定してください。

## 3. 推奨される AI ワークフロー

`ai-desk` 管理下のファイルを修正するよう指示された場合は、以下のフローに従ってください。

### ステップ 1: 構造の把握
ファイルが巨大な場合、全体を一度に読み込むとトークンを浪費します。まずは `skeleton` モードを使って、アーキテクチャの概要を把握してください。
```bash
node ai-desk.js target_file.js skeleton
```
*これによりセクションのコード本体が折りたたまれ、全体の構造と各セクションの行数だけを効率的に確認できます。*

### ステップ 2: 必要な箇所へのフォーカス
特定のセクション（例：`MainLogic`）を編集する場合、`focus` モードを使用します。
```bash
node ai-desk.js target_file.js focus MainLogic
```
*指定した名前のセクションのみが標準出力されます。*

### ステップ 3: 変更の適用（パッチ方式）
巨大なファイルに対して、直接的な編集を試みる代わりに、**変更したセクションだけを含む「パッチファイル」を作成**してください。

**パッチファイルの例 (`patch.js`):**
```javascript
// [ai_s_emblem:#high#logic MainLogic]
function mainLogic() {
  // AIが生成した新しい最適化ロジック
  return items.reduce((sum, i) => sum + i.price, 0);
}
// [/ai_s_emblem: MainLogic]
```

### ステップ 4: パッチの適用
`apply` モードを使用します。`ai-desk` は名前をキーにして、ファイル内の該当セクションだけを安全に上書きします。
```bash
node ai-desk.js target_file.js apply patch.js
```

## 4. AIへのベストプラクティス
- **名前の一意性を保つ**: ファイル内に同じ名前のセクションが複数ある場合、`apply` は安全のためにスキップされます。
- **ヘッダーは正確に**: `apply` 用のパッチを作る際は、元のヘッダー (`// [ai_s_emblem:... Name]`) を正確に維持してください。
- **新しいセクションの追加**: 現時点では、`apply` は既存のセクションの置換のみをサポートしています。新しいセクションの追加は手動で行ってください。

---

## §12. 3Dplus時空座標系 (3Dplus Spacetime Coordinate System)

AIが空間・時間・存在を制御するための「究極の聖域」です。

### 12.1 核心原則：純粋一方向変換 (Pure One-Way Transformation)
**「ローカル座標」と「ワールド座標」を絶対に混ぜない。**
演算の過程でこれらが混在することを「汚染」と定義し、厳格に排除します。

### 12.2 3Dplus の定義
座標とは空間だけではありません。「いつ、どれくらい、存在するか、どう見えるか」を含む以下の全要素を「座標」として扱い、親から子へ一方向に投影します。
- **`x, y, z, angle`**: 空間的位置・回転・スケール
- **`t` (Time)**: 時間の進み（tScale）とズレ（tOffset）
- **`a` (Alpha)**: 存在の濃度（透明度）
- **`v` (Visibility)**: 論理的な生存フラグ（Active状態）
- **`texObj, mesh, billboard`**: テクスチャ、メッシュ、ビルボードフラグの物理的投影
- **`effect, effectColor, effectPower`**: シェーダー効果（ダメージ点滅、波打ち等）の投影

### 12.3 深さベースの一括投影 (Level-based Batch Projection)
ツリーを再帰で辿ることを禁止します。
1. 全ノードを「深さ(Depth)」ごとに配列化する。
2. 深さ0から順に、単純なループで投影計算を行う。
3. **「自分の計算時には親のワールド状態が必ず確定している」**ことを物理的に保証します。

### 12.4 AIの責務
- **Logic（意図）**: AIは `node.local` のみを書き換えます。Worldを直接触ることは「禁忌」です。コマアニメーションの進行もエフェクト開始も、すべて `local` の数値を操作するだけで行います。
- **Draw/Sensor（実行）**: AIは `node.world` のみを参照します。**Draw層は「渡された World属性を一切の分岐（if文）なく無心で描画するだけのダム・ターミナル」でなければなりません。** 特定のIDや名前に依存した描画分岐は厳禁です。
- **時空・演出操作**: スローモーション、フェードアウト、親子連動、状態異常のエフェクト伝播は、すべて「親のLocal」をいじるだけで完結させます。


