#!/usr/bin/env node
// trace.js — 実行型ドキュメントの依存解決ランナー (MVP, Zero-Dep)
//
// 使い方: node trace.js <file.md> <entry-section-name>
// 出力: 依存をトポロジカル順で並べた md 連結。循環があれば exit 1。

const fs = require('fs');
const { parse } = require('./parse');

function trace(sections, entryName) {
  const byName = new Map(sections.map(s => [s.name, s]));
  if (!byName.has(entryName)) {
    throw new Error(`Entry section not found: '${entryName}'`);
  }

  const order = [];      // 出力順 (deps 先 → 自分後)
  const visited = new Set();
  const onStack = new Set();
  const stackTrail = []; // 循環検知時のトレース表示用

  function dfs(name) {
    if (visited.has(name)) return;
    if (onStack.has(name)) {
      const cycle = [...stackTrail.slice(stackTrail.indexOf(name)), name].join(' → ');
      throw new Error(`Cycle detected: ${cycle}`);
    }
    const node = byName.get(name);
    if (!node) {
      throw new Error(`Unresolved dep: '${name}' (referenced from '${stackTrail[stackTrail.length - 1] || entryName}')`);
    }
    onStack.add(name);
    stackTrail.push(name);
    for (const d of node.deps) dfs(d);
    onStack.delete(name);
    stackTrail.pop();
    visited.add(name);
    order.push(node);
  }

  dfs(entryName);
  return order;
}

if (require.main === module) {
  const [, , file, entry] = process.argv;
  if (!file || !entry) {
    console.error('Usage: node trace.js <file.md> <entry-section-name>');
    process.exit(1);
  }
  const sections = parse(fs.readFileSync(file, 'utf8'));
  let resolved;
  try {
    resolved = trace(sections, entry);
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exit(1);
  }
  console.log(`# Trace: ${entry} (${resolved.length} sections in dep order)\n`);
  for (const s of resolved) {
    console.log(s.body);
    console.log('\n---\n');
  }
}

module.exports = { trace };
