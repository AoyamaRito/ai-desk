#!/usr/bin/env node
// bundle-docs.js — リポ内の md を列挙し、doc-exec 形式の 1 ファイルに連結する
//
// 仕様:
//   - --root から *.md を再帰列挙 (.git, node_modules, .claude, snapshots 除外)
//   - sandbox/doc-exec/ (このスクリプトの dir) は除外。ただし HANDOFF/README は明示的に保持できる
//   - 各 md を `---\n# <slug>\n<!-- @source: <rel> -->\n<body>` セクションに変換して連結
//   - 各 md 内の単独行 `---` は `***` に置換 (parse 衝突回避)
//
// 使い方:
//   node bundle-docs.js
//   node bundle-docs.js --root=../.. --out=all-docs.md

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function flag(name, fb) {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fb;
}

const ROOT = path.resolve(flag('root', '../..'));
const OUT = flag('out', 'all-docs.md');

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.claude', 'snapshots']);

// 生成物・glossary 等は bundle に含めない (prepend-deps が別途扱う / 二重包含を防ぐ)
const EXCLUDE_FILE_RE = [
  /^all-docs.*\.md$/,        // 過去 bundle 出力
  /^glossary(-deps)?\.md$/,  // 用語ソース (先頭 prepend で扱う)
  /-deps\.md$/,              // prepend-deps の出力
  /-term\.md$/,              // mark-terms の出力
  /^converted-/,             // 旧 convert.js の出力
  /^expanded-/,              // 旧 expand.js の出力
  /^bible-term\.md$/         // mark-terms の特定出力
];

function isExcludedFile(name) {
  return EXCLUDE_FILE_RE.some(re => re.test(name));
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, acc);
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      if (isExcludedFile(entry.name)) continue;
      acc.push(full);
    }
  }
  return acc;
}

function slugify(rel) {
  return rel
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const files = walk(ROOT).sort();

const parts = [];
const manifest = [];
const seenSlugs = new Set();

for (const f of files) {
  const rel = path.relative(ROOT, f);
  let slug = slugify(rel);
  if (seenSlugs.has(slug)) {
    let i = 2;
    while (seenSlugs.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  seenSlugs.add(slug);
  const raw = fs.readFileSync(f, 'utf8');
  const body = raw.replace(/^---\s*$/gm, '***').trim();
  parts.push(`---\n\n# ${slug}\n\n<!-- @source: ${rel} -->\n\n${body}\n`);
  manifest.push({ rel, slug, bytes: body.length });
}

fs.writeFileSync(OUT, parts.join('\n') + '\n');

console.error(`[bundle-docs] wrote ${OUT}`);
console.error(`[bundle-docs] ${files.length} md files bundled`);
console.error(`[bundle-docs] manifest:`);
for (const m of manifest) {
  console.error(`  ${String(m.bytes).padStart(7)} B  ${m.slug.padEnd(40)}  ←  ${m.rel}`);
}
const totalBytes = manifest.reduce((s, m) => s + m.bytes, 0);
console.error(`[bundle-docs] total: ${totalBytes} bytes`);
