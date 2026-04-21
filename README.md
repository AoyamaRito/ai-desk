# ai-desk

> 大規模単一ファイル開発のためのAIネイティブツール (Name-Only Edition)

## 3行で

- 何千行もあるファイルを「セクション名」で管理
- AIコーダーが必要な部分だけを抽出(focus)して上書き(apply)
- トークン消費を最小化しつつ、物理的な行番号やGit差分を汚さない

## 問題

AIコーダーは大規模ファイルが苦手:
- ファイル分割 = コンテキストを失う
- 全体読み込み = トークンを浪費する
- 単純な置換 = インデントや行番号のズレで破壊する

## 解決：抽出と注入 (Extract & Inject)

セクションマーカーでコードを区切り、**「名前(Name)」**で管理します。
ファイルの物理順序を一切変更しないため、安全です。

```javascript
//{ 01:AuthModule @high #core
function login(user, pass) {
  // ...
}
//}

//{ 02:UserModule @mid #feature
function getProfile(id) {
  // ...
}
//}
```

## インストール

```bash
# グローバル
npm install -g ai-desk

# またはローカル
npm install ai-desk
```

## 使い方（AI向け3ステップ）

### 1. 構造を把握（トークン節約）

```bash
ai-desk app.js skeleton
```

出力:
```
//{ 01:AuthModule @high #core
  // [Collapsed: 50 lines]
//}
//{ 02:UserModule @mid #feature
  // [Collapsed: 30 lines]
//}
```

### 2. 必要なセクションを抽出して読む

```bash
ai-desk app.js focus AuthModule
```
*指定したセクションのコードだけが標準出力されます。*

### 3. 編集してパッチを適用

パッチファイル (`patch.js`) に修正したセクションを書いて：
```bash
ai-desk app.js apply patch.js
```
*元のファイルの該当箇所が「名前一致」で上書きされます。*

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `skeleton [Name...]` | 構造のみ表示（折りたたみ）。名前を指定するとそこだけ展開。 |
| `focus [Name...]` | 指定した名前のセクションだけを抽出して表示。 |
| `apply <patch>` | パッチファイルのセクションを名前一致で適用。 |
| `test` | 内部構造のデバッグ出力。 |

## 安全設計

- **ランダムUIDの廃止**: 人間にもAIにも分かりやすいセマンティックな「名前」だけを使用。
- **重複防御**: 同じ名前のセクションが複数存在する場合は、破壊を防ぐためパッチ適用をスキップします。
- **In-Place Mutation**: 物理ファイルの順序は変更しないため、Linterの行番号やGitのDiffは常に正確です。

## 対応形式

| 言語 | 開始 | 終了 |
|------|------|------|
| JS/TS/Go/C | `// { ...` | `// }` |
| HTML | `<!-- { ...` | `<!-- } -->` |
| CSS | `/* { ...` | `/* } */` |
| Python/Shell | `# { ...` | `# }` |
| VVV形式 | `VVV ...` | `AAA` |

## ライセンス

MIT
