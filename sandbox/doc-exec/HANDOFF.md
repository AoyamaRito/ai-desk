# doc-exec 引き継ぎ資料 (2026-05-02 作成)

次のセッションが cold start からでも続きが拾えるように。

---

## いまどこ

**実行型ドキュメント (executable doc) の概念検証中**。
sandbox/doc-exec/ で MVP を組み、Bible (AI_NATIVE_MASTER_BIBLE.md) で実測した。

### 確定した設計判断

1. **モデルは「関数呼び出し」ではなく「マクロ展開」**
   - LLM には call stack がない。spotlight に入っているか／いないかしかない
   - C プリプロセッサ #include / マクロ / LaTeX \input{} と同型

2. **Inline > Extract をドキュメントにも適用**
   - 同じセクションが複数箇所で expand されるのは無駄ではない
   - LLM ローカリティ (±300行) を保護するための「意図的な再読」
   - Bible §0.1 (Heavy Function) と一貫

3. **近接展開抑制 (proximity suppression)**
   - 同一セクションが直近 N 行以内に展開済みなら skip
   - デフォルト N=300 (Bible §0.0 spotlight)
   - --max=0 で抑制無効、--max=N で閾値変更
   - スポットライトを宣言的にチューニング可能

4. **ドキュメントは AI 用と人間用を分離**
   - 今は AI 用 (expand) のみ整備中
   - 人間用 (humanize) は将来別ツール (TOC + 階層復元 + 重複なし)

### 未確定／要再検討

5. **依存マーカーをどう書くか** (重要・未解決)
   - 案 A: `<!-- @expand: name -->` (現状の MVP)
   - 案 B: `§N.M` 自然言語参照を auto-detect
   - 案 C: `**bold**` を用語依存として扱い glossary 連携
   - 案 D: 用語リストを user が確定 → 単語そのもので auto-detect (bold 不要)
   - **データから判明: 案 C は現 Bible では不成立** (詳細下記)

---

## 失敗した試み・観察

### 1. Bible 移行で content loss
build-docs.js を AI_NATIVE_MASTER_BIBLE.md に書かせたら DOCS_REAL.js に未移行の §4/§4.5/§5/§6/§7 が消えた。即 git restore で復旧。教訓: **ソース未完成のままビルドターゲットを正本に向けてはいけない**。

### 2. Bold = 用語依存モデル ← データで否定
extract-bolds.js で実 Bible の `**...**` を全集計:

```
Total bold occurrences: 73
Unique terms:           72
Repeated (≥2 times):     1   ← 「同じ入力JSON」のみ
```

98.6% が一回限り。**Twin** すら 1 回しか bold されていない。bold は「リスト項目見出し + 一発強調」に消費されており、用語マーカーとして機能していない。

→ 案 C はこのままでは無理。Bible 書き直しか別マーカーが要る。

### 3. trace.js (topological 順) は採用しなかった
expand.js (マクロ展開) の方が LLM ローカリティに合う。trace.js は legacy として残してあるが、今後は expand.js が primary。

---

## 次に走るならどれか

優先順:

**P1. 用語依存の正しい signal を決める**
- 案 D が一番労少なく効果ありそう (user 確定の用語リスト → 自動検出 / bold 関係なし)
- 用語リスト候補: Twin / Emblem / Bridge / Heavy Function / REAL / SHADOW / Constraint Folding / Layer / ai-desk / ai-eyes / Dumb Relay / Event Sourcing / 複式数学 / Inline-over-Extract
- glossary.md を user が手で書く → expander が prose 中の出現を検出

**P2. 自動 deps 推論 (§N.M ベース)**
- 既存の Bible との互換性 ◎
- glossary とは独立に実装可
- 案 D と併用も可

**P3. doc-skeleton モード**
- 全セクション + deps を一覧化
- ai-desk skeleton の md 版

**P4. adaptive 抑制**
- 短いセクションは常に inline、長いセクションは抑制積極的
- token budget 制御の前段

**P5. e2e ランナー**
- goal + expanded + 成功条件 → LLM 実行 → 検証
- doc-exec の最終形

---

## ファイルマップ (sandbox/doc-exec/)

| ファイル | 状態 | 役割 |
|---|---|---|
| README.md | 仕様書 | doc-exec フォーマットの公式ドキュメント |
| example.md | 動 | @deps: 形式 (旧 trace.js 用、参考) |
| example-expand.md | 動 | @expand: 形式 (現行) |
| parse.js | 動 | md → AST (~50 行) |
| trace.js | 動 (legacy) | topological 順並べ (採用見送り) |
| expand.js | 動 | マクロ展開 + 近接抑制 (現行 primary) |
| convert.js | 動 | 既存 md → doc-exec 形式 |
| extract-bolds.js | 動 | bold 候補抽出 (案 C 検証用) |
| converted-bible.md | 生成物 | Bible auto-converted (16 sections) |
| expanded-section-7.md | 生成物 | section-7 を auto-expand したサンプル |

---

## main repo 側の状態 (uncommitted)

doc-exec とは独立に進んだ作業がある:
- `#for_human` タグ追加 (KNOWN_TAGS)
- `view` モード追加 (multi-file read-only)
- build-docs.js を docs.config.json 駆動に refactor
- DOCS_REAL.js に §4-7 移行 (placeholder fix も)

これらは sandbox の実験とは独立に commit/push 候補。

---

## 重要な気づき

**ユーザーの観察**: 「ドキュメントこそ肥大化して管理できなくなりつつある」
これがコードに対する ai-desk と同型の課題。doc-exec はその解の試作。

**LLM のドキュメント読みは第三のモデル**:
- コード実行 (call/jump) でも
- 人間の読書 (一度きり記憶) でもなく
- **spotlight 内に何が入っているか**で支配される

設計言語をまだ業界が持っていない。doc-exec の貢献はそこに概念を与えること。

---

## 引き継ぎコマンド集

```bash
cd sandbox/doc-exec/

# 全セクションの構造確認
node parse.js converted-bible.md

# Bible §7 を expand してみる (近接抑制 default)
node expand.js converted-bible.md section-7

# 抑制閾値を変える
node expand.js converted-bible.md section-7 --max=20
node expand.js converted-bible.md section-7 --max=0

# bold 候補を再抽出 (Bible 書き換え後の比較に使える)
node extract-bolds.js ../../AI_NATIVE_MASTER_BIBLE.md

# 既存 md を doc-exec 形式に変換
node convert.js any-doc.md > converted.md
```

---

## 一行まとめ

> **マクロ展開 + 近接抑制で AI ローカリティ最適化はできる。だが「何を依存とするか」のマーカー選びが未確定。Bold は実データで否定された。次は用語リスト確定 or §N.M 自動検出から。**
