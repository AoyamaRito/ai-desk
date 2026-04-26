#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// [ai_s_emblem:#low#config Config]
const HELP_TEXT = `ai-desk (Emblem Edition) - Robust Workspace Manager

Usage:
  ai-desk <filename> <mode> [args...]

Modes:
  skeleton           List structure with emblems replaced by placeholders.
  focus <Name>       Extract the exact source code of the specified emblem.
  apply <patch>      Replace emblems in target matching the patch's emblem names.
  check              Verify emblem integrity (nesting, uniqueness, completeness).

Format:
  // [ai_s_emblem:#importance#tag1#tag2 Name]
  // ... code ...
  // [/ai_s_emblem: Name]

Examples:
  ai-desk app.js skeleton
  ai-desk app.js focus MainLogic
  ai-desk app.js skeleton apply patch.js
`;
// [/ai_s_emblem: Config]

// [ai_s_emblem:#high#logic Core-Parser]
/**
 * Parses the file content to extract emblem blocks.
 */
function extractEmblems(code) {
  const emblems = [];
  // Regular expression to match:
  // 1. Opening tag: // [ai_s_emblem:#tags Name]
  // 2. Content: everything in between (non-greedy)
  // 3. Closing tag: // [/ai_s_emblem: Name]
  // Using 'gs' flags (global, dotAll)
  const regex = /\/\/ \[ai_s_emblem:([^\]\s]*) ([\w\-]+)\]([\s\S]*?)\/\/ \[\/ai_s_emblem: \2\]/g;

  let match;
  while ((match = regex.exec(code)) !== null) {
    const content = match[3];
    // Flatness Check: Check if content contains what looks like another emblem start
    if (content.includes('// [ai_s_emblem:')) {
      console.warn(`Warning: Potential nested emblem detected inside '${match[2]}'. Emblems should be flat.`);
    }

    emblems.push({
      fullMatch: match[0],
      meta: match[1], // e.g. #higher#ui
      name: match[2], // e.g. MainLogic
      content: match[3], // Code inside
      start: match.index,
      end: regex.lastIndex,
      header: `// [ai_s_emblem:${match[1]} ${match[2]}]`,
      footer: `// [/ai_s_emblem: ${match[2]}]`
    });
  }
  return emblems;
}
// [/ai_s_emblem: Core-Parser]

// [ai_s_emblem:#mid#cli Main-CLI]
function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    return;
  }

  const filePath = args[0];
  const mode = args[1];
  const extraArgs = args.slice(2);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf8');
  const emblems = extractEmblems(code);

  switch (mode) {
    case 'skeleton':
      let skeletonCode = code;
      // Replace from bottom to top to keep indices valid, or use a new string
      let lastIndex = 0;
      let output = "";

      emblems.forEach(emb => {
        output += code.substring(lastIndex, emb.start);
        // Precise line count: 
        // We trim the content to count actual lines of code inside.
        const trimmedContent = emb.content.trim();
        const lines = (trimmedContent === "") ? 0 : trimmedContent.split('\n').length;
        output += `${emb.header}\n  /* [Emblem: ${emb.name} (${lines} lines hidden)] */\n${emb.footer}`;
        lastIndex = emb.end;
      });
      output += code.substring(lastIndex);
      
      console.log(`[Skeleton] ${filePath} (${emblems.length} emblems found)`);
      console.log(output);
      break;

    case 'check':
      console.log(`[Check] Verifying ${filePath}...`);
      let errors = 0;
      const names = new Set();
      
      // 1. Basic validation from extractEmblems
      emblems.forEach(emb => {
        if (names.has(emb.name)) {
          console.error(`Error: Duplicate emblem name found: '${emb.name}'`);
          errors++;
        }
        names.add(emb.name);
      });

      // 2. Structural validation (Manual scan for unmatched tags)
      const startTags = (code.match(/\/\/ \[ai_s_emblem:/g) || []).length;
      const endTags = (code.match(/\/\/ \[\/ai_s_emblem:/g) || []).length;

      if (startTags !== endTags) {
        console.error(`Error: Tag count mismatch! Start tags: ${startTags}, End tags: ${endTags}`);
        errors++;
      }

      if (emblems.length !== startTags) {
        console.error(`Error: Some emblems are malformed and couldn't be parsed correctly.`);
        errors++;
      }

      if (errors === 0) {
        console.log(`✓ All ${emblems.length} emblems are valid and unique.`);
      } else {
        console.log(`✗ Found ${errors} error(s) in emblem structure.`);
        process.exit(1);
      }
      break;

    case 'focus':
      const targetName = extraArgs[0];
      if (!targetName) {
        console.error('Error: Please specify an emblem name to focus.');
        process.exit(1);
      }
      const targetEmb = emblems.find(e => e.name === targetName);
      if (targetEmb) {
        // Output with headers for context, or just content?
        // Usually, AI needs the full block including headers for 'apply' roundtrip.
        console.log(targetEmb.fullMatch);
      } else {
        console.error(`Error: Emblem '${targetName}' not found.`);
        process.exit(1);
      }
      break;

    case 'apply':
      const patchPath = extraArgs[0];
      if (!patchPath || !fs.existsSync(patchPath)) {
        console.error('Error: Valid patch file required.');
        process.exit(1);
      }
      const patchCode = fs.readFileSync(patchPath, 'utf8');
      const patchEmblems = extractEmblems(patchCode);

      if (patchEmblems.length === 0) {
        console.error('Error: No valid ai_s_emblem blocks found in patch.');
        process.exit(1);
      }

      let newCode = code;
      let appliedCount = 0;

      // Base tag counts for destruction check
      const baseStartTags = (newCode.match(/\/\/ \[ai_s_emblem:/g) || []).length;
      
      patchEmblems.forEach(pEmb => {
        const currentEmblems = extractEmblems(newCode);
        const matches = currentEmblems.filter(e => e.name === pEmb.name);
        
        if (matches.length === 1) {
          const tEmb = matches[0];
          // Tag Immutability: Preserve target's header and footer. Only replace content.
          const safeReplacement = `${tEmb.header}\n${pEmb.content.trim()}\n${tEmb.footer}`;
          newCode = newCode.slice(0, tEmb.start) + safeReplacement + newCode.slice(tEmb.end);
          appliedCount++;
          console.log(`Applied patch for: ${pEmb.name}`);
        } else if (matches.length > 1) {
          console.log(`Warning: Duplicate emblem name '${pEmb.name}' found in target file. (Skipping for safety)`);
        } else {
          console.log(`Warning: Emblem '${pEmb.name}' not found in target file. (Skipping)`);
        }
      });

      if (appliedCount > 0) {
        // Destruction Fence: Check if the patch accidentally destroyed or added tags inside the content
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
      break;

    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
  }
}

main();
// [/ai_s_emblem: Main-CLI]
