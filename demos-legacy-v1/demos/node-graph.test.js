// node --test demos/node-graph.test.js
//
// Tests for the DAG evaluator + reducer inside demos/node-graph.html.
// Same vm-sandbox strategy as spreadsheet.test.js: extract the inline
// <script>, eval in a stub DOM context, re-export needed bindings,
// then assert against the engine.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'node-graph.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.reduce((longest, s) => s.length > longest.length ? s : longest, '');
assert.ok(engine.length > 1000, 'engine script not found');

function makeFakeEl() {
  const el = {
    addEventListener() {}, removeEventListener() {}, appendChild() { return el; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getContext: () => ({
      setTransform() {}, fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {},
      moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {}, fill() {}, arc() {},
      set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set font(v) {},
      set textBaseline(v) {}, set textAlign(v) {},
    }),
    set width(v) {}, set height(v) {}, set className(v) {},
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
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout: () => 0, clearTimeout: () => {},
  addEventListener() {}, removeEventListener() {},
  ResizeObserver: class { observe() {} disconnect() {} },
  console, URLSearchParams, Math, Number, String, Boolean, Array, Object, JSON, Set, Map, Date,
  isNaN, parseFloat, parseInt,
  location: { search: '' },
  getComputedStyle: () => ({ getPropertyValue: () => '#ffffff' }),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  engine + `
    ;this.REAL_state = REAL_state;
    this.TYPES = TYPES;
    this.evaluate = evaluate;
    this.dispatch = dispatch;
    this.uid = uid;
  `,
  sandbox,
);

const { REAL_state, TYPES, evaluate, dispatch, uid } = sandbox;
assert.ok(typeof evaluate === 'function');
assert.ok(typeof dispatch === 'function');

function clear() {
  for (const id of Object.keys(REAL_state.nodes)) delete REAL_state.nodes[id];
  REAL_state.wires.length = 0;
  REAL_state.selected = null;
  REAL_state.drag = null;
}
function addNode(type, v) {
  const id = uid();
  REAL_state.nodes[id] = { id, type, x: 0, y: 0, v };
  return id;
}
function wire(from, fromOut, to, toIn) { REAL_state.wires.push({ from, fromOut, to, toIn }); }
function val(id, idx = 0) { return evaluate().valueOf(id, idx, new Set()); }

// ===================================================================
// types are wired correctly
// ===================================================================

test('TYPES: every type defined with fn / inputs / outputs / color', () => {
  for (const k of ['const', 'add', 'sub', 'mul', 'div', 'out']) {
    assert.ok(TYPES[k], k + ' missing');
    assert.equal(typeof TYPES[k].fn, 'function');
    assert.equal(typeof TYPES[k].inputs, 'number');
    assert.equal(typeof TYPES[k].outputs, 'number');
    assert.equal(typeof TYPES[k].color, 'string');
  }
});

// ===================================================================
// arithmetic
// ===================================================================

test('eval: lone const node returns its value', () => {
  clear();
  const c = addNode('const', 7);
  assert.equal(val(c), 7);
});

test('eval: add of two consts', () => {
  clear();
  const a = addNode('const', 3);
  const b = addNode('const', 4);
  const x = addNode('add');
  wire(a, 0, x, 0); wire(b, 0, x, 1);
  assert.equal(val(x), 7);
});

test('eval: sub / mul / div', () => {
  clear();
  const a = addNode('const', 10);
  const b = addNode('const', 3);
  const sub = addNode('sub'); wire(a, 0, sub, 0); wire(b, 0, sub, 1);
  const mul = addNode('mul'); wire(a, 0, mul, 0); wire(b, 0, mul, 1);
  const div = addNode('div'); wire(a, 0, div, 0); wire(b, 0, div, 1);
  assert.equal(val(sub), 7);
  assert.equal(val(mul), 30);
  assert.equal(Math.round(val(div) * 100) / 100, 3.33);
});

test('eval: divide by zero → NaN (no throw)', () => {
  clear();
  const a = addNode('const', 5);
  const b = addNode('const', 0);
  const d = addNode('div'); wire(a, 0, d, 0); wire(b, 0, d, 1);
  assert.ok(Number.isNaN(val(d)));
});

test('eval: chain (3 + 4) * 2 = 14 through Output', () => {
  clear();
  const c1 = addNode('const', 3);
  const c2 = addNode('const', 4);
  const c3 = addNode('const', 2);
  const a  = addNode('add'); wire(c1, 0, a, 0); wire(c2, 0, a, 1);
  const m  = addNode('mul'); wire(a, 0, m, 0);  wire(c3, 0, m, 1);
  const o  = addNode('out'); wire(m, 0, o, 0);
  assert.equal(val(o), 14);
});

test('eval: missing input defaults to 0', () => {
  clear();
  const c = addNode('const', 5);
  const x = addNode('add'); wire(c, 0, x, 0); // x.toIn=1 unwired
  assert.equal(val(x), 5);
});

// ===================================================================
// cycle detection
// ===================================================================

test('eval: 2-node cycle → NaN', () => {
  clear();
  const a = addNode('add');
  const b = addNode('add');
  wire(a, 0, b, 0); wire(b, 0, a, 0);
  assert.ok(Number.isNaN(val(a)));
});

test('eval: self-loop → NaN', () => {
  clear();
  const a = addNode('add');
  wire(a, 0, a, 0);
  assert.ok(Number.isNaN(val(a)));
});

// ===================================================================
// reducer commands
// ===================================================================

test('dispatch: ADD_NODE adds and selects', () => {
  clear();
  dispatch({ type: 'ADD_NODE', kind: 'const', x: 0, y: 0 });
  const ids = Object.keys(REAL_state.nodes);
  assert.equal(ids.length, 1);
  assert.equal(REAL_state.nodes[ids[0]].type, 'const');
  assert.equal(REAL_state.selected.kind, 'node');
  assert.equal(REAL_state.selected.id, ids[0]);
});

test('dispatch: ADD_WIRE replaces an existing wire into the same input', () => {
  clear();
  const c1 = addNode('const', 1);
  const c2 = addNode('const', 2);
  const x  = addNode('add');
  dispatch({ type: 'ADD_WIRE', from: c1, fromOut: 0, to: x, toIn: 0 });
  dispatch({ type: 'ADD_WIRE', from: c2, fromOut: 0, to: x, toIn: 0 });
  // only one wire into x.toIn=0; it must come from c2
  const ws = REAL_state.wires.filter(w => w.to === x && w.toIn === 0);
  assert.equal(ws.length, 1);
  assert.equal(ws[0].from, c2);
});

test('dispatch: REMOVE_NODE also removes attached wires', () => {
  clear();
  const a = addNode('const', 1);
  const b = addNode('const', 2);
  const x = addNode('add');
  dispatch({ type: 'ADD_WIRE', from: a, fromOut: 0, to: x, toIn: 0 });
  dispatch({ type: 'ADD_WIRE', from: b, fromOut: 0, to: x, toIn: 1 });
  dispatch({ type: 'REMOVE_NODE', id: x });
  assert.equal(REAL_state.nodes[x], undefined);
  assert.equal(REAL_state.wires.length, 0);
});

test('dispatch: EDIT_CONST changes the value', () => {
  clear();
  const c = addNode('const', 1);
  dispatch({ type: 'EDIT_CONST', id: c, v: 99 });
  assert.equal(REAL_state.nodes[c].v, 99);
  assert.equal(val(c), 99);
});

test('dispatch: MOVE_NODE updates position', () => {
  clear();
  const c = addNode('const', 1);
  dispatch({ type: 'MOVE_NODE', id: c, x: 100, y: 200 });
  assert.equal(REAL_state.nodes[c].x, 100);
  assert.equal(REAL_state.nodes[c].y, 200);
});

test('dispatch: PAN accumulates', () => {
  clear();
  REAL_state.pan = { x: 0, y: 0 };
  dispatch({ type: 'PAN', dx: 5, dy: 7 });
  dispatch({ type: 'PAN', dx: 2, dy: 3 });
  assert.equal(REAL_state.pan.x, 7);
  assert.equal(REAL_state.pan.y, 10);
});

test('eval: changing a Const value live re-flows through downstream', () => {
  clear();
  const c = addNode('const', 10);
  const o = addNode('out'); wire(c, 0, o, 0);
  assert.equal(val(o), 10);
  dispatch({ type: 'EDIT_CONST', id: c, v: 42 });
  assert.equal(val(o), 42);
});
