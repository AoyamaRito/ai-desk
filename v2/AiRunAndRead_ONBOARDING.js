// v2/AiRunAndRead_ONBOARDING.js
// AI Onboarding v2 — LLM が ai-desk で作業するときのルール集
//
// ⚠️ ファイル名 prefix `AiRunAndRead_` の意味:
//   1. `node AiRunAndRead_ONBOARDING.js` で実行 → 出力を読め
//   2. or `import { Rules, Forbidden, ... } from './AiRunAndRead_ONBOARDING.js'`
//   ⛔ .js ソースを prose として linear に読むな
//
// **canonical form**: this file (.js) ← REAL
// **正典**: AiRunAndRead_BIBLE.js(公理 A0〜A13)を補完する運用マニュアル
// **対象読者**: LLM(Claude / GPT / Gemini)。人間向けではない。

import { Axioms } from './AiRunAndRead_BIBLE.js';

export const VERSION = "2.6";
export const DATE = "2026-05-04";

// ============================================================
// §0 最初に把握する情報(file map + stderr hint policy)
// ============================================================
export const StartHere = {
  files: [
    { path: 'AiRunAndRead_BIBLE.js', purpose: '思想の正典(公理 A0〜A13)' },
    { path: 'ai-desk.js + ai-desk-core.js', purpose: '実装 split。core = pure logic(Block/Graph/parseJS)、ai-desk = CLI shell。Zero-Dep ~1.2k 行' },
    { path: 'e2e.js', purpose: '111 e2e テスト。新機能追加時にここに 1 件以上追加' },
    { path: '3d-prefab/', purpose: 'A10/A11 + heartbeat/flow/Shadow_for_Flow の voxel editor demo(55 tests)' },
    { path: 'package.json', purpose: '`npm test` で e2e、type:"module"(ESM)' },
    { path: '3dplus/', purpose: 'CPU 3D Twin(81 tests, CommonJS)。3D / WebGL コードを扱う際は突合層として参照' },
    { path: 'eyes/', purpose: 'AI-Eyes 観測ハーネス(in-memory virtual canvas、draw_op log)' },
  ],
  stderrHintPolicy:
    "ai-desk.js は CLI 実行時、コードの状態を観察して **stderr に 1 度だけ hint** を流す" +
    "(例: WebGL/Matrix4 検出 → `3dplus/` への routing)。" +
    "状態は cwd の `.ai-desk-state.json` に記録、二度目以降は静か。" +
    "hint が出たら指示先のドキュメントを実際に読む。",
};

// ============================================================
// §1 絶対に守る禁忌(これを破ったらコミットしない)
//   各禁忌は { rule, why, axiom_ref } の構造化データ
// ============================================================
export const Forbidden = [
  { id: 1, rule: "TypeScript を導入しない",                            why: "型情報による隠匿排除",     axiom_ref: 'A0' },
  { id: 2, rule: "npm install で外部依存を入れない",                    why: "Eternal Compatibility",   axiom_ref: 'Bible§3' },
  { id: 3, rule: "build / transpile step を作らない",                   why: "ソース = 実行ファイル",   axiom_ref: 'Bible§3' },
  { id: 4, rule: "フレームワーク(React 等)を入れない",                  why: "暗黙の規約は隠匿の温床", axiom_ref: 'A0' },
  { id: 5, rule: "コメントマーカー(// [ai_s_emblem:...])を新規に書かない", why: "マーカー廃止、tags は // @tags: で書く", axiom_ref: 'Bible§4' },
  { id: 6, rule: "Block.versions を直接書き換えない、commit() 経由のみ", why: "REAL の append-only 性",  axiom_ref: 'A4, A6' },
  { id: 7, rule: "Block.content / refs / tags を変数化しない",          why: "SHADOW 規約",             axiom_ref: 'A3, A6' },
  { id: 8, rule: "「人間の見やすさ」で判断しない",                       why: "LLM 視点の情報密度で判断", axiom_ref: 'A0, A7' },
];

// ============================================================
// §2 コード生成ルール(Block を作る / 更新する / 戻す)
// ============================================================
export const BlockOps = {
  create: {
    rule: "新規 Block は `new Block({id, type, meta})` してから `commit()` で初回 version を append。",
    naming: "id は `<moduleId>:<prefix>:<name>` 規約。prefix は 'fn' か 'class'。",
    types: ['function', 'class', 'module', 'constraint', 'observation', 'twin'],
    example: `
const b = new Block({ id: 'mod:fn:foo', type: 'function', meta: {} });
b.commit({ content, refs, children, tags, meta });
    `,
  },
  update: {
    rule: "必ず `commit()` で新 version を append。古い version は消さない・触らない。",
    pattern: "head() の値をベースに、変更したい部分だけ差し替えて新 version を作る。",
    example: `
const head = b.head();
b.commit({
  content: head.content,                       // 変更しない
  refs: [...head.refs, { kind: 'calls', target: 'x' }],  // 追加
  children: head.children,
  tags: head.tags,
  meta: { ...head.meta, reason: 'add x dependency' },
});
    `,
  },
  rollback: {
    rule: "過去に戻すときは `b.rollback(versionIndex)` を使う。履歴を消さず、新 version として commit。",
    禁忌: "b.versions = b.versions.slice(0, n) のような直接削除は禁忌。",
  },
};

// ============================================================
// §3 parseJS の出力規約
// ============================================================
export const ParseRules = {
  function:    "function 宣言 → Block(type:'function')",
  arrow:       "const x = () => {} → Block(type:'function', tags:['arrow'])",
  klass:       "class 宣言 → Block(type:'class')",
  imports:     "import 文 → module Block の refs に { kind:'import', target } で追加",
  calls:       "同モジュール内の関数呼び出し → refs に { kind:'calls', target } で追加",
  tagComments: "直前コメントの // @tags: a, b → tags に取り込み(20 行遡及)",
  v1emblems:   "// [ai_s_emblem:#a#b Name] は互換読み専用、新規記述禁止",
  limitations: [
    "文字列リテラル中の function キーワードを誤検出する可能性",
    "ネスト関数の捕捉が浅い場合がある",
    "対応が必要なら parseJS 内の正規表現を拡張(将来的に AST 置換)",
  ],
};

// ============================================================
// §4 Graph 操作の使い分け(やりたいこと → メソッド)
// ============================================================
export const GraphOps = [
  { intent: "この関数を変えたら何に影響する?",   method: "g.impact(id)" },
  { intent: "この関数を呼んでるのは?",          method: "g.backward(id)" },
  { intent: "この関数が呼ぶのは?",              method: "g.forward(id)" },
  { intent: "特定の文字列を含む Block は?",      method: "g.search('TODO')" },
  { intent: "export されてる Block は?",        method: "g.byTag('export')" },
  { intent: "class だけ取りたい",               method: "g.byType('class')" },
  { intent: "過去の状態のグラフが見たい",        method: "g.at(timestamp)" },
  { intent: "全 Block の整合性チェック",         method: "g.verify()" },
];

// ============================================================
// §5 永続化のルール
// ============================================================
export const Persistence = {
  default_filename: "graph.json",
  derived_filename: "*.local.json",
  rule: [
    "saveGraph(graph, path) で JSON 1 ファイルに保存",
    "graph.json と *.local.json は .gitignore 済み",
    "共有が必要な永続データは別名 + レビュー後 commit",
  ],
};

// ============================================================
// §6 テスト追加のルール
// ============================================================
export const TestingRules = {
  rule: "新機能を追加したら e2e.js に最低 1 テストを追加、`npm test` all green を確認してから commit。",
  template: `
group('新機能名', () => {
  test('期待される振る舞いの説明', () => {
    // setup / act / assert
  });
});
  `,
};

// ============================================================
// §7 CLI コマンド追加のルール
// ============================================================
export const CliExtension = {
  rule: "ai-desk.js の runCommand() に case を追加。",
  steps: [
    "1. case 'mycommand': を実装",
    "2. デフォルトケース(commands list)に追加",
    "3. e2e の CLI group にテスト追加",
    "4. AiRunAndRead_BIBLE.js の Rituals に追加(REFERENCE は BIBLE に統合済)",
  ],
  example: `
case 'mycommand': {
  if (!args[0]) return console.error('usage: mycommand <arg>');
  // 実装
  break;
}
  `,
};

// ============================================================
// §8 v1(ai-desk legacy)との関係
// ============================================================
export const V1Relation = {
  rules: [
    "v1 の Bible(AI_NATIVE_MASTER_BIBLE.md)は v1 のまま、触らない",
    "v1 emblem マーカーは v2 でも読める(parseJS が tags に取り込む)が、新規記述禁止",
    "v1 と v2 は併存可能。v1 = 固定された過去、v2 = canonical",
    "v1 機能で v2 未移植のもの(focus/apply/check/coverage 等)は段階的に Block 化",
  ],
};

// ============================================================
// §9 Constraint Folding を書くとき
// ============================================================
export const ConstraintRules = {
  api: "constraintBlock({id, axes, values, derive}) → evalConstraint(cb, filter?)",
  derive_must_be: "純粋関数(I/O・乱数・時刻に触れない、Bible §7 Twin 規約と同じ)",
  filter: "浅い等価(merged[k] === v)。範囲条件は derive で派生フラグを作る",
  矛盾の表現: "filter 結果が空集合のとき _contradiction: true で返る",
  example: `
const cb = constraintBlock({
  id: 'shipping',
  axes: ['weight', 'zone'],
  values: {
    weight: [0.5, 1, 5, 10],
    zone: ['kanto', 'kansai', 'kyushu'],
  },
  derive: combo => ({
    fee: ((combo.weight <= 1 ? 300 : 500) +
          (combo.zone === 'kyushu' ? 200 : 0)),
  }),
});
evalConstraint(cb);                     // 全 12 世界
evalConstraint(cb, { fee: 700 });       // 該当する組み合わせを逆引き
  `,
};

// ============================================================
// §10 Observation Block を書くとき
// ============================================================
export const ObservationRules = {
  api: "observationBlock({id, observedId, snapshot, tags})",
  id_convention: "タイムスタンプ + 連番(時系列の自然な並び)",
  snapshot: "構造化データ(画像バイナリは別途保存して URL で参照)",
  refs: "{ kind: 'observes', target: observedId } が自動付与",
  example: `
observationBlock({
  id: 'obs:2026-05-03T10:00Z:001',
  observedId: 'mod:fn:bar',
  snapshot: { hp: 50, x: 10 },
  tags: ['ai-eyes', 'frame'],
});
  `,
};

// ============================================================
// §11 コミットメッセージの規約
// ============================================================
export const CommitConventions = {
  format: "<type>: <summary>",
  types: {
    init:     "初回コミット",
    feat:     "新機能",
    fix:      "バグ修正",
    docs:     "ドキュメント",
    test:     "テスト追加・修正",
    clearify: "振る舞いを変えない構造調整(AI 向け最適化)",
    chore:    "ビルド・ツール周り",
  },
  example: "feat(parse): support generator function syntax",
};

// ============================================================
// §12 「迷ったらどうする」(judgment compass)
// ============================================================
export const Compass = [
  { 迷い: "Block の type を増やすべきか",   判断軸: "既存 type で表現できないか先に検討。新 type は最後の手段。" },
  { 迷い: "関数を分割すべきか",             判断軸: "「LLM が一目で全文脈を把握できるか」で決める。基本はインライン化(A1)。" },
  { 迷い: "命名で迷ったとき",               判断軸: "動詞 + 目的語で書く。略語は使わない(LLM の学習に負ける)。" },
  { 迷い: "ドキュメントを書くべきか",        判断軸: "LLM が読む前提。冗長を恐れない。具体例を必ず添える。" },
  { 迷い: "新 .md を作りたくなった",         判断軸: "AI 用なら .md 禁止、AiRunAndRead_*.js を作る。人間用は README のみ。" },
];

// ============================================================
// §13 このドキュメント自体の更新ルール
// ============================================================
export const SelfUpdate = {
  rule: "気づいた LLM / 人間は AiRunAndRead_ONBOARDING.js に追記。常に updated。",
  commit_format: "docs(onboarding): ...",
  derived_md: "node v2/AiRunAndRead_ONBOARDING.js export-md > AI_ONBOARDING.md (生成は基本不要、AI は .js 直接読む)",
};

// ============================================================
// Self-display + export-md
// ============================================================
export function exportMarkdown() {
  const out = [];
  out.push(`# AI Onboarding v${VERSION}`);
  out.push(`> Auto-generated from AiRunAndRead_ONBOARDING.js — DO NOT EDIT THIS FILE DIRECTLY.`);
  out.push(`> Run \`node v2/AiRunAndRead_ONBOARDING.js export-md > AI_ONBOARDING.md\` to regenerate.`);
  out.push(`> Date: ${DATE}\n`);

  out.push(`## §0 Start Here`);
  out.push(`### Files to know`);
  for (const f of StartHere.files) out.push(`- **${f.path}**: ${f.purpose}`);
  out.push(`\n### stderr hint policy\n${StartHere.stderrHintPolicy}\n`);

  out.push(`## §1 Forbidden(これを破ったらコミットしない)`);
  for (const f of Forbidden) out.push(`- **${f.id}.** ${f.rule}  _(${f.why}, ${f.axiom_ref})_`);
  out.push('');

  out.push(`## §2 Block ops`);
  for (const [op, spec] of Object.entries(BlockOps)) {
    out.push(`### ${op}`);
    out.push(spec.rule || '');
    if (spec.example) out.push('```js' + spec.example + '```');
  }

  out.push(`## §3 parseJS rules`);
  for (const [k, v] of Object.entries(ParseRules)) {
    if (Array.isArray(v)) out.push(`- **${k}**:\n  - ${v.join('\n  - ')}`);
    else out.push(`- **${k}**: ${v}`);
  }
  out.push('');

  out.push(`## §4 Graph ops`);
  for (const o of GraphOps) out.push(`- ${o.intent} → \`${o.method}\``);
  out.push('');

  out.push(`## §5 Persistence`);
  for (const r of Persistence.rule) out.push(`- ${r}`);
  out.push('');

  out.push(`## §6 Testing\n${TestingRules.rule}\n\`\`\`js${TestingRules.template}\`\`\`\n`);

  out.push(`## §7 CLI extension\n${CliExtension.rule}`);
  for (const s of CliExtension.steps) out.push(`- ${s}`);
  out.push('');

  out.push(`## §8 v1 relation`);
  for (const r of V1Relation.rules) out.push(`- ${r}`);
  out.push('');

  out.push(`## §9 Constraint Folding`);
  for (const [k, v] of Object.entries(ConstraintRules)) {
    if (k !== 'example') out.push(`- **${k}**: ${v}`);
  }
  out.push('```js' + ConstraintRules.example + '```\n');

  out.push(`## §10 Observation Block`);
  for (const [k, v] of Object.entries(ObservationRules)) {
    if (k !== 'example') out.push(`- **${k}**: ${v}`);
  }
  out.push('```js' + ObservationRules.example + '```\n');

  out.push(`## §11 Commit conventions`);
  out.push(`format: \`${CommitConventions.format}\``);
  for (const [t, d] of Object.entries(CommitConventions.types)) out.push(`- \`${t}\`: ${d}`);
  out.push(`example: \`${CommitConventions.example}\`\n`);

  out.push(`## §12 Compass(迷ったときの判断軸)`);
  for (const c of Compass) out.push(`- **${c.迷い}** → ${c.判断軸}`);
  out.push('');

  out.push(`## §13 Self-update\n${SelfUpdate.rule}\ncommit format: \`${SelfUpdate.commit_format}\``);

  return out.join('\n');
}

if (typeof process !== 'undefined' && /AiRunAndRead_ONBOARDING\.js$/.test(process.argv[1] || '')) {
  if (process.argv[2] === 'export-md') {
    process.stdout.write(exportMarkdown());
  } else {
    console.log(`\n##  AiRunAndRead_ONBOARDING.js v${VERSION}  ##\n`);
    console.log(`Forbidden(${Forbidden.length} items):`);
    for (const f of Forbidden) console.log(`  ${f.id}. ${f.rule}`);
    console.log(`\nGraph ops(${GraphOps.length} intents):`);
    for (const o of GraphOps) console.log(`  - ${o.intent} → ${o.method}`);
    console.log(`\nUsage:`);
    console.log(`  node AiRunAndRead_ONBOARDING.js export-md > AI_ONBOARDING.md`);
    console.log(`  import { Forbidden, BlockOps, GraphOps, ... } from './AiRunAndRead_ONBOARDING.js'`);
  }
}
