# aijs — minimal JS runtime, no Node required

ai-desk v2 の AiRunAndRead_*.js を **Node 完全不要**で実行する Go binary。
Bible §3 Eternal Compatibility の現実的最終形。

## なぜ作ったか

`v2/go-cli/` は ai-desk 専用 binary に JS を embed する形だった。
これは「ai-desk だけ」の解決で、**任意の AiRunAndRead_*.js を起動する汎用 runtime ではない**。

aijs は **runtime 1 つ install すれば任意の v2 .js が単体起動**できる構造:
- `~/.local/bin/aijs` を 1 度入れる(12 MB binary 1 個、Node エコシステム不要)
- 各 .js の冒頭に `#!/usr/bin/env aijs` shebang
- `chmod +x foo.js` してから `./foo.js` で実行
- これは python / bash / node の standard pattern

## 思想的位置

- **Node 必須を解除**(完全脱 Node ≒ 不可能、最小依存に置換)
- **依存先を自分が握る**(Node = 外部組織、aijs = 自分の binary、Eternal Compat に整合)
- **JS core は不変**(go-kernel と違って parser を Go 化しない、Bible §3 / Vocabulary 整合)
- **runtime 自体が v2 思想を保護**(将来 BIBLE.js を runtime に bake-in して起動時診断 etc. 拡張可)

## 使い方

```bash
# Build(初回のみ)
cd v2/aijs
go mod tidy
go build -o aijs

# 任意の .js を実行
./aijs script.js [args...]

# v2 doc を直接走らせる(Node 不要!)
./aijs ../AiRunAndRead_BIBLE.js                          # 自己開示
./aijs ../AiRunAndRead_BIBLE.js export-md                # md 生成
./aijs ../AiRunAndRead_BIBLE.js summon A0 A8             # 重力場 prompt
./aijs ../AiRunAndRead_BIBLE.js diagnose somefile.js     # 違反診断
./aijs ../AiRunAndRead_ONBOARDING.js                     # 規律集
./aijs ../AiRunAndRead_MANUAL.js                         # 操作マニュアル
./aijs ../AiRunAndRead_CLAUDE.js                         # Claude entry

# shebang 経由(install 後)
sudo cp aijs /usr/local/bin/
# script.js の先頭に: #!/usr/bin/env aijs
chmod +x script.js
./script.js
```

## サポート構文 / runtime

**OK**:
- ES2017+(class / arrow / async / await(関数内のみ)/ template literal / destructuring)
- `import { A, B as C } from './X.js'`(相対パスのみ)
- `import * as X from './X.js'`
- `import X from './X.js'`(default)
- `export class / function / const / let / var / async function`
- `export { A, B as C }`
- `console.log / info / warn / error / debug`
- `process.argv / process.exit / process.env / process.cwd`
- `process.stdout.write / process.stderr.write`
- `readFileSync / writeFileSync / existsSync / readdirSync`(globals + `fs` namespace)
- shebang `#!/usr/bin/env aijs`(自動除去)
- `const fs = await import('node:fs')` → 自動で no-op に変換(fs は global で提供済)

**未対応**:
- top-level await / dynamic `import()`(ただし `await import('node:X')` は変換対応)
- npm packages / node_modules
- Buffer / streams / child_process / http / etc.
- ESM の特殊 export 形態(re-export 等)

## アーキテクチャ

```
aijs binary (Go, 12 MB)
  ├─ goja (JS engine, ES2017+)
  ├─ ESM resolver(loader.go)
  │   - import 文を再帰的に resolve
  │   - 各 module を IIFE wrap、export を globalThis.__aijs_mod_<id> に隔離
  │   - module 同士の name collision(VERSION 等)を回避
  └─ runtime globals(setupRuntime)
      - console / process / fs(最小)
      - shebang / await import('node:X') の前処理
```

**input(.js)** → **resolver bundles ESM forest** → **goja exec** → **stdout/stderr**

## 起動速度

- aijs: ~7ms(自己 startup + bundle + goja init + JS exec)
- Node 同等動作: ~70ms
- → **10x faster startup**

## go-cli との違い

| | go-cli | aijs |
|---|---|---|
| binary 役割 | ai-desk 専用 CLI(JS embed) | 任意 .js を実行する汎用 runtime |
| install | プロジェクトごとに build / 配布 | 1 度 install して share |
| スコープ | ai-desk のみ | AiRunAndRead_*.js 全部 + 他の任意 .js |
| 拡張性 | 命令体系が固定(Go side で実装) | .js 書けば任意機能追加 |

両者は補完的:
- **aijs**:汎用 runtime、新 .js 増えても build 不要
- **go-cli**:特定用途の binary 配布、ai-desk core を 1 binary に固める

実用ベースでは **aijs を 1 個入れて全部 .js で済ませる**方が筋が良い。
go-cli は production 配布(end-user に Node も aijs も install させない)用の選択肢。

## 制約 / 既知の限界

- goja は **ES2022 までは概ね OK、ES2023+ の最新構文は未対応**(top-level await 等)
- ファイル単位の dynamic import 不可 → bundling 時に静的解決が必須
- npm dependency 不可 → AiRunAndRead_*.js 系のような Zero-Dep ファイルが対象
- パフォーマンス: V8 比 5〜10 倍遅いので、大規模パース等は go-kernel(別アプローチ)に譲る

## Phase 計画

- **Phase 0(完了)**: 基本 runtime + ESM resolver + AiRunAndRead_*.js 全実行確認
- **Phase 1**: より多くの node 標準 polyfill(child_process / Buffer / events 等)
- **Phase 2**: install script(`curl ... | sh` で aijs 入れる)、cross-compile(Linux / Win)
- **Phase 3**: aijs 自体に Bible 違反診断を起動時 hook(オプトイン)
- **Phase 4**: WASM target で browser でも aijs runtime 動作

## 思想 — なぜこれが「健全」か

「runtime install を強要する = 不健全」と感じるかもしれないが:

| | 不健全 | 健全 |
|---|---|---|
| アプリごとに 100MB の deps を npm install 強要 | ✗ | |
| 言語 runtime を 1 個 OS に入れる(python / bash / node / aijs) | | ✓ |

aijs は後者。**python / bash / node と同列の standard pattern**。
むしろ Node 依存より「自分が握る binary に依存する」方が **Bible §3 Eternal Compatibility** の純度が上がる。
