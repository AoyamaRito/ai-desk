#!/usr/bin/env node

// Author: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
// SPDX-License-Identifier: MIT
// ai-desk (Emblem Edition) — AI-Native Workspace Manager
//
// Refactored under Bible §0.1 (Heavy Functions / No-Shared Helpers / Inline > Extract):
//   各モードは自己完結した重厚関数として、Emblem境界内に全ロジックをインライン化。
//   regex / パース / I/O をモード間で共有せず、各機能内で独立して進化させる。
//   重複は悪ではない。隠れた依存（共通ヘルパーの暗黙の影響範囲）こそが悪。

const fs = require('fs');

const path = require('path');
let CONFIG = {
  emblemMarker: 'ai_s_emblem',
  bridgeMarker: 'ai_s_bridge',
  customTags: []
};
try {
  const configPath = path.join(process.cwd(), 'ai-desk.config.json');
  if (fs.existsSync(configPath)) {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    CONFIG = { ...CONFIG, ...userConfig };
  }
} catch (e) { /* fallback to defaults */ }

const EMB_MARK = CONFIG.emblemMarker;
const BRD_MARK = CONFIG.bridgeMarker;


// [ai_s_emblem:#low#config Help]
const HELP_TEXT = `ai-desk (Emblem Edition) - Robust Workspace Manager

Usage:
  ai-desk <filename> <mode> [args...]

Modes:
  skeleton                    Layer-sorted map of emblems and bridges with line numbers.
                              Order: L1 → L1toL2 → L2 → L2toL3 → L3 → L3toL4
                                     → L3toPersistent → L3toNetwork → L4 → OutOfLayers.
  focus <Name>                Extract the exact source of the specified emblem or bridge.
  apply <patch> [--dry-run]   Pre-flight verify all patch names exist in target,
                              then atomically replace. Fails (no mutation) if any
                              patch is unresolved or duplicated. --dry-run prints
                              the plan without writing.
  check                       Verify emblem/bridge integrity (nesting, uniqueness, completeness).
  coverage                    Bridge coverage report. Which layer transitions have bridges declared.

Format (emblem):
  // [${EMB_MARK}:#importance#layer#tag <name>]
  // ... code ...
  // [/${EMB_MARK}: <name>]

Format (bridge — explicit layer crossing):
  // [${BRD_MARK}:LXtoLY <name>]
  // ... code ...
  // [/${BRD_MARK}: <name>]

Layer tags for emblems:
  #L1 / #physical    Physical I/O, DOM, events
  #L2 / #intent      Command translation
  #L3 / #logic       Pure reducers, state
  #L4 / #draw        Rendering
  #verify            Twin (検証双子) — Bible §4.5。L4直後に表示。
  #OutOfLayers / #config  Explicitly outside the 4-layer model (config, utils, types)

Aspect tags (optional — used alongside layer tags, e.g. #high#L2#auth):
  #auth              認証・認可
  #security          セキュリティ（入力検証・暗号・サニタイズ）
  Project-specific aspects → ai-desk.config.json customTags

Bridge directions:
  L1toL2, L2toL3, L3toL4, L3toPersistent, L3toNetwork, ...

NOTE: 原則は強制しない。ai-desk は層違反を理由にパッチを拒否しない。
      Bridge と OutOfLayers は「見える化」のためのタグである。

Examples:
  ai-desk app.js skeleton
  ai-desk app.js focus MainLogic
  ai-desk app.js apply patch.js
`;
// [/ai_s_emblem: Help]

// [ai_s_emblem:#mid#cli Dispatcher]
// 純粋ルーティングのみ。各モードは自分でファイルを読み・パースする（自己完結）。
const args = process.argv.slice(2);
if (args.length < 2 || args.includes('-h') || args.includes('--help')) {
  console.log(HELP_TEXT);
  process.exit(0);
}
const filePath = args[0];
const mode = args[1];
const extraArgs = args.slice(2);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

switch (mode) {
  case 'skeleton': runSkeleton(filePath); break;
  case 'focus':    runFocus(filePath, extraArgs[0]); break;
  case 'apply':    runApply(filePath, extraArgs[0], extraArgs.slice(1)); break;
  case 'check':    runCheck(filePath); break;
  case 'coverage': runCoverage(filePath); break;
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
// [/ai_s_emblem: Dispatcher]

// [ai_s_emblem:#high#logic Run-Skeleton]
function runSkeleton(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  // Inline parsers (Bible §0.1.2 — 共有禁止: regexは各モードに複製).
  const EMBLEM_RE = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
  const BRIDGE_RE = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');

  // Char index → 1-indexed line number. インライン展開（§0.1.2 共有禁止）。
  // 行頭オフセットを線形走査で構築 → 各タグの開始/終了位置から行番号を引く。
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (idx) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };

  const items = [];
  let m;

  // Emblem 収集 + レイヤー判定。
  // 既存カテゴリ（#physical/#intent/#logic/#draw）を内部マッピングし、新しい #L1-#L4 と #OutOfLayers も受ける。
  // 推測でフォールバックさせない: タグ無しは「(untagged)」として末尾に分離する。
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const [, meta, name, content] = m;
    if (content.includes(`// [${EMB_MARK}:`) || content.includes(`// [${BRD_MARK}:`)) {
      console.warn(`Warning: Potential nested tag detected inside emblem '${name}'. Tags should be flat.`);
    }
    const trimmed = content.trim();
    const lines = trimmed === '' ? 0 : trimmed.split('\n').length;
    const startLine = lineOf(m.index);
    const endLine = lineOf(m.index + m[0].length - 1);
    let sortKey, label;
    if      (/#L1\b/.test(meta) || /#physical\b/.test(meta)) { sortKey = 1.0;   label = 'L1'; }
    else if (/#L2\b/.test(meta) || /#intent\b/.test(meta))   { sortKey = 2.0;   label = 'L2'; }
    else if (/#L3\b/.test(meta) || /#logic\b/.test(meta))    { sortKey = 3.0;   label = 'L3'; }
    else if (/#L4\b/.test(meta) || /#draw\b/.test(meta))     { sortKey = 4.0;   label = 'L4'; }
    else if (/#verify\b/.test(meta))                         { sortKey = 5.0;   label = 'Verify'; }
    else if (/#OutOfLayers\b/.test(meta) || /#config\b/.test(meta)) { sortKey = 100.0; label = 'OutOfLayers'; }
    else                                                     { sortKey = 200.0; label = '(untagged)'; }
    items.push({ kind: 'emblem', sortKey, label, meta, name, lines, startLine, endLine });
  }

  // Bridge 収集 + 方向解析。LxtoLy / LxtoPersistent / LxtoNetwork。
  // 不明な方向はOutOfLayersの直前 (150) に置く。強制はしない。
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    const [, direction, name, content] = m;
    if (content.includes(`// [${EMB_MARK}:`) || content.includes(`// [${BRD_MARK}:`)) {
      console.warn(`Warning: Potential nested tag detected inside bridge '${name}'. Tags should be flat.`);
    }
    const trimmed = content.trim();
    const lines = trimmed === '' ? 0 : trimmed.split('\n').length;
    const startLine = lineOf(m.index);
    const endLine = lineOf(m.index + m[0].length - 1);
    let sortKey;
    const fromMatch = direction.match(/^L(\d)to(.+)$/);
    if (fromMatch) {
      const from = parseInt(fromMatch[1], 10);
      const rest = fromMatch[2];
      if      (/^L\d/.test(rest))      sortKey = from + 0.5;
      else if (rest === 'Persistent')  sortKey = from + 0.6;
      else if (rest === 'Network')     sortKey = from + 0.7;
      else                             sortKey = from + 0.8;
    } else {
      sortKey = 150.0;
    }
    items.push({ kind: 'bridge', sortKey, label: direction, meta: direction, name, lines, startLine, endLine });
  }

  // 安定ソート: layer順、同層内は出現順を保つ（Array#sort は V8 で stable）。
  items.sort((a, b) => a.sortKey - b.sortKey);

  const emblemCount = items.filter(i => i.kind === 'emblem').length;
  const bridgeCount = items.filter(i => i.kind === 'bridge').length;
  console.log(`[Skeleton] ${filePath} (layer-sorted)`);
  console.log(`${emblemCount} emblems, ${bridgeCount} bridges`);
  console.log('');

  let prevLabel = null;
  for (const item of items) {
    if (item.label !== prevLabel) {
      console.log(`-- ${item.label} --`);
      prevLabel = item.label;
    }
    const range = `(L${item.startLine}-${item.endLine})`;
    if (item.kind === 'emblem') {
      console.log(`// [${EMB_MARK}:${item.meta} ${item.name}] ${range}`);
      console.log(`  /* [Emblem: ${item.name} (${item.lines} lines hidden)] */`);
      console.log(`// [/${EMB_MARK}: ${item.name}]`);
    } else {
      console.log(`// [${BRD_MARK}:${item.meta} ${item.name}] ${range}`);
      console.log(`  /* [Bridge: ${item.name} ${item.meta} (${item.lines} lines hidden)] */`);
      console.log(`// [/${BRD_MARK}: ${item.name}]`);
    }
    console.log('');
  }
}
// [/ai_s_emblem: Run-Skeleton]

// [ai_s_emblem:#high#logic Run-Focus]
function runFocus(filePath, targetName) {
  if (!targetName) {
    console.error('Error: Please specify an emblem or bridge name to focus.');
    process.exit(1);
  }
  const code = fs.readFileSync(filePath, 'utf8');
  // Emblem を先に走査（既存互換）。
  const EMBLEM_RE = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    if (m[2] === targetName) {
      // 'apply' でラウンドトリップできるよう、ヘッダ・フッタを含む全体を出力。
      console.log(m[0]);
      return;
    }
  }
  // Bridge も独立 regex で走査（§0.1.2 共有禁止）。
  const BRIDGE_RE = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    if (m[2] === targetName) {
      console.log(m[0]);
      return;
    }
  }
  console.error(`Error: Tag '${targetName}' not found (searched emblems and bridges).`);
  process.exit(1);
}
// [/ai_s_emblem: Run-Focus]

// [ai_s_emblem:#high#logic Run-Check]
function runCheck(filePath) {
  console.log(`[Check] Verifying ${filePath}...`);
  const code = fs.readFileSync(filePath, 'utf8');

  let errors = 0;
  let warnings = 0;

  const KNOWN_TAGS = new Set([
    ...CONFIG.customTags,
    '#high', '#mid', '#low',
    '#L1', '#L2', '#L3', '#L4',
    '#physical', '#intent', '#logic', '#draw',
    '#verify', '#OutOfLayers', '#config',
    // Aspect tags — 層と直交する横断関心事。最小限のみ。プロジェクト固有は customTags へ。
    '#auth', '#security'
  ]);

  // Emblem 検査（既存ロジックそのまま）。
  const EMBLEM_RE = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
  let parsedEmblems = 0;
  const emblemNames = new Set();
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const name = m[2];
    if (m[3].includes(`// [${EMB_MARK}:`) || m[3].includes(`// [${BRD_MARK}:`)) {
      console.warn(`Warning: Potential nested tag detected inside emblem '${name}'. Tags should be flat.`);
    }
    if (emblemNames.has(name)) {
      console.error(`Error: Duplicate emblem name found: '${name}'`);
      errors++;
    }
    emblemNames.add(name);
    for (const tag of (m[1].match(/#\w+/g) || [])) {
      if (!KNOWN_TAGS.has(tag)) {
        console.warn(`  Warning: emblem '${name}' has unrecognized tag '${tag}' — possible typo.`);
        warnings++;
      }
    }
    parsedEmblems++;
  }
  const emblemStarts = (code.match(new RegExp(`\\/\\/ \\[${EMB_MARK}:`, 'g')) || []).length;
  const emblemEnds   = (code.match(new RegExp(`\\/\\/ \\[\\/${EMB_MARK}:`, 'g')) || []).length;
  if (emblemStarts !== emblemEnds) {
    console.error(`Error: Emblem tag count mismatch! Start: ${emblemStarts}, End: ${emblemEnds}`);
    errors++;
  }
  if (parsedEmblems !== emblemStarts) {
    console.error(`Error: Some emblems are malformed and couldn't be parsed correctly.`);
    errors++;
  }

  // Bridge 検査（独立 regex / 独立カウンタ §0.1.2 共有禁止）。
  // 方向は原則強制しないが、非標準パターンは警告する（typo検知）。
  const BRIDGE_RE = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');
  const CANONICAL_DIR_RE = /^L[1-4]to(L[1-4]|Persistent|Network|Verify)$/;
  let parsedBridges = 0;
  const bridgeNames = new Set();
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    const dir = m[1], name = m[2];
    if (m[3].includes(`// [${EMB_MARK}:`) || m[3].includes(`// [${BRD_MARK}:`)) {
      console.warn(`Warning: Potential nested tag detected inside bridge '${name}'. Tags should be flat.`);
    }
    if (bridgeNames.has(name)) {
      console.error(`Error: Duplicate bridge name found: '${name}'`);
      errors++;
    }
    if (!CANONICAL_DIR_RE.test(dir)) {
      console.warn(`  Warning: bridge '${name}' has non-canonical direction '${dir}' — expected L[1-4]to(L[1-4]|Persistent|Network|Verify).`);
      warnings++;
    }
    bridgeNames.add(name);
    parsedBridges++;
  }
  const bridgeStarts = (code.match(new RegExp(`\\/\\/ \\[${BRD_MARK}:`, 'g')) || []).length;
  const bridgeEnds   = (code.match(new RegExp(`\\/\\/ \\[\\/${BRD_MARK}:`, 'g')) || []).length;
  if (bridgeStarts !== bridgeEnds) {
    console.error(`Error: Bridge tag count mismatch! Start: ${bridgeStarts}, End: ${bridgeEnds}`);
    errors++;
  }
  if (parsedBridges !== bridgeStarts) {
    console.error(`Error: Some bridges are malformed and couldn't be parsed correctly.`);
    errors++;
  }

  if (errors === 0) {
    const warnSuffix = warnings > 0 ? ` ⚠ ${warnings} tag/direction warning(s).` : '';
    console.log(`✓ All ${parsedEmblems} emblems and ${parsedBridges} bridges are valid and unique.${warnSuffix}`);
  } else {
    const warnNote = warnings > 0 ? ` (+ ${warnings} warning(s))` : '';
    console.log(`✗ Found ${errors} error(s) in tag structure.${warnNote}`);
    process.exit(1);
  }
}
// [/ai_s_emblem: Run-Check]

// [ai_s_emblem:#high#logic Run-Coverage]
function runCoverage(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const EMBLEM_RE = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
  const BRIDGE_RE = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');

  const layerCounts = { L1: 0, L2: 0, L3: 0, L4: 0, Verify: 0 };
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const meta = m[1];
    if      (/#L1\b|#physical\b/.test(meta))  layerCounts.L1++;
    else if (/#L2\b|#intent\b/.test(meta))    layerCounts.L2++;
    else if (/#L3\b|#logic\b/.test(meta))     layerCounts.L3++;
    else if (/#L4\b|#draw\b/.test(meta))      layerCounts.L4++;
    else if (/#verify\b/.test(meta))          layerCounts.Verify++;
  }

  const bridges = new Map();
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    const dir = m[1];
    if (!bridges.has(dir)) bridges.set(dir, []);
    bridges.get(dir).push(m[2]);
  }

  const layerSummary = Object.entries(layerCounts)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => `${l}(${n})`)
    .join('  ');
  const bridgeSummary = bridges.size > 0
    ? [...bridges.entries()].map(([d, ns]) => `${d}(${ns.join(',')})`).join('  ')
    : '(none)';

  console.log(`[Coverage] ${filePath}\n`);
  console.log(`Layer emblems: ${layerSummary || '(none)'}`);
  console.log(`Bridges:       ${bridgeSummary}\n`);

  const CORE_TRANSITIONS = [
    { dir: 'L1toL2', from: 'L1', to: 'L2' },
    { dir: 'L2toL3', from: 'L2', to: 'L3' },
    { dir: 'L3toL4', from: 'L3', to: 'L4' },
    { dir: 'L4toVerify', from: 'L4', to: 'Verify' },
  ];

  let warnings = 0;
  console.log('Transition check:');
  for (const { dir, from, to } of CORE_TRANSITIONS) {
    const fromPresent = layerCounts[from] > 0;
    const toPresent   = layerCounts[to]   > 0;
    if (!fromPresent || !toPresent) continue;
    if (bridges.has(dir)) {
      console.log(`  OK   ${from} → ${to}  [${bridges.get(dir).join(', ')}]`);
    } else {
      console.log(`  WARN ${from} → ${to}  (no bridge — both layers present)`);
      warnings++;
    }
  }

  const extraBridges = [...bridges.keys()].filter(d => !CORE_TRANSITIONS.find(t => t.dir === d));
  if (extraBridges.length > 0) {
    console.log(`  OK   extra bridges: ${extraBridges.join(', ')}`);
  }

  console.log('');
  if (warnings === 0) {
    console.log(`✓ No missing bridges detected.`);
  } else {
    console.log(`⚠ ${warnings} potential gap(s). (Informational — Bible §2: 原則は強制しない)`);
  }
}
// [/ai_s_emblem: Run-Coverage]

// [ai_s_emblem:#high#logic Run-Apply]
// セマンティクス: pre-flight 検証 → 全成功なら原子的書込 / 1件でも失敗で何もしない (Atomic apply)。
//   --dry-run を渡すと plan を表示するだけで書き込まない。
//   旧仕様の「skip して継続」は廃止。中途半端な状態は AI を混乱させるため (§0.0)。
function runApply(filePath, patchPath, flags = []) {
  const isDryRun = flags.includes('--dry-run');
  if (!patchPath || !fs.existsSync(patchPath)) {
    console.error('Error: Valid patch file required.');
    process.exit(1);
  }

  const targetCode = fs.readFileSync(filePath, 'utf8');
  const patchCode = fs.readFileSync(patchPath, 'utf8');

  // パッチ側の Emblem を一括収集（独立 regex、§0.1.2 共有禁止）。
  const patchEmblems = [];
  {
    const re = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
    let m;
    while ((m = re.exec(patchCode)) !== null) {
      patchEmblems.push({ meta: m[1], name: m[2], content: m[3] });
    }
  }
  // パッチ側の Bridge も独立 regex で収集（§0.1.2 共有禁止）。
  const patchBridges = [];
  {
    const re = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');
    let m;
    while ((m = re.exec(patchCode)) !== null) {
      patchBridges.push({ direction: m[1], name: m[2], content: m[3] });
    }
  }
  if (patchEmblems.length === 0 && patchBridges.length === 0) {
    console.error(`Error: No valid ${EMB_MARK} or ${BRD_MARK} blocks found in patch.`);
    process.exit(1);
  }

  // ---- Pre-flight: 全 patch 名がターゲットに「ちょうど1件」存在するか検証。
  // 失敗（unresolved / duplicate）が1件でもあれば exit 1（書き込みなし）。
  const plan = []; // { kind, name, meta, start, end, replacement }
  const failures = [];

  for (const pEmb of patchEmblems) {
    const re = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(targetCode)) !== null) {
      if (m[2] === pEmb.name) {
        matches.push({ meta: m[1], start: m.index, end: m.index + m[0].length });
      }
    }
    if (matches.length === 1) {
      const t = matches[0];
      // Tag Immutability: ヘッダ・フッタはターゲット側を保持し、中身だけ差し替える。
      const replacement = `// [${EMB_MARK}:${t.meta} ${pEmb.name}]\n${pEmb.content.trim()}\n// [/${EMB_MARK}: ${pEmb.name}]`;
      plan.push({ kind: 'emblem', name: pEmb.name, meta: t.meta, start: t.start, end: t.end, replacement });
    } else if (matches.length > 1) {
      failures.push(`emblem '${pEmb.name}' is duplicated in target (${matches.length} matches)`);
    } else {
      failures.push(`emblem '${pEmb.name}' not found in target`);
    }
  }

  for (const pBr of patchBridges) {
    const re = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(targetCode)) !== null) {
      if (m[2] === pBr.name) {
        matches.push({ direction: m[1], start: m.index, end: m.index + m[0].length });
      }
    }
    if (matches.length === 1) {
      const t = matches[0];
      const replacement = `// [${BRD_MARK}:${t.direction} ${pBr.name}]\n${pBr.content.trim()}\n// [/${BRD_MARK}: ${pBr.name}]`;
      plan.push({ kind: 'bridge', name: pBr.name, meta: t.direction, start: t.start, end: t.end, replacement });
    } else if (matches.length > 1) {
      failures.push(`bridge '${pBr.name}' is duplicated in target (${matches.length} matches)`);
    } else {
      failures.push(`bridge '${pBr.name}' not found in target`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[FATAL] Pre-flight failed (${failures.length} issue${failures.length > 1 ? 's' : ''}). No changes written.`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  // ---- Dry-run: plan を表示して終了。
  if (isDryRun) {
    console.log(`[Dry-Run] ${filePath} ← ${patchPath}`);
    console.log(`Plan: ${plan.length} replacement${plan.length > 1 ? 's' : ''} would be applied.\n`);
    for (const p of plan) {
      console.log(`  ${p.kind} '${p.name}' [${p.meta}]  bytes ${p.start}..${p.end}`);
    }
    console.log(`\n(no file written — re-run without --dry-run to apply)`);
    return;
  }

  // ---- Atomic apply: 全 plan を後ろから splice して原コードに 1 回で適用。
  // 後ろから処理することで先頭の置換による offset ズレを回避（巻き戻り耐性）。
  const sortedPlan = [...plan].sort((a, b) => b.start - a.start);
  let newCode = targetCode;
  for (const p of sortedPlan) {
    newCode = newCode.slice(0, p.start) + p.replacement + newCode.slice(p.end);
  }

  // ---- Destruction Fence: タグ件数の不変性を検査（壊れていたら書かない）。
  const baseEmblemStarts = (targetCode.match(new RegExp(`\\/\\/ \\[${EMB_MARK}:`, 'g')) || []).length;
  const baseBridgeStarts = (targetCode.match(new RegExp(`\\/\\/ \\[${BRD_MARK}:`, 'g')) || []).length;
  const postEmblemStarts = (newCode.match(new RegExp(`\\/\\/ \\[${EMB_MARK}:`, 'g')) || []).length;
  const postEmblemEnds   = (newCode.match(new RegExp(`\\/\\/ \\[\\/${EMB_MARK}:`, 'g')) || []).length;
  const postBridgeStarts = (newCode.match(new RegExp(`\\/\\/ \\[${BRD_MARK}:`, 'g')) || []).length;
  const postBridgeEnds   = (newCode.match(new RegExp(`\\/\\/ \\[\\/${BRD_MARK}:`, 'g')) || []).length;
  if (postEmblemStarts !== postEmblemEnds || postBridgeStarts !== postBridgeEnds ||
      postEmblemStarts !== baseEmblemStarts || postBridgeStarts !== baseBridgeStarts) {
    console.error(`\n[FATAL] Apply cancelled! Tag structure broken after replacement. No file written.`);
    console.error(`  emblem starts: ${baseEmblemStarts} → ${postEmblemStarts} / ends: ${postEmblemEnds}`);
    console.error(`  bridge starts: ${baseBridgeStarts} → ${postBridgeStarts} / ends: ${postBridgeEnds}`);
    process.exit(1);
  }

  // ---- 原子書き込み: tmp に書いてから rename することでクラッシュによるファイル破壊を防ぐ。
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, newCode, 'utf8');
  fs.renameSync(tmpPath, filePath);
  console.log(`Applied ${plan.length} patch${plan.length > 1 ? 'es' : ''} to ${filePath}. (atomic, immutability check passed)`);
  for (const p of plan) console.log(`  - ${p.kind} '${p.name}'`);
}
// [/ai_s_emblem: Run-Apply]
