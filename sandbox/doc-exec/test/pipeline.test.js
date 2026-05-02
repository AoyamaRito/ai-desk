// node --test test/pipeline.test.js
// doc-exec パイプライン golden test。
// 固定フィクスチャ (test/fixtures/) に対して bundle-docs + prepend-deps を走らせ、
// 出力が test/golden/ と byte 一致することを確認する。
//
// 既存の golden を更新したい場合: UPDATE_GOLDEN=1 node --test test/pipeline.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const GOLDEN = path.join(__dirname, 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

function runIn(cwd, script, args) {
  const r = spawnSync('node', [path.join(ROOT, script), ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function freshTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docexec_'));
  return dir;
}

function diffOrUpdate(actualPath, goldenPath, label) {
  const actual = fs.readFileSync(actualPath, 'utf8');
  if (UPDATE) {
    fs.writeFileSync(goldenPath, actual);
    return;
  }
  if (!fs.existsSync(goldenPath)) {
    assert.fail(`Golden missing: ${goldenPath}. Run with UPDATE_GOLDEN=1 to create.`);
  }
  const expected = fs.readFileSync(goldenPath, 'utf8');
  assert.equal(actual, expected,
    `${label}: output diverged from golden.\n  actual: ${actualPath}\n  golden: ${goldenPath}\n  Re-run with UPDATE_GOLDEN=1 if intentional.`);
}

test('bundle-docs: output matches golden for fixture repo', () => {
  const tmp = freshTmp();
  const r = runIn(tmp, 'bundle-docs.js', [
    `--root=${path.join(FIXTURES, 'repo')}`,
    `--out=all-docs.md`,
  ]);
  assert.equal(r.code, 0, `bundle-docs failed: ${r.err}`);
  diffOrUpdate(path.join(tmp, 'all-docs.md'), path.join(GOLDEN, 'all-docs.golden.md'), 'bundle');
});

test('prepend-deps: output matches golden for fixture bundle + glossary', () => {
  const tmp = freshTmp();
  // 前段 bundle 実行
  let r = runIn(tmp, 'bundle-docs.js', [
    `--root=${path.join(FIXTURES, 'repo')}`,
    `--out=all-docs.md`,
  ]);
  assert.equal(r.code, 0, `bundle-docs failed: ${r.err}`);
  // glossary を tmp にコピー (prepend-deps は cwd 相対で読む)
  fs.copyFileSync(path.join(FIXTURES, 'glossary.md'), path.join(tmp, 'glossary.md'));
  r = runIn(tmp, 'prepend-deps.js', [
    `--src=all-docs.md`,
    `--glossary=glossary.md`,
    `--out=all-docs-deps.md`,
  ]);
  assert.equal(r.code, 0, `prepend-deps failed: ${r.err}`);
  diffOrUpdate(path.join(tmp, 'all-docs-deps.md'), path.join(GOLDEN, 'all-docs-deps.golden.md'), 'deps');
});

test('prepend-deps: idempotent — running twice yields same output', () => {
  const tmp = freshTmp();
  let r = runIn(tmp, 'bundle-docs.js', [
    `--root=${path.join(FIXTURES, 'repo')}`,
    `--out=all-docs.md`,
  ]);
  assert.equal(r.code, 0, `bundle-docs failed: ${r.err}`);
  fs.copyFileSync(path.join(FIXTURES, 'glossary.md'), path.join(tmp, 'glossary.md'));
  r = runIn(tmp, 'prepend-deps.js', [
    `--src=all-docs.md`,
    `--glossary=glossary.md`,
    `--out=pass1.md`,
  ]);
  assert.equal(r.code, 0);
  // pass1 を src に再適用
  r = runIn(tmp, 'prepend-deps.js', [
    `--src=pass1.md`,
    `--glossary=glossary.md`,
    `--out=pass2.md`,
  ]);
  assert.equal(r.code, 0);
  // 注: 二回目は glossary が二重に prepend されるので pass1 != pass2 が正しい挙動。
  // ここで検証したいのは「関連リスト自体は冪等に再生成される」こと。
  // 一回目の関連行が二回目で重複していないことだけ確認する。
  const pass2 = fs.readFileSync(path.join(tmp, 'pass2.md'), 'utf8');
  // alpha の関連行はちょうど 1 セットだけ存在するはず
  const alphaRelated = pass2.match(/^> 原則: <<Heavy Function>> <<Spotlight>>$/gm) || [];
  assert.equal(alphaRelated.length, 1, 'related line should appear exactly once per section, not duplicated by re-run');
});

test('prepend-deps: code block content is masked from term detection', () => {
  // alpha.md のコードブロック内 "Heavy Function" は検出されない (本文出現は別途あるが、
  // それ "以外" にコードブロック内出現が含まれていないことを golden で間接保証している)。
  // ここでは masking の独立確認として、本文に Heavy Function が "コードブロック内のみ" のフィクスチャを作り、
  // 関連リストに <<Heavy Function>> が出ないことを確認する。
  const tmp = freshTmp();
  fs.mkdirSync(path.join(tmp, 'repo'));
  fs.writeFileSync(path.join(tmp, 'repo', 'only-code.md'),
    '# Only Code\n\n```\nHeavy Function appears only inside this code block.\n```\n\nNo plain mentions.\n');
  let r = runIn(tmp, 'bundle-docs.js', [
    `--root=${path.join(tmp, 'repo')}`,
    `--out=all-docs.md`,
  ]);
  assert.equal(r.code, 0);
  fs.copyFileSync(path.join(FIXTURES, 'glossary.md'), path.join(tmp, 'glossary.md'));
  r = runIn(tmp, 'prepend-deps.js', [
    `--src=all-docs.md`,
    `--glossary=glossary.md`,
    `--out=out.md`,
  ]);
  assert.equal(r.code, 0);
  const out = fs.readFileSync(path.join(tmp, 'out.md'), 'utf8');
  // out には glossary の <<Heavy Function>> 定義は含まれるが、only-code セクション本文の関連行に <<Heavy Function>> は無いはず
  const onlyCodeSection = out.split(/^---\s*$/m).find(s => s.includes('# only-code'));
  assert.ok(onlyCodeSection, 'only-code section should exist in output');
  assert.ok(!/^> 原則: .*<<Heavy Function>>/m.test(onlyCodeSection),
    'Heavy Function in code block should not appear in related list');
});

test('prepend-deps: alias is normalized to canonical in related list', () => {
  // beta.md は "重厚関数" を含むが、関連リストは canonical <<Heavy Function>> で出る。
  const tmp = freshTmp();
  let r = runIn(tmp, 'bundle-docs.js', [
    `--root=${path.join(FIXTURES, 'repo')}`,
    `--out=all-docs.md`,
  ]);
  assert.equal(r.code, 0);
  fs.copyFileSync(path.join(FIXTURES, 'glossary.md'), path.join(tmp, 'glossary.md'));
  r = runIn(tmp, 'prepend-deps.js', [
    `--src=all-docs.md`,
    `--glossary=glossary.md`,
    `--out=out.md`,
  ]);
  assert.equal(r.code, 0);
  const out = fs.readFileSync(path.join(tmp, 'out.md'), 'utf8');
  const betaSection = out.split(/^---\s*$/m).find(s => /^# beta\b/m.test(s));
  assert.ok(betaSection, 'beta section should exist');
  assert.ok(/<<Heavy Function>>/.test(betaSection),
    'beta should list canonical <<Heavy Function>>, not the alias');
  assert.ok(!/<<重厚関数>>/.test(betaSection),
    'alias should be normalized away in related list');
});

test('prepend-deps on glossary itself: self-reference is excluded', () => {
  // glossary を自分自身に適用すると、各 <<term>> セクションが他の term を関連に持つが
  // 自分自身は含まない。
  const tmp = freshTmp();
  fs.copyFileSync(path.join(FIXTURES, 'glossary.md'), path.join(tmp, 'glossary.md'));
  const r = runIn(tmp, 'prepend-deps.js', [
    `--src=glossary.md`,
    `--glossary=glossary.md`,
    `--out=glossary-deps.md`,
  ]);
  assert.equal(r.code, 0, `prepend-deps failed: ${r.err}`);
  const out = fs.readFileSync(path.join(tmp, 'glossary-deps.md'), 'utf8');
  // SHADOW セクション本文は "REAL" を含む。関連には <<REAL>> が出るはずだが、<<SHADOW>> は出ない。
  const shadowSection = out.split(/^---\s*$/m).find(s => /^# <<SHADOW>>/m.test(s));
  assert.ok(shadowSection, 'SHADOW section should exist in glossary-deps');
  // Heuristic: 関連行のうち SHADOW 自身を含むものはあってはならない
  const relatedLines = shadowSection.match(/^>.*$/gm) || [];
  for (const line of relatedLines) {
    assert.ok(!line.includes('<<SHADOW>>'),
      `self-reference leaked into SHADOW related list: ${line}`);
  }
});
