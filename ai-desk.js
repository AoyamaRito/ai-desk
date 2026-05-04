#!/usr/bin/env node
// ai-desk root entry — redirect to v2.
//
// v1 (./ai-desk-old-v1.js) は frozen された過去。
// 新規作業 / canonical entry は v2/ai-desk.js です。
//
// このファイルは「pwd で ai-desk リポ root に居るのに ai-desk.js が無い → 壊れてる?」
// と誤読されないための薄い案内 + redirect。

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const v2 = path.resolve(__dirname, 'v2', 'ai-desk.js');

console.error([
  '──────────────────────────────────────────────────────────────',
  '  ai-desk: v1 は frozen、canonical entry は v2/ai-desk.js です',
  '',
  '    実体: ' + v2,
  '    test: cd v2 && npm test    (166 tests, all green)',
  '    bible: cd v2 && cat BIBLE.md  または node AiRunAndRead_BIBLE.js',
  '',
  '  渡された引数を v2/ai-desk.js にそのまま forward します。',
  '──────────────────────────────────────────────────────────────',
].join('\n'));

const r = spawnSync('node', [v2, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 0);
