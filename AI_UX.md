# AI Coder UX Guide for ai-desk

## 1. コア・コンセプト：抽出と注入 (Extract & Inject)
`ai-desk` は、巨大な単一ファイルをAIが扱うための**「覗き窓」**と**「注射器」**です。
- **ファイルを物理的に分割しない。**
- **ファイル内の順序を物理的に入れ替えない。**
- **セクション名で一意に識別する。**

## 2. セクション形式 (Emblem Edition)
```javascript
// [ai_s_emblem:#Importance#Tags Name]
function example() {
  // コード...
}
// [/ai_s_emblem: Name]
```
- **Name**: (必須) AIがセクションを特定するためのキーです。一意でセマンティックな名前をつけてください。**英数字とハイフンのみ使用可**（日本語不可）。
- **#Importance**: `#high` (コア), `#mid` (ヘルパー), `#low` (初期化)
- **#Tags**: (任意) 関連する機能グループ (`#api` など)

## 3. AI ワークフロー（3ステップ）

### Step 1: 構造の把握 (skeleton)
ファイル全体の目次（セクション名の一覧）を確認します。
```bash
node ai-desk.js target_file.js skeleton
```
*出力された名前を見て、どこを修正すべきかアタリをつけます。*

### Step 2: 特定部分の読み取り (focus)
必要なセクションの中身だけを抽出します。
```bash
node ai-desk.js target_file.js focus TargetSectionName
```
*指定した名前のセクションのコードのみが標準出力されます。*

### Step 3: 部分的な修正の適用 (apply)
修正したセクションだけを含む「パッチファイル」を作成し、適用します。
```bash
# 1. パッチファイルを作成
cat << 'EOF' > patch.js
// [ai_s_emblem:#high#core TargetSectionName]
function modifiedCode() {
  // 新しいロジック...
}
// [/ai_s_emblem: TargetSectionName]
EOF

# 2. 適用
node ai-desk.js target_file.js apply patch.js
```
*元のファイルの該当セクションが「名前一致」で安全に上書きされます。*

## 4. AIへのベストプラクティス (Must Read)
- **名前の重複を避ける**: ファイル内に同じ名前のセクションが複数ある場合、意図しない破壊を防ぐため `apply` は自動でスキップされます。
- **ヘッダーは正確に**: `apply` 用のパッチを作る際は、元のヘッダー (`// [ai_s_emblem:... Name]`) を正確に維持してください。
- **新しいセクションの追加**: パッチ内に新しい（既存ファイルに存在しない）名前のセクションを含めても、現在は適用されません。
- **行番号を信じる**: 物理順序は変わらないため、Linterやエラーログの行番号は常に正確です。
