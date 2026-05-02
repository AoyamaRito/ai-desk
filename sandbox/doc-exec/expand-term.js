#!/usr/bin/env node
// expand-term.js — <<term>> マクロ展開 + 近接抑制 (MVP, Zero-Dep)
//
// モデル:
//   - 用語定義は md 末尾に `---` 区切りで `# <<term>>` セクションとして書く
//   - 本文中の `<<term>>` を検出し、対応セクションの body を直後に inline 挿入
//   - マーカー `<<term>>` 自体はキープ (用語ラベルとしての可読性を保つ)
//   - 同じ用語が直近 N 行以内で展開済みなら定義を省略 (マーカーのみ残す)
//
// 使い方:
//   node expand-term.js <file.md> <entry> [--max=300]
//
//   --max=N  近接抑制の閾値 (出力行数). デフォルト 300 (Bible §0.0 スポットライト).
//   --max=0  抑制なし (毎回フル展開)

const fs = require('fs');
const { parse } = require('./parse');

const TERM_RE = /<<([^<>\n]+)>>/g;

function expand(sections, entryName, proximityLines = 300) {
  const byName = new Map(sections.map(s => [s.name, s]));
  if (!byName.has(entryName)) {
    throw new Error(`Entry section not found: '${entryName}'`);
  }

  const ctx = {
    byName,
    proximityLines,
    lastExpandedAt: new Map(),
    stack: [],
    skipped: 0,
    expanded: 0,
    unresolved: []
  };

  function expandBody(body, startLine) {
    // <<term>> で split。capture group で交互に [text, term, text, term, ...]
    const segments = body.split(TERM_RE);
    let result = '';
    let currentLine = startLine;

    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 0) {
        // テキスト断片
        result += segments[i];
        currentLine += (segments[i].match(/\n/g) || []).length;
      } else {
        // 用語名 (<< >> の中身)
        const term = segments[i].trim();
        const fullName = `<<${term}>>`;
        const lastAt = ctx.lastExpandedAt.get(fullName);
        const distance = lastAt === undefined ? Infinity : currentLine - lastAt;

        // 用語マーカー自体は常に出力に残す
        result += fullName;
        currentLine += (fullName.match(/\n/g) || []).length;

        if (proximityLines > 0 && distance < proximityLines) {
          // 近接抑制: マーカーのみで定義は省略
          ctx.skipped++;
          continue;
        }

        const sec = byName.get(fullName);
        if (!sec) {
          ctx.unresolved.push(term);
          continue;
        }

        if (ctx.stack.includes(fullName)) {
          // 循環参照は安全に skip (定義中の自己参照を許容)
          ctx.skipped++;
          continue;
        }

        // body から H1 行と前後空白を取り除いた中身を inline 挿入
        const bodyOnly = sec.body.replace(/^#\s+[^\n]+\n?/, '').trim();
        ctx.stack.push(fullName);
        ctx.lastExpandedAt.set(fullName, currentLine);
        const sub = expandBody(bodyOnly, currentLine + 1);
        ctx.stack.pop();
        ctx.expanded++;

        // インデント付きで挿入 (用語マーカー直後に改行 + ↳ 定義)
        const indented = sub.split('\n').map(l => `    ${l}`).join('\n');
        const inserted = `\n  ↳ 定義:\n${indented}\n`;
        result += inserted;
        currentLine += (inserted.match(/\n/g) || []).length;
      }
    }
    return result;
  }

  const output = expandBody(byName.get(entryName).body, 0);
  return {
    output,
    expanded: ctx.expanded,
    skipped: ctx.skipped,
    unresolved: ctx.unresolved
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('--'));
  const positional = args.filter(a => !a.startsWith('--'));
  const [file, entry] = positional;
  if (!file || !entry) {
    console.error('Usage: node expand-term.js <file.md> <entry-section> [--max=N]');
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
  const unresolvedStr = result.unresolved.length > 0
    ? `, ${result.unresolved.length} unresolved [${result.unresolved.join(', ')}]`
    : '';
  console.error(`[expand-term] ${result.expanded} expanded, ${result.skipped} skipped (proximity=${proximityLines})${unresolvedStr}`);
}

module.exports = { expand };
