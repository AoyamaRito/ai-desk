// node --test demos/spreadsheet.test.js
//
// Tests for the formula engine inside demos/spreadsheet.html.
//
// Strategy: read the .html file, slice the inline <script> body, and
// evaluate it inside a stub sandbox (with document/localStorage/window
// shimmed enough that the DOM-bound code at the bottom no-ops without
// throwing). The pure parser/evaluator functions are then captured via
// eval-context globals and asserted against.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// --- load the spreadsheet engine into a sandboxed VM ---
const html = fs.readFileSync(path.join(__dirname, 'spreadsheet.html'), 'utf8');

// pull every <script> body except the embed-mode initialiser (the long one is the engine)
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.reduce((longest, s) => s.length > longest.length ? s : longest, '');
assert.ok(engine.length > 1000, 'engine script not found in spreadsheet.html');

// stub DOM. Anything the engine touches at top level needs a no-throw answer.
function makeFakeEl() {
  const el = {
    addEventListener() {}, appendChild() { return el; }, removeChild() {},
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, style: {}, children: [], childNodes: [], firstChild: null, parentElement: null,
    focus() {}, blur() {}, scrollIntoView() {}, setSelectionRange() {}, select() {}, remove() {},
    insertBefore() {}, cloneNode() { return makeFakeEl(); },
    set textContent(v) { this._text = v; }, get textContent() { return this._text || ''; },
    set value(v) { this._value = v; }, get value() { return this._value || ''; },
    set className(v) { this._className = v; }, get className() { return this._className || ''; },
    set innerHTML(v) { this._innerHTML = v; }, get innerHTML() { return this._innerHTML || ''; },
  };
  return el;
}
const fakeDoc = {
  createElement: () => makeFakeEl(),
  getElementById: () => makeFakeEl(),
  querySelector: () => makeFakeEl(),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: makeFakeEl(),
  activeElement: null,
  documentElement: { classList: { add() {}, remove() {} }, lang: 'ja' },
};

const sandbox = {
  document: fakeDoc,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  setTimeout: () => 0, clearTimeout: () => {},
  addEventListener() {}, removeEventListener() {},
  console, URLSearchParams, Math, Number, String, Boolean, Array, Object, JSON, Set, Map, Date,
  isNaN, parseFloat, parseInt,
  location: { search: '' },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
// after running the engine, manually re-export the const-bindings we need.
// (VM context exposes function-decl globals automatically but not const/let.)
vm.runInContext(
  engine + `
    ;this.REAL_state = REAL_state;
    this.tokenize = tokenize;
    this.parseFormula = parseFormula;
    this.evalAst = evalAst;
    this.callFunc = callFunc;
    this.computeCell = computeCell;
  `,
  sandbox,
);

// engine globals we expect:
const { tokenize, parseFormula, evalAst, callFunc, computeCell, REAL_state } = sandbox;
// cross-realm equality helper: use JSON stringify to bypass Array prototype mismatch.
const eqJSON = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
assert.ok(typeof tokenize === 'function', 'tokenize not found');
assert.ok(typeof parseFormula === 'function', 'parseFormula not found');
assert.ok(typeof evalAst === 'function', 'evalAst not found');
assert.ok(typeof callFunc === 'function', 'callFunc not found');
assert.ok(typeof computeCell === 'function', 'computeCell not found');

// helper: evaluate a formula against a small named-cell map
function run(formula, cells = {}) {
  REAL_state.raw = cells;
  REAL_state.computed = {};
  const ast = parseFormula(formula);
  return evalAst(ast, (a) => {
    const r = REAL_state.raw[a] ?? '';
    const c = computeCell(a, r, 0, new Set());
    if (c.error) throw new Error(c.error);
    return c.value;
  });
}

// ===================================================================
// Tokenizer
// ===================================================================

test('tokenize: numbers and operators', () => {
  const t = tokenize('1 + 2 * 3');
  eqJSON(t.map(x => x.v), [1, '+', 2, '*', 3]);
});

test('tokenize: cell refs and ranges', () => {
  const t = tokenize('A1 + B2 * SUM(A1:A10)');
  assert.equal(t[0].t, 'ref'); assert.equal(t[0].v, 'A1');
  assert.equal(t[2].t, 'ref'); assert.equal(t[2].v, 'B2');
  assert.equal(t[4].t, 'id');  assert.equal(t[4].v, 'SUM');
  assert.equal(t[6].v, 'A1');
  assert.equal(t[7].v, ':');
  assert.equal(t[8].v, 'A10');
});

test('tokenize: strings and multi-char ops', () => {
  const t = tokenize('"hello" >= 5 <> 3');
  assert.equal(t[0].t, 'str'); assert.equal(t[0].v, 'hello');
  assert.equal(t[1].v, '>=');
  assert.equal(t[3].v, '!=');
});

// ===================================================================
// Arithmetic / precedence
// ===================================================================

test('eval: basic arithmetic with precedence', () => {
  assert.equal(run('1 + 2 * 3'),       7);
  assert.equal(run('(1 + 2) * 3'),     9);
  assert.equal(run('10 / 2 - 1'),      4);
  assert.equal(run('2 ^ 3'),           8);
  assert.equal(run('2 ^ 3 ^ 2'),       512); // right-assoc
});

test('eval: unary minus / plus', () => {
  assert.equal(run('-5 + 3'),    -2);
  assert.equal(run('-(2 + 3)'),  -5);
  assert.equal(run('+7'),        7);
});

test('eval: comparison ops return 0/1', () => {
  assert.equal(run('5 > 3'),      1);
  assert.equal(run('5 < 3'),      0);
  assert.equal(run('5 = 5'),      1);
  assert.equal(run('5 <> 5'),     0);
  assert.equal(run('5 >= 5'),     1);
});

test('eval: string concat with &', () => {
  assert.equal(run('"foo" & "bar"'),       'foobar');
  assert.equal(run('"x=" & (1 + 2)'),      'x=3');
});

// ===================================================================
// Cell refs
// ===================================================================

test('eval: simple cell reference', () => {
  assert.equal(run('A1 + B1', { A1: '10', B1: '20' }), 30);
});

test('eval: chained reference', () => {
  assert.equal(run('A1 * 2', { A1: '=B1+C1', B1: '5', C1: '7' }), 24);
});

test('eval: range expanded into SUM', () => {
  assert.equal(run('SUM(A1:A4)', { A1: '1', A2: '2', A3: '3', A4: '4' }), 10);
});

test('eval: empty cell is 0', () => {
  assert.equal(run('A1 + 5', {}), 5);
});

// ===================================================================
// Built-in functions
// ===================================================================

test('eval: SUM / AVERAGE / MIN / MAX / COUNT', () => {
  const cells = { A1: '10', A2: '20', A3: '30', A4: '40' };
  assert.equal(run('SUM(A1:A4)',     cells), 100);
  assert.equal(run('AVERAGE(A1:A4)', cells), 25);
  assert.equal(run('AVG(A1:A4)',     cells), 25);
  assert.equal(run('MIN(A1:A4)',     cells), 10);
  assert.equal(run('MAX(A1:A4)',     cells), 40);
  assert.equal(run('COUNT(A1:A4)',   cells), 4);
});

test('eval: IF', () => {
  assert.equal(run('IF(1, "yes", "no")'),         'yes');
  assert.equal(run('IF(0, "yes", "no")'),         'no');
  assert.equal(run('IF(A1>5, A1*2, A1)', { A1: '10' }), 20);
  assert.equal(run('IF(A1>5, A1*2, A1)', { A1: '3'  }), 3);
});

test('eval: ABS / ROUND / LEN / CONCAT', () => {
  assert.equal(run('ABS(-7)'),                 7);
  assert.equal(run('ROUND(3.14159, 2)'),       3.14);
  assert.equal(run('ROUND(2.5)'),              3);
  assert.equal(run('LEN("hello")'),            5);
  assert.equal(run('CONCAT("a", "b", "c")'),  'abc');
});

test('eval: nested function calls', () => {
  assert.equal(run('SUM(A1:A3) + AVG(B1:B3)',
    { A1: '1', A2: '2', A3: '3', B1: '4', B2: '5', B3: '6' }
  ), 6 + 5);
});

// ===================================================================
// Error / cycle / depth
// ===================================================================

test('compute: cycle detection', () => {
  REAL_state.raw = { A1: '=A1' };
  REAL_state.computed = {};
  const c = computeCell('A1', '=A1', 0, new Set());
  assert.equal(c.error, '#CYCLE!');
});

test('compute: 2-cell cycle', () => {
  REAL_state.raw = { A1: '=B1', B1: '=A1' };
  REAL_state.computed = {};
  const c = computeCell('A1', '=B1', 0, new Set());
  assert.equal(c.error, '#CYCLE!');
});

test('compute: division by zero is Infinity (not error)', () => {
  // intentional: spreadsheets typically return #DIV/0!, but this MVP just yields Infinity
  REAL_state.raw = {};
  const c = computeCell('A1', '=1/0', 0, new Set());
  assert.equal(c.value, Infinity);
});

test('compute: unknown function → #ERR!', () => {
  // Current impl normalises any non-#-prefixed throw to '#ERR!'.
  // (Future improvement: surface as #NAME? like Excel does.)
  REAL_state.raw = {};
  const c = computeCell('A1', '=NOPE(1,2)', 0, new Set());
  assert.equal(c.error, '#ERR!');
});

test('compute: plain string passthrough', () => {
  const c = computeCell('A1', 'hello', 0, new Set());
  assert.equal(c.value, 'hello'); assert.equal(c.error, null);
});

test('compute: numeric string parsed as number', () => {
  const c = computeCell('A1', '42', 0, new Set());
  assert.equal(c.value, 42);
});

test('compute: empty raw → empty value, no error', () => {
  const c = computeCell('A1', '', 0, new Set());
  assert.equal(c.value, ''); assert.equal(c.error, null);
});
