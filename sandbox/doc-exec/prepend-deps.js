#!/usr/bin/env node
// prepend-deps.js — 各セクション先頭に「関連: <<term>>...」を追記する (本文は無傷)
//
// モデル:
//   - 本文中の用語 (canonical + aliases) を検出するが、本文は変更しない
//   - セクション H1 直後に category 別グループ化された関連リストを挿入
//   - alias でヒットしても出力は canonical (`<<term>>`) で正規化
//   - コードブロック・インラインコード・見出し・既存 <<...>> は検出から除外
//
// 使い方:
//   node prepend-deps.js
//   node prepend-deps.js --src=all-docs.md --glossary=glossary.md --out=all-docs-deps.md
//
// glossary 自身に適用するときは:
//   node prepend-deps.js --src=glossary.md --out=glossary-deps.md

const fs = require('fs');
const { parse } = require('./parse');

const args = process.argv.slice(2);
function flag(name, fb) {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fb;
}

const SRC = flag('src', 'all-docs.md');
const GLOSSARY = flag('glossary', 'glossary.md');
const OUT = flag('out', 'all-docs-deps.md');

const src = fs.readFileSync(SRC, 'utf8');
const glossaryRaw = fs.readFileSync(GLOSSARY, 'utf8');
const glossarySections = parse(glossaryRaw);

// 検出パターンを集める: { pattern, canonical }
const detectables = [];
const categoryOf = new Map();
for (const sec of glossarySections) {
  const m = sec.name.match(/^<<(.+)>>$/);
  if (!m) continue;
  const canonical = m[1];
  if (sec.meta.category) categoryOf.set(canonical, sec.meta.category.trim());
  detectables.push({ pattern: canonical, canonical });
  if (sec.meta.aliases) {
    const aliases = sec.meta.aliases.split(',').map(s => s.trim()).filter(Boolean);
    for (const a of aliases) detectables.push({ pattern: a, canonical });
  }
}
detectables.sort((a, b) => b.pattern.length - a.pattern.length);

// グループ表示順とラベル
const CATEGORY_ORDER = ['principle', 'state', 'layer', 'tag', 'verification', 'persistence', 'tool', 'other'];
const CATEGORY_LABEL = {
  principle: '原則',
  state: '状態',
  layer: '層',
  tag: 'タグ',
  verification: '検証',
  persistence: '永続化',
  tool: 'ツール',
  other: 'その他'
};

// ノイズマスク (検出から除外する箇所を空白で潰す)
const NUL = '\u0000';
function maskNoise(text) {
  let work = text;
  work = work.replace(/```[\s\S]*?```/g, m => NUL.repeat(m.length));
  work = work.replace(/`[^`\n]+`/g, m => NUL.repeat(m.length));
  work = work.replace(/^#+[^\n]*$/gm, m => NUL.repeat(m.length));
  // 既存の "関連" 行 (このスクリプトが生成した行) は冪等性のため除外
  work = work.replace(/^>\s+(?:原則|状態|層|タグ|検証|永続化|ツール|その他|関連):\s*[^\n]*$/gm, m => NUL.repeat(m.length));
  // 注: 既存 <<...>> はマスクしない。中身の用語を検出対象にする (glossary 自身への適用や mark-terms 後でも動くため)
  return work;
}

// セクションごとに処理
const sections = parse(src);
const stats = { secs: 0, withDeps: 0, totalDeps: 0, perTerm: {} };
const outParts = [];

for (const sec of sections) {
  stats.secs++;
  const m = sec.body.match(/^(#\s+[^\n]+)\n?([\s\S]*)$/);
  const head = m ? m[1] : `# ${sec.name}`;
  const rest = m ? m[2] : sec.body;

  // canonical 検出: 自分自身の glossary セクションは関連に含めない
  const selfCanonical = sec.name.match(/^<<(.+)>>$/);
  const selfTerm = selfCanonical ? selfCanonical[1] : null;

  const masked = maskNoise(rest);
  const positions = new Map(); // canonical -> earliest index
  for (const { pattern, canonical } of detectables) {
    if (canonical === selfTerm) continue; // 自己参照を除外
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped);
    const hit = masked.match(re);
    if (!hit) continue;
    const existing = positions.get(canonical);
    if (existing === undefined || hit.index < existing) {
      positions.set(canonical, hit.index);
    }
  }

  const sortedTerms = [...positions.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(e => e[0]);

  let relatedBlock = '';
  if (sortedTerms.length > 0) {
    const grouped = {};
    for (const t of sortedTerms) {
      const cat = categoryOf.get(t) || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    }
    const lines = [];
    for (const cat of CATEGORY_ORDER) {
      if (!grouped[cat]) continue;
      const label = CATEGORY_LABEL[cat] || cat;
      const tags = grouped[cat].map(t => `<<${t}>>`).join(' ');
      lines.push(`> ${label}: ${tags}`);
    }
    relatedBlock = lines.join('\n') + '\n\n';
    stats.withDeps++;
    stats.totalDeps += sortedTerms.length;
    for (const t of sortedTerms) stats.perTerm[t] = (stats.perTerm[t] || 0) + 1;
  }

  outParts.push(`---\n\n${head}\n\n${relatedBlock}${rest.trim()}\n`);
}

// 先頭に glossary 用語定義を 1 回だけ連結 (src が glossary 自身ならスキップ)
const isSelfGlossary = fs.realpathSync(SRC) === fs.realpathSync(GLOSSARY);
let output;
if (isSelfGlossary) {
  output = outParts.join('\n');
} else {
  const glossaryDefs = glossaryRaw
    .split(/^---\s*$/m)
    .map(b => b.trim())
    .filter(b => /^#\s+<<[^<>\n]+>>/.test(b));
  const glossaryHead = glossaryDefs.map(d => `---\n\n${d}\n`).join('\n');
  output = glossaryHead + '\n' + outParts.join('\n');
}

fs.writeFileSync(OUT, output);

console.error(`[prepend-deps] wrote ${OUT}`);
console.error(`[prepend-deps] sections: ${stats.secs} (${stats.withDeps} with related terms)`);
console.error(`[prepend-deps] total deps: ${stats.totalDeps}`);
console.error(`[prepend-deps] term coverage:`);
const ranked = Object.entries(stats.perTerm).sort((a, b) => b[1] - a[1]);
for (const [t, n] of ranked) console.error(`  ${String(n).padStart(3)} sections  <<${t}>>`);
const allCanonicals = [...new Set(detectables.map(d => d.canonical))];
const unused = allCanonicals.filter(t => !stats.perTerm[t]);
if (unused.length > 0) {
  console.error(`[prepend-deps] terms not appearing in any section: ${unused.length}`);
  for (const t of unused) console.error(`       <<${t}>>`);
}
