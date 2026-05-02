#!/usr/bin/env node
// extract-bolds.js — md から **bold** 候補を全部拾い、頻度集計する。
// 目的: 「bold = 用語依存」モデルが実態に合うか判定するための観察ツール。
//
// Usage: node extract-bolds.js <file.md>

const fs = require('fs');

function extractBolds(mdText) {
  // コードブロックとコードスパンを除外（**bold** は強調用に限る）
  // ` ` で囲まれた範囲、``` で囲まれた範囲を空白で潰してから探す。
  let text = mdText;
  text = text.replace(/```[\s\S]*?```/g, m => ' '.repeat(m.length));
  text = text.replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));

  // **...** マッチ。改行をまたがない。
  const re = /\*\*([^*\n]+?)\*\*/g;
  const counts = new Map();
  let m;
  while ((m = re.exec(text)) !== null) {
    const term = m[1].trim();
    if (term.length === 0) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return counts;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node extract-bolds.js <file.md>');
    process.exit(1);
  }
  const counts = extractBolds(fs.readFileSync(file, 'utf8'));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const unique = sorted.length;
  const repeats = sorted.filter(([, n]) => n >= 2).length;

  console.log(`File: ${file}`);
  console.log(`Total bold occurrences: ${total}`);
  console.log(`Unique terms: ${unique}`);
  console.log(`Repeated (≥2 times): ${repeats}`);
  console.log('');
  console.log('Frequency  Term');
  console.log('---------  ----');
  for (const [term, n] of sorted) {
    console.log(`${String(n).padStart(9)}  ${term}`);
  }
}

module.exports = { extractBolds };
