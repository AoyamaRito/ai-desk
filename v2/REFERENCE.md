# REFERENCE — CLI / API 早見表

> 自動生成 SHADOW(canonical は `AiRunAndRead_BIBLE.js` の `Rituals`)。
> 再生成: `cd v2 && node AiRunAndRead_BIBLE.js export-md` でも全 Rituals 含むが、本 REFERENCE.md は CLI 一覧に絞った subset。

## CLI commands

### skeleton
`node ai-desk.js skeleton <file>` — Block 構造の透視(関数 / class / module + refs)

### focus
`node ai-desk.js focus <file> <id>` — 特定 Block の中身を表示

### graph
`node ai-desk.js graph <file...>` — 複数ファイルから Graph 抽出 → JSON

### impact
`node ai-desk.js impact <file> <id>` — 変更による因果の波及予測(forward closure)

### save
`node ai-desk.js save <out.json> <files...>` — Graph を JSON に永続化(全 Block + versions)

### load
`node ai-desk.js load <in.json>` — JSON から Graph を復元 + hash chain verify

### heavy
`node ai-desk.js heavy <graph> <root> [--depth=N]` — 1 root + 推移閉包を 1 content に展開して stdout に出す(LLM 渡し用)

### virtualApply
`node ai-desk.js virtual-apply <graph> <root> <patch>` — expand を編集して戻された content を BLOCK ヘッダで分割 → 各 Block に逆配分

### apply
`node ai-desk.js apply <graph> <patch.js> <module-id>` — patch ファイルの差分を特定 module の Block 群に適用

### tags
`node ai-desk.js tags <file> <tag>` — tag でフィルタ(SPEC タグの全関数を引く等)

### inferTags
`node ai-desk.js infer-tags <file>` — I/O / async / pure / large 等を heuristic 推定

### search
`node ai-desk.js search <file> <query>` — content を substring 検索

### diff
`node ai-desk.js diff <file> <id> [i] [j]` — Block の version 間 diff

### blame
`node ai-desk.js blame <file> <id>` — Block の各行の version 由来を追跡

### stats
`node ai-desk.js stats <file>` — Graph 統計(blocks / versions / refs / by-type / by-tag)

### mermaid
`node ai-desk.js mermaid <file>` — Graph を Mermaid 図に出力

### lint
`node ai-desk.js lint <file>` — Bible 違反 lint(共通ヘルパー検出 / 命名 / 等)

### e2e
`node ai-desk.js e2e` — コア e2e テストを実行

## 関連

- 思想正典: [`AiRunAndRead_BIBLE.js`](./AiRunAndRead_BIBLE.js) → [`BIBLE.md`](./BIBLE.md)(SHADOW)
- 操作詳説: [`MANUAL.md`](./MANUAL.md)(Virtual Heavy Function APPLY 含む)
- 作業ルール: [`AI_ONBOARDING.md`](./AI_ONBOARDING.md)
