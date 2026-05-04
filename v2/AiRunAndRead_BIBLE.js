// v2/AiRunAndRead_BIBLE.js
// AI-Native Master Bible v2 — Super-Block Executable Edition
//
// ⚠️ ファイル名 prefix `AiRunAndRead_` の意味:
//   このファイルは AI に対して 2 つの instruction を発する:
//     1. `node AiRunAndRead_BIBLE.js` で **実行** せよ(出力が canonical view)
//     2. or `import { ... } from './AiRunAndRead_BIBLE.js'` で構造を **読め**
//   ⛔ .js のソースを prose として linear に読むな(JS は構造化容器、
//      prose 読みは情報を取りこぼす — 公理 A0 / A7 違反)
//
// 思想(Bible) + 認知(Manifesto) + 規律(Onboarding) + 参照(Reference) + 派生 Block 仕様
// を統合した全知の核。
//
// **canonical form**: this file (.js) ← REAL
// **human form**:    BIBLE.md は派生(SHADOW)、`node AiRunAndRead_BIBLE.js export-md` で生成
//                    (公理 A3 — REAL は .js、SHADOW は .md)
//
// 他 v2 ツールから:
//   `import { Kernel, Axioms, BlockSchema } from './AiRunAndRead_BIBLE.js'`

export const VERSION = "2.6";
export const DATE = "2026-05-04";
export const AUTHOR = "沖井広行(蒼山りと)";

// ============================================================
// 第 1 層: 認知物理学(Cognitive Physics)
//   公理より下のレイヤー。AI の思考を規定する観測された物理法則。
//   実証された heuristic は law として。仮説は note として明記。
// ============================================================
export const Physics = {
  Spotlight: {
    range: 300,
    law: "AI は今読んでいる場所から ~300 行以上離れた情報を急速に忘却する。重要な情報は常に近接に配置せよ。",
    status: "heuristic",   // BIBLE.md には未記載、運用上の観察値。今後計測で根拠を強化する。
    addedIn: "2.6",
  },
  Gravity: {
    law: "複雑性は推論を一意化する重力である。シンプルさは AI を漂流(ハルシネーション)させる無重力空間である。",
    detail: "Bible §0 大前提 / §2.5 詳説。注意機構の質量分布として作用 — refs が密 = attention が安定。",
    status: "axiomatic",
    // 注: calculate は「推定指標」であり真の attention 重力の計測ではない。
    // 文字列単純 match であって、コメントや文字列リテラル中の token も拾う。
    // 比較値として使う(同じ formula で時系列比較)用途のみ妥当。
    calculate: (code) => {
      const connections = (code.match(/\b(import|export|function|class)\b|=>/g) || []).length;
      return connections / Math.max(1, code.split('\n').length);
    },
  },
  FileCost: {
    law: "ファイル移動と分割は AI にとって物理的重労働である。コンテキストを統合し、移動を最小化せよ。",
    status: "axiomatic",
    related: "公理 A1(ローカリティ極大化)",
  },
};

// ============================================================
// 第 2 層: 公理体系(Core Axioms A0〜A8)
//   各公理は {id, name, summary, why, examples, violations, refs} を持つ
//   prose ではなく構造化データとして — JS が容器の真価を発揮する層
// ============================================================
export const Axioms = {
  A0: {
    id: "A0", name: "認知非対称性",
    summary: "人向けの『良い設計』(抽象化・分割・カプセル化)は AI にとって情報の隠匿、つまり毒である。AI には統合された複雑性を与えよ。",
    why: "人間の作業記憶は 7±2 と狭く隠匿で『理解』を作る。LLM の作業記憶は桁違いに広く、隠匿は推測領域(=ハルシネーション温床)に変わる。",
    examples: ["ヘルパー関数で詳細を隠す ❌ → インライン展開して全部見せる ✓", "型定義で実装と分離 ❌ → 動的な構造を直接見せる ✓"],
    violations: ["共通関数で重複削減", "interface で実装隠匿", "doc string でコードの意図を別レイヤーに"],
    refs: ["A1", "A7"],
  },
  A1: {
    id: "A1", name: "ローカリティ極大化",
    summary: "機能に必要な情報は 1 つのスコープに集約する。共有ヘルパーを作らず、必要なら複製(Copy&Paste)せよ。重複は悪ではない。隠れた依存こそが悪。",
    why: "別ファイル / 別関数への分離 = 物理的隠匿。Spotlight 範囲(~300 行)を超えると AI から forgotten される。",
    examples: ["3 箇所で似た 5 行 → 3 箇所に複製で OK(共通化しない)"],
    violations: ["DRY 至上主義", "1 行関数の抽出", "util/helper モジュールへの逃げ"],
    refs: ["A0", "Physics.FileCost", "Physics.Spotlight"],
  },
  A2: {
    id: "A2", name: "Constraint Folding",
    summary: "if/else 分岐ツリーを捨て、全可能世界 + 制約 filter に畳み込め。",
    why: "分岐ツリーは推測領域(=重力ゼロ)を生む。全可能世界の物質化は重力場を形成し、推論軌道を一意化する。",
    examples: ["じゃんけん 9 通りを全列挙 → tie 制約で filter", "状態遷移を全許容組み合わせ × 制約で生成"],
    violations: ["if/else の入れ子", "early return で網羅性放棄"],
    refs: ["A0", "BlockTypes.Constraint"],
  },
  A3: {
    id: "A3", name: "REAL / SHADOW",
    summary: "書き換え可能な唯一の真実を REAL とし、それ以外は SHADOW(派生値)として保持禁止。SHADOW は使う瞬間に生成し、使い終わったら捨てる。",
    why: "重複 state は同期コストと整合性事故の温床。REAL 1 つから常に派生計算する方が密度が上がり、ハルシネーション余地が消える。",
    examples: ["Block.versions = REAL、Block.content = SHADOW(getter で head().content)", "AiRunAndRead_BIBLE.js = REAL、BIBLE.md = SHADOW(exportMarkdown で派生)"],
    violations: ["状態を 2 箇所に保存", "computed 値をキャッシュ変数化(stale 化リスク)"],
    refs: ["A6"],
  },
  A4: {
    id: "A4", name: "Event Sourcing + Sequential Hashing",
    summary: "状態の上書き保存を避け、状態を変えるイベントの履歴を時系列に追記する。各イベントは前イベントの hash を含み、改ざん検知可能。",
    why: "上書きは過去の喪失。append-only + hash chain は時間軸を保存し、任意時点の再構成と監査を保証する。Block.versions の prevHash chain の理論基盤。",
    examples: ["Block.versions[].prevHash = versions[i-1].hash", "session = 操作 + 観測 Block の連鎖"],
    violations: ["state を上書き", "ログを別ファイルに分離(graph 構造から外れる)"],
    refs: ["A6"],
  },
  A5: {
    id: "A5", name: "All-as-Block",
    summary: "ai-desk における全ての構成要素は Block インターフェースに従う。関数・クラス・モジュール・ドキュメント・制約・観測・テスト・議論 ─ すべて Block。",
    why: "LLM は単一の操作モデル(Block の生成・追記・参照・走査・検証)で全構造を扱えるべき。type の発明は隠匿の入口。",
    examples: ["function Block / class Block / module Block / constraint Block / observation Block / twin Block"],
    violations: ["Block 外の独自 schema 発明", "別 layer での state 保持"],
    refs: ["A0", "Block"],
  },
  A6: {
    id: "A6", name: "Versions-as-Body",
    summary: "Block の唯一の状態は versions: Version[] である。content / refs / children / tags は head() から派生(SHADOW)、変数化禁止。",
    why: "履歴は本体であり、最新値は派生に過ぎない。任意時点の状態は versions 走査で再現可能(time travel)。",
    examples: ["Block.versions = REAL", "Block.content getter は head().content"],
    violations: ["b.content = X で代入", "head() の戻り値を変数で持ち回す"],
    refs: ["A3", "A4"],
  },
  A7: {
    id: "A7", name: "LLM-First Information Density",
    summary: "人間用の簡素化を捨て、LLM にとっての情報密度を最大化する。",
    why: "情報量(展開 ✓)・構造(単一抽象 ✓)・関係(refs 明示 ✓)・履歴(Block 内蔵 ✓)・区切り(言語構文 ✓)の各軸で密度を上げる。",
    examples: ["full inline expansion", "refs を明示的 edge として書く", "tags で意味を構造化"],
    violations: ["『見やすさ』のための省略", "コメントで意図を別レイヤー化"],
    refs: ["A0"],
  },
  A8: {
    id: "A8", name: "Spec-First Versioning",
    summary: "実装の前に必ず論理(v0:SPEC)を置け。論理なき実装は漂流の始まり。仕様変更時は『新仕様のみ』バージョンを挟む脱皮プロトコル。",
    why: "Block.versions に SPEC version を埋め込めば、論理の変遷が版数構造として読み取れる。同一履歴に spec / impl が交互に積まれ、いつでも『最新の正解』へ帰還可能。",
    examples: ["v0: コメントだけ + // @tags: SPEC", "v1: 実装", "v2: 新 SPEC 挟み込み", "v3: 新実装"],
    violations: ["実装直書き(SPEC version 無し)", "仕様変更を impl 同士の連続 commit で済ませる"],
    refs: ["A4", "A6", "Bible§4.1.1"],
    enforcementNote: "規律は validate 関数で守らない。`#SPEC#` tag の存在/不在 + prevHash chain 構造そのものが enforcement(§4.1.1)。",
  },
};

// ============================================================
// Internal helpers (Taboo check の文字列マッチ脆性を回避)
// ============================================================
// import / require / from "..." / package.json の dependency 記述から
// quoted literal を抽出し、いずれかが pattern に match するか判定。
// これにより `.parcel-cache` のような関係ない文字列が import 違反扱いされない。
function _importsAny(content, pattern) {
  const literals = [];
  const importRe = /(?:^|\s)(?:import\b[\s\S]*?from\s*|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(content)) !== null) literals.push(m[1]);
  // package.json 形式の "deps": { "name": "version" } の name 部分も拾う
  const depsRe = /"(?:dependencies|devDependencies|peerDependencies)"\s*:\s*\{([\s\S]*?)\}/g;
  while ((m = depsRe.exec(content)) !== null) {
    const block = m[1];
    let dm;
    const nameRe = /"([^"]+)"\s*:\s*"[^"]+"/g;
    while ((dm = nameRe.exec(block)) !== null) literals.push(dm[1]);
  }
  return literals.some(l => pattern.test(l));
}

// ============================================================
// 第 3 層: Block schema(全 v2 ツールが共有する基本型)
// ============================================================
export const BlockSchema = {
  Block: {
    description: "id / type / meta / versions(append-only)",
    fields: {
      id: "string — globally unique identifier",
      type: "string — 'function' | 'class' | 'module' | 'constraint' | 'observation' | ...",
      meta: "object — type 固有の補助情報",
      versions: "Version[] — append-only、commit() 経由のみ伸ばせる(REAL)",
    },
  },
  Version: {
    description: "Block.versions の要素。1 つの commit を表す不変 record。",
    fields: {
      timestamp: "number — Date.now()",
      prevHash:  "string|null — 前 version の hash(連鎖)",
      content:   "any — その時点の値",
      refs:      "{kind, target}[] — 他 Block への型付きエッジ",
      children:  "string[] — 順序付き Block id list(構成的所有)",
      tags:      "string[] — 検索 / フィルタ用",
      meta:      "object — commit 自体のメタデータ",
      hash:      "string — 上記全フィールド(自身を除く)の FNV-1a 8 文字",
    },
  },
};

// 派生 Block 型(BIBLE.md §6/§7/§8 + 仮想重厚関数)
export const BlockTypes = {
  function: { type: 'function',   purpose: "コード単位、parseJS が JS の関数宣言から自動抽出" },
  class:    { type: 'class',      purpose: "クラス宣言" },
  module:   { type: 'module',     purpose: "ファイル単位" },

  constraint: {
    type: 'constraint',
    purpose: "公理 A2 の Constraint Folding を第一級 Block として永続化",
    schema: "{ axes:string[], values:Record<axis, any[]>, derive:(combo)=>any }",
    api: "evalConstraint(constraintBlock, filter?) → 候補の組み合わせ群",
    refSection: "BIBLE.md §6",
  },

  observation: {
    type: 'observation',
    purpose: "AI-Eyes の観測スナップショットを Block として保存(canvas frame, state JSON, draw_ops 等)",
    schema: "content: { capturedAt, viewport, canvases?, draw_ops?, state }",
    refs: "[{ kind:'observes', target: observedId }]",
    refSection: "BIBLE.md §7",
  },

  twin: {
    type: 'function',   // type は function、tags で識別
    purpose: "効率層(GPU 等)と並走する検証層(CPU twin)を refs で結ぶ複式数学",
    refs: "[{ kind:'twin-of', target: 効率層 Block }]",
    tags: ["twin", "verify"],
    refSection: "BIBLE.md §8",
  },

  virtualHeavy: {
    purpose: "複数 Block を 1 つの content に展開して LLM に渡し、編集後に逆配分(virtual-apply)で再分散する",
    api: ["heavy <graph> <root> [--depth=N]", "virtual-apply <graph> <root> <patch-file>"],
    refSection: "BIBLE.md §6 (仮想重厚関数), MANUAL §4.5〜4.9",
  },
};

// ============================================================
// 第 4 層: 守護聖域(Sacred Taboos)
//   これは declarative な禁忌の表明であり、validator ではない(公理 A8 §4.1.1)。
//   check 関数は「構造的に何が違反か」の概念表現として提供。
//   実際の enforcement は Block 構造(parseJS / tags / refs)の存在/不在で読む。
// ============================================================
export const Taboos = [
  {
    id: 1, name: "No TypeScript",
    rule: "TS / TSX を導入しない。型情報による情報の分離(隠匿)を防ぐため。",
    declarative: true,
    check: (content, path) => !/\.tsx?$/.test(path) && !/\btsconfig\.json$/.test(path),
  },
  {
    id: 2, name: "No Build / Transpile",
    rule: "build step を作らない。ソース = 実行ファイルの原則を守る。",
    declarative: true,
    // import / require / package.json の依存記述だけを検査(ファイル内の literal 文字列に誤反応しないため)
    check: (content) => !_importsAny(content, /(webpack|babel|rollup|esbuild|vite|parcel|swc|tsc)/),
  },
  {
    id: 3, name: "No Frameworks",
    rule: "React / Vue / Angular / Next 等の framework を入れない。暗黙の規約は隠匿の温床。",
    declarative: true,
    check: (content) => !_importsAny(content, /(^react$|^react\/|^react-dom|^vue$|^@vue\/|^@angular\/|^svelte$|^next$|^next\/)/i),
  },
  {
    id: 4, name: "Zero-Dependency",
    rule: "Web 標準 + Node 標準のみ。Eternal Compatibility の確保。",
    declarative: true,
    note: "node:fs / node:path 等の node 標準は許可。CommonJS の require は局所許可(3dplus 等)。",
  },
  {
    id: 5, name: "No direct mutation of Block.versions",
    rule: "Block.versions を直接書き換えない。必ず commit() 経由(append-only)。",
    declarative: true,
  },
  {
    id: 6, name: "SHADOW 変数化禁止",
    rule: "Block.content / refs / tags(SHADOW)を変数で持ち回さない。getter から都度読む。",
    declarative: true,
    refsAxiom: "A3, A6",
  },
  {
    id: 7, name: "No human-readability optimization",
    rule: "「人間にとっての見やすさ」で判断しない。LLM の情報密度で判断する。",
    declarative: true,
    refsAxiom: "A0, A7",
  },
];

// ============================================================
// 第 5 層: 実行儀式(CLI Reference)
// ============================================================
export const Rituals = {
  // 基本走査
  skeleton:   { cmd: "node ai-desk.js skeleton <file>",            desc: "Block 構造の透視(関数 / class / module + refs)" },
  focus:      { cmd: "node ai-desk.js focus <file> <id>",          desc: "特定 Block の中身を表示" },
  graph:      { cmd: "node ai-desk.js graph <file...>",            desc: "複数ファイルから Graph 抽出 → JSON" },
  impact:     { cmd: "node ai-desk.js impact <file> <id>",         desc: "変更による因果の波及予測(forward closure)" },

  // 永続化
  save:       { cmd: "node ai-desk.js save <out.json> <files...>", desc: "Graph を JSON に永続化(全 Block + versions)" },
  load:       { cmd: "node ai-desk.js load <in.json>",             desc: "JSON から Graph を復元 + hash chain verify" },

  // 仮想重厚関数(v2 戦闘力の核)
  heavy:         { cmd: "node ai-desk.js heavy <graph> <root> [--depth=N]",         desc: "1 root + 推移閉包を 1 content に展開して stdout に出す(LLM 渡し用)" },
  virtualApply:  { cmd: "node ai-desk.js virtual-apply <graph> <root> <patch>",     desc: "expand を編集して戻された content を BLOCK ヘッダで分割 → 各 Block に逆配分" },
  apply:         { cmd: "node ai-desk.js apply <graph> <patch.js> <module-id>",     desc: "patch ファイルの差分を特定 module の Block 群に適用" },

  // tag / 検索
  tags:       { cmd: "node ai-desk.js tags <file> <tag>",          desc: "tag でフィルタ(SPEC タグの全関数を引く等)" },
  inferTags:  { cmd: "node ai-desk.js infer-tags <file>",          desc: "I/O / async / pure / large 等を heuristic 推定" },
  search:     { cmd: "node ai-desk.js search <file> <query>",      desc: "content を substring 検索" },

  // 履歴 / 解析
  diff:       { cmd: "node ai-desk.js diff <file> <id> [i] [j]",   desc: "Block の version 間 diff" },
  blame:      { cmd: "node ai-desk.js blame <file> <id>",          desc: "Block の各行の version 由来を追跡" },
  stats:      { cmd: "node ai-desk.js stats <file>",               desc: "Graph 統計(blocks / versions / refs / by-type / by-tag)" },
  mermaid:    { cmd: "node ai-desk.js mermaid <file>",             desc: "Graph を Mermaid 図に出力" },

  // 検証
  lint:       { cmd: "node ai-desk.js lint <file>",                desc: "Bible 違反 lint(共通ヘルパー検出 / 命名 / 等)" },
  e2e:        { cmd: "node ai-desk.js e2e",                        desc: "コア e2e テストを実行" },
};

// ============================================================
// Kernel — 統合ガバナンス・エンジン
// ============================================================
export const Kernel = {
  // 全 Taboos を当てて違反を返す。declarative_only: true なら check 関数があるものだけ実行
  diagnose(content, path) {
    const violations = Taboos
      .filter(t => typeof t.check === 'function')
      .filter(t => !t.check(content, path))
      .map(t => ({ id: t.id, name: t.name, rule: t.rule }));
    return {
      ok: violations.length === 0,
      violations,
      gravity: Physics.Gravity.calculate(content),
      // declarative-only(check 関数なし)の Taboos は別途
      declarative_only_check_required: Taboos.filter(t => !t.check).map(t => ({ id: t.id, name: t.name, rule: t.rule })),
    };
  },

  // 任意の axiom 集合を選んで重力場 prompt を組み立てる(token 削減用、enkai の auto-inject 代替)
  summonContext(axiomIds = [], opts = {}) {
    const includeExamples = opts.examples !== false;
    let p = `## 🌌 CONTEXT_GRAVITY_FIELD\n\n`;
    p += `[Physics.Gravity] ${Physics.Gravity.law}\n`;
    if (opts.spotlight) p += `[Physics.Spotlight] ${Physics.Spotlight.law}\n`;
    p += `\n`;
    for (const id of axiomIds) {
      const a = Axioms[id];
      if (!a) continue;
      p += `[${a.id}] ${a.name}\n  ${a.summary}\n  why: ${a.why}\n`;
      if (includeExamples && a.examples?.length) p += `  examples: ${a.examples.join(' / ')}\n`;
      if (includeExamples && a.violations?.length) p += `  violations: ${a.violations.join(' / ')}\n`;
      p += `\n`;
    }
    return p;
  },

  // BIBLE.md の人間用 view を生成(SHADOW、いつでも捨てられる)
  exportMarkdown() {
    const out = [];
    out.push(`# AI-Native Master Bible v${VERSION}`);
    out.push(`> Auto-generated from AiRunAndRead_BIBLE.js — DO NOT EDIT THIS FILE DIRECTLY.`);
    out.push(`> Run \`node v2/AiRunAndRead_BIBLE.js export-md > BIBLE.md\` to regenerate.`);
    out.push(`> Date: ${DATE}  ·  Author: ${AUTHOR}\n`);

    out.push(`## 1. Cognitive Physics`);
    for (const [name, p] of Object.entries(Physics)) {
      out.push(`### ${name}`);
      out.push(p.law || p.detail || '(functional)');
      if (p.detail && p.law) out.push(`\n${p.detail}`);
      if (p.status) out.push(`\n**status**: ${p.status}`);
    }
    out.push('');

    out.push(`## 2. Axioms`);
    for (const a of Object.values(Axioms)) {
      out.push(`### ${a.id} — ${a.name}`);
      out.push(`**${a.summary}**\n`);
      out.push(`why: ${a.why}\n`);
      if (a.examples?.length)   out.push(`examples:\n${a.examples.map(e => `- ${e}`).join('\n')}\n`);
      if (a.violations?.length) out.push(`violations:\n${a.violations.map(v => `- ${v}`).join('\n')}\n`);
      if (a.refs?.length)       out.push(`refs: ${a.refs.join(', ')}\n`);
      if (a.enforcementNote)    out.push(`enforcement: ${a.enforcementNote}\n`);
    }
    out.push('');

    out.push(`## 3. Block Schema`);
    for (const [name, s] of Object.entries(BlockSchema)) {
      out.push(`### ${name}`);
      out.push(s.description);
      for (const [k, v] of Object.entries(s.fields)) out.push(`- \`${k}\`: ${v}`);
      out.push('');
    }
    out.push(`### Block Types`);
    for (const [name, t] of Object.entries(BlockTypes)) {
      out.push(`- **${name}** — ${t.purpose}${t.refSection ? ` (${t.refSection})` : ''}`);
    }
    out.push('');

    out.push(`## 4. Sacred Taboos`);
    for (const t of Taboos) {
      out.push(`### ${t.id}. ${t.name}`);
      out.push(t.rule);
      if (t.note) out.push(`\nnote: ${t.note}`);
      if (t.refsAxiom) out.push(`\nrefs: ${t.refsAxiom}`);
      out.push('');
    }

    out.push(`## 5. Execution Rituals`);
    for (const [name, r] of Object.entries(Rituals)) {
      out.push(`- **${name}**: \`${r.cmd}\` — ${r.desc}`);
    }
    out.push('');

    return out.join('\n');
  },
};

// ============================================================
// Self-display(node AiRunAndRead_BIBLE.js で自分自身を開示)
// ============================================================
if (typeof process !== 'undefined' && /AiRunAndRead_BIBLE\.js$/.test(process.argv[1] || '')) {
  const cmd = process.argv[2];

  if (cmd === 'export-md') {
    process.stdout.write(Kernel.exportMarkdown());
  } else if (cmd === 'summon') {
    const ids = process.argv.slice(3);
    process.stdout.write(Kernel.summonContext(ids.length ? ids : ['A0','A4','A5','A6','A8'], { spotlight: true }));
  } else if (cmd === 'diagnose') {
    const file = process.argv[3];
    if (!file) {
      console.error("usage: node AiRunAndRead_BIBLE.js diagnose <file>");
      process.exit(2);
    }
    const fs = await import('node:fs');
    const content = fs.readFileSync(file, 'utf8');
    console.log(JSON.stringify(Kernel.diagnose(content, file), null, 2));
  } else {
    console.log(`\n##################################################`);
    console.log(`##  AiRunAndRead_BIBLE.js v${VERSION} : THE AI KERNEL  ##`);
    console.log(`##################################################\n`);

    console.log(`[Cognitive Physics]`);
    for (const [name, p] of Object.entries(Physics)) {
      console.log(`  - ${name}: ${(p.law || '').slice(0, 80)}${p.status ? ` (${p.status})` : ''}`);
    }

    console.log(`\n[Axioms]`);
    for (const a of Object.values(Axioms)) {
      console.log(`  - ${a.id} ${a.name}`);
    }

    console.log(`\n[Block Types]`);
    for (const [name, t] of Object.entries(BlockTypes)) {
      console.log(`  - ${name}: ${t.purpose.slice(0, 60)}`);
    }

    console.log(`\n[Sacred Taboos]`);
    for (const t of Taboos) console.log(`  ${t.id}. ${t.name}`);

    console.log(`\n[Execution Rituals]  (${Object.keys(Rituals).length} commands)`);
    for (const [name, r] of Object.entries(Rituals)) {
      console.log(`  - ${name}: ${r.desc}`);
    }

    console.log(`\nUsage:`);
    console.log(`  node AiRunAndRead_BIBLE.js export-md > BIBLE.md   # 人間用 md を生成`);
    console.log(`  node AiRunAndRead_BIBLE.js summon A0 A8           # 重力場 prompt を生成`);
    console.log(`  node AiRunAndRead_BIBLE.js diagnose <file>        # Bible 違反診断`);
    console.log(``);
  }
}
