// node --test demos/vector-pad.test.js
//
// Tests for the Vector Pad reducer (shape add / move / resize /
// reorder / property edit / undo) inside demos/vector-pad.html.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'vector-pad.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.reduce((longest, s) => s.length > longest.length ? s : longest, '');
assert.ok(engine.length > 1000, 'engine script not found');

function makeFakeEl() {
  const el = {
    addEventListener() {}, removeEventListener() {}, appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    children: [],
    set textContent(v) { this._text = v; }, get textContent() { return this._text || ''; },
    set value(v) { this._value = v; }, get value() { return this._value || ''; },
    set className(v) { this._cls = v; }, get className() { return this._cls || ''; },
    set innerHTML(v) { this._html = v; this.children = []; }, get innerHTML() { return this._html || ''; },
    insertBefore(c) { this.children.push(c); return c; },
    remove() {}, focus() {}, blur() {}, contentEditable: 'false', spellcheck: false,
    getContext: () => ({
      setTransform() {}, fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {},
      moveTo() {}, lineTo() {}, ellipse() {}, rect() {}, stroke() {}, fill() {}, save() {}, restore() {},
      set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {},
      set lineCap(v) {}, set font(v) {}, setLineDash() {},
    }),
    set width(v) {}, set height(v) {}, toDataURL: () => 'data:,', click() {}, set href(v) {}, set download(v) {},
    onclick: null,
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
  ResizeObserver: class { observe() {} disconnect() {} },
  console, URLSearchParams, Math, Number, String, Boolean, Array, Object, JSON, Set, Map, Date,
  isNaN, parseFloat, parseInt, structuredClone,
  location: { search: '' },
  confirm: () => true,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  engine + `
    ;this.REAL_state = REAL_state;
    this.dispatch = dispatch;
    this.uid = uid;
    this.hitTest = hitTest;
    this.defaultProps = defaultProps;
  `,
  sandbox,
);

const { REAL_state, dispatch, hitTest, defaultProps } = sandbox;

function reset() {
  REAL_state.shapes = [];
  REAL_state.selected = null;
  REAL_state.tool = 'select';
  REAL_state.history = [];
  REAL_state.drag = null;
}
function add(type, x, y, w, h) {
  dispatch({ type: 'ADD_SHAPE', shape: { type, x, y, w, h } });
  return REAL_state.shapes.at(-1);
}

// ===================================================================
// add / select / delete
// ===================================================================

test('ADD_SHAPE: appends with default props and selects it', () => {
  reset();
  const s = add('rect', 10, 10, 50, 30);
  assert.equal(REAL_state.shapes.length, 1);
  assert.equal(s.type, 'rect');
  assert.equal(s.fill, '#a78bfa');   // default fill
  assert.equal(s.visible, true);
  assert.equal(REAL_state.selected, s.id);
});

test('SELECT: changes selection, no history pollution', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  const histBefore = REAL_state.history.length;
  dispatch({ type: 'SELECT', id: null });
  assert.equal(REAL_state.selected, null);
  assert.equal(REAL_state.history.length, histBefore); // SELECT must not push history
});

test('DELETE_SHAPE: removes and clears selection if it was selected', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  dispatch({ type: 'DELETE_SHAPE', id: a.id });
  assert.equal(REAL_state.shapes.length, 0);
  assert.equal(REAL_state.selected, null);
});

// ===================================================================
// move / resize / set_prop
// ===================================================================

test('MOVE_SHAPE: updates x,y only', () => {
  reset();
  const a = add('rect', 10, 10, 50, 30);
  dispatch({ type: 'MOVE_SHAPE', id: a.id, x: 100, y: 200 });
  assert.equal(a.x, 100); assert.equal(a.y, 200);
  assert.equal(a.w, 50);  assert.equal(a.h, 30);
});

test('RESIZE_SHAPE: updates all 4 dims', () => {
  reset();
  const a = add('rect', 0, 0, 50, 50);
  dispatch({ type: 'RESIZE_SHAPE', id: a.id, x: 5, y: 5, w: 80, h: 80 });
  assert.equal(a.x, 5); assert.equal(a.w, 80);
});

test('SET_PROP: arbitrary property mutation', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  dispatch({ type: 'SET_PROP', id: a.id, key: 'fill', value: '#ff0000' });
  assert.equal(a.fill, '#ff0000');
  dispatch({ type: 'SET_PROP', id: a.id, key: 'name', value: 'hero' });
  assert.equal(a.name, 'hero');
  dispatch({ type: 'SET_PROP', id: a.id, key: 'visible', value: false });
  assert.equal(a.visible, false);
});

// ===================================================================
// reorder / undo
// ===================================================================

test('REORDER: brings a shape to a new layer index', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  const b = add('rect', 0, 0, 10, 10);
  const c = add('rect', 0, 0, 10, 10);
  // c is on top (last in array). Move a to index 2 (top).
  dispatch({ type: 'REORDER', id: a.id, toIdx: 2 });
  assert.equal(REAL_state.shapes.at(-1).id, a.id);
});

test('UNDO: reverts the last mutation', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  dispatch({ type: 'SET_PROP', id: a.id, key: 'fill', value: '#000' });
  assert.equal(a.fill, '#000');
  dispatch({ type: 'UNDO' });
  // after undo, the shape should be back to default fill
  const s = REAL_state.shapes.find(x => x.id === a.id);
  assert.equal(s.fill, '#a78bfa');
});

test('UNDO: chained reverts work', () => {
  reset();
  add('rect', 0, 0, 10, 10);
  add('rect', 0, 0, 10, 10);
  add('rect', 0, 0, 10, 10);
  assert.equal(REAL_state.shapes.length, 3);
  dispatch({ type: 'UNDO' });
  dispatch({ type: 'UNDO' });
  dispatch({ type: 'UNDO' });
  assert.equal(REAL_state.shapes.length, 0);
});

test('UNDO: no-op when history is empty', () => {
  reset();
  const before = JSON.stringify(REAL_state.shapes);
  dispatch({ type: 'UNDO' });
  assert.equal(JSON.stringify(REAL_state.shapes), before);
});

// ===================================================================
// CLEAR
// ===================================================================

test('CLEAR: empties shapes and selection', () => {
  reset();
  add('rect', 0, 0, 10, 10);
  add('ellipse', 0, 0, 10, 10);
  dispatch({ type: 'CLEAR' });
  assert.equal(REAL_state.shapes.length, 0);
  assert.equal(REAL_state.selected, null);
});

// ===================================================================
// tool switching
// ===================================================================

test('SELECT_TOOL: changes tool, deselects when leaving select', () => {
  reset();
  const a = add('rect', 0, 0, 10, 10);
  assert.equal(REAL_state.selected, a.id);
  dispatch({ type: 'SELECT_TOOL', tool: 'rect' });
  assert.equal(REAL_state.tool, 'rect');
  assert.equal(REAL_state.selected, null);
});

// ===================================================================
// hit testing
// ===================================================================

test('hitTest: rect inside / outside', () => {
  reset();
  add('rect', 10, 10, 100, 50); // covers x: 10-110, y: 10-60
  assert.ok(hitTest(50, 30));  // inside
  assert.equal(hitTest(200, 200), null);  // outside
});

test('hitTest: ellipse inside / outside', () => {
  reset();
  add('ellipse', 0, 0, 100, 100); // ellipse centred (50,50), radius 50
  assert.ok(hitTest(50, 50));      // centre
  assert.ok(hitTest(50, 99));      // bottom edge inside
  assert.equal(hitTest(99, 99), null);  // corner — outside the ellipse
});

test('hitTest: line proximity', () => {
  reset();
  add('line', 0, 0, 100, 0); // horizontal line
  assert.ok(hitTest(50, 1));    // very near
  assert.equal(hitTest(50, 30), null);   // far
});

test('hitTest: top-most shape wins', () => {
  reset();
  const a = add('rect', 0, 0, 100, 100); // bottom layer
  const b = add('rect', 0, 0, 100, 100); // top layer (added later)
  assert.equal(hitTest(50, 50).id, b.id);
});

test('hitTest: skips hidden shapes', () => {
  reset();
  const a = add('rect', 0, 0, 100, 100);
  dispatch({ type: 'SET_PROP', id: a.id, key: 'visible', value: false });
  assert.equal(hitTest(50, 50), null);
});
