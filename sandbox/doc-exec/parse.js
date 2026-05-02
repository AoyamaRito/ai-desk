#!/usr/bin/env node
// parse.js — 実行型ドキュメントの md パーサー (MVP, Zero-Dep)
//
// 仕様:
//   - セクション区切り: 単独行の `---`
//   - セクション名: そのセクション最初の `# 名前` (H1)
//   - メタデータ: 同セクション内の `<!-- @key: value -->` コメント
//   - 1ファイル内で同名セクション禁止 (将来は warn → error)

const fs = require('fs');

function parse(mdText) {
  // セクション分割: `---` だけの行で split。前後の空行は trim。
  const blocks = mdText.split(/^---\s*$/m).map(b => b.trim()).filter(b => b.length > 0);

  const sections = [];
  for (const block of blocks) {
    // H1 抽出 (# Name) — 名前として最初に出るものを採用
    const headingMatch = block.match(/^#\s+([^\n]+)$/m);
    if (!headingMatch) continue; // 名前のないブロックは捨てる
    const name = headingMatch[1].trim();

    // メタデータ抽出: <!-- @key: value --> を全部拾う
    const meta = {};
    const metaRe = /<!--\s*([\s\S]*?)\s*-->/g;
    let mm;
    while ((mm = metaRe.exec(block)) !== null) {
      const inner = mm[1];
      const lineRe = /@(\w+)\s*:\s*([^\n@]+)/g;
      let lm;
      while ((lm = lineRe.exec(inner)) !== null) {
        meta[lm[1]] = lm[2].trim();
      }
    }

    // deps はカンマ区切り string → array
    const deps = meta.deps
      ? meta.deps.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    sections.push({ name, deps, meta, body: block });
  }

  // 重複名チェック
  const seen = new Set();
  for (const s of sections) {
    if (seen.has(s.name)) {
      throw new Error(`Duplicate section name: '${s.name}'`);
    }
    seen.add(s.name);
  }

  return sections;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node parse.js <file.md>');
    process.exit(1);
  }
  const sections = parse(fs.readFileSync(file, 'utf8'));
  for (const s of sections) {
    const depsStr = s.deps.length > 0 ? ` deps: [${s.deps.join(', ')}]` : '';
    console.log(`# ${s.name}${depsStr}`);
  }
  console.log(`\n(${sections.length} sections)`);
}

module.exports = { parse };
