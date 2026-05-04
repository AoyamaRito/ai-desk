# ai-desk-go — Go CLI shell for ai-desk v2

**JS core を Go binary に embed**、Node 不要で動く ai-desk CLI。

## 思想

Bible §3 Eternal Compatibility の現実的最終形 — **Node 必須を解除する**。
JS core(Block / Graph / parseJS / Bible 公理体系)は触らず、I/O / process / fs / signal だけを Go に移譲。

```
┌──────────────────────────────┐
│  ai-desk binary (Go, 12 MB)  │
│   - CLI arg / fs / process    │
│   - 起動時に goja を抱える     │
│                                │
│  ╔═══════════════════════╗    │
│  ║ ai-desk-bundle.js      ║    │  ← AiRunAndRead_BIBLE.js + ai-desk-core.js
│  ║ (1500 行、//go:embed)  ║    │     を 1 file に bundle、Go binary に内蔵
│  ╚═══════════════════════╝    │
└──────────────────────────────┘
```

## 速度

| | startup | size | deps |
|---|---|---|---|
| Node 版 | ~69ms | — | Node 20+ install 必須 |
| **Go 版** | **~6ms (11x faster)** | **12 MB single binary** | **なし** |

## ビルド

```bash
cd v2/go-cli
node bundle.js        # JS core を 1 file に bundle
go mod tidy            # 初回のみ(goja を fetch)
go build -o ai-desk    # binary 生成
```

cross-compile:
```bash
GOOS=linux GOARCH=amd64 go build -o ai-desk-linux
GOOS=windows GOARCH=amd64 go build -o ai-desk.exe
GOOS=darwin GOARCH=arm64 go build -o ai-desk-mac
```

## 使い方(Phase A 実装済 commands)

```bash
./ai-desk bible-info                                # 9 公理 / 7 BlockTypes / 7 Taboos / Vocabulary
./ai-desk bible-check <file>                         # Bible 違反診断 (exit 1 if violated)
./ai-desk bible-summon A0 A8                         # 重力場 prompt 動的生成
./ai-desk skeleton <file>                            # Block 構造の透視
./ai-desk focus <file> <block-id>                    # 指定 Block の content
./ai-desk save graph.json src/foo.js src/bar.js      # Graph を JSON に保存
./ai-desk version                                     # version 表示
```

## アーキテクチャ

`main.go`:
- `//go:embed ai-desk-bundle.js` で JS bundle を Go binary に内蔵
- 起動時に goja runtime を生成、bundle を 1 度だけ実行 → `globalThis.AiDesk` に 36 symbols が露出
- 各 CLI command は `runtime.aiDesk.Get(name)` で JS 関数を取得、Go から call

`bundle.js`(Node script、build 専用):
- `AiRunAndRead_BIBLE.js`(11 exports)+ `ai-desk-core.js`(25 exports)を読む
- ESM の `export` キーワードを剥がして連結
- self-display ブロック(`if (typeof process...)`)を除去(goja で意味なし)
- `globalThis.AiDesk = {...}` namespace に全 symbols を露出

## 制約 / 既知の限界

- **goja は ES2017+ サポート**、ESM 構文は bundler 経由で CJS 化
- **Top-level await は使えない** — JS core 側にあれば bundler で対応必要
- **動的 import(`import('...')`) は不可** — 現状の core は使ってないので問題なし
- **Anthropic API 等の fetch は Go 側でやる方が筋**(JS から呼ぶより低 overhead)
- **CLI command の網羅率は Phase A**(全 24 中 6 件)、必要に応じて Phase B/C で追加

## Phase 計画

- **Phase A(完了)**: bible-info / bible-check / bible-summon / skeleton / focus / save
- **Phase B(候補)**: impact / lint / heavy / virtual-apply / load / stats / tag / tags / search
- **Phase C(候補)**: HTTP server(qr-auth 互換)、enkai REPL の Go 化、AI-Eyes runner
- **Phase D(候補)**: WASM target — browser からも core を呼び出せる single binary

## なぜ JS core を Go で書き直さないか

- **Bible §3 JS 完全主義** — JS は LLM の学習データに最も豊富、構文揺れ少
- **Vocabulary** — JS core を Go 化すると `expose(表面化)` でなく `abstract(隠匿)` 方向に思考が引っ張られる(言語境界 = 隠匿)
- **2 言語並走の認知負荷** — 既存の demo / BIBLE / enkai 全て JS、Go 化すると永遠に翻訳コスト

JS core は**正典の身体**、Go は**配布の器**。役割が明確に分離してる。
