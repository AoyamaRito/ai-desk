# crystallize — Phase 1+2 prototype

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
```

## 構成

- `hashversion.go` — Phase 1 SHADOW
- `sameops.go` — Phase 2 SHADOW
- `main.go` — Phase 1 harness + Phase 2 dispatch
- `sameops_cases.go` — Phase 2 cases / harness
- `verify.js` / `verify-phase2.js` — JS 側検証
- `go.mod` — module 定義

