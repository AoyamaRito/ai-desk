#!/usr/bin/env node

// ai-desk (Emblem Edition) — AI-Native Workspace Manager
//
// Refactored under Bible §0.1 (Heavy Functions / No-Shared Helpers / Inline > Extract):
//   各モードは自己完結した重厚関数として、Emblem境界内に全ロジックをインライン化。
//   regex / パース / I/O をモード間で共有せず、各機能内で独立して進化させる。
//   重複は悪ではない。隠れた依存（共通ヘルパーの暗黙の影響範囲）こそが悪。

const fs = require('fs');

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
  miner <data.json>  [AI-Only] Extract logic (laws) from data and synthesize code.

Format (emblem):
  // [ai_s_emblem:#importance#layer#tag <name>]
  // ... code ...
  // [/ai_s_emblem: <name>]

Format (bridge — explicit layer crossing):
  // [ai_s_bridge:LXtoLY <name>]
  // ... code ...
  // [/ai_s_bridge: <name>]

Layer tags for emblems:
  #L1 / #physical    Physical I/O, DOM, events
  #L2 / #intent      Command translation
  #L3 / #logic       Pure reducers, state
  #L4 / #draw        Rendering
  #OutOfLayers       Explicitly outside the 4-layer model (config, utils, types)

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
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
  const BRIDGE_RE = /\/\/ \[ai_s_bridge:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_bridge: \2\]/g;

  const items = [];
  let m;

  // Emblem 収集 + レイヤー判定。
  // 既存カテゴリ（#physical/#intent/#logic/#draw）を内部マッピングし、新しい #L1-#L4 と #OutOfLayers も受ける。
  // 推測でフォールバックさせない: タグ無しは「(untagged)」として末尾に分離する。
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const [, meta, name, content] = m;
    if (content.includes('// [ai_s_emblem:') || content.includes('// [ai_s_bridge:')) {
      console.warn(`Warning: Potential nested tag detected inside emblem '${name}'. Tags should be flat.`);
    }
    const trimmed = content.trim();
    const lines = trimmed === '' ? 0 : trimmed.split('\n').length;
    let sortKey, label;
    if      (/#L1\b/.test(meta) || /#physical\b/.test(meta)) { sortKey = 1.0;   label = 'L1'; }
    else if (/#L2\b/.test(meta) || /#intent\b/.test(meta))   { sortKey = 2.0;   label = 'L2'; }
    else if (/#L3\b/.test(meta) || /#logic\b/.test(meta))    { sortKey = 3.0;   label = 'L3'; }
    else if (/#L4\b/.test(meta) || /#draw\b/.test(meta))     { sortKey = 4.0;   label = 'L4'; }
    else if (/#OutOfLayers\b/.test(meta))                    { sortKey = 100.0; label = 'OutOfLayers'; }
    else                                                     { sortKey = 200.0; label = '(untagged)'; }
    items.push({ kind: 'emblem', sortKey, label, meta, name, lines });
  }

  // Bridge 収集 + 方向解析。LxtoLy / LxtoPersistent / LxtoNetwork。
  // 不明な方向はOutOfLayersの直前 (150) に置く。強制はしない。
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    const [, direction, name, content] = m;
    if (content.includes('// [ai_s_emblem:') || content.includes('// [ai_s_bridge:')) {
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
      console.log(`// [ai_s_emblem:${item.meta} ${item.name}]`);
      console.log(`  /* [Emblem: ${item.name} (${item.lines} lines hidden)] */`);
      console.log(`// [/ai_s_emblem: ${item.name}]`);
    } else {
      console.log(`// [ai_s_bridge:${item.meta} ${item.name}]`);
      console.log(`  /* [Bridge: ${item.name} ${item.meta} (${item.lines} lines hidden)] */`);
      console.log(`// [/ai_s_bridge: ${item.name}]`);
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
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    if (m[2] === targetName) {
      // 'apply' でラウンドトリップできるよう、ヘッダ・フッタを含む全体を出力。
      console.log(m[0]);
      return;
    }
  }
  // Bridge も独立 regex で走査（§0.1.2 共有禁止）。
  const BRIDGE_RE = /\/\/ \[ai_s_bridge:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_bridge: \2\]/g;
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

  // Emblem 検査（既存ロジックそのまま）。
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
  let parsedEmblems = 0;
  const emblemNames = new Set();
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const name = m[2];
    if (m[3].includes('// [ai_s_emblem:') || m[3].includes('// [ai_s_bridge:')) {
      console.warn(`Warning: Potential nested tag detected inside emblem '${name}'. Tags should be flat.`);
    }
    if (emblemNames.has(name)) {
      console.error(`Error: Duplicate emblem name found: '${name}'`);
      errors++;
    }
    emblemNames.add(name);
    parsedEmblems++;
  }
  const emblemStarts = (code.match(/\/\/ \[ai_s_emblem:/g) || []).length;
  const emblemEnds   = (code.match(/\/\/ \[\/ai_s_emblem:/g) || []).length;
  if (emblemStarts !== emblemEnds) {
    console.error(`Error: Emblem tag count mismatch! Start: ${emblemStarts}, End: ${emblemEnds}`);
    errors++;
  }
  if (parsedEmblems !== emblemStarts) {
    console.error(`Error: Some emblems are malformed and couldn't be parsed correctly.`);
    errors++;
  }

  // Bridge 検査（独立 regex / 独立カウンタ §0.1.2 共有禁止）。
  // 方向の妥当性 (LxtoLy 等) はチェックしない: 原則は強制しない。構造のみ守る。
  const BRIDGE_RE = /\/\/ \[ai_s_bridge:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_bridge: \2\]/g;
  let parsedBridges = 0;
  const bridgeNames = new Set();
  while ((m = BRIDGE_RE.exec(code)) !== null) {
    const name = m[2];
    if (m[3].includes('// [ai_s_emblem:') || m[3].includes('// [ai_s_bridge:')) {
      console.warn(`Warning: Potential nested tag detected inside bridge '${name}'. Tags should be flat.`);
    }
    if (bridgeNames.has(name)) {
      console.error(`Error: Duplicate bridge name found: '${name}'`);
      errors++;
    }
    bridgeNames.add(name);
    parsedBridges++;
  }
  const bridgeStarts = (code.match(/\/\/ \[ai_s_bridge:/g) || []).length;
  const bridgeEnds   = (code.match(/\/\/ \[\/ai_s_bridge:/g) || []).length;
  if (bridgeStarts !== bridgeEnds) {
    console.error(`Error: Bridge tag count mismatch! Start: ${bridgeStarts}, End: ${bridgeEnds}`);
    errors++;
  }
  if (parsedBridges !== bridgeStarts) {
    console.error(`Error: Some bridges are malformed and couldn't be parsed correctly.`);
    errors++;
  }

  if (errors === 0) {
    console.log(`✓ All ${parsedEmblems} emblems and ${parsedBridges} bridges are valid and unique.`);
  } else {
    console.log(`✗ Found ${errors} error(s) in tag structure.`);
    process.exit(1);
  }
}
// [/ai_s_emblem: Run-Check]

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
    const re = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
    let m;
    while ((m = re.exec(patchCode)) !== null) {
      patchEmblems.push({ meta: m[1], name: m[2], content: m[3] });
    }
  }
  // パッチ側の Bridge も独立 regex で収集（§0.1.2 共有禁止）。
  const patchBridges = [];
  {
    const re = /\/\/ \[ai_s_bridge:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_bridge: \2\]/g;
    let m;
    while ((m = re.exec(patchCode)) !== null) {
      patchBridges.push({ direction: m[1], name: m[2], content: m[3] });
    }
  }
  if (patchEmblems.length === 0 && patchBridges.length === 0) {
    console.error('Error: No valid ai_s_emblem or ai_s_bridge blocks found in patch.');
    process.exit(1);
  }

  // 適用前のタグ数を記録（破壊検知のため）。Emblem / Bridge 別カウント。
  const baseEmblemStarts = (newCode.match(/\/\/ \[ai_s_emblem:/g) || []).length;
  const baseBridgeStarts = (newCode.match(/\/\/ \[ai_s_bridge:/g) || []).length;
  let appliedCount = 0;

  // Emblem パッチ適用
  for (const pEmb of patchEmblems) {
    const re = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
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
      const safeReplacement = `// [ai_s_emblem:${t.meta} ${t.name}]\n${pEmb.content.trim()}\n// [/ai_s_emblem: ${t.name}]`;
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
    const re = /\/\/ \[ai_s_bridge:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_bridge: \2\]/g;
    const matches = [];
    let m;
    while ((m = re.exec(newCode)) !== null) {
      if (m[2] === pBr.name) {
        matches.push({ direction: m[1], name: m[2], start: m.index, end: m.index + m[0].length });
      }
    }
    if (matches.length === 1) {
      const t = matches[0];
      const safeReplacement = `// [ai_s_bridge:${t.direction} ${t.name}]\n${pBr.content.trim()}\n// [/ai_s_bridge: ${t.name}]`;
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
    const postEmblemStarts = (newCode.match(/\/\/ \[ai_s_emblem:/g) || []).length;
    const postEmblemEnds   = (newCode.match(/\/\/ \[\/ai_s_emblem:/g) || []).length;
    const postBridgeStarts = (newCode.match(/\/\/ \[ai_s_bridge:/g) || []).length;
    const postBridgeEnds   = (newCode.match(/\/\/ \[\/ai_s_bridge:/g) || []).length;
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
