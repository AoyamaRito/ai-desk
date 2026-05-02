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
  skeleton           Layer-sorted map of emblems and bridges.
                     Order: L1 → L1toL2 → L2 → L2toL3 → L3 → L3toL4
                            → L3toPersistent → L3toNetwork → L4 → OutOfLayers.
  focus <Name>       Extract the exact source of the specified emblem or bridge.
  apply <patch>      Replace emblems/bridges in target matching the patch's names.
  check              Verify emblem/bridge integrity (nesting, uniqueness, completeness).
  coverage           Bridge coverage report. Which layer transitions have bridges declared.
  miner <data.json>  [AI-Only] Extract logic (laws) from data and synthesize code.

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

if (mode !== 'miner' && !fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

switch (mode) {
  case 'skeleton': runSkeleton(filePath); break;
  case 'focus':    runFocus(filePath, extraArgs[0]); break;
  case 'apply':    runApply(filePath, extraArgs[0]); break;
  case 'check':    runCheck(filePath); break;
  case 'coverage': runCoverage(filePath); break;
  case 'miner':    runMiner(extraArgs[0]); break;
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
    let sortKey, label;
    if      (/#L1\b/.test(meta) || /#physical\b/.test(meta)) { sortKey = 1.0;   label = 'L1'; }
    else if (/#L2\b/.test(meta) || /#intent\b/.test(meta))   { sortKey = 2.0;   label = 'L2'; }
    else if (/#L3\b/.test(meta) || /#logic\b/.test(meta))    { sortKey = 3.0;   label = 'L3'; }
    else if (/#L4\b/.test(meta) || /#draw\b/.test(meta))     { sortKey = 4.0;   label = 'L4'; }
    else if (/#verify\b/.test(meta))                         { sortKey = 5.0;   label = 'Verify'; }
    else if (/#OutOfLayers\b/.test(meta) || /#config\b/.test(meta)) { sortKey = 100.0; label = 'OutOfLayers'; }
    else                                                     { sortKey = 200.0; label = '(untagged)'; }
    items.push({ kind: 'emblem', sortKey, label, meta, name, lines });
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
    items.push({ kind: 'bridge', sortKey, label: direction, meta: direction, name, lines });
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
    if (item.kind === 'emblem') {
      console.log(`// [${EMB_MARK}:${item.meta} ${item.name}]`);
      console.log(`  /* [Emblem: ${item.name} (${item.lines} lines hidden)] */`);
      console.log(`// [/${EMB_MARK}: ${item.name}]`);
    } else {
      console.log(`// [${BRD_MARK}:${item.meta} ${item.name}]`);
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
function runApply(filePath, patchPath) {
  if (!patchPath || !fs.existsSync(patchPath)) {
    console.error('Error: Valid patch file required.');
    process.exit(1);
  }

  let newCode = fs.readFileSync(filePath, 'utf8');
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

  // 適用前のタグ数を記録（破壊検知のため）。Emblem / Bridge 別カウント。
  const baseEmblemStarts = (newCode.match(new RegExp(`\\/\\/ \\[${EMB_MARK}:`, 'g')) || []).length;
  const baseBridgeStarts = (newCode.match(new RegExp(`\\/\\/ \\[${BRD_MARK}:`, 'g')) || []).length;
  let appliedCount = 0;

  // Emblem パッチ適用
  for (const pEmb of patchEmblems) {
    const re = new RegExp(`\\/\\/ \\[${EMB_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${EMB_MARK}: \\2\\]`, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(newCode)) !== null) {
      if (m[2] === pEmb.name) {
        matches.push({ meta: m[1], name: m[2], start: m.index, end: m.index + m[0].length });
      }
    }
    if (matches.length === 1) {
      const t = matches[0];
      // Tag Immutability: ヘッダ・フッタはターゲット側を保持し、中身だけ差し替える。
      const safeReplacement = `// [${EMB_MARK}:${t.meta} ${t.name}]\n${pEmb.content.trim()}\n// [/${EMB_MARK}: ${t.name}]`;
      newCode = newCode.slice(0, t.start) + safeReplacement + newCode.slice(t.end);
      appliedCount++;
      console.log(`Applied patch for emblem: ${pEmb.name}`);
    } else if (matches.length > 1) {
      console.log(`Warning: Duplicate emblem name '${pEmb.name}' in target. (Skipping for safety)`);
    } else {
      console.log(`Warning: Emblem '${pEmb.name}' not found in target. (Skipping)`);
    }
  }

  // Bridge パッチ適用（独立ロジック §0.1.2 共有禁止）
  for (const pBr of patchBridges) {
    const re = new RegExp(`\\/\\/ \\[${BRD_MARK}:([^\\]\\s]*) ([\\w\\-]+)\\]([\\s\\S]*?)\\/\\/ \\[\\/${BRD_MARK}: \\2\\]`, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(newCode)) !== null) {
      if (m[2] === pBr.name) {
        matches.push({ direction: m[1], name: m[2], start: m.index, end: m.index + m[0].length });
      }
    }
    if (matches.length === 1) {
      const t = matches[0];
      const safeReplacement = `// [${BRD_MARK}:${t.direction} ${t.name}]\n${pBr.content.trim()}\n// [/${BRD_MARK}: ${t.name}]`;
      newCode = newCode.slice(0, t.start) + safeReplacement + newCode.slice(t.end);
      appliedCount++;
      console.log(`Applied patch for bridge: ${pBr.name}`);
    } else if (matches.length > 1) {
      console.log(`Warning: Duplicate bridge name '${pBr.name}' in target. (Skipping for safety)`);
    } else {
      console.log(`Warning: Bridge '${pBr.name}' not found in target. (Skipping)`);
    }
  }

  if (appliedCount === 0) {
    console.log('No patches applied. (All emblems/bridges were not found or skipped)');
    return;
  }

  // Destruction Fence: Emblem / Bridge どちらも対称性と件数不変を検査。
  {
    const postEmblemStarts = (newCode.match(new RegExp(`\\/\\/ \\[${EMB_MARK}:`, 'g')) || []).length;
    const postEmblemEnds   = (newCode.match(new RegExp(`\\/\\/ \\[\\/${EMB_MARK}:`, 'g')) || []).length;
    const postBridgeStarts = (newCode.match(new RegExp(`\\/\\/ \\[${BRD_MARK}:`, 'g')) || []).length;
    const postBridgeEnds   = (newCode.match(new RegExp(`\\/\\/ \\[\\/${BRD_MARK}:`, 'g')) || []).length;
    if (postEmblemStarts !== postEmblemEnds) {
      console.error(`\n[FATAL] Apply cancelled! Emblem tag corrupted (starts: ${postEmblemStarts}, ends: ${postEmblemEnds}).`);
      process.exit(1);
    }
    if (postBridgeStarts !== postBridgeEnds) {
      console.error(`\n[FATAL] Apply cancelled! Bridge tag corrupted (starts: ${postBridgeStarts}, ends: ${postBridgeEnds}).`);
      process.exit(1);
    }
    if (postEmblemStarts !== baseEmblemStarts) {
      console.error(`\n[FATAL] Apply cancelled! Emblem count changed (${baseEmblemStarts} -> ${postEmblemStarts}).`);
      console.error(`Structural changes (adding/removing tags) are restricted in 'apply' to prevent destruction.`);
      process.exit(1);
    }
    if (postBridgeStarts !== baseBridgeStarts) {
      console.error(`\n[FATAL] Apply cancelled! Bridge count changed (${baseBridgeStarts} -> ${postBridgeStarts}).`);
      console.error(`Structural changes (adding/removing tags) are restricted in 'apply' to prevent destruction.`);
      process.exit(1);
    }
    // 原子書き込み: tmp に書いてから rename することでクラッシュによるファイル破壊を防ぐ。
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, newCode, 'utf8');
    fs.renameSync(tmpPath, filePath);
    console.log(`Successfully updated ${filePath}. (Immutability check passed)`);
  }
}
// [/ai_s_emblem: Run-Apply]

// [ai_s_emblem:#mid#logic Run-Miner]
function runMiner(dataPath) {
  if (!dataPath || !fs.existsSync(dataPath)) {
    console.error('Error: Valid data file (.json or .csv) required for mining.');
    process.exit(1);
  }
  const dataContent = fs.readFileSync(dataPath, 'utf8');
  console.log(`\n[Miner] Data loaded from ${dataPath}.`);
  console.log(`\n--- DATASET START ---`);
  console.log(dataContent);
  console.log(`--- DATASET END ---`);
  console.log(`\n[AI Action Required]: Analyze the dataset above, extract the underlying laws, and synthesize a self-contained Heavy Function in JavaScript.`);
  // miner はデータを標準出力に流すだけで終わる。コード合成はこの出力を読んだ AI の推論ループ内で行われる。
  // 単体実行では何も生成しない。
}
// [/ai_s_emblem: Run-Miner]
