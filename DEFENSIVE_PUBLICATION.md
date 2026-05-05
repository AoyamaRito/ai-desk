# Defensive Publication: AI-Native Coding Substrate

Publication date: 2026-05-06  
Author: Hiroyuki Okii / AoyamaRito  
Repository: https://github.com/AoyamaRito/ai-desk  
License of the repository: MIT

This document is a public defensive disclosure. Its purpose is to place the
technical ideas below into the public record as prior art, so that they remain
available for public use and are harder for others to monopolize by later
patent claims.

This document is not legal advice. It is an enabling technical disclosure of
the mechanisms implemented in this repository.

## Summary

ai-desk discloses an AI-native software development substrate in which ordinary
JavaScript files are simultaneously:

- executable source code,
- AI-readable documentation,
- a parseable graph of edit units,
- a function-level versioned database,
- a source for dependency-aware prompt assembly, and
- a target for automatic redistribution of AI edits.

The central objective is to reduce the inference burden on large language
models by placing the information they need directly in the token stream they
read: value domains, dependency context, version history, and observation
results are made explicit and machine-readable.

## Disclosed Techniques

### 1. Domain-Tagged Values / LLM-First Typing

Runtime values that persist in state, events, references, observations, or
inter-block communication are represented as self-describing literal strings:

```js
const position = "world:5,0,2";
const pointer = "screen:300,200";
const price = "usd:9.99";
const instant = "time:1778000000000";
const user = "user:42";
```

The prefix is the domain, type, unit, or coordinate space. Scratch arithmetic
may use raw numbers inside a local function, but values are settled back into a
tagged literal before crossing a boundary or being stored as real state.

Example implementation:

```js
export const w = (...v) => `world:${v.join(",")}`;

export function parseTaggedValue(str) {
  const i = str.indexOf(":");
  if (i < 0) throw new Error("missing domain prefix");
  return { domain: str.slice(0, i), values: str.slice(i + 1).split(",") };
}

export function requireDomain(str, expected) {
  const parsed = parseTaggedValue(str);
  if (parsed.domain !== expected) throw new Error("domain mismatch");
  return parsed.values.map(Number);
}
```

This is "LLM-first typing": the type is placed where the LLM sees it, in the
value itself, instead of relying on variable names, comments, schemas, or
out-of-context type declarations.

### 2. JavaScript-as-Document and JavaScript-as-Block Substrate

JavaScript files are used as canonical documentation and implementation because
valid JavaScript syntax can be parsed into semantic edit units without a custom
DSL:

- a file becomes a module block,
- `function` declarations become function blocks,
- `class` declarations become class blocks,
- `import` declarations become dependency references,
- same-module function calls become call references,
- nearby comments such as `// @tags: logic, pure` become tags.

Example parser behavior:

```js
function parseJS(source, moduleId) {
  const moduleBlock = { id: moduleId, type: "module", refs: [] };
  const functionBlocks = [];
  // Extract functions/classes/imports and build refs.
  // Store each extracted unit as a Block with versions.
  return [moduleBlock, ...functionBlocks];
}
```

The same file can therefore be executed by Node or a browser, read by humans,
injected into an LLM prompt, and converted into a block graph for AI editing.

### 3. Block.versions: Function-Level Version Management Without Git

Each semantic unit is represented as a block. A block's real body is its
append-only `versions` array:

```js
const block = {
  id: "app.js:fn:dispatch",
  type: "function",
  versions: [
    {
      timestamp: 1778000000000,
      prevHash: null,
      hash: "hash:v0",
      content: "function dispatch(state, event) { ... }",
      refs: [{ kind: "calls", target: "app.js:fn:reduce" }],
      children: [],
      tags: ["function", "logic"],
      meta: {}
    }
  ]
};
```

The latest content, tags, references, and children are derived from the head
version. Rollback is not destructive: restoring an older version appends a new
version that copies the older content and records rollback metadata.

This enables function-level history, blame, diff, rollback, and tamper-evident
sequential hashing without requiring Git. Git may still be used as repository
storage, but the AI editing workbench has its own semantic version model.

### 4. Refs as an Explicit Dependency Map

Blocks store references such as:

```js
{ kind: "calls", target: "app.js:fn:renderSlide" }
{ kind: "import", target: "./logic.js" }
{ kind: "contains", target: "app.js:fn:dispatch" }
```

The graph can answer forward dependencies, reverse dependencies, transitive
impact, orphan detection, and cycle checks. This gives an LLM a dependency map
without requiring it to rediscover all relationships from raw source text.

### 5. Virtual Heavy Function and Virtual Apply

Physical storage remains split into blocks, but an LLM can be shown a temporary
"virtual heavy function" that combines a root block and its dependency closure
into one editable text.

Expansion format:

```js
// === Virtual Heavy Function rooted at app.js:fn:render ===
// 3 blocks combined into one logical heavy function
// Edit the bodies; do not change the boundary headers.

// --- BLOCK: app.js:fn:render (function) ---
function render(state) {
  return format(getState(state));
}

// --- BLOCK: app.js:fn:format (function) ---
function format(value) {
  return String(value);
}

// --- BLOCK: app.js:fn:getState (function) ---
function getState(state) {
  return state.value;
}

// === end of virtual heavy ===
```

The LLM edits this as if it were one large function with all relevant context
visible. The system then parses the boundary headers and redistributes each
edited segment back to its original block, appending new versions only where
content changed.

This combines the benefits of large-context editing and small-unit versioning:
the LLM sees one coherent context, while the system stores and tracks separate
semantic blocks.

### 6. Observation Witnesses / AI-Eyes

Programs can expose pure state-machine functions:

```js
export function initialState() { return {...}; }
export function dispatch(state, event) { return nextState; }
export function render(ctx, state, dims) { ... }
export const events = [{ type: "click", payload: {...} }];
```

A virtual canvas records drawing operations as structured data instead of
pixels. This creates an observation witness that can be inspected by tools or
LLMs:

```js
{ op: "fillRect", args: [10, 20, 100, 40] }
{ op: "fillText", args: ["score: 10", 8, 16] }
```

The system can detect anomalies such as empty drawing logs, frozen state,
non-finite numeric values, or drawing entirely outside the canvas. Visual
failures are converted into structured facts that can be routed back to code.

### 7. Constraint Folding: Observation to Law to Execution

Conditional behavior is represented as data tables and pure reducers. The same
execution substrate can be filled manually or inferred from observations.

Example:

```js
const RULES = [
  { weightMax: 1, zone: "kanto", base: 300, perKg: 0 },
  { weightMax: 5, zone: "kanto", base: 500, perKg: 100 }
];

function resolveShipping(weight, zone) {
  const rule = RULES.find(r => r.zone === zone && weight <= r.weightMax);
  return rule ? rule.base + weight * rule.perKg : null;
}
```

Given input/output observations, an LLM or search process can infer candidate
tables, run them through the same reducer, and keep only candidates consistent
with observed behavior. The inferred table is already executable; no separate
"translate the rule into code" step is required.

### 8. AI-Native Development Loop

The disclosed workflow combines the mechanisms above:

1. The user declares intent.
2. The AI writes or edits JavaScript.
3. JavaScript is parsed into blocks and references.
4. Related blocks are expanded into a virtual heavy function when needed.
5. AI edits are redistributed back into block versions.
6. Domain-tagged values reduce type and coordinate confusion.
7. Observation witnesses and tests verify behavior.
8. Human review focuses on intent and acceptance, not line-by-line reading.

## Concrete Implementations in This Repository

Representative files:

- `v2/ai-desk-core.js`: Block, Graph, parseJS, version chains, refs, virtual heavy functions, virtual apply, constraint and observation blocks.
- `v2/ai-desk.js`: CLI shell for save/load/heavy/virtual-apply/context/lint/export.
- `v2/AiRunAndRead_BIBLE.js`: canonical JavaScript doctrine containing domain-tagged value rules and related axioms.
- `v2/3d-prefab/coord.js`: domain-tagged coordinate helpers.
- `v2/3d-prefab/prefabs.js`: pure prefab state transitions using tagged values.
- `demos-legacy-v1/presentations/*.html`: explanatory decks for scaling, block graphs, virtual heavy functions, and constraint folding.

## Scope of Disclosure

This disclosure covers the individual techniques above and combinations of
them, including but not limited to:

- storing type/domain information inside runtime literal values for LLM use,
- parsing ordinary JavaScript into AI-editable semantic blocks,
- maintaining append-only per-block version chains with sequential hashes,
- using refs to build AI-editable dependency maps,
- expanding a dependency closure into one editable LLM prompt and then
  redistributing edits back to original blocks,
- using structured observation logs as verification witnesses,
- inferring executable rule tables from observations,
- using JavaScript as the shared medium for documentation, execution, graph
  extraction, prompt material, and versioned AI editing.

The repository is intentionally MIT licensed to permit broad public use.
