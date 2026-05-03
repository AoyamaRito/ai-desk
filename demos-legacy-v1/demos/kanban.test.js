// node --test demos/kanban.test.js
//
// Tests for the Kanban reducer (cards, columns, drag-drop result,
// undo, persistence shape) inside demos/kanban.html.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'kanban.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.reduce((longest, s) => s.length > longest.length ? s : longest, '');
assert.ok(engine.length > 1000, 'engine script not found');

function makeFakeEl() {
  const el = {
    addEventListener() {}, removeEventListener() {}, appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    children: [],
    set textContent(v) { this._text = v; }, get textContent() { return this._text || ''; },
    set value(v) { this._value = v; }, get value() { return this._value || ''; },
    set className(v) { this._cls = v; }, get className() { return this._cls || ''; },
    set innerHTML(v) { this._html = v; this.children = []; }, get innerHTML() { return this._html || ''; },
    insertBefore(c) { this.children.push(c); return c; },
    remove() {}, focus() {}, blur() {}, contentEditable: 'false', spellcheck: false,
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
  isNaN, parseFloat, parseInt, structuredClone,
  location: { search: '' },
  HTMLElement: class {}, prompt: () => null, confirm: () => true,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  engine + `
    ;this.REAL_state = REAL_state;
    this.dispatch = dispatch;
    this.uid = uid;
    this.seedColumns = seedColumns;
  `,
  sandbox,
);

const { REAL_state, dispatch, seedColumns } = sandbox;

function reset() {
  REAL_state.columns = seedColumns();
  REAL_state.history = [];
  REAL_state.drag = null;
}
function findCard(id) {
  for (const col of REAL_state.columns) for (const c of col.cards) if (c.id === id) return { col, card: c };
  return null;
}

// ===================================================================
// seed
// ===================================================================

test('seed: 3 columns with cards', () => {
  reset();
  assert.equal(REAL_state.columns.length, 3);
  assert.equal(REAL_state.columns[0].title, 'To Do');
  assert.equal(REAL_state.columns[1].title, 'Doing');
  assert.equal(REAL_state.columns[2].title, 'Done');
  assert.ok(REAL_state.columns[0].cards.length > 0);
});

// ===================================================================
// card commands
// ===================================================================

test('ADD_CARD: appends to specified column', () => {
  reset();
  const colId = REAL_state.columns[0].id;
  const before = REAL_state.columns[0].cards.length;
  dispatch({ type: 'ADD_CARD', colId, text: 'hello' });
  assert.equal(REAL_state.columns[0].cards.length, before + 1);
  assert.equal(REAL_state.columns[0].cards.at(-1).text, 'hello');
});

test('EDIT_CARD: changes text', () => {
  reset();
  const card = REAL_state.columns[0].cards[0];
  dispatch({ type: 'EDIT_CARD', cardId: card.id, text: 'updated' });
  assert.equal(findCard(card.id).card.text, 'updated');
});

test('DELETE_CARD: removes from its column', () => {
  reset();
  const card = REAL_state.columns[0].cards[0];
  const before = REAL_state.columns[0].cards.length;
  dispatch({ type: 'DELETE_CARD', cardId: card.id });
  assert.equal(REAL_state.columns[0].cards.length, before - 1);
  assert.equal(findCard(card.id), null);
});

test('MOVE_CARD: between columns at given index', () => {
  reset();
  const fromCard = REAL_state.columns[0].cards[0];
  const toCol = REAL_state.columns[2];
  const beforeTo = toCol.cards.length;
  dispatch({ type: 'MOVE_CARD', cardId: fromCard.id, toColId: toCol.id, toIdx: 0 });
  assert.equal(toCol.cards[0].id, fromCard.id);
  assert.equal(toCol.cards.length, beforeTo + 1);
  assert.equal(REAL_state.columns[0].cards.find(c => c.id === fromCard.id), undefined);
});

test('MOVE_CARD: within same column to a later index', () => {
  reset();
  const col = REAL_state.columns[0];
  const a = col.cards[0]; const b = col.cards[1];
  // move A to position 2 (after B)
  dispatch({ type: 'MOVE_CARD', cardId: a.id, toColId: col.id, toIdx: 2 });
  // splice semantics: A removed (col now has b, c), then inserted at idx 2 (end → b, c, a)
  assert.equal(col.cards.at(-1).id, a.id);
  assert.equal(col.cards[0].id, b.id);
});

test('MOVE_CARD: clamps idx to valid range', () => {
  reset();
  const card = REAL_state.columns[0].cards[0];
  const target = REAL_state.columns[1];
  dispatch({ type: 'MOVE_CARD', cardId: card.id, toColId: target.id, toIdx: 9999 });
  assert.equal(target.cards.at(-1).id, card.id);
});

// ===================================================================
// column commands
// ===================================================================

test('ADD_COLUMN: appends with title', () => {
  reset();
  dispatch({ type: 'ADD_COLUMN', title: 'Backlog' });
  assert.equal(REAL_state.columns.length, 4);
  assert.equal(REAL_state.columns.at(-1).title, 'Backlog');
});

test('RENAME_COLUMN: changes title only', () => {
  reset();
  const col = REAL_state.columns[0];
  const before = col.cards.length;
  dispatch({ type: 'RENAME_COLUMN', colId: col.id, title: 'Inbox' });
  assert.equal(REAL_state.columns[0].title, 'Inbox');
  assert.equal(REAL_state.columns[0].cards.length, before);
});

test('DELETE_COLUMN: removes whole column', () => {
  reset();
  const colId = REAL_state.columns[1].id;
  dispatch({ type: 'DELETE_COLUMN', colId });
  assert.equal(REAL_state.columns.length, 2);
  assert.equal(REAL_state.columns.find(c => c.id === colId), undefined);
});

test('MOVE_COLUMN: reorders', () => {
  reset();
  const lastId = REAL_state.columns.at(-1).id;
  dispatch({ type: 'MOVE_COLUMN', colId: lastId, toIdx: 0 });
  assert.equal(REAL_state.columns[0].id, lastId);
});

// ===================================================================
// undo
// ===================================================================

test('UNDO: reverts the last command', () => {
  reset();
  const colId = REAL_state.columns[0].id;
  const before = REAL_state.columns[0].cards.length;
  dispatch({ type: 'ADD_CARD', colId, text: 'X' });
  assert.equal(REAL_state.columns[0].cards.length, before + 1);
  dispatch({ type: 'UNDO' });
  assert.equal(REAL_state.columns[0].cards.length, before);
});

test('UNDO: chained reverts work', () => {
  reset();
  const colId = REAL_state.columns[0].id;
  const before = REAL_state.columns[0].cards.length;
  dispatch({ type: 'ADD_CARD', colId, text: 'A' });
  dispatch({ type: 'ADD_CARD', colId, text: 'B' });
  dispatch({ type: 'ADD_CARD', colId, text: 'C' });
  assert.equal(REAL_state.columns[0].cards.length, before + 3);
  dispatch({ type: 'UNDO' });
  dispatch({ type: 'UNDO' });
  dispatch({ type: 'UNDO' });
  assert.equal(REAL_state.columns[0].cards.length, before);
});

test('UNDO: no-op when history empty', () => {
  reset();
  REAL_state.history = []; // ensure empty
  const snap = JSON.stringify(REAL_state.columns);
  dispatch({ type: 'UNDO' });
  assert.equal(JSON.stringify(REAL_state.columns), snap);
});

// ===================================================================
// reset
// ===================================================================

test('RESET: re-seeds and clears history', () => {
  reset();
  dispatch({ type: 'ADD_CARD', colId: REAL_state.columns[0].id, text: 'extra' });
  dispatch({ type: 'RESET' });
  assert.equal(REAL_state.columns.length, 3);
  assert.equal(REAL_state.columns[0].title, 'To Do');
  assert.equal(REAL_state.history.length, 0);
});
