# doc-exec — 実行型ドキュメント実験

捨てフォルダ。動くことすら保障しない。本体に取り込む価値が出るまでここで暴れる。
ただし、現在は **MVP が 2 段階で動作** しており、肥大化したドキュメントを 1 ファイル化 + 用語依存リスト付与までは安定して再現できる。

このファイルは **他の LLM (Claude / GPT / Gemini 等) がこの実験を引き継ぐための手引き** を兼ねる。

---

## 解こうとしている問題

ドキュメントが肥大化すると AI スポットライト (LLM の局所参照範囲、約 ±300 行) に収まらず、用語の意味や依存関係を辿りきれずに誤読する。
コードの肥大化に対して `ai-desk` が Emblem 単位の局所読み込みで対処したのと同じ問題が、ドキュメント側にも起きている。

doc-exec はその対処の試作。**マクロ展開ではなく依存宣言** (各セクション冒頭に関連用語のリストを置く + 用語定義をバンドル先頭に集約) で AI ローカリティを取り戻す。

---

## 成果物 — `all-docs-deps.md`

これが **AI 単独消費用のメイン出力**。これ 1 ファイルを LLM に渡せば、リポ全 md の主要内容と用語辞書が 1 つの spotlight 視界内で扱える形になっている。

構造:

```
[先頭]   glossary 23 用語定義 (<<Heavy Function>>, <<Twin>>, ...)
         ─ AI が本体を読む前に語彙を脳にロード ─

[本体]   # ai-native-master-bible
           > 原則: <<Heavy Function>> <<Spotlight>> ...
           > 状態: <<Twin>> <<REAL>> <<SHADOW>>
           > 層: <<Layer>> <<L1>> ...
           ...
           [元 Bible の本文がそのまま続く]

         # ai-onboarding
           > 原則: ...
           [元 onboarding の本文]

         ...

[末尾]   最後のセクションが本文のまま終わる (余計な append なし)
```

---

## 受け手 (読む LLM) として知るべきこと

1. **`<<term>>` は用語マーカー**。本文中に出現したら、先頭 glossary の `# <<term>>` セクションを参照すれば定義が引ける。
2. **セクション冒頭の `> 原則:` `> 状態:` `> 層:` 等の行は依存リスト**。本文を読む前に「このセクションが触れる概念領域」を把握できる。読み飛ばし可能だが、初見の章では読む価値あり。
3. **本文は元ドキュメントのまま無傷**。編集や注釈は加わっていない。
4. **glossary は "序文"**。最初の 100〜200 行は用語定義のセットアップ。読み流して構わないが、後で本文中の `<<term>>` を見たときに思い出す前提。

---

## 送り手 (ビルドする LLM) として知るべきコマンド

すべて `sandbox/doc-exec/` で実行する Zero-Dependency Node スクリプト。

```bash
# 1. リポ内 md を再帰列挙して 1 ファイル化
node bundle-docs.js                      # → all-docs.md (15 セクション)
node bundle-docs.js --root=../.. --out=all-docs.md    # 明示指定

# 2. 各セクション冒頭に関連用語リストを付与 + 先頭に glossary 連結
node prepend-deps.js                     # → all-docs-deps.md (最終成果)
node prepend-deps.js --src=all-docs.md --glossary=glossary.md --out=all-docs-deps.md

# 3. glossary 自身に適用すれば用語間依存グラフが得られる
node prepend-deps.js --src=glossary.md --out=glossary-deps.md

# 4. 構造確認
node parse.js all-docs-deps.md           # セクション一覧

# 失敗例の参考実装 (使わない方がよい)
node mark-terms.js                       # 本文中に <<term>> をラップ → 本文が分断される
node expand-term.js bible-term.md <sec>  # マクロ展開 → 本文が壊れる、捨てた
```

---

## 用語の追加方法

1. `glossary.md` の末尾に新しいセクションを追加:

```md
---

# <<NewTerm>>

<!-- @category: principle | state | layer | tag | verification | persistence | tool -->
<!-- @aliases: 別表記1, 別表記2 -->

短い定義文 (1〜3 行)。出典 (Bible §x.y, AI_ONBOARDING) を併記。
```

2. `node prepend-deps.js` を再実行。
3. 検出件数とカバレッジが標準エラーに出るので、未出現用語があれば alias を増やすか本文に概念が無いか判断する。

---

## 用語検出ルール (内部仕様)

- **canonical 名 + alias** の全パターンをマッチ対象にする
- **longest match first**: `Heavy Function` を `Function` より先に試す (部分マッチ衝突を回避)
- **mask 対象** (検出から除外):
  - コードブロック ` ```...``` `
  - インラインコード `` `...` ``
  - 見出し行 `^#+...`
  - 既存の関連行 `> 原則: ...` 等 (冪等性のため)
- **自己参照を除外**: glossary の `# <<Twin>>` セクション本文に `<<Twin>>` があっても関連には載せない
- **出力の正規化**: alias でヒットしても出力は canonical (`<<term>>`) で統一
- **出現順**: セクション冒頭関連リストの並びは本文中の初出位置順

---

## 既知の穴 (リスクの棚卸し)

### 検出系
- alias の false positive: 「条件畳み込み」が無関係な文脈でヒットする可能性
- 表記揺れ: 大小文字 / 複数形 / 活用形を網羅できない
- 多語境界: longest match で当面は OK
- コード内コメント・引用ブロック: mask に漏れあり

### 構造系
- defines/uses の機械判定なし: 用語の正典セクションが手動依存
- セクションサイズと関連行のバランス: 156 B のセクションに 7 行関連は過剰
- サブセクション粒度なし: `## 0.0` 〜 `## 0.21` 単位で関連が欲しい場面あり

### 運用系
- glossary は手書き: 用語追加が必ず追従より遅れる
- アンカーリンク無し: 本文 `<<Twin>>` から末尾 (現在は先頭) 定義への物理ジャンプは手作業
- 逆引き欠如: glossary 側に「どこで使われてるか」が無い (`append-usages.js` 候補)
- バージョニング: 用語定義が変わったときの過去参照との整合は保証されない

### 思想系 (一番怖い)
- **効果が未測定**: 関連リストで AI が本当に早く理解する/正確に答えるかを数値で示せていない
- **真の問題が用語不在ではない可能性**: 肥大化の正体は重複・矛盾・古さかもしれない
- **100 用語超えで破綻**: 冒頭 glossary が 500 行になり、本文到達前にスポットライトを使い切る将来

---

## 失敗の記録 (繰り返さないために)

### 1. inline 展開モデル ── 捨てた
`expand-term.js` で `<<term>>` を本文中に inline で展開する設計を試した。結果:
- bold 構造 `**...**` が改行で分断され可読性破壊
- 入れ子展開でインデント 4 段、本文 12 行が出力 35 行に膨張
- 既知の概念を読み手にもう一度押し付けるノイズ
- 結論: マーカー直後 inline 挿入は文の流れに対して攻撃的 → 廃案

代わりに **関連リスト方式** (本文無傷、冒頭に依存宣言) に切り替えた。これが現在の `prepend-deps.js`。

### 2. bold = 用語シグナル仮説 ── データで否定
「Bible 中の `**...**` を用語マーカーに使えるのでは」を `extract-bolds.js` で実測:
- 73 件中 98.6% が一回限りの bold
- 用語反復の signal として機能していない
- 結論: bold は「リスト見出し / 一発強調」に消費されており用語マーカーには使えない

### 3. `@deps:` HTML コメント形式 (旧 `trace.js` 用) ── 廃案
section 間依存を `<!-- @deps: name1, name2 -->` で書くモデル。
`<<term>>` ベースに統合した方が記述コストが下がるため廃止。`example.md` `trace.js` `convert.js` は legacy 参考として残置。

### 4. Bible 直接編集 ── 教訓化
`build-docs.js` を AI_NATIVE_MASTER_BIBLE.md (SHADOW) に書き戻させたら DOCS_REAL.js (REAL) に未移行の §4-7 が消えた。即 git restore で復旧。
**教訓: ソース未完成のままビルドターゲットを正本に向けてはいけない**。doc-exec は sandbox 配下で完結させ、本体 md には触らない。

---

## ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `README.md` | 文書 | これ |
| `HANDOFF.md` | 文書 | 過去セッションの引き継ぎ資料 |
| `glossary.md` | データ | 用語定義のソース (手書き、追加場所) |
| `bundle-docs.js` | スクリプト | リポ内 md を 1 ファイル化 |
| `prepend-deps.js` | スクリプト | 関連リスト付与 + glossary 先頭連結 (現行) |
| `parse.js` | スクリプト | md → AST (セクション + メタ) パーサー |
| `all-docs.md` | 生成物 | bundle の中間出力 (15 セクション) |
| `all-docs-deps.md` | 生成物 | **最終成果**: AI 消費用統合ドキュメント |
| `glossary-deps.md` | 生成物 | 用語間依存グラフ版 |
| `mark-terms.js` | スクリプト (失敗例) | 本文に `<<term>>` をラップ。本文を分断するので使わない |
| `bible-term.md` | 生成物 (失敗例) | mark-terms 結果。可読性悪化の証拠として残置 |
| `expand-term.js` | スクリプト (失敗例) | inline 展開。本文を壊す。debug 用に残置 |
| `expanded-section-7.md` | 生成物 (legacy) | 旧 expand 形式のサンプル |
| `example.md` `example-expand.md` `example-term.md` | サンプル | 各記法の最小サンプル |
| `convert.js` `extract-bolds.js` `trace.js` | スクリプト (legacy) | 旧形式の参考実装 |
| `converted-bible.md` | 生成物 (legacy) | Bible を旧 @expand 形式に変換した中間物 |

---

## 設計方針

- **Zero-Dep**: `fs` と `path` だけで動く。Node 標準のみ
- **ai-desk 本体には触らない**: ここが安定したら export を検討
- **本体 md は無傷**: バンドル時に元 md には書き込まない
- **失敗ログ歓迎**: 何度でも捨ててやり直す。失敗例も残してデータにする
- **冪等**: `prepend-deps.js` は何回走らせても同じ結果

---

## 効果測定ハーネス (`eval/`)

`eval/eval.js` で 3 context (deps / bundle / direct) の prompt を吐き、別 LLM の回答を採点する手動 MVP。

```bash
# 1. prompt 生成
node eval/eval.js prompt deps      # → eval/prompts/deps.md
node eval/eval.js prompt bundle    # → eval/prompts/bundle.md
node eval/eval.js prompt direct    # → eval/prompts/direct.md

# 2. 各 prompt を別 LLM (Claude Web / GPT / Gemini 等) にコピペ
#    回答を eval/answers/<ctx>.md に保存 (## <q-id> 見出し形式)

# 3. 採点
node eval/eval.js score all
```

質問セット: `eval/questions.json` (7 問、Bible 核概念)。must_include キーワードで部分点。
意味判定は人間が最終確認 (キーワード一致は必要条件・十分条件ではない)。

## パイプライン回帰テスト (`test/`)

```bash
node --test test/pipeline.test.js   # 6 tests: golden + idempotency + masking + alias + self-ref
UPDATE_GOLDEN=1 node --test test/pipeline.test.js   # 仕様変更時に golden を更新
```

固定フィクスチャ (`test/fixtures/`) でビルドし、`test/golden/` と byte 一致を確認。
本リポの md 変更で壊れない独立テスト。

## 次の実験候補 (引き継ぐ LLM へ)

優先順:

1. **効果測定の実走** ── ハーネスは入った。あとは LLM に prompt を流すだけ
   - 上の eval ワークフロー参照
   - 正答率の差が出れば穴の優先度が一気に絞れる
   - 正答率が変わらなければ用語マーカーモデル自体を疑うべき

2. **`append-usages.js`** ── 用語逆引き
   - glossary の `# <<Twin>>` セクションに「使用箇所: ai-native-master-bible, readme, ...」を自動付与
   - 用語からドキュメントへの双方向リンク

3. **alias false positive 検出**
   - 大量の alias を加える前に、本文中での文脈ウィンドウを抽出して人手 (or LLM) でレビューする仕組み

4. **defines vs uses の区別**
   - 用語ごとに正典セクション (defines) を 1 つだけ自動推定 (初出 + 段落見出しが用語名と一致 等)
   - glossary を機械的に Bible から再構築できるようになる

5. **サイズ閾値**
   - セクション本文サイズに応じて関連表示を圧縮 / 省略

着手しないなら、最低限 **次の人が `node bundle-docs.js && node prepend-deps.js` を打てば現状再現できる** 状態を保つこと。
