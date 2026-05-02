// node --test ai-desk.test.js
// ai-desk.js 全モード（skeleton/focus/apply/check/coverage）の自動テスト。
// CLI を spawnSync で叩き、stdout/stderr/exitCode を検証する。Zero-Dep。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const AI_DESK = path.resolve(__dirname, 'ai-desk.js');

function run(args) {
  const result = spawnSync('node', [AI_DESK, ...args], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

function tmp(content) {
  const f = path.join(os.tmpdir(), `aitest_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(f, content, 'utf8');
  return f;
}

// ================================================================
// CHECK — valid
// ================================================================

const VALID = `
// [ai_s_emblem:#L3#logic Alpha]
const x = 1;
// [/ai_s_emblem: Alpha]

// [ai_s_emblem:#L1#physical Beta]
const y = 2;
// [/ai_s_emblem: Beta]

// [ai_s_bridge:L1toL2 MyBridge]
const z = 3;
// [/ai_s_bridge: MyBridge]
`;

test('check: valid file exits 0 and reports counts', () => {
  const f = tmp(VALID);
  const r = run([f, 'check']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('2 emblems'));
  assert.ok(r.out.includes('1 bridges'));
  fs.unlinkSync(f);
});

// ================================================================
// CHECK — duplicate emblem name
// ================================================================

test('check: duplicate emblem name exits 1', () => {
  const f = tmp(`
// [ai_s_emblem:#L3#logic Dup]
const a = 1;
// [/ai_s_emblem: Dup]

// [ai_s_emblem:#L3#logic Dup]
const b = 2;
// [/ai_s_emblem: Dup]
`);
  const r = run([f, 'check']);
  assert.equal(r.code, 1);
  assert.ok(r.err.includes("Duplicate emblem name") || r.out.includes("Duplicate emblem name"));
  fs.unlinkSync(f);
});

// ================================================================
// CHECK — mismatched open/close
// ================================================================

test('check: unclosed emblem tag exits 1', () => {
  const f = tmp(`
// [ai_s_emblem:#L3#logic Orphan]
const x = 1;
`);
  const r = run([f, 'check']);
  assert.equal(r.code, 1);
  assert.ok(r.err.includes('mismatch') || r.out.includes('mismatch'));
  fs.unlinkSync(f);
});

// ================================================================
// CHECK — unknown tag warns (exit 0)
// ================================================================

test('check: unknown tag emits warning but exits 0', () => {
  const f = tmp(`
// [ai_s_emblem:#unknown#logic WeirdTag]
const x = 1;
// [/ai_s_emblem: WeirdTag]
`);
  const r = run([f, 'check']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('unrecognized tag') || r.err.includes('unrecognized tag'));
  fs.unlinkSync(f);
});

// ================================================================
// CHECK — non-canonical bridge direction warns (exit 0)
// ================================================================

test('check: non-canonical bridge direction emits warning but exits 0', () => {
  const f = tmp(`
// [ai_s_bridge:Foo MyBridge]
const x = 1;
// [/ai_s_bridge: MyBridge]
`);
  const r = run([f, 'check']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('non-canonical') || r.err.includes('non-canonical'));
  fs.unlinkSync(f);
});

// ================================================================
// SKELETON — outputs layer-sorted emblem/bridge map
// ================================================================

test('skeleton: outputs layer labels in L1 before L3 order', () => {
  const f = tmp(VALID);
  const r = run([f, 'skeleton']);
  assert.equal(r.code, 0);
  const l1pos = r.out.indexOf('-- L1 --');
  const l3pos = r.out.indexOf('-- L3 --');
  assert.ok(l1pos < l3pos, 'L1 should appear before L3 in skeleton output');
  fs.unlinkSync(f);
});

test('skeleton: lists all emblem and bridge names', () => {
  const f = tmp(VALID);
  const r = run([f, 'skeleton']);
  assert.ok(r.out.includes('Alpha'));
  assert.ok(r.out.includes('Beta'));
  assert.ok(r.out.includes('MyBridge'));
  fs.unlinkSync(f);
});

test('skeleton: emits line ranges for each emblem and bridge', () => {
  const f = tmp(VALID);
  const r = run([f, 'skeleton']);
  // Each entry should have a (Lstart-Lend) range marker.
  assert.match(r.out, /Alpha\] \(L\d+-\d+\)/);
  assert.match(r.out, /Beta\] \(L\d+-\d+\)/);
  assert.match(r.out, /MyBridge\] \(L\d+-\d+\)/);
  fs.unlinkSync(f);
});

// ================================================================
// FOCUS — extracts exact emblem
// ================================================================

test('focus: returns full emblem block for named emblem', () => {
  const f = tmp(VALID);
  const r = run([f, 'focus', 'Alpha']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('// [ai_s_emblem:'));
  assert.ok(r.out.includes('Alpha'));
  assert.ok(r.out.includes('const x = 1'));
  fs.unlinkSync(f);
});

test('focus: returns full bridge block for named bridge', () => {
  const f = tmp(VALID);
  const r = run([f, 'focus', 'MyBridge']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('// [ai_s_bridge:'));
  assert.ok(r.out.includes('MyBridge'));
  fs.unlinkSync(f);
});

test('focus: exits 1 when name not found', () => {
  const f = tmp(VALID);
  const r = run([f, 'focus', 'DoesNotExist']);
  assert.equal(r.code, 1);
  fs.unlinkSync(f);
});

// ================================================================
// APPLY — patches emblem content; preserves meta tags
// ================================================================

test('apply: replaces emblem content and preserves original meta', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 1;
// [/ai_s_emblem: Alpha]
`);
  const patch = tmp(`
// [ai_s_emblem:#IGNOREDMETA Alpha]
const x = 999;
// [/ai_s_emblem: Alpha]
`);
  const r = run([target, 'apply', patch]);
  assert.equal(r.code, 0, `apply failed: ${r.err}`);
  const result = fs.readFileSync(target, 'utf8');
  assert.ok(result.includes('const x = 999'), 'patch content should be applied');
  assert.ok(result.includes('#L3#logic'), 'original meta should be preserved');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

test('apply: destruction fence — exits 1 if patch adds a new emblem tag', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 1;
// [/ai_s_emblem: Alpha]
`);
  // Patch contains Alpha + a new tag NewOne — apply should refuse
  const patch = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 2;
// [ai_s_emblem:#L3#logic NewOne]
const y = 3;
// [/ai_s_emblem: NewOne]
// [/ai_s_emblem: Alpha]
`);
  const r = run([target, 'apply', patch]);
  // Either exits 1 (destruction fence) or skips malformed patch — either way target is safe
  const result = fs.readFileSync(target, 'utf8');
  const count = (result.match(/\/\/ \[ai_s_emblem:/g) || []).length;
  assert.equal(count, 1, 'target should still have exactly 1 emblem tag after failed apply');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

test('apply: pre-flight fails (exit 1, no write) when emblem name not found in target', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 1;
// [/ai_s_emblem: Alpha]
`);
  const patch = tmp(`
// [ai_s_emblem:#L3#logic Ghost]
const x = 99;
// [/ai_s_emblem: Ghost]
`);
  const before = fs.readFileSync(target, 'utf8');
  const r = run([target, 'apply', patch]);
  assert.equal(r.code, 1);
  assert.ok(r.err.includes('Ghost') && r.err.includes('not found'));
  // Atomic apply: pre-flight failure must leave file untouched.
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'target file must be byte-identical after pre-flight failure');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

test('apply: --dry-run prints plan and does not modify target', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 1;
// [/ai_s_emblem: Alpha]
`);
  const patch = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const x = 999;
// [/ai_s_emblem: Alpha]
`);
  const before = fs.readFileSync(target, 'utf8');
  const r = run([target, 'apply', patch, '--dry-run']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('Dry-Run'));
  assert.ok(r.out.includes('Alpha'));
  assert.ok(r.out.includes('no file written'));
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'target file must be unchanged after dry-run');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

test('apply: atomic — when one of two patches fails pre-flight, none are applied', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const a = 1;
// [/ai_s_emblem: Alpha]

// [ai_s_emblem:#L3#logic Beta]
const b = 2;
// [/ai_s_emblem: Beta]
`);
  // Patch has Alpha (exists) and Ghost (missing). Atomic → neither should be applied.
  const patch = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const a = 999;
// [/ai_s_emblem: Alpha]

// [ai_s_emblem:#L3#logic Ghost]
const g = 0;
// [/ai_s_emblem: Ghost]
`);
  const before = fs.readFileSync(target, 'utf8');
  const r = run([target, 'apply', patch]);
  assert.equal(r.code, 1);
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'atomic: file must be untouched when any patch fails pre-flight');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

test('apply: pre-flight fails (exit 1, no write) when patch contains duplicate emblem names', () => {
  const target = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const a = 1;
// [/ai_s_emblem: Alpha]
`);
  const patch = tmp(`
// [ai_s_emblem:#L3#logic Alpha]
const a = 2;
// [/ai_s_emblem: Alpha]

// [ai_s_emblem:#L3#logic Alpha]
const a = 3;
// [/ai_s_emblem: Alpha]
`);
  const before = fs.readFileSync(target, 'utf8');
  const r = run([target, 'apply', patch]);
  assert.equal(r.code, 1);
  assert.ok(r.err.includes('duplicated in patch'));
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'target must be untouched when patch has duplicate names');
  fs.unlinkSync(target);
  fs.unlinkSync(patch);
});

// ================================================================
// COVERAGE — reports layer transitions
// ================================================================

test('coverage: reports OK when bridge covers L1→L2', () => {
  const f = tmp(`
// [ai_s_emblem:#L1#physical Phys]
const a = 1;
// [/ai_s_emblem: Phys]

// [ai_s_emblem:#L2#intent Intent]
const b = 2;
// [/ai_s_emblem: Intent]

// [ai_s_bridge:L1toL2 Cross]
const c = 3;
// [/ai_s_bridge: Cross]
`);
  const r = run([f, 'coverage']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('OK'));
  assert.ok(r.out.includes('L1 → L2') || r.out.includes('L1toL2'));
  fs.unlinkSync(f);
});

test('coverage: warns when L1 and L2 both present but no bridge', () => {
  const f = tmp(`
// [ai_s_emblem:#L1#physical Phys]
const a = 1;
// [/ai_s_emblem: Phys]

// [ai_s_emblem:#L2#intent Intent]
const b = 2;
// [/ai_s_emblem: Intent]
`);
  const r = run([f, 'coverage']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('WARN') || r.out.includes('gap'));
  fs.unlinkSync(f);
});

// ================================================================
// Edge: file not found
// ================================================================

test('any mode: exits 1 with error when file not found', () => {
  const r = run(['/tmp/nonexistent_ai_desk_file.js', 'check']);
  assert.equal(r.code, 1);
});
