#!/usr/bin/env node
// expand.js — マクロ展開型 trace + 近接展開抑制 (MVP, Zero-Dep)
//
// モデル:
//   <!-- @expand: name --> をその場でテキスト展開する。
//   ただし「同じセクションが直近 N 行以内で既に展開されている」場合は重複展開を抑制し、
//   skip マーカーに置換する (LLM スポットライト内なら再読不要、外なら再読が locality 保護)。
//
// 使い方:
//   node expand.js <file.md> <entry> [--max=300]
//
//   --max=N  近接抑制の閾値 (出力行数). デフォルト 300 (Bible §0.0 スポットライト).
//   --max=0  抑制なし (毎回フル展開)

const fs = require('fs');
const { parse } = require('./parse');

const EXPAND_RE = /<!--\s*@expand:\s*([\w-]+)\s*-->/g;

function expand(sections, entryName, proximityLines = 300) {
  const byName = new Map(sections.map(s => [s.name, s]));
  if (!byName.has(entryName)) {
    throw new Error(`Entry section not found: '${entryName}'`);
  }

  const ctx = {
    byName,
    proximityLines,
    lastExpandedAt: new Map(), // section name → 最後に展開された出力行
    stack: [],                 // 循環検知
    skipped: 0,                // 抑制された回数 (報告用)
    expanded: 0                // 展開された回数 (報告用)
  };

  // body を @expand マーカーで分割しながら処理。出力行番号を逐次トラッキング。
  function expandBody(body, startLine) {
    // split with capture: ["text", "refName", "text", "refName", "text", ...]
    const segments = body.split(EXPAND_RE);
    let result = '';
    let currentLine = startLine;

    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 0) {
        // テキスト断片
        result += segments[i];
        currentLine += (segments[i].match(/\n/g) || []).length;
      } else {
        // @expand 参照名
        const refName = segments[i].trim();
        const lastAt = ctx.lastExpandedAt.get(refName);
        const distance = lastAt === undefined ? Infinity : currentLine - lastAt;

        if (proximityLines > 0 && distance < proximityLines) {
          // 近接抑制: スポットライト内なので skip
          const note = `<!-- @skipped: ${refName} (already expanded at output line ${lastAt}, distance ${distance} < ${proximityLines}) -->`;
          result += note;
          ctx.skipped++;
        } else {
          // フル展開
          if (ctx.stack.includes(refName)) {
            throw new Error(`Cycle detected: ${[...ctx.stack, refName].join(' → ')}`);
          }
          const sec = byName.get(refName);
          if (!sec) {
            const from = ctx.stack[ctx.stack.length - 1] || '<entry>';
            throw new Error(`Unresolved @expand: '${refName}' (referenced from '${from}')`);
          }
          ctx.stack.push(refName);
          ctx.lastExpandedAt.set(refName, currentLine);
          const sub = expandBody(sec.body, currentLine);
          ctx.stack.pop();
          result += sub;
          currentLine += (sub.match(/\n/g) || []).length;
          ctx.expanded++;
        }
      }
    }
    return result;
  }

  const output = expandBody(byName.get(entryName).body, 0);
  return { output, expanded: ctx.expanded, skipped: ctx.skipped };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('--'));
  const positional = args.filter(a => !a.startsWith('--'));
  const [file, entry] = positional;
  if (!file || !entry) {
    console.error('Usage: node expand.js <file.md> <entry-section> [--max=N]');
    process.exit(1);
  }

  let proximityLines = 300;
  for (const f of flags) {
    const m = f.match(/^--max=(\d+)$/);
    if (m) proximityLines = parseInt(m[1], 10);
  }

  const sections = parse(fs.readFileSync(file, 'utf8'));
  let result;
  try {
    result = expand(sections, entry, proximityLines);
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exit(1);
  }
  process.stdout.write(result.output);
  if (!result.output.endsWith('\n')) process.stdout.write('\n');
  console.error(`[expand] ${result.expanded} expanded, ${result.skipped} skipped (proximity=${proximityLines})`);
}

module.exports = { expand };
