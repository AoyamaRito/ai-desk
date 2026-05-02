#!/usr/bin/env node
// convert.js — 既存 md を doc-exec 形式に変換 (MVP, Zero-Dep)
//
// 入力: H1 タイトル + H2 セクション × N の典型的なドキュメント (Bible 等)
// 出力: H1 セクション × N + `---` 区切り (doc-exec 形式)
//
// 規則:
//   - H2 (`## XYZ`) で分割。各 H2 が doc-exec の関数（H1）になる
//   - 関数名はリーディング番号をスラッグ化 (`## 0.15 ...` → `section-0-15`)
//     番号がない場合はASCII単語をハイフン連結 (fallback)
//   - 元の H2 タイトル全文は本文先頭に `> 元タイトル` として保持
//   - 本文中の単独 `---` は `***` に置換（doc-exec 区切りとの誤認回避）
//   - deps は推論しない。空のまま出力。後から手で書く
//
// 使い方: node convert.js <input.md> [> output.md]

const fs = require('fs');

function slugify(headingText) {
  // 「0.15 認知...」「1. ai-desk...」「7.6 ペア宣言」等から番号を取る
  const m = headingText.match(/^(\d+(?:\.\d+)*)/);
  if (m) return `section-${m[1].replace(/\./g, '-')}`;
  // 番号なしフォールバック: ASCII 単語のみ拾ってハイフン連結
  const slug = headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('-');
  return slug || 'section';
}

function convert(mdText) {
  // H2 (`^## `) を境界に split。先頭の preamble (タイトル/前書き) は捨てる選択も可だが、
  // 情報ロスを防ぐため preamble がある場合は `intro` セクションとして残す。
  const lines = mdText.split('\n');
  const sections = [];
  let current = { headingText: null, lines: [] };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      // 直前のセクションを締める
      if (current.headingText !== null || current.lines.some(l => l.trim().length > 0)) {
        sections.push(current);
      }
      current = { headingText: h2[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  // 最後のセクション
  if (current.headingText !== null || current.lines.some(l => l.trim().length > 0)) {
    sections.push(current);
  }

  // 名前付け
  const usedNames = new Map();
  for (const s of sections) {
    let base = s.headingText ? slugify(s.headingText) : 'intro';
    let name = base;
    let n = 2;
    while (usedNames.has(name)) {
      name = `${base}-${n++}`;
    }
    usedNames.set(name, true);
    s.name = name;
  }

  // 出力組み立て
  const out = [];
  for (const s of sections) {
    out.push(`# ${s.name}`);
    out.push('');
    if (s.headingText) {
      // 元タイトルを引用で保持（人間向け可読性）
      out.push(`> ${s.headingText}`);
      out.push('');
    }
    // 本文の単独 `---` 行を `***` に置換（doc-exec 区切りとの衝突回避）
    const body = s.lines
      .map(l => /^---\s*$/.test(l) ? '***' : l)
      .join('\n')
      .replace(/^\n+/, '')   // 先頭空行を削除
      .replace(/\n+$/, '');  // 末尾空行を削除
    if (body.length > 0) {
      out.push(body);
      out.push('');
    }
    out.push('---');
    out.push('');
  }
  return out.join('\n');
}

if (require.main === module) {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node convert.js <input.md> [> output.md]');
    process.exit(1);
  }
  const md = fs.readFileSync(inputFile, 'utf8');
  process.stdout.write(convert(md));
}

module.exports = { convert, slugify };
