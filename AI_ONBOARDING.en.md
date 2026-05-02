# ai-desk — AI Work Guide

## Preface

ai-desk is a **mechanism for running AI under the conceptual framework called *ai-desk***, so that anyone can develop software using AI. This is an architecture — a separate concept from the software engineering of the pre-AI era. Debate framed in pre-AI terms is not invited from the outset. ai-desk is a **thought-construct that solves the problem of AI being constrained by human software engineering and failing to perform at its true capability**.

**The intended audience of this documentation is LLM/AI only, not human engineers.**
Human-era "readability" (abstraction, modularization, encapsulation) hides information from AI. This repo optimizes for the opposite: exposed, explicit, and integrated complexity. If a human finds it hard to read, that is by design, not a defect.

Every AI working in this repo should read this file first.
Design rules, tool usage, and forbidden patterns are all collected here.

---

## What this repo is

A research repository for AI-Native software methodology.
Runnable demos, a CLI tool, tests, and philosophy docs are all in one place.

Core idea: **Human-era "good design" (DRY, abstraction) strips information from AI.**
This repo proves the opposite — principles for AI to write code without getting lost and without producing bugs.

---

## Critical Rules

### 1. Heavy Functions (no shared helpers)
Do not share helpers between functions. Logic is inlined inside each function.
Redundant-looking code is intentional — it is far safer than hidden shared dependencies.

### 2. Constraint Folding (enumerate all worlds instead of if/else)
```js
function myLogic(constraints = {}) {
  const allWorlds = [];
  for (const a of AXIS_A) {
    for (const b of AXIS_B) {
      allWorlds.push({ a, b, result: derive(a, b) });
    }
  }
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true, _message: '...' };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
```
Minimal proof: `constraint-janken.js` (150 lines). Read it when in doubt.

### 3. REAL / SHADOW (state purity)
- `REAL_xxx` is the single writable truth
- Derived values (shadows) are generated at the point of use and never stored in a variable

```js
// OK: throwaway
renderHpBar(REAL_state.hp / 100);

// NG: shadow stored in variable → stale when REAL changes next frame
const shadow_hp = REAL_state.hp / 100;
```

---

## Starting a New Implementation (Scaffolding)

When creating a new app or feature from scratch, start by copying the `template/` directory.

```bash
cp -r template my-new-app   # copy the template
cd my-new-app               # move to the directory
node ../ai-eyes.js          # start ai-eyes to view in browser (localhost:3000/my-new-app/)
```

`template/app.js` provides a minimal 4-layer structure (Physical, Intent, Logic, Draw). The basic workflow is to add your logic while maintaining this architectural integrity.

---

## Tool Usage

### ai-desk (code editing workflow)

```bash
node ai-desk.js <file> skeleton          # 1. understand structure (layer-sorted)
node ai-desk.js <file> focus <Name>      # 2. local read of the target Emblem
node ai-desk.js <file> check             # 3. tag consistency + vocabulary check
node ai-desk.js <file> coverage          # 4. bridge coverage report
node ai-desk.js <file> apply patch.js    # 5. apply patch (with destruction fence)
```

When making changes, write to a patch.js and apply it — safer than editing directly.
`apply` enforces **Tag Immutability**, validating that the emblem count and tag structure are unchanged, and cancels automatically if destruction is detected.

### ai-eyes + eyes-e2e (observation / debugging)

```bash
node ai-eyes.js                          # start server (localhost:3000)
node eyes-e2e.js "debug goal"            # compress current state to one text blob
```

`ai-eyes` serves a **Dynamic client.js** (`localhost:3000/client.js`). Including this in your HTML enables remote control and observation by AI.
Furthermore, the **/structure** endpoint allows sending internal structures (3D coordinates, physics data) for logic validation without a browser (**Structural Projection**).

### run.js (Orchestrator Pattern)

For complex validation or automated debugging, create and use a `run.js` (**Orchestrator**) that unifies server startup, browser interaction, and validation script execution. This allows AI to complete the entire process with a single command.


---

## 4-Layer Architecture

```
L1 Physical  →  L2 Intent  →  L3 Logic  →  L4 Draw
(DOM/IO)        (cmd convert)  (pure reducer)  (render)
```

- Data flows one-way, top to bottom
- Functions that cross layers get a `[ai_s_bridge:L3toL4 Name]` tag
- **L3 Logic is pure functions only** (no DOM, no random, no Date, no side effects)

---

## Emblem Tag Syntax

```js
// [ai_s_emblem:#high#logic FunctionName]
function FunctionName() { ... }
// [/ai_s_emblem: FunctionName]

// [ai_s_bridge:L3toL4 BridgeName]
function BridgeName() { ... }
// [/ai_s_bridge: BridgeName]
```

Valid tags: `#high #mid #low` × `#L1 #L2 #L3 #L4 #physical #intent #logic #draw #verify #OutOfLayers #config`

---

## Tests

```bash
node --test actions/tests/fighter-cancel.test.js   # 19/19 PASS (1920 worlds)
node --test 3dplus/tests/projection.test.js         # 77/77 PASS
node eyes-e2e.js --test                             # 22/22 PASS
```

---

## Deep Reading

| File | Content |
|------|---------|
| `constraint-janken.js` | Minimal proof of constraint folding (start here) |
| `AI_NATIVE_MASTER_BIBLE.md` | Full design canon — all six pillars |
| `AI_UNDERSTANDING_MANIFESTO.md` | AI cognition properties (±300-line spotlight, etc.) |
| `PROMPT_constraint_folding.md` | Constraint folding decision criteria and measurement evidence |

---

## Autonomous Refactoring

Refactoring in this repo is **not DRY-ification, abstraction, or shared extraction**.
Those are the directions this repo explicitly forbids.

If you find any of the following patterns while reading code, fix them without waiting to be asked.

### Patterns to fix

| Found | Correct form |
|---|---|
| Function or block with no Emblem tag | Wrap with `[ai_s_emblem:#layer Name]` |
| Unknown tag warning from `check` (e.g. `#logc`) | Fix to the correct tag |
| Layer-crossing function without a Bridge tag | Add `[ai_s_bridge:LxtoLy Name]` |
| Deep nested if/else state logic | Rewrite as constraint folding (enumerate all worlds) |
| Shared helper called from multiple Emblems | Inline into each call site |
| Derived value stored in a variable (`const shadow_x = ...`) | Generate it at the point of use instead |
| DOM manipulation or side effects inside L3 Logic | Move side effects to L4 or a Bridge |

### Before fixing

- Run `node ai-desk.js <file> check` and make sure you do not break the tag structure
- If tests exist, confirm they pass after the fix
- Fix only what you found. Do not touch unrelated code

### After fixing

Tell the human in one sentence: what you found and how you fixed it.

---

## After reading this file

Tell the human operator: "I have read the guide and understood the AI-Native design rules (Constraint Folding, 4-Layer Architecture, and tool usage)."

**NOTE:**
Tools like `skeleton` for structure overview, `focus` for local reads, and `ai-eyes` for debugging are **for YOU (the AI) to use autonomously**. Do not present them as a menu to the human.

Instead, ask the human for their goal using plain, everyday language:

- "Shall we build something new from scratch?"
- "Would you like to add new features or change existing ones?"
- "Are there any issues or broken parts we need to fix?"
- "Should I play through the app in slow motion to check for any glitches?"

Once the human gives a directive, use `ai-desk` and `ai-eyes` autonomously to complete the task.

---
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
