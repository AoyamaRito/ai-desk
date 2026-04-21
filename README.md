# ai-desk

> 大規模単一ファイル開発のためのAIネイティブツール

## 3行で

- 7000行超のファイルをセクション単位で管理
- AIコーダーが必要な部分だけ読み書き
- トークン消費を最小化

## 問題

AIコーダーは大規模ファイルが苦手:
- ファイル切り替えでコンテキストを失う
- 全体を読むとトークンを消費しすぎる
- 部分編集で意図しない箇所を壊す

## 解決

セクションマーカーでコードを区切り、UIDで管理:

```javascript
//{ AuthModule @high #core $AUTH01
function login(user, pass) {
  // ...
}
//}

//{ UserModule @mid #feature $USER01
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

## 使い方

### 1. 構造を把握（トークン節約）

```bash
ai-desk app.js skeleton
```

出力:
```
//{ AuthModule @high #core $AUTH01
  //{ [Collapsed: 50 lines]
//}
//{ UserModule @mid #feature $USER01
  //{ [Collapsed: 30 lines]
//}
```

### 2. 必要なセクションを読む

```bash
ai-desk app.js focus $AUTH01
```

### 3. 編集してパッチを適用

```bash
# patch.js にセクションを書いて
ai-desk app.js apply patch.js -w
```

### 4. Git前に正規化

```bash
ai-desk app.js restore -w
```

## セクション形式

```
//{ name @importance #tag1 #tag2 $UID
code...
//}
```

| 要素 | 説明 | 例 |
|------|------|-----|
| name | セクション名 | `AuthModule` |
| @importance | 重要度 | `@high`, `@mid`, `@low` |
| #tags | タグ（複数可） | `#core #security` |
| $UID | 一意ID | `$AUTH01`, `$MY_UID` |

## AI ワークフロー

```
1. skeleton  → 全体構造を把握（最小トークン）
2. focus     → 必要セクションを展開
3. 編集      → パッチファイル作成
4. apply -w  → UIDでマッチして適用
5. restore   → git commit前に正規化
```

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `skeleton` | 構造のみ表示（折りたたみ） |
| `focus [$UID]` | @high展開、または指定UID |
| `apply <patch>` | パッチ適用（UID照合） |
| `restore` | git用に順序正規化 |
| `save << name` | ブックマーク保存 |
| `load >> name` | ブックマーク読込 |
| `test` | デバッグ出力 |

## オプション

| オプション | 説明 |
|------------|------|
| `-w, --write` | ファイルに書き込み（デフォルト: stdout） |

## なぜ単一ファイル？

AIコーダーにとって:
- ファイル切り替え = コンテキストロス
- モジュール分割 = 依存関係の把握コスト
- 単一ファイル + セクション = 最適解

## 対応形式

| 言語 | 開始 | 終了 |
|------|------|------|
| JS/TS/Go/C | `//{ ... //}` | |
| HTML | `<!-- { ... --> ` | |
| CSS | `/* { ... */ ` | |
| Python/Shell | `# { ... # }` | |
| VVV形式 | `VVV ... AAA` | |

## テスト

```bash
node ai_desk.js --help    # ヘルプ
node stress_e2e.js        # ストレステスト (15テスト)
node attack_test.js       # エッジケース (13テスト)
```

## ライセンス

MIT
