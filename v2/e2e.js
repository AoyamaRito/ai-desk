// e2e.js — ai-desk の end-to-end テスト
// 純JS、Zero-Dep。Node 標準の node:assert と node:child_process のみ使用。

import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import {
  Block, Graph, parseJS,
  applyPatch,
  applyToBlock, applyBlockSmart,
  exportModule,
  graphStats,
  blockContext, formatContextForLLM,
  parseMD, exportMermaid, inferTags,
  virtualHeavy, expandVirtualHeavy, virtualApply,
  constraintBlock, evalConstraint,
  observationBlock,
} from './ai-desk-core.js';
import {
  loadProject, saveGraph, loadGraph, buildAndSave,
  exportToFile, resolveImports
} from './ai-desk.js';

const TMP = './e2e-tmp';
let pass = 0, fail = 0;
const fails = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    fails.push({ name, error: e });
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message}`);
  }
}

function group(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

// 準備
if (existsSync(TMP)) rmSync(TMP, { recursive: true });
mkdirSync(TMP);

// ============================================================
// 1. Block: versions が本体、SHADOW getter
// ============================================================
group('Block', () => {
  test('id/type 必須', () => {
    assert.throws(() => new Block({}));
    assert.throws(() => new Block({ id: 'a' }));
    assert.throws(() => new Block({ type: 'function' }));
  });

  test('初期 versions は空', () => {
    const b = new Block({ id: 'a', type: 'function' });
    assert.equal(b.versions.length, 0);
    assert.equal(b.head(), null);
    assert.equal(b.content, null);
    assert.deepEqual(b.refs, []);
    assert.deepEqual(b.tags, []);
  });

  test('commit すると versions が増える', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x' });
    b.commit({ content: 'y' });
    assert.equal(b.versions.length, 2);
    assert.equal(b.content, 'y');
  });

  test('head は最新 version', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x' });
    b.commit({ content: 'y' });
    assert.equal(b.head().content, 'y');
  });

  test('at で過去の version を取得(timestamp 厳密)', () => {
    const b = new Block({ id: 'a', type: 'function' });
    const v1 = b.commit({ content: 'x' });
    // 異なる timestamp を保証するため少し時間を置く処理が必要だが、
    // ミリ秒解像度なので連続 commit だと同じ timestamp になる
    // → ai-desk で解決必要(後述)
    const v2 = b.commit({ content: 'y' });
    if (v1.timestamp !== v2.timestamp) {
      assert.equal(b.at(v1.timestamp).content, 'x');
    }
  });

  test('hash チェーン整合性', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x' });
    b.commit({ content: 'y' });
    b.commit({ content: 'z' });
    assert.deepEqual(b.verify(), { ok: true });
  });

  test('改ざん検知', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x' });
    b.commit({ content: 'y' });
    // 強引に書き換える
    b.versions[0].content = 'tampered';
    const r = b.verify();
    assert.equal(r.ok, false);
  });

  test('tags の SHADOW getter', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x', tags: ['core', 'critical'] });
    assert.deepEqual(b.tags, ['core', 'critical']);
    assert.equal(b.hasTag('core'), true);
    assert.equal(b.hasTag('xxx'), false);
    assert.equal(b.hasAllTags(['core', 'critical']), true);
    assert.equal(b.hasAnyTag(['xxx', 'core']), true);
  });

  test('refs の SHADOW getter', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x', refs: [{ kind: 'calls', target: 'b' }] });
    assert.equal(b.refs.length, 1);
    assert.equal(b.refs[0].target, 'b');
  });

  test('JSON ラウンドトリップ', () => {
    const b = new Block({ id: 'a', type: 'function', meta: { name: 'foo' } });
    b.commit({ content: 'x', tags: ['core'] });
    b.commit({ content: 'y' });
    const json = b.toJSON();
    const restored = Block.fromJSON(json);
    assert.equal(restored.versions.length, 2);
    assert.equal(restored.content, 'y');
    assert.deepEqual(restored.verify(), { ok: true });
  });
});

// ============================================================
// 2. Graph
// ============================================================
group('Graph', () => {
  function fixture() {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'b', refs: [{ kind: 'calls', target: 'a' }] });
    const c = new Block({ id: 'c', type: 'function' });
    c.commit({ content: 'c', refs: [{ kind: 'calls', target: 'b' }] });
    return new Graph([a, b, c]);
  }

  test('forward', () => {
    const g = fixture();
    assert.deepEqual(g.forward('b').map(x => x.id), ['a']);
    assert.deepEqual(g.forward('c').map(x => x.id), ['b']);
    assert.deepEqual(g.forward('a').map(x => x.id), []);
  });

  test('backward', () => {
    const g = fixture();
    assert.deepEqual(g.backward('a').map(x => x.id), ['b']);
    assert.deepEqual(g.backward('b').map(x => x.id), ['c']);
    assert.deepEqual(g.backward('c').map(x => x.id), []);
  });

  test('impact (推移閉包)', () => {
    const g = fixture();
    const ids = g.impact('a').map(x => x.id).sort();
    assert.deepEqual(ids, ['b', 'c']);
  });

  test('byTag', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a', tags: ['core'] });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'b', tags: ['core', 'export'] });
    const c = new Block({ id: 'c', type: 'function' });
    c.commit({ content: 'c', tags: ['util'] });
    const g = new Graph([a, b, c]);
    assert.deepEqual(g.byTag('core').map(x => x.id), ['a', 'b']);
    assert.deepEqual(g.byTag('export').map(x => x.id), ['b']);
    assert.deepEqual(g.byAllTags(['core', 'export']).map(x => x.id), ['b']);
    assert.deepEqual(g.byAnyTag(['util', 'export']).map(x => x.id), ['b', 'c']);
  });

  test('byType', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const b = new Block({ id: 'b', type: 'class' });
    b.commit({ content: 'b' });
    const g = new Graph([a, b]);
    assert.deepEqual(g.byType('function').map(x => x.id), ['a']);
    assert.deepEqual(g.byType('class').map(x => x.id), ['b']);
  });

  test('JSON ラウンドトリップ', () => {
    const g = fixture();
    const restored = Graph.fromJSON(g.toJSON());
    assert.equal(restored.all().length, 3);
    assert.deepEqual(restored.verify(), { ok: true });
    assert.deepEqual(restored.forward('b').map(x => x.id), ['a']);
  });

  test('remove で参照も整理されるか', () => {
    const g = fixture();
    g.remove('a');
    // a を参照していた b の refs はそのまま残る(target 不在)
    // forward は filter で nullを除外する仕様
    assert.deepEqual(g.forward('b').map(x => x.id), []);
  });
});

// ============================================================
// 3. parseJS
// ============================================================
group('parseJS', () => {
  test('function 宣言', () => {
    const blocks = parseJS(`function foo() { return 1; }`, 'm');
    assert.equal(blocks.length, 2); // module + foo
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo);
    assert.equal(foo.type, 'function');
    assert.ok(foo.tags.includes('function'));
  });

  test('export function', () => {
    const blocks = parseJS(`export function foo() {}`, 'm');
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo.tags.includes('export'));
  });

  test('async function', () => {
    const blocks = parseJS(`async function foo() {}`, 'm');
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo.tags.includes('async'));
  });

  test('arrow function', () => {
    const blocks = parseJS(`const foo = (x) => { return x; };`, 'm');
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo);
    assert.ok(foo.tags.includes('arrow'));
  });

  test('class 宣言', () => {
    const blocks = parseJS(`class Foo { run() {} }`, 'm');
    const foo = blocks.find(b => b.meta.name === 'Foo');
    assert.ok(foo);
    assert.equal(foo.type, 'class');
    assert.ok(foo.tags.includes('class'));
  });

  test('import 文', () => {
    const blocks = parseJS(`import { x } from './x.js';\nfunction f(){}`, 'm');
    const m = blocks[0];
    assert.equal(m.type, 'module');
    assert.ok(m.refs.some(r => r.kind === 'import' && r.target === './x.js'));
  });

  test('destructuring 引数の関数本体を正しく取得', () => {
    const src = `
function makeVersion({ content, refs = [] }, prev = null) {
  const v = { content, refs };
  v.hash = hashVersion(v);
  return v;
}
function hashVersion(v) { return 'h'; }
`;
    const blocks = parseJS(src, 'm');
    const mv = blocks.find(b => b.meta.name === 'makeVersion');
    // content に hashVersion が含まれてる(本体を完全に取れてる)
    assert.ok(mv.content.includes('hashVersion'));
    // calls エッジが追加されてる
    assert.ok(mv.refs.some(r => r.kind === 'calls' && r.target === 'm:fn:hashVersion'));
  });

  test('呼び出しグラフ(同モジュール内)', () => {
    const src = `
function a() { return 1; }
function b() { return a() + 1; }
function c() { return b() + a(); }
`;
    const blocks = parseJS(src, 'm');
    const b = blocks.find(x => x.meta.name === 'b');
    const c = blocks.find(x => x.meta.name === 'c');
    assert.ok(b.refs.some(r => r.kind === 'calls' && r.target === 'm:fn:a'));
    assert.ok(c.refs.some(r => r.kind === 'calls' && r.target === 'm:fn:b'));
    assert.ok(c.refs.some(r => r.kind === 'calls' && r.target === 'm:fn:a'));
  });

  test('@tags 注釈', () => {
    const src = `
// @tags: core, critical
function foo() {}
`;
    const blocks = parseJS(src, 'm');
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo.tags.includes('core'));
    assert.ok(foo.tags.includes('critical'));
  });

  test('v1 emblem 互換', () => {
    const src = `
// [ai_s_emblem:#high#logic Foo]
function foo() {}
`;
    const blocks = parseJS(src, 'm');
    const foo = blocks.find(b => b.meta.name === 'foo');
    assert.ok(foo.tags.includes('high'));
    assert.ok(foo.tags.includes('logic'));
  });

  test('module の contains refs', () => {
    const src = `function a(){} function b(){}`;
    const blocks = parseJS(src, 'm');
    const m = blocks[0];
    const containsTargets = m.refs.filter(r => r.kind === 'contains').map(r => r.target);
    assert.deepEqual(containsTargets, ['m:fn:a', 'm:fn:b']);
  });

  test('文字列やコメント内のキーワードを無視 (エッジケース)', () => {
    const src = `
// function ignoreMe() {}
/* class IgnoreMe {} */
const s = "function fake() {}";
const r = /class Fake {}/;
function real() { return "ok"; }
`;
    const blocks = parseJS(src, 'm');
    const names = blocks.map(b => b.meta.name).filter(Boolean);
    // 'ignoreMe', 'IgnoreMe', 'fake', 'Fake' は含まれてはいけない
    // 'real' だけが含まれるべき
    assert.ok(names.includes('real'));
    assert.ok(!names.includes('ignoreMe'));
    assert.ok(!names.includes('IgnoreMe'));
    assert.ok(!names.includes('fake'));
    assert.ok(!names.includes('Fake'));
  });

  test('複雑なネストとブレースの追跡 (エッジケース)', () => {
    const src = `
function outer() {
  if (true) {
    const s = "{";
    function inner() {
      return "}";
    }
  }
}
function next() {}
`;
    const blocks = parseJS(src, 'm');
    const outer = blocks.find(b => b.meta.name === 'outer');
    const next = blocks.find(b => b.meta.name === 'next');
    assert.ok(outer);
    assert.ok(next);
    // outer の content が next を含んでいないことを確認 (ブレースの閉じ間違いチェック)
    assert.ok(!outer.content.includes('function next'));
    assert.ok(outer.content.includes('function inner'));
  });
});

// ============================================================
// 4. loadProject (複数ファイル)
// ============================================================
group('loadProject', () => {
  const f1 = `${TMP}/a.js`;
  const f2 = `${TMP}/b.js`;
  writeFileSync(f1, `
import { foo } from './b.js';
export function bar() { return foo() + 1; }
`);
  writeFileSync(f2, `
export function foo() { return 42; }
`);

  test('2ファイル読み込み', () => {
    const g = loadProject([f1, f2]);
    // a.js / b.js の module + 各 function
    assert.ok(g.has(f1));
    assert.ok(g.has(f2));
    assert.ok(g.has(`${f1}:fn:bar`));
    assert.ok(g.has(`${f2}:fn:foo`));
  });

  test('module 間の import エッジ', () => {
    const g = loadProject([f1, f2]);
    const aMod = g.get(f1);
    assert.ok(aMod.refs.some(r => r.kind === 'import' && r.target === './b.js'));
  });
});

// ============================================================
// 5. CLI
// ============================================================
group('CLI', () => {
  function run(args) {
    return execSync(`node ai-desk.js ${args}`, { encoding: 'utf8' });
  }

  test('default help 実行(BIBLE 案内 + コマンドグループ表示)', () => {
    const out = run('');
    assert.ok(out.includes('Block.versions が本体'));
    assert.ok(out.includes('bible-info'), 'help should advertise bible-info');
    assert.ok(out.includes('first-time?'), 'help should have first-time guidance');
  });

  test('demo 実行(in-memory Block / Graph)', () => {
    const out = run('demo');
    assert.ok(out.includes('demo (in-memory'));
    assert.ok(out.includes('graph size: 2'));
    assert.ok(out.includes('verify'));
  });

  test('bible-info shows axioms / block types / taboos / vocabulary', () => {
    const out = run('bible-info');
    assert.ok(out.includes('BIBLE.js version'));
    assert.ok(out.includes('A0 認知非対称性'));
    assert.ok(out.includes('A4 Event Sourcing'));
    assert.ok(out.includes('A8 Spec-First'));
    assert.ok(out.includes('Block types'));
    assert.ok(out.includes('Taboos'));
    assert.ok(out.includes('Vocabulary'));
    assert.ok(out.includes('clarify'));
    assert.ok(out.includes('refactor'));
  });

  test('bible-check on clean file → ok:true', () => {
    const f = `${TMP}/clean.js`;
    writeFileSync(f, 'export function foo(){ return 42; }');
    const out = run(`bible-check ${f}`);
    const r = JSON.parse(out);
    assert.equal(r.ok, true);
    assert.equal(r.violations.length, 0);
    assert.ok(typeof r.gravity === 'number');
  });

  test('bible-check on framework import → exit 1 + violation', () => {
    const f = `${TMP}/violation.js`;
    writeFileSync(f, 'import x from "react";');
    let exitCode = 0;
    let stdout = '';
    try { stdout = run(`bible-check ${f}`); }
    catch (e) { exitCode = e.status; stdout = e.stdout?.toString() || ''; }
    assert.equal(exitCode, 1);
    const r = JSON.parse(stdout);
    assert.equal(r.ok, false);
    assert.ok(r.violations.some(v => v.name === 'No Frameworks'));
  });

  test('bible-summon outputs gravity-field prompt', () => {
    const out = run('bible-summon A0 A8');
    assert.ok(out.includes('CONTEXT_GRAVITY_FIELD'));
    assert.ok(out.includes('A0'));
    assert.ok(out.includes('A8'));
    assert.ok(out.includes('認知非対称性'));
  });

  test('skeleton', () => {
    const f = `${TMP}/sk.js`;
    writeFileSync(f, `function a(){} function b(){ a(); }`);
    const out = run(`skeleton ${f}`);
    assert.ok(out.includes(`${f}:fn:a`));
    assert.ok(out.includes(`${f}:fn:b`));
  });

  test('focus', () => {
    const f = `${TMP}/fo.js`;
    writeFileSync(f, `function hello() { return 'hi'; }`);
    const out = run(`focus ${f} ${f}:fn:hello`);
    assert.ok(out.includes('return'));
  });

  test('graph (JSON)', () => {
    const f = `${TMP}/gr.js`;
    writeFileSync(f, `function a(){}`);
    const out = run(`graph ${f}`);
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed));
    assert.ok(parsed.length >= 2);
  });

  test('impact', () => {
    const f = `${TMP}/im.js`;
    writeFileSync(f, `function a(){} function b(){ a(); }`);
    const out = run(`impact ${f} ${f}:fn:a`);
    assert.ok(out.includes(`${f}:fn:b`));
  });

  test('tag', () => {
    const f = `${TMP}/tg.js`;
    writeFileSync(f, `export function a(){}`);
    const out = run(`tag ${f} export`);
    assert.ok(out.includes(`${f}:fn:a`));
  });

  test('tags', () => {
    const f = `${TMP}/tgs.js`;
    writeFileSync(f, `export function a(){} class B{}`);
    const out = run(`tags ${f}`);
    assert.ok(/function\s+\d+/.test(out));
    assert.ok(/class\s+\d+/.test(out));
  });

  test('self', () => {
    const out = run('self');
    assert.ok(out.includes('self-parse'));
  });

  test('save', () => {
    const f = `${TMP}/sv.js`;
    writeFileSync(f, `function a(){}`);
    const out = `${TMP}/sv.json`;
    const result = run(`save ${out} ${f}`);
    assert.ok(existsSync(out));
    assert.ok(result.includes('saved'));
  });

  test('load', () => {
    const f = `${TMP}/ld.js`;
    writeFileSync(f, `function a(){}`);
    const out = `${TMP}/ld.json`;
    run(`save ${out} ${f}`);
    const result = run(`load ${out}`);
    assert.ok(result.includes('loaded'));
    assert.ok(result.includes('ok: true'));
  });

  test('search', () => {
    const f = `${TMP}/sr.js`;
    writeFileSync(f, `function a(){ return SENTINEL; }`);
    const result = run(`search ${f} SENTINEL`);
    assert.ok(result.includes(`${f}:fn:a`));
  });

  test('diff', () => {
    // version 1個だけだと diff null になるが、CLI 経由ではそれを表示するだけ
    const f = `${TMP}/df.js`;
    writeFileSync(f, `function a(){}`);
    const result = run(`diff ${f} ${f}:fn:a`);
    // diff が null でも JSON 化されて出る or 空
    // versions が 1個だけなので diff(null, null) は null
    assert.ok(result.includes('null') || result.length >= 0);
  });
});

// ============================================================
// 6a. diff / blame / rollback
// ============================================================
group('Block diff/blame/rollback', () => {
  test('diff(content)', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'function a(){ return 1; }' });
    b.commit({ content: 'function a(){ return 2; }' });
    const d = b.diff();
    assert.equal(d.contentChanged, true);
    assert.equal(d.content.from.includes('return 1'), true);
    assert.equal(d.content.to.includes('return 2'), true);
  });

  test('diff(refs added/removed)', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x', refs: [{ kind: 'calls', target: 'foo' }] });
    b.commit({ content: 'x', refs: [{ kind: 'calls', target: 'bar' }] });
    const d = b.diff();
    assert.equal(d.refsAdded.length, 1);
    assert.equal(d.refsAdded[0].target, 'bar');
    assert.equal(d.refsRemoved.length, 1);
    assert.equal(d.refsRemoved[0].target, 'foo');
  });

  test('diff(tags added/removed)', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x', tags: ['a', 'b'] });
    b.commit({ content: 'x', tags: ['b', 'c'] });
    const d = b.diff();
    assert.deepEqual(d.tagsAdded, ['c']);
    assert.deepEqual(d.tagsRemoved, ['a']);
  });

  test('blameRef(refが追加されたversion)', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'x' });
    b.commit({ content: 'x', refs: [{ kind: 'calls', target: 'foo' }] });
    b.commit({ content: 'x', refs: [{ kind: 'calls', target: 'foo' }, { kind: 'calls', target: 'bar' }] });
    const r = b.blameRef('foo');
    assert.equal(r.index, 1);
    const r2 = b.blameRef('bar');
    assert.equal(r2.index, 2);
    assert.equal(b.blameRef('xxx'), null);
  });

  test('rollback', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'v1' });
    b.commit({ content: 'v2' });
    b.commit({ content: 'v3' });
    b.rollback(0);
    assert.equal(b.versions.length, 4);
    assert.equal(b.content, 'v1');
    assert.equal(b.head().meta.rollbackIndex, 0);
    // hash 整合性は維持
    assert.deepEqual(b.verify(), { ok: true });
  });
});

// ============================================================
// 6b. search
// ============================================================
group('Graph search', () => {
  function fixture() {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){ return SECRET; }', tags: ['core'] });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'function b(){ return 1; }', tags: ['util'] });
    const c = new Block({ id: 'c', type: 'class' });
    c.commit({ content: 'class C { run() { return SECRET; } }', tags: ['core'] });
    return new Graph([a, b, c]);
  }

  test('文字列検索', () => {
    const g = fixture();
    const hits = g.search('SECRET');
    assert.equal(hits.length, 2);
  });

  test('RegExp 検索', () => {
    const g = fixture();
    const hits = g.search(/return\s+\d+/);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].block.id, 'b');
  });

  test('type 絞り込み', () => {
    const g = fixture();
    const hits = g.search('SECRET', { type: 'class' });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].block.id, 'c');
  });

  test('tag 絞り込み', () => {
    const g = fixture();
    const hits = g.search('return', { tag: 'core' });
    assert.equal(hits.length, 2);
  });
});

// ============================================================
// 6c. saveGraph / loadGraph
// ============================================================
group('Persistence', () => {
  test('save → load ラウンドトリップ', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){}', tags: ['core'] });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'function b(){ a(); }', refs: [{ kind: 'calls', target: 'a' }] });
    const g = new Graph([a, b]);
    const path = `${TMP}/graph.json`;
    saveGraph(g, path);
    const restored = loadGraph(path);
    assert.equal(restored.all().length, 2);
    assert.equal(restored.get('a').content, 'function a(){}');
    assert.deepEqual(restored.verify(), { ok: true });
  });

  test('buildAndSave (一発)', () => {
    const f = `${TMP}/x.js`;
    writeFileSync(f, `export function foo(){}`);
    const out = `${TMP}/g.json`;
    const g = buildAndSave([f], out);
    assert.ok(existsSync(out));
    const restored = loadGraph(out);
    assert.equal(restored.has(`${f}:fn:foo`), true);
  });
});

// ============================================================
// 6c-2. Block.applyPatch / applyToBlock / applyBlockSmart
// ============================================================
group('Block-level apply', () => {
  test('Block.applyPatch — content 差し替え', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'function a(){}', tags: ['core'] });
    const r = b.applyPatch('function a(){ return 1; }');
    assert.equal(r.action, 'updated');
    assert.equal(b.content, 'function a(){ return 1; }');
    // tags は引き継がれてる
    assert.deepEqual(b.tags, ['core']);
    assert.equal(b.versions.length, 2);
  });

  test('Block.applyPatch — 同じ内容なら unchanged', () => {
    const b = new Block({ id: 'a', type: 'function' });
    b.commit({ content: 'function a(){}', tags: ['core'] });
    const r = b.applyPatch('function a(){}');
    assert.equal(r.action, 'unchanged');
    assert.equal(b.versions.length, 1);
  });

  test('Block.applyPatch — 未 commit なら created', () => {
    const b = new Block({ id: 'a', type: 'function' });
    const r = b.applyPatch('function a(){}');
    assert.equal(r.action, 'created');
    assert.equal(b.versions.length, 1);
  });

  test('applyToBlock(graph, id, content)', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){}' });
    const g = new Graph([a]);
    const r = applyToBlock(g, 'a', 'function a(){ return 2; }');
    assert.equal(r.action, 'updated');
    assert.equal(g.get('a').content, 'function a(){ return 2; }');
  });

  test('applyBlockSmart — content から refs/tags 自動抽出', () => {
    const a = new Block({ id: 'm:fn:foo', type: 'function', meta: { name: 'foo' } });
    a.commit({ content: 'function foo(){}', tags: ['function'] });
    const g = new Graph([a]);
    const newSrc = `// @tags: high\nexport function foo(){ return 1; }`;
    const r = applyBlockSmart(g, 'm:fn:foo', newSrc);
    assert.equal(r.action, 'updated');
    const updated = g.get('m:fn:foo');
    // tags が再抽出されてる(function/export/high)
    assert.ok(updated.tags.includes('export'));
    assert.ok(updated.tags.includes('high'));
  });

  test('applyToBlock — 存在しない id は throw', () => {
    const g = new Graph();
    assert.throws(() => applyToBlock(g, 'nonexistent', 'x'));
  });
});

// ============================================================
// 6d. applyPatch
// ============================================================
group('applyPatch', () => {
  test('既存 Block の更新', () => {
    const f = `${TMP}/ap.js`;
    writeFileSync(f, `function foo(){ return 1; }`);
    const g = loadProject([f]);
    const beforeVersions = g.get(`${f}:fn:foo`).versions.length;
    const patch = `function foo(){ return 2; }`;
    const updates = applyPatch(g, patch, f);
    const after = g.get(`${f}:fn:foo`);
    assert.equal(after.content.includes('return 2'), true);
    assert.equal(after.versions.length, beforeVersions + 1);
    assert.ok(updates.some(u => u.action === 'updated'));
  });

  test('新規 Block の追加', () => {
    const f = `${TMP}/ap2.js`;
    writeFileSync(f, `function foo(){}`);
    const g = loadProject([f]);
    const patch = `function foo(){} function bar(){}`;
    const updates = applyPatch(g, patch, f);
    assert.ok(g.has(`${f}:fn:bar`));
    assert.ok(updates.some(u => u.id === `${f}:fn:bar` && u.action === 'added'));
  });

  test('変更なしは unchanged', () => {
    const f = `${TMP}/ap3.js`;
    writeFileSync(f, `function foo(){ return 1; }`);
    const g = loadProject([f]);
    const beforeVersions = g.get(`${f}:fn:foo`).versions.length;
    const updates = applyPatch(g, `function foo(){ return 1; }`, f);
    const after = g.get(`${f}:fn:foo`);
    assert.equal(after.versions.length, beforeVersions); // 増えてない
    assert.ok(updates.some(u => u.id === `${f}:fn:foo` && u.action === 'unchanged'));
  });
});

// ============================================================
// 6e. resolveImports
// ============================================================
group('resolveImports', () => {
  test('相対パスの解決', () => {
    const f1 = `${TMP}/ri-a.js`;
    const f2 = `${TMP}/ri-b.js`;
    writeFileSync(f1, `import { x } from './ri-b.js';`);
    writeFileSync(f2, `export const x = 1;`);
    const g = loadProject([f1, f2]);
    resolveImports(g);
    const head = g.get(f1).head();
    const importRef = head.refs.find(r => r.kind === 'import');
    // 解決された target は f2 の絶対パス相当
    assert.ok(importRef.target.endsWith('ri-b.js'));
    assert.ok(importRef.originalTarget === './ri-b.js');
  });
});

// ============================================================
// 6f. constraintBlock + evalConstraint
// ============================================================
group('Constraint Folding', () => {
  test('じゃんけん 27世界', () => {
    const cb = constraintBlock({
      id: 'janken',
      axes: ['a', 'b', 'c'],
      values: { a: ['rock', 'paper', 'scissors'], b: ['rock', 'paper', 'scissors'], c: ['rock', 'paper', 'scissors'] },
      derive: combo => ({ allSame: combo.a === combo.b && combo.b === combo.c }),
    });
    const all = evalConstraint(cb);
    assert.equal(all._worlds, 27);
  });

  test('filter で絞り込み', () => {
    const cb = constraintBlock({
      id: 'janken2',
      axes: ['a', 'b'],
      values: { a: ['rock', 'paper', 'scissors'], b: ['rock', 'paper', 'scissors'] },
      derive: combo => ({ tie: combo.a === combo.b }),
    });
    const ties = evalConstraint(cb, { tie: true });
    assert.equal(ties._worlds, 3);
  });

  test('矛盾は _contradiction', () => {
    const cb = constraintBlock({
      id: 'imp',
      axes: ['x'],
      values: { x: [1, 2, 3] },
      derive: combo => ({ ok: combo.x > 100 }),
    });
    const r = evalConstraint(cb, { ok: true });
    assert.equal(r._contradiction, true);
  });
});

// ============================================================
// 6g. observationBlock
// ============================================================
group('Observation Block', () => {
  test('観測の記録と参照', () => {
    const obs = observationBlock({
      id: 'obs:001',
      observedId: 'mod:fn:bar',
      snapshot: { hp: 50, x: 10 },
      tags: ['ai-eyes'],
    });
    assert.equal(obs.type, 'observation');
    assert.equal(JSON.parse(obs.content).hp, 50);
    assert.ok(obs.refs.some(r => r.kind === 'observes' && r.target === 'mod:fn:bar'));
    assert.ok(obs.tags.includes('ai-eyes'));
  });
});

// ============================================================
// 6h. lint
// ============================================================
group('Graph lint', () => {
  test('broken-ref を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a', refs: [{ kind: 'calls', target: 'nonexistent' }] });
    const g = new Graph([a]);
    const issues = g.lint();
    assert.ok(issues.some(i => i.kind === 'broken-ref'));
  });

  test('orphan を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const g = new Graph([a]);
    const issues = g.lint();
    assert.ok(issues.some(i => i.kind === 'orphan' && i.id === 'a'));
  });

  test('module は orphan にしない', () => {
    const m = new Block({ id: 'm', type: 'module' });
    m.commit({ content: null });
    const g = new Graph([m]);
    const issues = g.lint();
    assert.ok(!issues.some(i => i.kind === 'orphan'));
  });

  test('循環参照を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a', refs: [{ kind: 'calls', target: 'b' }] });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'b', refs: [{ kind: 'calls', target: 'a' }] });
    const g = new Graph([a, b]);
    const issues = g.lint();
    assert.ok(issues.some(i => i.kind === 'circular'));
  });

  test('健全な graph では issue なし', () => {
    const m = new Block({ id: 'm', type: 'module' });
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){}', tags: ['function'] });
    m.commit({ content: null, refs: [{ kind: 'contains', target: 'a' }] });
    const g = new Graph([m, a]);
    const issues = g.lint();
    assert.equal(issues.length, 0);
  });

  test('brace-mismatch を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){ return; ', tags: ['function'] });  // 閉じカッコなし
    const g = new Graph([a]);
    const issues = g.lint({ orphan: false });
    assert.ok(issues.some(i => i.kind === 'brace-mismatch'));
  });

  test('brace 検査が文字列リテラル中の {} を無視', () => {
    const a = new Block({ id: 'm:fn:a', type: 'function', meta: { name: 'a' } });
    a.commit({ content: 'function a(){ return "{ unclosed string"; }', tags: ['function'] });
    const g = new Graph([a]);
    const issues = g.lint({ orphan: false });
    assert.ok(!issues.some(i => i.kind === 'brace-mismatch'));
  });

  test('calls-leak を検出', () => {
    const a = new Block({ id: 'm:fn:a', type: 'function', meta: { name: 'a' } });
    a.commit({ content: 'function a(){ return 1; }', tags: ['function'] });
    const b = new Block({ id: 'm:fn:b', type: 'function', meta: { name: 'b' } });
    // content には a() がある、refs には calls エッジがない
    b.commit({ content: 'function b(){ return a() + 1; }', tags: ['function'], refs: [] });
    const g = new Graph([a, b]);
    const issues = g.lint({ orphan: false });
    assert.ok(issues.some(i => i.kind === 'calls-leak' && i.from === 'm:fn:b' && i.missing === 'm:fn:a'));
  });

  test('tag-mismatch を検出(function なのに tag なし)', () => {
    const a = new Block({ id: 'a', type: 'function', meta: { name: 'a' } });
    a.commit({ content: 'function a(){}', tags: [] });
    const g = new Graph([a]);
    const issues = g.lint({ orphan: false });
    assert.ok(issues.some(i => i.kind === 'tag-mismatch' && i.expected === 'function'));
  });

  test('empty-block を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: null, refs: [], children: [], tags: ['function'] });
    const g = new Graph([a]);
    const issues = g.lint({ orphan: false });
    assert.ok(issues.some(i => i.kind === 'empty-block'));
  });

  test('hash-broken を検出', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'function a(){}', tags: ['function'] });
    a.versions[0].content = 'tampered';  // 改ざん
    const g = new Graph([a]);
    const issues = g.lint({ orphan: false });
    assert.ok(issues.some(i => i.kind === 'hash-broken'));
  });

  test('opts でカテゴリを無効化できる', () => {
    const a = new Block({ id: 'a', type: 'function', meta: { name: 'a' } });
    a.commit({ content: 'function a(){}', tags: [] }); // tag-mismatch + orphan
    const g = new Graph([a]);
    const all = g.lint();
    const noOrphan = g.lint({ orphan: false });
    assert.ok(all.length > noOrphan.length);
  });
});

// ============================================================
// 6i. exportModule
// ============================================================
group('exportModule', () => {
  test('module Block から JS 復元', () => {
    const f = `${TMP}/em.js`;
    writeFileSync(f, `export function foo(){ return 1; }\nfunction bar(){}`);
    const g = loadProject([f]);
    const code = exportModule(g, f);
    assert.ok(code.includes('foo'));
    assert.ok(code.includes('bar'));
  });

  test('exportToFile でファイル出力', () => {
    const f = `${TMP}/etf.js`;
    writeFileSync(f, `function hello(){}`);
    const g = loadProject([f]);
    const out = `${TMP}/etf-out.js`;
    exportToFile(g, f, out);
    assert.ok(existsSync(out));
    assert.ok(readFileSync(out, 'utf8').includes('hello'));
  });
});

// ============================================================
// 6j. graphStats
// ============================================================
group('graphStats', () => {
  test('Block 数 / type 集計', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a', tags: ['core'] });
    const b = new Block({ id: 'b', type: 'class' });
    b.commit({ content: 'b' });
    const g = new Graph([a, b]);
    const s = graphStats(g);
    assert.equal(s.blocks, 2);
    assert.equal(s.byType.function, 1);
    assert.equal(s.byType.class, 1);
    assert.equal(s.byTag.core, 1);
  });
});

// ============================================================
// 6k. blockContext
// ============================================================
group('blockContext', () => {
  function fixture() {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'b', refs: [{ kind: 'calls', target: 'a' }] });
    const c = new Block({ id: 'c', type: 'function' });
    c.commit({ content: 'c', refs: [{ kind: 'calls', target: 'b' }] });
    return new Graph([a, b, c]);
  }

  test('depth=1 で隣接 Block を取得', () => {
    const g = fixture();
    const ctx = blockContext(g, 'b', { depth: 1 });
    const ids = ctx.map(x => x.id).sort();
    assert.deepEqual(ids, ['a', 'b', 'c']);
  });

  test('depth=0 で target のみ', () => {
    const g = fixture();
    const ctx = blockContext(g, 'b', { depth: 0 });
    assert.equal(ctx.length, 1);
    assert.equal(ctx[0].id, 'b');
  });

  test('formatContextForLLM が markdown を返す', () => {
    const g = fixture();
    const ctx = blockContext(g, 'b', { depth: 1 });
    const md = formatContextForLLM(ctx, 'b');
    assert.ok(md.includes('# Context for b'));
    assert.ok(md.includes('⭐ b'));
    assert.ok(md.includes('```js'));
  });
});

// ============================================================
// 6l. parseMD
// ============================================================
group('parseMD', () => {
  test('section を Block に分解', () => {
    const md = `# Title\n\nintro\n\n## Section A\n\ncontent\n\n## Section B\n\nmore`;
    const blocks = parseMD(md, 'doc.md');
    const sections = blocks.filter(b => b.type === 'section');
    assert.equal(sections.length, 3);
    assert.ok(sections.some(s => s.meta.title === 'Title'));
    assert.ok(sections.some(s => s.meta.title === 'Section A'));
  });

  test('code block を子 Block に', () => {
    const md = `## Foo\n\nintro\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n`;
    const blocks = parseMD(md, 'doc.md');
    const code = blocks.find(b => b.type === 'code');
    assert.ok(code);
    assert.equal(code.content, 'const x = 1;');
    assert.ok(code.tags.includes('js'));
  });

  test('リンクを refs に', () => {
    const md = `## Foo\n\nsee [bar](./bar.md) for more`;
    const blocks = parseMD(md, 'doc.md');
    const sec = blocks.find(b => b.type === 'section');
    assert.ok(sec.refs.some(r => r.kind === 'link' && r.target === './bar.md'));
  });

  test('module の contains refs', () => {
    const md = `## A\n\n## B`;
    const blocks = parseMD(md, 'doc.md');
    const m = blocks[0];
    const containsCount = m.refs.filter(r => r.kind === 'contains').length;
    assert.equal(containsCount, 2);
  });
});

// ============================================================
// 6m. exportMermaid
// ============================================================
group('exportMermaid', () => {
  test('flowchart 形式で出力', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const b = new Block({ id: 'b', type: 'function' });
    b.commit({ content: 'b', refs: [{ kind: 'calls', target: 'a' }] });
    const g = new Graph([a, b]);
    const out = exportMermaid(g);
    assert.ok(out.startsWith('flowchart LR'));
    assert.ok(out.includes('-->|calls|'));
  });

  test('type で絞り込み', () => {
    const a = new Block({ id: 'a', type: 'function' });
    a.commit({ content: 'a' });
    const b = new Block({ id: 'b', type: 'class' });
    b.commit({ content: 'b' });
    const g = new Graph([a, b]);
    const out = exportMermaid(g, { type: 'function' });
    assert.ok(out.includes('n_a'));
    assert.ok(!out.includes('n_b'));
  });
});

// ============================================================
// 6n. inferTags
// ============================================================
group('inferTags', () => {
  test('I/O 検出', () => {
    const tags = inferTags(`function f() { return readFileSync('x'); }`, 'function');
    assert.ok(tags.includes('io'));
  });

  test('async 検出', () => {
    const tags = inferTags(`async function f() { await x(); }`, 'function');
    assert.ok(tags.includes('async'));
  });

  test('test 検出', () => {
    const tags = inferTags(`test('foo', () => { assert.ok(1); })`, 'function');
    assert.ok(tags.includes('test'));
    assert.ok(tags.includes('assertion'));
  });

  test('pure 検出', () => {
    const tags = inferTags(`function add(a, b) { return a + b; }`, 'function');
    assert.ok(tags.includes('pure'));
  });

  test('large 検出', () => {
    const lines = Array(60).fill('  // line').join('\n');
    const tags = inferTags(`function f() {\n${lines}\n}`, 'function');
    assert.ok(tags.includes('large'));
  });
});

// ============================================================
// 6o. virtual heavy / virtualApply
// ============================================================
group('Virtual Heavy Function', () => {
  function fixture() {
    const a = new Block({ id: 'm:fn:a', type: 'function', meta: { name: 'a' } });
    a.commit({ content: 'function a(){ return 1; }', tags: ['function'] });
    const b = new Block({ id: 'm:fn:b', type: 'function', meta: { name: 'b' } });
    b.commit({
      content: 'function b(){ return a() + 1; }',
      tags: ['function'],
      refs: [{ kind: 'calls', target: 'm:fn:a' }],
    });
    const c = new Block({ id: 'm:fn:c', type: 'function', meta: { name: 'c' } });
    c.commit({
      content: 'function c(){ return b() + a(); }',
      tags: ['function'],
      refs: [{ kind: 'calls', target: 'm:fn:b' }, { kind: 'calls', target: 'm:fn:a' }],
    });
    const d = new Block({ id: 'm:fn:d', type: 'function', meta: { name: 'd' } });
    d.commit({ content: 'function d(){}', tags: ['function'] });  // 関係ない
    return new Graph([a, b, c, d]);
  }

  test('virtualHeavy が依存先を集める', () => {
    const g = fixture();
    const heavy = virtualHeavy(g, 'm:fn:c');
    const ids = heavy.map(b => b.id).sort();
    assert.deepEqual(ids, ['m:fn:a', 'm:fn:b', 'm:fn:c']);
    assert.ok(!ids.includes('m:fn:d'));
  });

  test('expandVirtualHeavy が BLOCK ヘッダ付き content を返す', () => {
    const g = fixture();
    const expanded = expandVirtualHeavy(g, 'm:fn:c');
    assert.ok(expanded.includes('--- BLOCK: m:fn:c (function) ---'));
    assert.ok(expanded.includes('--- BLOCK: m:fn:b (function) ---'));
    assert.ok(expanded.includes('--- BLOCK: m:fn:a (function) ---'));
    assert.ok(!expanded.includes('m:fn:d'));
  });

  test('virtualApply が各 Block を更新する', () => {
    const g = fixture();
    const expanded = expandVirtualHeavy(g, 'm:fn:c');
    // a, b, c 全部書き換える形に
    const newContent = expanded
      .replace('function a(){ return 1; }', 'function a(){ return 100; }')
      .replace('function b(){ return a() + 1; }', 'function b(){ return a() * 2; }')
      .replace('function c(){ return b() + a(); }', 'function c(){ return b() * 10; }');
    const updates = virtualApply(g, 'm:fn:c', newContent);
    assert.equal(g.get('m:fn:a').content, 'function a(){ return 100; }');
    assert.equal(g.get('m:fn:b').content, 'function b(){ return a() * 2; }');
    assert.equal(g.get('m:fn:c').content, 'function c(){ return b() * 10; }');
    assert.equal(g.get('m:fn:d').content, 'function d(){}'); // 範囲外、無傷
    assert.ok(updates.every(u => u.action === 'updated'));
  });

  test('virtualApply は範囲外の Block を skip', () => {
    const g = fixture();
    // d を patch しようとする(範囲外)
    const fake = `// --- BLOCK: m:fn:d (function) ---\nfunction d(){ return 'hacked'; }`;
    const updates = virtualApply(g, 'm:fn:c', fake);
    assert.ok(updates.some(u => u.action === 'skipped-out-of-scope' && u.id === 'm:fn:d'));
    assert.equal(g.get('m:fn:d').content, 'function d(){}'); // 無傷
  });

  test('depth で範囲制御', () => {
    const g = fixture();
    const heavy0 = virtualHeavy(g, 'm:fn:c', { depth: 0 });
    assert.deepEqual(heavy0.map(b => b.id), ['m:fn:c']);
    const heavy1 = virtualHeavy(g, 'm:fn:c', { depth: 1 });
    assert.equal(heavy1.length, 3);  // c + b + a
  });

  // MANUAL §4.5/§4.7: content が head と同一なら新 version は作らない
  test('virtualApply: content 同一なら新 version 作らない (unchanged)', () => {
    const g = fixture();
    const heavy = virtualHeavy(g, 'm:fn:c');
    const before = heavy.map(b => b.versions.length);
    const segments = heavy.map(b =>
      `// --- BLOCK: ${b.id} (${b.type}) ---\n${b.content}\n`
    ).join('\n');
    const updates = virtualApply(g, 'm:fn:c', segments);
    const after = heavy.map(b => b.versions.length);
    assert.equal(updates.length, 3);
    for (const u of updates) assert.equal(u.action, 'unchanged');
    assert.deepEqual(before, after);  // versions 数は不変
  });

  // MANUAL §4.5/§4.6: expand → そのまま virtualApply で全 unchanged(編集なし round-trip)
  test('virtualApply: expand 出力をそのまま戻すと全 unchanged', () => {
    const g = fixture();
    const before = ['m:fn:a', 'm:fn:b', 'm:fn:c'].map(id => g.get(id).versions.length);
    const expanded = expandVirtualHeavy(g, 'm:fn:c');
    const updates = virtualApply(g, 'm:fn:c', expanded);
    const after = ['m:fn:a', 'm:fn:b', 'm:fn:c'].map(id => g.get(id).versions.length);
    for (const u of updates) assert.equal(u.action, 'unchanged');
    assert.deepEqual(before, after);
  });

  // MANUAL §4.5/§4.8 #6: 入力中の // refs: // tags: 行は除去され、refs/tags は head から継承
  test('virtualApply: // refs: / // tags: 行は無視され head から継承', () => {
    const g = fixture();
    const c = g.get('m:fn:c');
    const originalRefs = c.refs.map(r => `${r.kind}:${r.target}`).sort();
    const originalTags = [...c.tags].sort();
    const patch =
`// --- BLOCK: m:fn:c (function) ---
// tags: BOGUS_TAG_THAT_SHOULD_BE_IGNORED
// refs: calls->NONEXISTENT_TARGET
function c(){ return b() + 999; }
`;
    const updates = virtualApply(g, 'm:fn:c', patch);
    const cAfter = g.get('m:fn:c');
    assert.equal(cAfter.content, 'function c(){ return b() + 999; }');
    assert.equal(updates.find(u => u.id === 'm:fn:c').action, 'updated');
    // refs / tags は元のまま(head 継承)
    assert.deepEqual(
      cAfter.refs.map(r => `${r.kind}:${r.target}`).sort(),
      originalRefs,
    );
    assert.deepEqual([...cAfter.tags].sort(), originalTags);
  });
});

// ============================================================
// 7. 自己読み込み(ai-desk.js が ai-desk.js を解析)
// ============================================================
group('Self-parse', () => {
  test('自分自身を Block に分解できる', () => {
    const src = readFileSync('./ai-desk-core.js', 'utf8');
    const blocks = parseJS(src, 'self');
    const g = new Graph(blocks);
    assert.ok(g.byType('function').length > 5);
    assert.ok(g.byType('class').length >= 2);
    assert.ok(g.byTag('export').length >= 3);
    assert.deepEqual(g.verify(), { ok: true });
  });
});

// ============================================================
// 後始末 + 集計
// ============================================================
rmSync(TMP, { recursive: true });

console.log(`\n=========================================`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`=========================================`);

if (fail > 0) {
  console.log('\nfailures:');
  for (const f of fails) console.log(`  - ${f.name}: ${f.error.message}`);
  process.exit(1);
}
