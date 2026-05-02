# doc-exec — 実行型ドキュメント実験

捨てフォルダ。動くことすら保障しない。本体に取り込む価値が出るまでここで暴れる。

## コンセプト

ドキュメントを「関数の集まり」として書く。AI は目的のセクションを起点に、依存関係を辿って必要な範囲だけ読む（コード読解と同型）。

## フォーマット仕様（最小）

- ベース: Markdown (.md)
- セクション区切り: `---`（horizontal rule）
- 関数名 = `#` heading（H1）
- メタデータ: heading の直前 (or 直後) の HTML コメント `<!-- @key: value -->`
  - `@deps: name1, name2` 依存宣言
  - 将来: `@verify`, `@goal`, `@author` 等

```md
<!-- @deps: ai-desk-basics, emblem-tags -->
# add-feature

新機能を追加する手順。
1. skeleton で構造把握
2. focus で対象 emblem を読む
3. patch.js を書く
4. apply で原子的適用

---

# ai-desk-basics

ai-desk は ...

---

<!-- @deps: ai-desk-basics -->
# emblem-tags

Emblem タグは ...

---
```

HTML コメントは Markdown レンダラー（GitHub等）で非表示。機械可読のまま。

## 想定モード（順次実装）

| モード | 用途 | ステータス |
|---|---|---|
| `parse` | md を AST に解析（section name → content + deps） | MVP 済 |
| `trace <name>` | 指定 section から依存を再帰解決、トポロジカル順で出力 | MVP 済 |
| `cycle-check` | 循環依存の検出 | trace 内で実装 |
| `e2e <goal>` | LLM に渡して目的完遂を検証 | 未着手 |

## 使い方（現状）

```bash
node parse.js example.md             # セクションとdepsを表示
node trace.js example.md root-task   # 指定セクションから依存解決して内容出力
```

## 設計方針

- Zero-Dep（fs と path だけ）
- ai-desk 本体には触らない（ここが安定したら export）
- 失敗ログ歓迎、何度でも捨ててやり直す
