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
  skeleton           List structure with emblems replaced by placeholders.
  focus <Name>       Extract the exact source code of the specified emblem.
  apply <patch>      Replace emblems in target matching the patch's emblem names.
  check              Verify emblem integrity (nesting, uniqueness, completeness).
  miner <data.json>  [AI-Only] Extract logic (laws) from data and synthesize code.

Format:
  // [ai_s_emblem:#importance#tag1#tag2 Name]
  // ... code ...
  // [/ai_s_emblem: Name]

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
  // Inline parser (Bible §0.1.2 — 共有禁止: regexは各モードに複製).
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;

  let output = '';
  let lastIndex = 0;
  let count = 0;
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const [full, meta, name, content] = m;
    if (content.includes('// [ai_s_emblem:')) {
      console.warn(`Warning: Potential nested emblem detected inside '${name}'. Emblems should be flat.`);
    }
    output += code.substring(lastIndex, m.index);
    const trimmed = content.trim();
    const lines = trimmed === '' ? 0 : trimmed.split('\n').length;
    output += `// [ai_s_emblem:${meta} ${name}]\n  /* [Emblem: ${name} (${lines} lines hidden)] */\n// [/ai_s_emblem: ${name}]`;
    lastIndex = m.index + full.length;
    count++;
  }
  output += code.substring(lastIndex);

  console.log(`[Skeleton] ${filePath} (${count} emblems found)`);
  console.log(output);
}
// [/ai_s_emblem: Run-Skeleton]

// [ai_s_emblem:#high#logic Run-Focus]
function runFocus(filePath, targetName) {
  if (!targetName) {
    console.error('Error: Please specify an emblem name to focus.');
    process.exit(1);
  }
  const code = fs.readFileSync(filePath, 'utf8');
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;

  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    if (m[2] === targetName) {
      // 'apply' でラウンドトリップできるよう、ヘッダ・フッタを含む全体を出力。
      console.log(m[0]);
      return;
    }
  }
  console.error(`Error: Emblem '${targetName}' not found.`);
  process.exit(1);
}
// [/ai_s_emblem: Run-Focus]

// [ai_s_emblem:#high#logic Run-Check]
function runCheck(filePath) {
  console.log(`[Check] Verifying ${filePath}...`);
  const code = fs.readFileSync(filePath, 'utf8');
  const EMBLEM_RE = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;

  let errors = 0;
  let parsedCount = 0;
  const names = new Set();
  let m;
  while ((m = EMBLEM_RE.exec(code)) !== null) {
    const name = m[2];
    if (m[3].includes('// [ai_s_emblem:')) {
      console.warn(`Warning: Potential nested emblem detected inside '${name}'. Emblems should be flat.`);
    }
    if (names.has(name)) {
      console.error(`Error: Duplicate emblem name found: '${name}'`);
      errors++;
    }
    names.add(name);
    parsedCount++;
  }

  // 構造的整合性: タグ数の対称性をシンプルに突き合わせる。
  const startTags = (code.match(/\/\/ \[ai_s_emblem:/g) || []).length;
  const endTags = (code.match(/\/\/ \[\/ai_s_emblem:/g) || []).length;
  if (startTags !== endTags) {
    console.error(`Error: Tag count mismatch! Start tags: ${startTags}, End tags: ${endTags}`);
    errors++;
  }
  if (parsedCount !== startTags) {
    console.error(`Error: Some emblems are malformed and couldn't be parsed correctly.`);
    errors++;
  }

  if (errors === 0) {
    console.log(`✓ All ${parsedCount} emblems are valid and unique.`);
  } else {
    console.log(`✗ Found ${errors} error(s) in emblem structure.`);
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

  // パッチ側のEmblemを一括収集（各モード固有のregex、共有しない）。
  const patchEmblems = [];
  {
    const re = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;
    let m;
    while ((m = re.exec(patchCode)) !== null) {
      patchEmblems.push({ meta: m[1], name: m[2], content: m[3] });
    }
  }
  if (patchEmblems.length === 0) {
    console.error('Error: No valid ai_s_emblem blocks found in patch.');
    process.exit(1);
  }

  // 適用前のEmblem数を記録（破壊検知のため）。
  const baseStartTags = (newCode.match(/\/\/ \[ai_s_emblem:/g) || []).length;
  let appliedCount = 0;

  for (const pEmb of patchEmblems) {
    // 各適用ごとにターゲットを再走査（前の適用でindexが変わるため）。
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
      console.log(`Applied patch for: ${pEmb.name}`);
    } else if (matches.length > 1) {
      console.log(`Warning: Duplicate emblem name '${pEmb.name}' found in target file. (Skipping for safety)`);
    } else {
      console.log(`Warning: Emblem '${pEmb.name}' not found in target file. (Skipping)`);
    }
  }

  if (appliedCount > 0) {
    // Destruction Fence: パッチ内の不正な追加・削除タグを物理的に弾く。
    const postStartTags = (newCode.match(/\/\/ \[ai_s_emblem:/g) || []).length;
    const postEndTags = (newCode.match(/\/\/ \[\/ai_s_emblem:/g) || []).length;
    if (postStartTags !== postEndTags) {
      console.error(`\n[FATAL] Apply cancelled! Tag structure corrupted (starts: ${postStartTags}, ends: ${postEndTags}).`);
      process.exit(1);
    }
    if (postStartTags !== baseStartTags) {
      console.error(`\n[FATAL] Apply cancelled! Emblem count changed (${baseStartTags} -> ${postStartTags}).`);
      console.error(`Structural changes (adding/removing emblems) are restricted in 'apply' to prevent destruction.`);
      process.exit(1);
    }
    fs.writeFileSync(filePath, newCode, 'utf8');
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
  // 実際の合成は、この出力後にAIの推論ループ内で行われる。
}
// [/ai_s_emblem: Run-Miner]
