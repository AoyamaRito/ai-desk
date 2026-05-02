#!/usr/bin/env node

// Author: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
// SPDX-License-Identifier: MIT
//
// AI-Native Documentation Pipeline.
//   docs.config.json で「どのソースのどのセクションをどの順で何処へ書き出すか」を宣言する。
//   各ソースに ai-desk check を先に走らせて、emblem 整合性をビルド前に保証する。
//   Bible §3 REAL/SHADOW: ソースが REAL、生成された Markdown は SHADOW（直接編集禁止）。
//
// Usage:
//   node build-docs.js                # build all documents
//   node build-docs.js --dry-run      # validate sources + show plan, write nothing
//   node build-docs.js --check        # only run ai-desk check on all sources

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// [ai_s_emblem:#high#L1 Build-Main]
const flags = process.argv.slice(2);
const isDryRun = flags.includes('--dry-run');
const checkOnly = flags.includes('--check');

const CONFIG_PATH = path.resolve(__dirname, 'docs.config.json');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`[FATAL] docs.config.json not found at ${CONFIG_PATH}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
if (!Array.isArray(config.documents) || config.documents.length === 0) {
  console.error('[FATAL] docs.config.json: documents[] is empty.');
  process.exit(1);
}

// ---- Phase 1: ai-desk check on all sources (drift / corruption fence).
const aiDeskPath = path.resolve(__dirname, 'ai-desk.js');
const sources = [...new Set(config.documents.map(d => d.source))];
for (const src of sources) {
  const srcPath = path.resolve(__dirname, src);
  if (!fs.existsSync(srcPath)) {
    console.error(`[FATAL] Source not found: ${src}`);
    process.exit(1);
  }
  const result = spawnSync('node', [aiDeskPath, srcPath, 'check'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`[FATAL] ai-desk check failed for ${src}:\n${result.stdout}${result.stderr}`);
    process.exit(1);
  }
  console.log(`✓ ${src} (ai-desk check passed)`);
}

if (checkOnly) {
  console.log(`\nAll ${sources.length} source(s) passed ai-desk check.`);
  process.exit(0);
}

// ---- Phase 2: build each document.
for (const doc of config.documents) {
  const srcPath = path.resolve(__dirname, doc.source);
  // require() で source の export を取得。シンプルかつ JS との互換性が高い。
  delete require.cache[srcPath]; // ensure fresh load if invoked repeatedly
  const source = require(srcPath);

  // テンプレ置換: {{KEY.path}} を source[KEY][path] で解決。
  const subst = (str) => str.replace(/\{\{([\w.]+)\}\}/g, (_, expr) => {
    const parts = expr.split('.');
    let v = source;
    for (const p of parts) v = (v == null) ? undefined : v[p];
    if (v === undefined) {
      console.error(`[FATAL] Template variable '{{${expr}}}' could not be resolved in ${doc.source}.`);
      process.exit(1);
    }
    return String(v);
  });

  let body = '';
  if (doc.header) body += subst(doc.header);

  for (const name of doc.sections) {
    const content = source[name];
    if (content === undefined) {
      console.error(`[FATAL] Section '${name}' not exported by ${doc.source}.`);
      process.exit(1);
    }
    body += content;
  }

  if (doc.footer) body += subst(doc.footer);

  const targetPath = path.resolve(__dirname, doc.target);
  if (isDryRun) {
    console.log(`[DRY-RUN] would write ${doc.target} (${body.length} bytes, ${doc.sections.length} sections)`);
  } else {
    const tmpPath = targetPath + '.tmp';
    fs.writeFileSync(tmpPath, body, 'utf8');
    fs.renameSync(tmpPath, targetPath);
    console.log(`✓ ${doc.target} written (${body.length} bytes, ${doc.sections.length} sections from ${doc.source})`);
  }
}

if (isDryRun) console.log('\n(no files written — re-run without --dry-run to build)');
// [/ai_s_emblem: Build-Main]
