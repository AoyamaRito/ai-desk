# AI-Native Development Master Bible (Unified V3.5 Final)

The single source of truth for human–AI co-creation: how to eliminate bugs and secure permanent maintainability.

> English translation of `AI_NATIVE_MASTER_BIBLE.md`. The Japanese version is canonical; if any divergence occurs, the Japanese wording wins.

---

## 0.0 Cognitive Asymmetry

Complexity is the human's problem, not the AI's.
Hiding is the AI's problem, not the human's.
Most developers misunderstand this. "Good design" for humans (abstraction, splitting, encapsulation) is "hiding" for AI: it strips information away. Correct AI-facing design — even when it offends human aesthetics — appears as **expanded, explicit, integrated complexity**.
Every principle in this Bible is derived from this asymmetry.
(Note: code that ignores this principle becomes liability in the AI era.)

## 0.1 Locality Maximization and "Heavy Functions"

In AI-facing code, locality is the highest-priority design principle. Splitting files scatters information physically; splitting functions scatters it logically. Both force the AI to pay reference / search / inference costs (cognitive jumps). Therefore, observe the following "Heavy Functions" principles strictly:

1. **Self-Contained Logic**:
   Don't fear function length. The data transformations, branches, and side-effect triggers (Bridge calls) needed for a feature should all be inlined into one scope (function) wherever possible. Maintain the property that the AI can read just that one function and understand everything.
2. **No-Shared Helpers**:
   Creating "small common helper functions" called from multiple features is forbidden in principle. When similar processing is needed, copy the code without hesitation and let it evolve independently inside each feature. Duplication is not the evil. Hidden dependencies (their invisible blast radius) are.
3. **Emblem as Boundary**:
   Instead of subdividing into small functions, build large meaning-bearing functions per feature and partition their internal steps with `ai-desk` Emblem tags. This lets the AI update locally without losing context.
4. **Inline > Extract**:
   The human-style refactoring of "extracting a function" to make code look shorter is harmful. Instead, **inline** the small functions back into their callers and re-integrate the lost context.

## 0.15 Condition Folding

Prefer designs where complex conditional logic (nested if/else, switch chains) is **folded into a pure function** that returns the result in one shot. By holding complexity as a "data structure" in bulk, we maximize the **cognitive grounding** for the AI.

1. **Eliminate the branch tree**:
   Instead of evaluating conditions sequentially as branches, hold them in bulk as a **data structure** and derive results by filtering and mapping. Branches are cognitive splits for AI and produce path combinatorial explosions.
2. **Generate all possible worlds, narrow by constraint**:
   The correct approach is "keep only the worlds that match the constraints." The constraint library (see `constraint-janken`) generates 27 possible worlds, filters by constraint, and returns the surviving structure. Zero `if` statements.
3. **Reverse traversal becomes possible**:
   Conditions folded into a pure function support input→output as well as output→input reverse lookup. This is structurally impossible with branch trees (branches are one-way).
4. **Synergy with the mining paradigm**:
   When extracting laws from data, AI folds them into a single-path pure function (threshold → base value → transform), not into branches. This makes the synthesized code easy to verify (it can be passed to a constraint validator in one shot).

## 0.2 Core Principles
- **AI Drives All (AI-only codebase)**: humans only declare intent; writing, structuring, naming, attaching metadata are all done by the AI. This document prioritizes "the AI doesn't lose context and doesn't ship bugs."
- **Zero-Dependency / Zero-Server**: external libraries and black-box servers are excluded; inference transparency stays at 100%.
- **Physical Separation**: HTML (structure), CSS (presentation), JS (logic) are physically separated to keep coupling loose. This means "no language-level mixing" (no large `<style>`/`<script>` blocks inside HTML; no building CSS by string concatenation in JS). Per-element `style="..."` attributes do not violate this and are actively encouraged per §0.21.

## 0.21 Inline-CSS Acceptance (Inline Style Locality)

What §0.2 "Physical Separation" forbids is the language-level mixing of "writing large `<style>`/`<script>` blocks inside HTML" and "constructing CSS as JS strings." Per-element `style="..."` attributes are **not** in that category — instead, they prioritize §0.1 (locality maximization) and §0.1.2 (no sharing) and are **actively allowed and recommended**.

### Where each kind of style belongs
| Kind | Placement | Reason |
|---|---|---|
| Element-specific style (position, color, size, padding) | inline `style=""` | §0.1 locality. Reading the element alone reveals it. |
| Design tokens (color/size CSS variables) | CSS file `:root` | Bulk theme change. Inline still references via `var()`. |
| `:hover` / `:focus` / `:active` / `:disabled` | CSS file | Cannot be written inline (technical limit). |
| `::before` / `::after` and other pseudo-elements | CSS file | Same. |
| `@media` (responsive, print) | CSS file | Same. |
| `@keyframes` animations | CSS file | Same. |

### Benefits from the AI-edit standpoint
- The look is graspable from the element alone (fits in the §0.0 "±300-line spotlight").
- The cost of "is this class used anywhere else?" disappears.
- Deleting the element auto-deletes the corresponding style (no orphan CSS).
- Doesn't conflict with `ai-desk` Emblem boundaries; everything closes inside the focused range.
- "Why is *this* element red?" is one-glance obvious (it's right in the attribute).

### CSS class sharing forbidden
§0.1.2 "no sharing" applies to CSS too. When multiple elements need similar styles, do **not** create a common class — duplicate it into each element's inline style. Hidden dependencies (one class change cascading to unintended elements) are evil, just like shared helper functions.

Exception: structural classes that **only carry layout meaning** like `.row` or `.cta-stacked` (no color/font in them, just `display: flex; gap: 1rem;`) are acceptable.

### Recommended CSS file size
Following these principles, a project's `style.css` typically stays at 50–100 lines:
- `:root` CSS variables (color, size, line-height)
- Body base typography
- Pseudo-classes for major elements (`button:hover`, `input:focus` etc.)
- Print and motion `@media`
- Minimum required `@keyframes`

A `style.css` greatly exceeding this is a sign element-specific styles have leaked in — consider refactoring back to inline.

## 0.3 Canvas 2D UI Pattern (§Canvas UI)

Four-layer rules for building game UI on Canvas (rather than DOM). Minimal proof: `canvas-ui-sample.js`.

### Layer assignment

| Element | Layer | Reason |
|---|---|---|
| Mouse coordinates / hit-test | **L2 Intent** | Convert coords to Command JSON inside L2; never pass coords to L3 |
| Screen transitions (title/playing/pause/gameover) | **L3 Logic (constraint folding)** | Finite discrete states → declare all transitions as data, zero if/else |
| HP / score etc. | **L3 Logic (applyCommand)** | Pure reducer; same input → same output |
| Drawing buttons / gauges / text | **L4 Draw** | Reads `REAL_state` and writes to Canvas; never mutates state |

### REAL_state shape
```js
const REAL_state = {
  screen: 'title',          // 'title' | 'playing' | 'pause' | 'gameover'
  score: 0,
  hp: 100,
  ui: { hoveredId: null },  // hover state lives in the UI layer only
};
```

### Buttons are data
Declare button coords / label / owning screen as objects. Drawing and hit-testing both reference this data (it's data sharing, not helper sharing).

```js
const BUTTONS = {
  title_start: { x: 220, y: 260, w: 200, h: 50, label: 'START', screen: 'title' },
  // ...
};
```

### Screen transitions are constraint folding
```js
const SCREEN_TRANSITIONS = [
  { from: 'title',   input: 'start',  to: 'playing' },
  { from: 'playing', input: 'pause',  to: 'pause'   },
  { from: 'playing', input: 'die',    to: 'gameover'},
  // ...
];
// zero if/else. Invalid transitions get rejected via _contradiction.
function reduceScreen(constraints = {}) { ... }
```

### Handling shadow (Canvas version)
Derived values that show up in Canvas drawing (ratios, computed coordinates) are shadow. Don't store them in variables.

```js
// OK: compute on the spot at draw time
ctx.fillRect(20, 52, 200 * (state.hp / 100), 18);

// NG: stored — next frame REAL_state may have changed but this stays stale
const hpRatio = state.hp / 100;
```

### Shared-helper ban (Draw functions)
`drawTitle` / `drawPlaying` / `drawPause` / `drawGameover` do not share helpers. Even if button-drawing code looks similar, inline it inside each function.

## 1. The ai-desk Co-Working Protocol (§Emblem Management)

As compensation for forbidding physical file splits, we operate "virtual cognitive boundaries" via the `ai-desk` tool and `Emblem` tags.

### Extract & Inject
The AI manipulates large files in three steps.
1. **Structure overview (`skeleton`)**: `node ai-desk.js <file> skeleton` to read the table of contents. Auto-sorted by layer / tag (#logic, #verify, etc.).
2. **Local read (`focus`)**: `node ai-desk.js <file> focus <Name>` to read only that section.
3. **Partial apply (`apply`)**: produce a patch file containing only the changed section, then `node ai-desk.js <file> apply <patch>` to safely "inject" it. Tag-structure invariance (Tag Immutability) is automatically verified.

### Emblem definition
JS files must use the following tags to delimit sections (feature units):
```javascript
// [EMBLEM:#<importance>#<category> Name]
// ... code ...
// [/EMBLEM: Name]
```
(Note: in real source the tag is `ai_s_emblem`. This document uses `EMBLEM` as a placeholder so `ai-desk check` doesn't conflict on the doc itself. `Bridge` likewise has the real name `ai_s_bridge`.)

## 1.5 Forced AI-Eyes Observation Infrastructure (§AI-Eyes Protocol)

Drop the passive posture of "waiting for human reports from an unseen environment." To reliably crush bugs, every product must include observation infrastructure via `ai-eyes.js`.

1. **Mandatory connection**:
   Every project's HTML must embed the `ai-eyes` client script (`<script src="http://localhost:3000/client.js"></script>`) or implement an equivalent snapshot-send / command-listen loop.
2. **Forced observability**:
   Right after important state transitions or when catching errors, send the current DOM state or Canvas frame to the `ai-eyes` `/snapshot` endpoint.
3. **Structural observation**:
   For 3D / physics, send logical structural data (JSON) to `/structure` to detect coordinate-system mismatches. The AI debugs by cross-checking against a Twin like `cpu3d.js`.
4. **Recording**:
   For continuous-behavior bugs (jitter, interpolation errors), the AI autonomously calls `/record/start` and `/record/stop` and records a series of frames as an HTML slideshow for analysis.
5. **Step-by-step hooks for slow-motion debugging**:
   For features with complex algorithms or physics (e.g., maze, collision), intentionally leave a public interface (e.g. `window.step_xxx`) the AI can step through. The AI calls these via `curl /input` to track state changes in slow motion.
6. **Keyless observation transducer (eyes-e2e)**:
   In the AI debug loop (Observe → Think → Act), don't tightly couple LLM API keys into the loop script. Instead, use a single-purpose transducer like `eyes-e2e.js` that "converts the latest state to minimal-token text and prints to stdout." The CLI agent interprets this output in its own context and injects the next action via `curl` (Unix-philosophy loose coupling).

## 2. The 4-Layer Vanilla Architecture (§Information Ring)

All information flows one-way through these four layers.

1. **L1: Physical**: DOM access, event registration, external API (localStorage etc.) access.
   - **Forbidden**: do not write `REAL_state` directly here.
2. **L2: Intent**: convert raw events into Command JSON. Regardless of the input source (UI / replay / AI control), this is the **only** entry point to L3.
   - **Async and side-effects**: heavy async (network, external API) lives in L2; the result (success / failure) is passed to L3 as a Command.
   - Example: a drag operation's three L1 events are folded by L2 into a logical command like `DragCommit`.
3. **L3: Logic**: functions as a `(REAL_state, Command) => newState` reducer that updates state purely.
   - **Event Sourcing**: append received Commands to the event log array and compute the hash chain.
   - **Side-effect triggers**: after state update, explicitly call `bridgeLogic2Draw()`, `bridgeLogic2Persistent()`, `bridgeLogic2Network()` etc. to propagate side effects to the outside.
4. **L4: Draw**: targeted DOM updates (sniper update) from `REAL_state`.
   - **Rule**: don't carelessly overwrite the element matching `document.activeElement` (e.g., a focused text area).

## 3. REAL / SHADOW (§State Purity)

Eliminates "missed-sync" bugs physically.
- **REAL_<name>**: the single mutable truth.
- **shadow(REAL, purpose)**: a disposable derived value built from REAL. **"No retention (no variable storage)."** Generate on use, throw away after use.
- **One-way conversion**: only REAL → SHADOW is allowed.

```js
// REAL_state: only L3 mutates it
const REAL_state = { hp: 100, x: 0 };

// L4: build per draw, immediately discard (never store)
renderHpBar(REAL_state.hp / 100);          // ← shadow (disposable)
renderSprite(REAL_state.x * PIXEL_SCALE);  // ← shadow (disposable)
```

## 4. 3Dplus Spacetime Coordinate System (§Causal Projection)

A dimension-independent framework for projecting state through parent-child relationships.
- **Pure one-way conversion**: never mix "local" and "world" coordinates.
- **Level-based projection**: forbid recursion. Resolve world state in a loop from depth 0 (parent) downward.
- **Projected elements**: not just position and rotation — time (t), alpha, visibility are all projected as "coordinates."

## 4.5 Twin (§Verification Twin)

Any layer may have a **Twin (verification twin)**. A Twin takes the same input as the layer and is a pure-function verification implementation that returns JSON. The implementation unit of double-entry math (§7) is this Twin.

1. **Orthogonal concept**:
   Twin is orthogonal to layer (L1–L4). It is not a new layer; it's a property attached to a layer. Where `L1`–`L4` defines the direction of data flow, Twin defines the pairing of "performance implementation" and "verification implementation."
2. **Notation**:
   Write as `L<n>*` or `<name>_twin`. Examples: `L4*`, `render_twin()`, `cpu3d.js (L4 twin)`.
3. **Common contract**:
   - Takes the **same input JSON** as the source layer (no double definition).
   - Is a **pure function** (no DOM / GPU / I/O / random / time).
   - Returns **stage-by-stage JSON** so divergence point can be located.
   - A standalone **diff function** (`assert_xxx`) exists.
4. **Typical Twins**:
   - **L4\* (Draw twin)**: transparent CPU-side arithmetic running alongside GPU/Canvas drawing (`3dplus/cpu3d.js`).
   - **L3\* (Logic twin)**: re-verifies physics-engine / complex-reducer results in another implementation.
   - L1 / L2 Twins are rare (DOM / Intent are usually thin enough not to need them).
5. **Twin vs SHADOW** (avoid confusing with §3):
   - SHADOW: the **display / interaction-purpose derived value** from REAL. The result of a one-way conversion.
   - Twin: a **verification implementation** running alongside the original layer. It exists to be diff-ed.
   They are different concepts. Don't mix `SHADOW_xxx` with `xxx_twin`.

## 5. Persistence and Cryptography (§Persistence & Cryptography)

Principles for guaranteeing data trustworthiness and history locally, without depending on a server DB.
- **JSON + Event Sourcing**: avoid overwriting state. Append the history of state-changing **events (Commands)** to a JSON array. The current state is determined by replaying (reducing) all events from the initial state.
- **Sequential Hashing**: each event computes its own hash including the previous event's hash (a blockchain-like serial structure). Tampering or dropouts in history are detected mathematically.
- **Dumb Relay & HTTP/3**: the server is a logic-less pipe (relay). Use HTTP/3 (WebTransport, etc.) to transport data as low-latency streams. Hash integrity of received JSON events is **always verified at the edge (L3: Logic)**.
- **Attestation Over Auth**: abolish centralized login authentication; use public-key signature verification as the basis of authority.
- **Eternal Compatibility**: follow web standards only; maintain code that still runs unchanged ten years later.

## 6. FAQ & Operational Guide (§Operational Rules)

### Q: Should I always prefer `ai-desk apply` when editing?
**A: Always.**
To preserve Emblem-based "cognitive boundaries" and guarantee patch consistency. It's the standard way for AI to safely sniper-update large files without destroying its own context.

### Q: What is the essence of Bridge?
**A: A "barrier (membrane)" that separates layers.**
It's not just a function call — the constraint that "only data passing through this membrane can affect other layers" is what matters. The physical existence of this membrane interrupts side-effect chains and dramatically simplifies debugging.

### Q: How should files without Emblems be handled?
**A: Add them aggressively during edits.**
In AI-Native development, Emblem is the "map." When stepping into unmapped territory (code), drawing the boundaries first so subsequent AI sessions don't get lost is the expectation.

### Q: When should the constraint library be used?
**A: It is in the experimental stage.**
We are currently determining the balance between implementation cost and expressive power. In situations needing complex relationship organization, consider local introduction first.

## 7. AI-Specific Double-Entry Math (§Double-Entry Verification)

For external systems that are easily black-boxed (GPU/WebGL, physics engines, external APIs), the AI must verify with the following "double-entry math." The implementation unit is the **Twin** of §4.5.

1. **Execution layer**:
   For ordinary development, prioritize ease of writing and execution efficiency. Use existing libraries and GPU features. "Hiding" here is acceptable in exchange for execution speed.
2. **Verification layer = Twin (§4.5)**:
   At "places where bugs are suspected" or "logically central pieces," run a "transparent heavy function (raw, pure arithmetic written out fully)" alongside as the Twin.
3. **Proof by numbers**:
   Don't trust the black box's output. Compare the pure mathematical coordinates (JSON) computed by the Twin against actual behavior. If a mathematically-correct coordinate points off-screen, the AI can confidently declare "this is a logic bug, not a rendering bug."

The separation of "efficient execution" and "transparent re-verification" is the final answer to AI debugging in complex 3D / physics systems.

### 7.1 Naming convention (Pair Naming)

```
Execution layer:   xxx()             // any implementation (GPU / physics engine / Three.js etc.)
Twin:              xxx_twin(input)   // pure function. takes JSON, returns JSON
Diff:              assert_xxx(e, t)  // throws / returns contradiction. Zero-Dep
```

For module-level pairing (3dplus style):
```
effective:  render.js, physics.js
twin:       render.twin.js, cpu3d.js (= L4 twin), physics.twin.js
```

### 7.2 Input contract (forced identity)

Execution layer and Twin must take the **same input JSON**. Double definition is a violation (writing the same math twice defeats the purpose).

### 7.3 Output contract (stage-by-stage JSON)

```js
xxx_twin(input) → {
  stages: { stage1: ..., stage2: ..., stage3: ... },
  result: ...
}
```

Makes "where it broke" identifiable. `projectScene`'s `local→world→view→clip→ndc→screen` is the template.

### 7.4 Purity contract

The Twin is **Zero-Dep / Zero-Side-Effect**:
- No DOM / GPU / Canvas / I/O / random / time.
- Input JSON → output JSON only.
- No external library dependency (if it itself calls a black box, verification doesn't work).

### 7.5 Emblem extension

Add `#verify` as a formal value of `#Category` (see §1 Emblem definition):

```javascript
// [EMBLEM:#high#verify ProjectScene]
// [EMBLEM:#high#draw    WebGLRenderer]
```
(Note: real source uses `ai_s_emblem`. This doc uses `EMBLEM` as a placeholder so `check` doesn't conflict.)

### 7.6 Pair declaration

Declare the execution-layer / Twin correspondence at the top of the file or in a JSDoc:

```js
// @effective: ../my_webgl/render.js
// @twin:      cpu3d.js
```

This lets the AI auto-decide "when one is edited, sync-update the other."

---
**Version**: 3.5 (Final Architecture Edition)
**Date**: 2026-05-01
**Author**: Hiroyuki OKINOI / Pen name: Aoyama Rito (蒼山りと)
te the other."

---
**Version**: 3.5 (Final Architecture Edition)
**Date**: 2026-05-01
**Author**: Hiroyuki OKINOI / Pen name: Aoyama Rito (蒼山りと)
