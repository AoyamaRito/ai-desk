#!/usr/bin/env node
// focus-md.js — doc-exec 形式の md から検索要件にマッチするセクションを抽出する
//
// 思想: ai-desk.js の skeleton/focus を md 用に再構成。本体は触らず sandbox 内で完結。
//
// 使い方:
//   node focus-md.js <file.md>                # skeleton: セクション名 + 関連リストを並べる
//   node focus-md.js <file.md> <q>            # query 1 つ: マッチセクションを全文出力
//   node focus-md.js <file.md> <q1> <q2>...   # 複数: AND マッチ
//
// クエリ仕様:
//   - 大小文字無視、部分一致 (正規表現の特殊文字は escape)
//   - セクション名 / 本文 / 関連リスト 全てを対象
//   - <<Twin>> でも Twin でもマッチ可 (関連行に <<Twin>> として記録されているため)
//
// 例:
//   node focus-md.js all-docs-deps.md                    # 全 38 セクションのスケルトン
//   node focus-md.js all-docs-deps.md Twin               # Twin に触れるセクションのみ
//   node focus-md.js all-docs-deps.md Twin REAL          # 両方を含むセクション
//   node focus-md.js all-docs-deps.md "Heavy Function"   # 多語クエリは引用符で

const fs = require('fs');
const { parse } = require('./parse');

const [file, ...queries] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node focus-md.js <file.md> [query...]');
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const sections = parse(text);

// skeleton モード
if (queries.length === 0) {
  for (const sec of sections) {
    // 本文先頭の "> 関連:" 系ブロックを抽出 (連続する `>` 行)
    const m = sec.body.match(/^>\s+[^\n]+(?:\n>\s+[^\n]+)*/m);
    const related = m ? '\n    ' + m[0].split('\n').join('\n    ') : '';
    console.log(`# ${sec.name}${related}`);
  }
  console.error(`\n[focus-md] ${sections.length} sections (skeleton)`);
  process.exit(0);
}

// focus モード
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regexes = queries.map(q => new RegExp(escape(q), 'i'));

const matched = sections.filter(sec =>
  regexes.every(re => re.test(sec.name) || re.test(sec.body))
);

if (matched.length === 0) {
  console.error(`[focus-md] no sections match: ${queries.join(' AND ')}`);
  process.exit(1);
}

for (const sec of matched) {
  process.stdout.write('---\n\n' + sec.body.trim() + '\n\n');
}
console.error(`[focus-md] ${matched.length} / ${sections.length} sections matched: ${queries.join(' AND ')}`);
