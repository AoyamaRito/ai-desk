# template/ — 新規 AI-Native プロジェクトの starter kit

このフォルダは「新しい ai-desk 流のプロジェクトを始める」ための最小ひな型です。

## 中身

| ファイル | 役割 |
|---|---|
| `CLAUDE.md` | LLM が最初に読む routing(本テンプレ用) |
| `GEMINI.md` | Gemini が最初に読む routing(同上) |
| `app.js` | 単一実装ファイル(Block / Graph / etc. を含むスケルトン) |
| `index.html` | フロント単体起動用 |

## 使い方

```bash
cp -r template/ ../my-new-project/
cd ../my-new-project/
# CLAUDE.md / GEMINI.md / app.js を読んで、自分のドメインに書き換える
```

ai-desk v2 の Bible(`/v2/AiRunAndRead_BIBLE.js`)に従って書き始める前提です。
本リポ外で使う場合は Bible を vendor するか、URL 参照を入れてください。

## 関連

- 本リポ root の [`README.md`](../README.md) — リポ全体の入口
- [`v2/CLAUDE.md`](../v2/CLAUDE.md) — v2 で作業する道標
- [`v2/AiRunAndRead_BIBLE.js`](../v2/AiRunAndRead_BIBLE.js) — 思想の正典
