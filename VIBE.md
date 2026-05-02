# Vibe Log

実作業ブランチ集の入口。AI時代はコード変更が速すぎて feature branch が間に合わない（できあがる前に主流が動いている）。
だからブランチは **マージ前提ではなく記録前提** で残す。やったこと・思いついたこと・捨てた案を雑に置く場所。

## ルール
- ブランチ名: `vibe/<YYYY-MM-DD>-<topic>`
- **動くことすら保障しない**。テスト通過も保障しない。途中で投げ出していい
- main にマージしない／削除しない／rebase しない
- 形式自由。コミット粒度も自由。後から検索できればいい
- 失敗ログ歓迎。やめた理由が一番価値ある
- このブランチのコードを参考にしないこと（壊れている前提で扱う）

---

## Sessions

### 2026-05-02 — ai-desk cleanup & redesign
やったこと:
- 著者署名 + SPDX-License-Identifier を主要 .js 5本に追加
- DISCUSSION_constraint_library.md の署名にペンネーム追加
- ai-desk.js: `apply` モードのエラーメッセージ template literal 化（`${EMB_MARK}` がリテラル出力されていたバグ）
- ai-eyes.js のタグを正規化 (#core/#docs/#test/#entry → #L1/#OutOfLayers)
- KNOWN_TAGS に aspect 軸 `#auth` `#security` を追加（語彙クリープは customTags で抑制）
- `apply` を pre-flight + atomic + `--dry-run` に再設計（旧 skip 継続を廃止）
- `skeleton` に行番号 `(L274-587)` 付与
- `miner` モード削除（CLI 表面 6→5）
- ai-desk.test.js を 16→19 テストに拡張

判断・気づき:
- Grok から「regex tag操作が O(N²) で遅い」と指摘されたが、実運用域（最大 32KB ファイル）でサブミリ秒なので無視。むしろ遅さは「ファイルを大きくしすぎるな」という設計圧として機能している
- aspect タグは2個だけにした。`#cache #log #db ...` と無限に増やしたくなる誘惑を断つ。プロジェクト固有は `customTags` 経由
- miner モードは「ファイル読んでプロンプト足すだけ」で AI が `Read` で代替可能だったので削除
- apply の「skip して継続」は中途半端な状態を作るので Bible §0.0 違反 → atomic 化
