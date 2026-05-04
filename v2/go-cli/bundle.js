#!/usr/bin/env node
// bundle.js — Node script: ai-desk-core.js + AiRunAndRead_BIBLE.js を 1 ファイルの
// CommonJS-ish 文字列に bundle する(goja で eval するため)。
//
// 戦略:
//   - 両ファイルとも import 文ゼロ + export 多数。
//   - export を剥がして単純連結。
//   - 末尾に namespace object を露出して goja から拾えるようにする。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const v2 = join(__dirname, '..');

function readAndStripExports(path) {
  let src = readFileSync(path, 'utf8');
  // `export class Foo` → `class Foo`
  src = src.replace(/^export\s+(class|function|const|let|var|async)\s+/gm, '$1 ');
  // `export {...}` 形式は無視(必要なら都度対応)
  src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  // `export default` も剥がす(現状未使用のはず)
  src = src.replace(/^export\s+default\s+/gm, '');
  return src;
}

function collectExportedNames(originalSrc) {
  const names = new Set();
  const re = /^export\s+(?:class|function|const|let|var|async\s+function)\s+(\w+)/gm;
  let m;
  while ((m = re.exec(originalSrc)) !== null) names.add(m[1]);
  return names;
}

const bibleSrc = readFileSync(join(v2, 'AiRunAndRead_BIBLE.js'), 'utf8');
const coreSrc  = readFileSync(join(v2, 'ai-desk-core.js'), 'utf8');

const bibleNames = collectExportedNames(bibleSrc);
const coreNames  = collectExportedNames(coreSrc);

// BIBLE.js の self-display ブロック(末尾 if (process...) {...})は goja で意味なし。
// `if (typeof process !== 'undefined' && /AiRunAndRead_BIBLE\.js$/.test(...)) { ... }`
// をまるごと削除(import.meta は goja 未対応の可能性も避ける)。
const stripSelfBlock = (src) =>
  src.replace(
    /if\s*\(\s*typeof\s+process\s*!==\s*['"]undefined['"][\s\S]*?\}\s*\}\s*$/m,
    '/* self-display block removed for goja */'
  );

const bibleClean = stripSelfBlock(readAndStripExports(join(v2, 'AiRunAndRead_BIBLE.js')));
const coreClean  = stripSelfBlock(readAndStripExports(join(v2, 'ai-desk-core.js')));

// 全名を namespace object として露出
const allNames = [...bibleNames, ...coreNames];

const bundle = `// AUTO-GENERATED — DO NOT EDIT
// Built from ai-desk-core.js + AiRunAndRead_BIBLE.js by go-cli/bundle.js
// (function () { ... })() で local scope に閉じ込め、最後に globalThis.AiDesk へ露出

(function () {
'use strict';

// ============================================================
// AiRunAndRead_BIBLE.js (stripped)
// ============================================================
${bibleClean}

// ============================================================
// ai-desk-core.js (stripped)
// ============================================================
${coreClean}

// ============================================================
// 露出
// ============================================================
globalThis.AiDesk = {
${allNames.map(n => `  ${n}: typeof ${n} !== 'undefined' ? ${n} : undefined,`).join('\n')}
};

})();
`;

const outPath = join(__dirname, 'ai-desk-bundle.js');
writeFileSync(outPath, bundle);
console.log(`bundled → ${outPath}`);
console.log(`  Bible exports: ${bibleNames.size} (${[...bibleNames].slice(0, 6).join(', ')}...)`);
console.log(`  Core exports:  ${coreNames.size} (${[...coreNames].slice(0, 6).join(', ')}...)`);
console.log(`  Total: ${allNames.length} symbols on globalThis.AiDesk`);
