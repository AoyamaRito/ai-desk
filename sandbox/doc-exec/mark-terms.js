#!/usr/bin/env node
// mark-terms.js — md 本文中の用語を <<term>> でラップ (機械変換, MVP)
//
// 入力: converted-bible.md (doc-exec 形式に変換済みの Bible)
// 用語: glossary.md の `# <<term>>` セクション名
// 出力: bible-term.md = Bible 本文に <<term>> ラップ + glossary 用語定義を末尾連結
//
// 保護: コードブロック ```...```、インラインコード `...`、見出し行 `#...`、既存 <<...>> は触らない
//
// 使い方:
//   node mark-terms.js
//   node mark-terms.js --src=converted-bible.md --glossary=glossary.md --out=bible-term.md

const fs = require('fs');
const path = require('path');
const { parse } = require('./parse');

const args = process.argv.slice(2);
function flag(name, fallback) {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fallback;
}

const SRC = flag('src', 'converted-bible.md');
const GLOSSARY = flag('glossary', 'glossary.md');
const OUT = flag('out', 'bible-term.md');

const src = fs.readFileSync(SRC, 'utf8');
const glossaryRaw = fs.readFileSync(GLOSSARY, 'utf8');

// 用語名抽出: `# <<term>>` セクションの中身
const terms = parse(glossaryRaw)
  .map(s => s.name)
  .map(n => n.match(/^<<(.+)>>$/))
  .filter(Boolean)
  .map(m => m[1])
  .sort((a, b) => b.length - a.length); // longest first で部分マッチ衝突を回避

// 退避用プレースホルダ
const NUL = '\u0000';
const stash = (work, re, prefix) => {
  const buf = [];
  const replaced = work.replace(re, m => {
    buf.push(m);
    return `${NUL}${prefix}${buf.length - 1}${NUL}`;
  });
  return { replaced, buf };
};
const restore = (work, buf, prefix) =>
  work.replace(new RegExp(`${NUL}${prefix}(\\d+)${NUL}`, 'g'), (_, i) => buf[+i]);

// 1. コードブロック ```...``` を退避
let work = src;
const code = stash(work, /```[\s\S]*?```/g, 'CODE');
work = code.replaced;

// 2. インラインコード `...` を退避
const inline = stash(work, /`[^`\n]+`/g, 'INL');
work = inline.replaced;

// 3. 見出し行 `^#...` を退避 (用語名と重なる見出しは多いので保護)
const head = stash(work, /^#+[^\n]*$/gm, 'HEAD');
work = head.replaced;

// 4. 既存 <<term>> を退避 (冪等性のため)
const existing = stash(work, /<<[^<>\n]+>>/g, 'EXIST');
work = existing.replaced;

// 5. 各用語をラップ
let totalHits = 0;
const perTerm = {};
for (const term of terms) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'g');
  let hits = 0;
  work = work.replace(re, () => {
    hits++;
    return `<<${term}>>`;
  });
  if (hits > 0) {
    perTerm[term] = hits;
    totalHits += hits;
  }
}

// 6. 退避を逆順で戻す
work = restore(work, existing.buf, 'EXIST');
work = restore(work, head.buf, 'HEAD');
work = restore(work, inline.buf, 'INL');
work = restore(work, code.buf, 'CODE');

// 7. glossary の用語定義セクション (`# <<...>>` のみ) を末尾連結
const termSections = glossaryRaw
  .split(/^---\s*$/m)
  .map(b => b.trim())
  .filter(b => /^#\s+<<[^<>\n]+>>/.test(b));

const output =
  work.trimEnd() +
  '\n\n---\n\n' +
  termSections.join('\n\n---\n\n') +
  '\n';

fs.writeFileSync(OUT, output);

// 報告
console.error(`[mark-terms] wrote ${OUT}`);
console.error(`[mark-terms] glossary terms: ${terms.length}`);
console.error(`[mark-terms] total hits: ${totalHits}`);
console.error(`[mark-terms] term definitions appended: ${termSections.length}`);
console.error(`[mark-terms] hit breakdown:`);
const sorted = Object.entries(perTerm).sort((a, b) => b[1] - a[1]);
for (const [t, n] of sorted) {
  console.error(`  ${String(n).padStart(3)}  <<${t}>>`);
}
const unused = terms.filter(t => !perTerm[t]);
if (unused.length > 0) {
  console.error(`[mark-terms] unused terms (${unused.length}):`);
  for (const t of unused) console.error(`       <<${t}>>`);
}
