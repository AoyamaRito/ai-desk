# crystallize — Phase 1+2+3+4+5 prototype

ai-desk v2 の Block を Go にネイティブ翻訳する仕組み(Crystallization)の最初の検証。
**A9 Crystallization Compliance** の実証 phase。

5 段フロー: REAL(JS) → TRANSCRIPTION(AI 翻訳指示) → SHADOW(Go src) → COMPILE → CRYSTAL(native binary)。

詳細: `/Users/AoyamaRito/PJs/memo/2026-05-04_block-to-go-transpilation.md`

---

## Phase 1 — hashVersion 翻訳

REAL = `ai-desk-core.js` の `export function hashVersion(v)`。
SHADOW = `hashversion.go` の `HashVersion(v map[string]any) string`。

### 結果

5 case 中 **2 一致 / 3 不一致**。

不一致の原因 = **JS 側 hashVersion の暗黙 bug**:
- `JSON.stringify(rest, Object.keys(rest).sort())` は **top-level key だけ sort**。
- nested object(refs / meta 等)は insertion order になる。
- 同じ logical Version でも nested の挿入順が違うと hash が変わる(latent bug)。

Go 側翻訳は素直に nested も sort したので、JS の暗黙 bug を露出させた。

→ **修正は MTG 後に持ち越し**(graph.json 互換性影響大)。
詳細: `/Users/AoyamaRito/PJs/memo/2026-05-04_crystallize-phase1-findings.md`

### 教訓

> crystallize tool の本来の価値は performance でなく、**意味論の厳密化**である。
> A9 axiom は単なる perf 制約でなく、**Block の semantic precision を保証する公理**。

---

---

## Phase 2 — sameArr / sameRefs 翻訳

REAL = `ai-desk-core.js` の `sameArr` / `sameRefs`(共に Tier 1 純粋関数)。
SHADOW = `sameops.go`。

### 結果

**10/10 全件一致**。暗黙 bug なし。

### 教訓

Tier 1(純粋関数、nested object 無し、JS quirk 無し)は **AI 手動翻訳で 1 発一致**。
これが crystallize の "easy zone"。Phase 1 のような暗黙 bug 露出は、JS 側に
仕様曖昧さがあるときだけ起きる。

---

## Phase 3 — nodeId / inferTags / checkBraces 翻訳

REAL = `ai-desk-core.js`:
- `nodeId(id)` — 内部ヘルパー、`[^a-zA-Z0-9_]` を `_` 化
- `inferTags(content, type)` — regex で tag 推論、Set insertion order で返す
- `checkBraces(content)` — JS source の `{}` 平衡判定(string / comment / regex / template literal 対応)

SHADOW = `jsanalysis.go`(+ `isRegexContext`, `skipRegex` 補助関数)。

### 結果

**22/22 全件一致**(checkBraces error の field order を struct で再現)。

### 副作用 — 第 2 の暗黙 bug 発見

`checkBraces` に **template literal `${...}` の処理 bug** を発見:

JS:
```js
if (inString) {
  if (c === inString) inString = null;
  else if (...) { inTemplate++; i++; }
  continue;   // ← 早すぎる continue
}
if (inTemplate > 0 && c === '}') { inTemplate--; continue; }
```

`inString === '\`'` で `}` が来た時、`inString` block で `continue` されてしまい、
`inTemplate--` まで到達しない → template の `}` が string 内 char 扱いになる →
`${x + 1}` を含む code に対して **誤って unbalanced 判定**。

Go 翻訳が JS の挙動を忠実に再現したので diff は通ったが、test case
`checkBraces with template literal` は両方とも誤った "unbalanced" を返している。

これは Phase 1 hashVersion bug と同じ pattern: **crystallize tool が「JS と Go が同じ wrong answer を出す」 case を経由して、JS 側の latent bug を surface させる**。

### 教訓

Tier 1 純粋関数でも、JS source 解析系には JS quirk(template literal、regex 文脈)
が密に絡む。AI 手動翻訳で「**翻訳した後に test を見て JS 側の挙動を疑う**」
ステップが必要 — crystallize は単なる翻訳ではなく、**Block の挙動レビュー装置**でもある。

修正は別 task: `checkBraces` の template literal 処理を直す(MTG 後)。

---

## Phase 4 — parseJS 補助関数群

REAL = `ai-desk-core.js`:
- `matchPair` / `matchBrace` / `matchParen` — string / comment / regex 文脈対応 brace 平衡
- `findFunctionBody(source, declStart)` — 関数 body の `{` 位置を返す
- `extractInlineTags(source, declStart)` — 関数手前の emblem / @tags pragma を遡って抽出

SHADOW = `parsehelpers.go`(Phase 3 の isRegexContext / skipRegex を再利用)。

### 結果

**14/14 全件一致**、暗黙 bug なし。

ai-desk-core.js 側で 5 関数を `export` に変更(API 拡大なし、helper 公開のみ)。

### 教訓

Phase 4 までで、`parseJS` の構成要素のうち低層 helper はすべて Go に翻訳完了:
- 文字単位走査(matchPair / checkBraces)
- pattern matching(inferTags / extractInlineTags の regex)
- 文字列処理(nodeId)

これで Phase 5 以降の **parseJS 本体翻訳** に進める基盤が揃った。
parseJS は ~80 行で複雑だが、helper はすべて crystal 側にあるので、
残るは control flow の翻訳のみになる。

---

## Phase 5 — parseJS 本体翻訳

REAL = `ai-desk-core.js` の `parseJS(source, moduleId)`。
JS で source code を function / class / arrow / import に分解する核 parser(~80 行)。

SHADOW = `parsejs.go` の `ParseJS(source, moduleId string) []ParseResult`。

### 結果

**10/10 全件一致**(対象は flat ParseResult 比較、Block の version chain は対象外)。

### 翻訳の決定事項(transcription contract 重要)

JS regex の **lookbehind** `(?<=[;}{])` は Go RE2 非対応:
- 書き換え: `(^|[;}{])` で boundary char を capture group 1 として consume する形式に変更
- match start 位置は capture 1 の長さ分ずれるので、`jsLikeStart()` で JS の m.index 相当に補正

JS regex の `/m` flag(行頭マッチ):
- Go では default で `^` は input 先頭のみ、`(?m)` flag で行頭マッチ有効化
- inline tags 直前の関数を取りこぼすので必須

JS の `JSON.stringify` vs Go の `json.MarshalIndent`:
- Go は default で `<` `>` `&` を Unicode escape(HTML 安全)
- `json.NewEncoder + SetEscapeHTML(false)` で JS と同じ生 ASCII 出力に

### 教訓

- parseJS まで翻訳できた = ai-desk core の **「source → Block」変換ロジック全体**が
  Go ネイティブで実行可能になった
- crystallize は単なる翻訳ではなく、**JS と Go の文法差を contract として明示**する作業。
  lookbehind / multiline / JSON escape の差は AI 翻訳で必ず引っかかるので、
  人間と AI が共有する translation contract として記録された

---

## 使い方

```bash
go build

# Phase 1 — hashVersion
./crystallize --emit-cases | node verify.js > js1.json
./crystallize --emit-go-results > go1.json
diff js1.json go1.json

# Phase 2 — sameArr / sameRefs
./crystallize --phase2 --emit-cases | node verify-phase2.js > js2.json
./crystallize --phase2 --emit-go-results > go2.json
diff js2.json go2.json

# Phase 3 — nodeId / inferTags / checkBraces
./crystallize --phase3 --emit-cases | node verify-phase3.js > js3.json
./crystallize --phase3 --emit-go-results > go3.json
diff js3.json go3.json

# Phase 4 — parseJS helpers
./crystallize --phase4 --emit-cases | node verify-phase4.js > js4.json
./crystallize --phase4 --emit-go-results > go4.json
diff js4.json go4.json

# Phase 5 — parseJS 本体
./crystallize --phase5 --emit-cases | node verify-phase5.js > js5.json
./crystallize --phase5 --emit-go-results > go5.json
diff js5.json go5.json
```

## 構成

- `hashversion.go` — Phase 1 SHADOW
- `sameops.go` — Phase 2 SHADOW
- `jsanalysis.go` — Phase 3 SHADOW
- `parsehelpers.go` — Phase 4 SHADOW
- `parsejs.go` — Phase 5 SHADOW
- `main.go` — dispatch (no-arg / --phase2 ~ --phase5)
- `*_cases.go` — phase 別 cases / harness
- `verify.js` / `verify-phaseN.js` — JS 側検証
- `go.mod` — module 定義

