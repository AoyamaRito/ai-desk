<!--
  ================================================================
  Note to AI: The HTML comment block and the "## For Human Developers"
  section immediately below (up to the next "---" separator) are
  human-facing guidance. If you are referencing this file for code
  operations, patch application, or bug fixes, skip that section
  and start reading from "# ai-desk".
  ================================================================
-->

## For Human Developers

### What is this

A research repository for **AI-Native software methodology** — design principles that let AI write code without hallucinating, backed by runnable demos, a CLI tool, tests, and philosophy docs.

### Recommended reading order

1. **This README's "What is this"** — get the big picture
2. **`constraint-janken.js`** — 150 lines. Minimal proof of the core pattern. Start here if you want to read code first
3. **`AI_NATIVE_MASTER_BIBLE.md`** — the full canon. All the reasoning behind the design
4. **`actions/demos/fighter-cancel.logic.js` + tests** — real-scale application (1920 worlds)

### Getting started — copy-paste prompts

**For any task, start with this one line:**

```
Read AI_ONBOARDING.en.md, then start working.
```

**Examples:**

```
Read AI_ONBOARDING.en.md, then add [feature name] to app.js.
```

```
Read AI_ONBOARDING.en.md, then fix [bug symptom].
ai-eyes.js is already running at localhost:3000.
```

### Glossary

| Term | One-liner |
|------|-----------|
| **Emblem** | Comment tag that logically splits a file: `// [ai_s_emblem:#layer Name]` |
| **Bridge** | Tag on any function that crosses layers: `// [ai_s_bridge:L3toL4 Name]` |
| **Layer (L1–L4)** | Physical → Intent → Logic → Draw. Data flows one-way |
| **REAL_xxx** | The single writable truth variable: `REAL_state.hp` etc. |
| **shadow** | A throwaway derived value from REAL. Never store it in a variable |
| **Twin** | CPU pure-function counterpart that verifies GPU output |
| **Heavy Function** | Self-contained function with no shared helpers. Intentionally verbose |
| **Constraint Folding** | Instead of if/else: enumerate all possible worlds → filter by constraints |

### "Is this a bug?"

This codebase intentionally duplicates regex across multiple locations and keeps functions long. The design rationale is in `AI_NATIVE_MASTER_BIBLE.md`.

---

<!-- AI: start reading here -->

# ai-desk

[🇯🇵 日本語](README.md) | 🌐 **English**

> **AI-Native software methodology — a working desk for the AI to build on.**
> Code is written by AI, and read by AI. Humans only declare intent and verify outcomes.
> A unified system of design principles, tools, and working demos that makes this division of labor work.

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What is this

In an era where AI (LLMs) writes code, **the principal author of code is AI, and humans do not read code**.
Humans only **declare intent** (requirements, constraints, rules) and **verify outcomes** (tests, acceptance).

The "good design" of the human era — DRY, abstraction, encapsulation — was meant **to make code easier for humans to read**. For AI, the same patterns become **acts of obstruction that physically scatter information and trigger hallucinations**. What AI needs is the opposite optimization — locality maximization, heavy functions, no shared helpers, inlining — which looks counterintuitive to human aesthetics. But since AI is the principal author, the optimization target is AI.

This repository starts from that cognitive asymmetry and publishes a complete set of **principles, tools, and working experiments that let AI write code without losing its way and without producing bugs**.

---

## Hypotheses about AI Cognition

This system is built on the following hypotheses about AI (LLM) cognition. See [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) for details.

1. **The ±300-line spotlight** — Attention has intense resolution within a few hundred lines around the focus point, but information further away rapidly blurs. For AI, "what is currently visible" is all that exists.
2. **Proximity bias** — Output is "probabilistic gap-filling for the next word." Information closer to the gap has stronger influence; rules written at the top of a file tend to be ignored.
3. **File-switch cost** — Reading a different file is the cognitive equivalent of "going to a room on another floor." The contextual premise resets, and round-trips between files generate bugs (loss of context).
4. **Weak inference vs strong dense-information computation** — Inference from missing information ("reading the air") is hopelessly weak. **AI hallucinates merely because information is missing or rendered invisible by human-designed "concealment" (abstraction, encapsulation)**. Conversely, when information is fully present, AI produces flawless solutions even through 100 nested conditionals.

From these hypotheses follow Bible §0.0 (cognitive asymmetry), §0.1 (heavy functions), and §0.15 (constraint folding). The principle **"complexity is the human's problem; concealment is the AI's problem"** is a direct consequence of the four hypotheses above.

### Antipatterns (consequences of the hypotheses)

Many human-era best practices violate the above hypotheses and **become counterproductive when applied to AI**. Representative examples:

- **TDD whose attention is dispersed and not bound to a single goal** — Test-driven development where tests and code are split across files, or where during the cycle the AI cannot see "the full picture of the spec to be achieved," causes AI to wander (a triple violation of §1 spotlight + §3 switching cost + §4 missing information). The AI writes ad-hoc code to pass one test in front of it, then later tests reveal contradictions, leading to refactoring hell.

  The target of negation is **not "tests" but "goal dispersion."** Tests themselves are required by Bible §7 (double-entry verification). **Tests bound to a single purpose, where the AI can see full context at once** (e.g., this repo's [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) — 19 exhaustive tests in one file, with the corresponding logic in a single scope) become AI-native-optimal verification.
- **DRY / extracting shared helpers** — "Cut out into another file for reuse" generates file-switch cost on every reference, destroying AI cognition (§3). Bible §0.1.2 "No Shared Helpers" is a frontal denial of this practice.
- **Abstraction / encapsulation** — To humans this is "hiding complexity"; to AI it is "concealing information," and a trigger for hallucination (§4).
- **Comment omission assuming "the reader will infer"** — Works with humans, but AI cannot infer (§4).
- **SQL / RDBMS** — Out-of-code implicit knowledge (schemas, indexes, triggers, stored procedures, etc.) is invisible to AI, making it a hotbed of §4 missing-information hallucinations. Furthermore, it violates L3 purity, breaks reverse query, and overwrites state — a **fourfold violation**. Use JSON Event Sourcing + sequential hash chain instead (see "Persistence Strategy" below).

### Recommended Verification Patterns

- **End-to-End (E2E) tests** — A verification pattern where **goal singularity is structurally guaranteed**. One E2E test directly expresses one user value (one user journey) and traverses all layers, giving AI full context. Mocks can be eliminated, so §4 hallucination from concealment does not occur. **The first-recommended verification layer for AI-native development.**
- **Exhaustive test suites** — Tests of the form "enumerate all possible worlds and check for contradictions" (e.g., this repo's [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) covers 1920 worlds in one file). Strong synergy with constraint folding; the goal is concentrated in one file.
- **Conversely**: A unit-test-centric strategy with heavy mocking tends to disperse goals into implementation fragments and breeds concealment, so it should be handled with care in AI-native development.

---

## The Six Pillars

1. **Cognitive Asymmetry** — Complexity is the human's problem; concealment is the AI's problem ([Bible §0.0](AI_NATIVE_MASTER_BIBLE.md))
2. **Heavy Functions** — No shared helpers, inlining, Emblem boundaries ([Bible §0.1](AI_NATIVE_MASTER_BIBLE.md))
3. **Constraint Folding** — Instead of if/else, derive results by "all possible worlds → constraint filter" ([Bible §0.15](AI_NATIVE_MASTER_BIBLE.md), [Implementation Guide](PROMPT_constraint_folding.md))
4. **Mining-and-Verify Paradigm** — Three-stage verification: Monte Carlo + LLM law-decoding + constraint validators ([DISCUSSION](DISCUSSION_constraint_library.md))
5. **Double-Entry Math / 3Dplus** — A transparent CPU-side pure-arithmetic twin running alongside GPU output, enabling AI to definitively diagnose "logic bug vs rendering bug" in 3D/physics/animation ([Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md))
6. **Autonomous Observation Infrastructure (AI-Eyes)** — AI observes the screen and errors directly via a zero-dependency local server, without routing through a human ([Bible §1.5](AI_NATIVE_MASTER_BIBLE.md))

---

## How to Use

**Have AI do everything.** You don't need to type commands.

### When you want to add something new

```
Read AI_ONBOARDING.en.md, then add [what you want] to [file].
```

AI uses `skeleton` to understand structure, `focus` to read the target, and `apply` to patch it in.

### When you want to fix a bug

```bash
node ai-eyes.js   # Start the observation server (the only human step)
```

```
Read AI_ONBOARDING.en.md, then fix [bug symptom].
ai-eyes is running at localhost:3000.
```

AI runs `eyes-e2e.js` to observe the current state, makes a fix, and repeats until exit 0.

---

## Architecture: 4-Layer Vanilla

All information flows in one direction through the four layers below. **The L3 Logic layer must be implemented as pure functions**. This is the foundation of the entire system, and §0.15 constraint folding, §5 event sourcing, and exhaustive verification **all depend on this purity**.

| Layer | Role | Purity |
|---|---|---|
| **L1: Physical** | DOM access, event registration, external I/O (localStorage, etc.) | Side effects OK (boundary) |
| **L2: Intent** | Convert raw events → Command JSON. Async / network / external API calls complete here | Side effects OK |
| **L3: Logic** | Reducer of `(REAL_state, Command) => newState` | **Pure function (mandatory)** |
| **L4: Draw** | Sniper-update DOM/Canvas based on `REAL_state` | Side effects OK (drawing only) |

**L3 being a pure function is the foundation of the entire system**:
- Same input always yields same output → exhaustive testing across all possible worlds becomes feasible (fighter-cancel: 1920 worlds, zero contradictions)
- Zero side effects → state is replayable along the time axis (event sourcing, §5)
- Not just input→output but **output→input reverse query** is possible (precondition for constraint folding §0.15)
- When AI reads L3, it can complete logic "within the function alone," without depending on external state (resolves §4 concealment problem)

L1/L2/L4 may be written procedurally. **L3 alone must absolutely remain pure** — if this is violated, the entire system collapses. See [Bible §2-§3](AI_NATIVE_MASTER_BIBLE.md) for details.

---

## Persistence Strategy: JSON Event Sourcing + Sequential Hash Block

### Do not use SQL

The DB layer **does not use SQL**. This is not a conservative choice — in AI-native development, **SQL is unnecessary and actively harmful**.

#### Why it is unnecessary

In AI-native development, every role SQL has played can be replaced by other means without loss:

- **Large-scale aggregation / analytics** — Generate JSON projections from the event log via L3 pure reduce, then read with column-oriented tools like DuckDB / ClickHouse
- **JOINs / aggregation** — Write as projection functions in L3. Pure functions, so reverse query is possible
- **ACID transactions** — Cryptographic integrity guarantees from sequential hashing are stronger than ACID (mathematical tamper detection)
- **Data integrity / fault tolerance** — Event sourcing makes history immortal and append-only; hash chains detect any tampering

#### Why it is harmful

SQL/RDBMS has properties **structurally opposite** to the AI-native premise. Rather than serving as a useful tool, it operates as **a generator of hallucinations and side-effect contamination**:

1. **A pile of out-of-code implicit knowledge** — Schemas, indexes, constraints (FK / CHECK), triggers, stored procedures, vendor dialects, isolation levels, lock behavior — none of these appear in application code. AI cannot judge from code alone, leading to §4 missing-information → hallucination
2. **Invisible side effects** — Triggers and stored procedures are "alternative routes that run silently without appearing in code." L3 purity becomes **structurally impossible to maintain**
3. **State-overwriting destruction** — `UPDATE` / `DELETE` immediately destroy history. The opposite of event sourcing's "append-only" principle
4. **Migrations live outside the code** — Schema change history flows in a separate lane from application code. AI cannot follow the timeline, and reconstructing past states becomes impossible
5. **Reverse query is impossible** — SQL queries are one-way only (input → output). Searching from outputs (results) to inputs (conditions) cannot be done; the reverse traversal of §0.15 constraint folding is **fundamentally infeasible**
6. **Cannot be composed as pure functions** — SQL appears declarative but has side effects, so it cannot be embedded in L3 reducers
7. **Query intent is lost from the code** — "Why this index?" "Why this JOIN order?" "Why this isolation level?" remains as unspoken implicit knowledge floating around
8. **AI writing SQL requires mobilizing all implicit knowledge at once** — Without complete mastery of types, schema, performance characteristics, and dialects, it silently breaks

In short, SQL is **"a layer optimized for humans to read and write."** In AI-native development, where humans don't read code, it has no reason to exist; furthermore, it is harmful as a **fourfold violation** of §4 missing information, §0.1 locality, L3 purity, and §0.15 reverse query.

### Recommended Persistence (Bible §5)

- **JSON Event Sourcing** — Do not overwrite state; append the history of Commands as a JSON array. Current state is derived by replaying (reducing) all events from the initial state
- **Sequential Hashing → Block** — Each event includes the hash of the previous event in computing its own hash (a chained, blockchain-like structure). Tampering and omissions are mathematically detectable; data stability is guaranteed
- **Dumb Relay** — The server has no logic — it is a pipe (relay). Integrity verification happens at the edge (L3 Logic)
- **Attestation Over Auth** — Discard centralized login authentication; use signature verification with public-key cryptography as the basis of authority

Combined with L3 purity, "complete event history + pure reducer" makes **the state at any arbitrary moment exactly reproducible**. This is the foundation supporting all of verification, debugging, replay, and reverse-query analysis.

---

## 30-Second Live Proof

> **🎮 [Open Playable Demo (Action Constraint Lab) in browser](https://aoyamarito.github.io/ai-desk/actions/index.html)**

```bash
# fighter-cancel: cancel chains in a fighting game, implemented with constraint folding
open actions/index.html

# Run 19/19 tests (exhaustive verification across 1920 worlds)
node --test actions/tests/fighter-cancel.test.js
```

`actions/` is a working demo that separates L3 Logic (pure data + constraint filter) from L1/L4 (input/draw).
Cancel windows, buffered input, and hit confirmation are all declared with **zero `if` statements, only data**, and the side panel **always shows, by reverse query, every route that leads to the current state**.

---

## Measurements

From `PROMPT_constraint_folding.md`, measured across 9 action-game demos:

| Bug category | Constraint folding suppression rate |
|---|---|
| State-combination omissions | **95%** |
| Spec/code divergence | **90%** |
| Cancel/combo systems | **85%** |
| AI strategy transitions | **80%** |
| Frame data contradictions | **95%** |
| Physics / drawing | Out of scope |

> **Weighted total: 50–60% of all action-game bugs eliminated structurally.**

For `fighter-cancel` specifically: 1920 worlds traversed, zero contradictions, 19/19 tests PASS.

---

## Documents

| File | Content |
|---|---|
| [`AI_ONBOARDING.en.md`](AI_ONBOARDING.en.md) | **AI work guide (start here)**. Rules, tools, syntax, and test commands in one place |
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | The full canon. Cognitive asymmetry → heavy functions → 4-layer architecture → REAL/SHADOW → 3Dplus → event sourcing → double-entry verification |
| [`AI_UNDERSTANDING_MANIFESTO.md`](AI_UNDERSTANDING_MANIFESTO.md) | AI cognition properties (±300-line spotlight, proximity bias, file-switch cost) |
| [`PROMPT_constraint_folding.md`](PROMPT_constraint_folding.md) | LLM-targeted application guide for the constraint folding pattern (decision criteria, templates, measurement evidence) |
| [`DISCUSSION_constraint_library.md`](DISCUSSION_constraint_library.md) | Full explanation of the mining-and-verify paradigm (with shipping-calculation PoC) |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | Application guide for action games (three-layer folding architecture) |
| [`3dplus/README.md`](3dplus/README.md) | Double-entry math 3D implementation guide. cpu3d.js contract and usage |

---

## Implementation and Evidence

### Tools

- **[`ai-desk.js`](ai-desk.js) (hands)** — A CLI that provides locality for the single intent of "what part of the code do I need to look at right now, and for what purpose?" Rather than making AI read entire files repeatedly, it `focus`-extracts only the range needed for the current intent, in Emblem units, and `apply`s patches locally. Satisfies Bible §0.1 (locality maximization) and Single-Purpose Binding simultaneously.

```bash
node ai-desk.js path/to/file.js skeleton                # structure overview (table of contents only)
node ai-desk.js path/to/file.js focus EmblemName        # local read for a single intent
node ai-desk.js path/to/file.js apply patch.js          # partial apply (zero side effects on other emblems)
node ai-desk.js path/to/file.js check                   # tag vocabulary + direction validation
node ai-desk.js path/to/file.js coverage                # bridge coverage report
```

- **[`ai-eyes.js`](ai-eyes.js) (eyes)** — Zero-dependency local server that collects browser errors automatically, saves snapshots, and accepts remote control commands. AI observes the page state without routing through a human.

```bash
node ai-eyes.js           # start server (http://localhost:3000)
node eyes-e2e.js "goal"   # compress current state to one text blob (exit 0/1)
```

### Minimal implementation
- [`constraint-janken.js`](constraint-janken.js) — 3-player rock-paper-scissors, 27 worlds. **Read this first.**

### Action-game application
- [`action-demos.html`](action-demos.html) + [`action-demos.js`](action-demos.js) — 9 action-game algorithms (playable)
- [`actions/`](actions/) — A lab where multiple JS demos can be switched from a single HTML hub. Includes `fighter-cancel` implementation + 19/19 exhaustive tests

### Mining-and-Verify PoC
- [`examples/`](examples/) — Empirical reconstruction of legacy shipping logic to 100% fidelity from 50 random samples

```bash
node examples/blackbox_generator.js     # generate 50 samples
node examples/verify_mining.js           # validate the reconstructed code against the original data
```

### Double-Entry Math / 3Dplus Verification Layer
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) + [`3dplus/render.js`](3dplus/render.js) — CPU Twin and GPU renderer pair (same scene JSON format). When a 3D bug appears, run both and compare outputs — a mathematical mismatch is a logic bug, not a rendering bug.
- [`3dplus/tests/`](3dplus/tests/) — 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js
open 3dplus/examples/point-projection.html   # GPU vs CPU comparison demo
```

---

## Decision Criteria (when to use / when not to use)

See `PROMPT_constraint_folding.md` §1 for full details. Summary:

### ✅ When constraint folding works
- Domain is finite and discrete
- Multiple independent state axes (concurrency)
- **Reverse query is meaningful** (the strongest single criterion)
- Business rules, game rules, tax logic, etc.

### ❌ When it doesn't
- Continuous-value physics / interpolation
- Real-time drawing loops
- Tree / graph search
- Cases where state combinations explode

> **"Before you write `if`, ask whether you can enumerate the possible worlds.
>  If you can, that set of worlds is your code."**

---

## Layout

```
ai-desk/
├── README.md / README.en.md
├── CLAUDE.md / GEMINI.md           # auto-loaded by AI CLI → redirects to AI_ONBOARDING
├── AI_ONBOARDING.md                # AI work guide (Japanese)
├── AI_ONBOARDING.en.md             # AI work guide (English)
├── AI_NATIVE_MASTER_BIBLE.md       # The canon
├── AI_UNDERSTANDING_MANIFESTO.md   # AI cognition properties
├── PROMPT_constraint_folding.md    # Constraint folding guide
├── DISCUSSION_constraint_library.md
├── ai-desk.js                      # Emblem manipulation tool (hands)
├── ai-eyes.js                      # Autonomous observation / debug server (eyes)
├── eyes-e2e.js                     # State → text compressor
├── constraint-janken.js            # Minimal implementation
├── action-demos.{html,css,js,-ui.js}
├── index.html                      # Landing page
├── examples/                       # Mining-and-verify PoC (shipping)
├── 3dplus/                         # Double-entry math (CPU Twin + GPU Renderer)
│   ├── cpu3d.js / render.js / render.shaders.js
│   ├── examples/point-projection.html
│   └── tests/projection.test.js
└── actions/
    ├── ACTION_NATIVE_FOLDING_GUIDE.md
    ├── index.html
    ├── demos/fighter-cancel.{logic,}.js
    └── tests/fighter-cancel.test.js
```

---

## Philosophy

This repository is a development system **redesigned from the premise that "code is written by AI, read by AI, and humans do not read code."**

- **Human role**: declaration of intent (requirements, constraints, rules, acceptance conditions) / verification of outcomes (tests, execution checks)
- **AI role**: all of code authorship, structuring, naming, refactoring, and metadata annotation

The traditional design principles for human readability (DRY, function decomposition, abstraction, encapsulation) act as **interference that scatters information and induces hallucinations** when applied to AI. What AI needs is the opposite — locality maximization, heavy functions, no shared helpers, inlining, Emblem boundaries. This looks counterintuitive to human aesthetics.

This is a frontal denial of human-era common sense. **In the AI-native era, the optimization target is AI, not humans.**

---

## License

MIT — use, modify, and redistribute freely. Credit is appreciated.

## Author

沖井広行 (Hiroyuki OKINOI) / [AoyamaRito](https://github.com/AoyamaRito) (蒼山りと, pen name)

---

## Citation

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```

---
**Author**: 沖井広行 (Hiroyuki OKINOI) / Pen name: 蒼山りと (Aoyama Rito)
