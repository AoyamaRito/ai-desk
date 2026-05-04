# crystallize — Phase 1 prototype

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

## 使い方

```bash
go build
./crystallize                                                       # Go 側 hash 一覧
./crystallize --emit-cases | node verify.js > js-results.json       # JS 側結果
./crystallize --emit-go-results > go-results.json                   # Go 側結果
diff js-results.json go-results.json                                # 比較
```

## 構成

- `hashversion.go` — JS hashVersion の Go 翻訳(SHADOW)
- `main.go` — test case + harness
- `verify.js` — JS 側検証
- `go.mod` — module 定義

