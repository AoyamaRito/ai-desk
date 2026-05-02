# ai-desk

> This file is the **AI / architect-facing** spec, design philosophy, and architecture overview.
> End users should start with [`README.en.md`](README.en.md) (how to ask AI to do work in plain language).
> AI agents should also read [`AI_ONBOARDING.en.md`](AI_ONBOARDING.en.md) before starting any task.
> The deepest source of truth (`AI_NATIVE_MASTER_BIBLE.md`) is currently Japanese only.

---

## Branch policy

- **`main`** — active development trunk. Latest commits land here. Default branch.
- **`stable`** — pinned snapshot. Advances only by **manual fast-forward from main** when a state is judged stable. For external integrators / citations that want to lock to "ai-desk@stable as of T".

---

## Glossary

| Term | One-line definition |
|------|--------------------|
| **Emblem** | Comment tag that logically partitions a file: `// [ai_s_emblem:#layer Name]` |
| **Bridge** | Tag attached to functions that cross layers: `// [ai_s_bridge:L3toL4 Name]` |
| **Layer (L1–L4)** | Physical → Intent → Logic → Draw, four layers, data flows one-way |
| **REAL_xxx** | The single mutable state variable, e.g. `REAL_state.hp` |
| **shadow** | Disposable derived value built from REAL on demand. Never stored in a variable |
| **Twin** | A pure CPU-side reimplementation that runs alongside (e.g., a GPU implementation) for verification |
| **Heavy Function** | Self-contained function with no shared helpers. Looks redundant, intentionally so |
| **Constraint Folding** | Instead of if/else, "enumerate all possible worlds → filter by constraints" pattern |

If something looks like a bug: this codebase deliberately duplicates regexes across multiple sites and keeps functions long. The "why" is in this file and in `AI_NATIVE_MASTER_BIBLE.md`.

---

> **AI-Native software methodology — a working desk for the AI to build on.**
> Code is written by AI, read by AI. Humans only declare intent and verify results.
> This repo packages the design principles, tools, and demos that make that division of labor work.

[![tests](https://img.shields.io/badge/tests-19%2F19_PASS-success)](actions/tests/fighter-cancel.test.js)
[![worlds](https://img.shields.io/badge/worlds_verified-1920-blue)](actions/tests/fighter-cancel.test.js)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What is this

In an era where AI (LLMs) write the code, **the protagonist is the AI; humans don't read code**.
The human's job is **declaring intent** (requirements, constraints, rules) and **verifying outcomes** (tests, acceptance).

The "good design" of the human era — DRY, abstraction, encapsulation — exists to make code easier for **humans** to read. To AI, those same patterns are **physical scattering of information that triggers hallucination**. AI needs the opposite optimization: maximal locality, heavy functions, no sharing, inlining everywhere. This looks ugly to a human aesthetic, but the optimization target is the AI, not the human.

This repo starts from that asymmetry of cognition and packages the **principles, tools, and proof-of-concept implementations** that let an AI write code without losing its way and without producing bugs.

---

## AI cognition hypotheses

This system assumes the following about LLM cognition. Detail in [`AI_UNDERSTANDING_MANIFESTO.en.md`](AI_UNDERSTANDING_MANIFESTO.en.md).

1. **±300-line spotlight** — Attention has very high resolution within a few hundred lines around the focus point and degrades sharply outside that range. For an AI, only "what is currently visible" exists.
2. **Recency bias** — Output is "probabilistic completion of the next token." Information close to the answer position has the strongest influence. Rules placed at the top of a file are easily ignored.
3. **File-switch cost** — Reading a different file costs as much as physically walking into a different room. Context resets, and round-trips between multiple files generate context-loss bugs.
4. **Weak at guessing, strong at heavy computation** — Inferring missing information ("reading between the lines") is hopelessly bad. **The mere absence of information — or hidden information caused by human-style abstraction/encapsulation — triggers hallucination.** But when the information is all visible, the AI can perfectly handle chaos with 100 entangled branches.

The Bible's §0.0 (asymmetry of cognition), §0.1 (heavy functions), and §0.15 (constraint folding) are derived from these. **"Complexity is the human's problem; hiding is the AI's problem"** is the consequence of those four points.

### Anti-patterns (consequences of the hypotheses)

Many human-era best practices violate the hypotheses above and are **counter-productive** for AI:

- **TDD where attention scatters and one goal can't be bundled** — Test-driven development with tests in separate files, or where the AI can't see the full target spec mid-cycle, leads the AI astray (triple violation: §1 spotlight + §3 switch cost + §4 missing info). The AI writes throwaway code that only passes the immediate test, then later tests reveal contradictions and you spiral into refactor hell.

  The thing being rejected is not "tests" but **"goal scatter."** Tests themselves are required by Bible §7 (double-entry). **A test set bundled around one goal where AI sees the full context** (e.g., this repo's [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js) — 19 exhaustive cases in one file with the corresponding logic in a single scope) is in fact an AI-native-optimal verification surface.
- **DRY / extraction into shared helpers** — "Pull this out into another file for reuse" forces a file-switch cost on every reference and shreds AI cognition (§3). Bible §0.1.2 "no sharing" rejects this head-on.
- **Abstraction / encapsulation** — From the human side this is "hiding complexity." From the AI side it is "hiding information," which is the trigger for hallucination (§4).
- **SQL / RDBMS** — Implicit knowledge outside the code (schema, indexes, triggers, etc.) is invisible to the AI: §4 missing-info → hallucination. On top of that: L3 purity violation, no reverse lookup, destructive overwrites — a **quadruple violation**. The replacement is JSON Event Sourcing + sequential-hash blocks.

### Recommended verification patterns

- **End-to-end tests** — single goal is structurally guaranteed. Crosses every layer and gives AI full context. **The first-recommended verification surface for AI-native development.**
- **Exhaustive test sets** — "enumerate all possible worlds, check for contradictions" style (e.g. [`fighter-cancel.test.js`](actions/tests/fighter-cancel.test.js), 1920 worlds in one file).

---

## The six core pillars

1. **Asymmetry of cognition** — complexity is the human's problem, hiding is the AI's problem ([Bible §0.0](AI_NATIVE_MASTER_BIBLE.md))
2. **Heavy Functions** — no sharing, inline everything, Emblem boundaries ([Bible §0.1](AI_NATIVE_MASTER_BIBLE.md))
3. **Constraint Folding** — instead of if/else, "enumerate all possible worlds → filter by constraints" ([Bible §0.15](AI_NATIVE_MASTER_BIBLE.md), [implementation guide](CONSTRAINT_FOLDING_MASTER.md))
4. **Mining paradigm** — Monte Carlo + LLM-driven law extraction + constraint validators, three-stage verification
5. **Double-entry math / 3Dplus verification layer** — transparent CPU-side arithmetic running alongside GPU output, so 3D / physics / animation bugs can be definitively classified as "logic bugs" ([Bible §4 / §7](AI_NATIVE_MASTER_BIBLE.md))
6. **Autonomous observation infrastructure (AI-Eyes)** — instead of routing screen output and errors through humans, the AI observes them itself through a zero-dependency local server ([Bible §1.5](AI_NATIVE_MASTER_BIBLE.md))

---

## How to use it

**Have the AI do everything.** Humans don't run commands.

### When you want to do something new

```
Read AI_ONBOARDING.md first, then do [what you want].
```

The AI uses `skeleton` to grasp structure, `focus` to read the target locally, and `apply` to land the patch.

### When you want to fix a bug

```bash
node ai-eyes.js   # start the observation server (the only thing the human runs)
```

```
Read AI_ONBOARDING.md first, then fix [the symptom].
ai-eyes is already running (localhost:3000).
```

The AI uses `eyes-e2e.js` to observe current state, fixes things, and iterates until exit 0.

---

## Architecture: 4-Layer Vanilla

All information flows one-way through these four layers. **The L3 Logic layer must be implemented as a pure function.**

| Layer | Role | Nature |
|---|---|---|
| **L1: Physical** | DOM access, event registration, localStorage and other external I/O | Side-effects OK (boundary) |
| **L2: Intent** | Raw event → Command JSON conversion. Async / network / external API calls happen here | Side-effects OK |
| **L3: Logic** | `(REAL_state, Command) => newState` reducer | **Pure function (mandatory)** |
| **L4: Draw** | Targeted DOM/Canvas updates from `REAL_state` | Side-effects OK (rendering only) |

L1/L2/L4 may be procedural. **Only L3 must stay strictly pure.** Detail in [Bible §2-§3](AI_NATIVE_MASTER_BIBLE.md).

---

## Persistence: JSON Event Sourcing + sequential-hash blocks

SQL is not used. In AI-native development, SQL is harmful as a **quadruple violation** (L3 purity, reverse-lookup loss, missing-information, destructive overwrite). Instead:

- **JSON Event Sourcing** — Don't overwrite state. Append the Command history to a JSON array.
- **Sequential Hashing** — Each event computes its own hash including the previous hash. Tampering and dropouts are detected mathematically.
- **Dumb Relay** — The server is a logic-less pipe. Integrity verification happens at the edge (L3 Logic).

Detail in [Bible §5](AI_NATIVE_MASTER_BIBLE.md).

---

## 30-second proof

> **[Open the playable demo (LP) in your browser](https://aoyamarito.github.io/ai-desk/en/)**

```bash
open actions/index.html
node --test actions/tests/fighter-cancel.test.js
```

---

## Measured impact

| Bug category | Eliminated by Constraint Folding |
|---|---|
| State combinatorial gaps | **95%** |
| Spec / code mismatch | **90%** |
| Cancel & combo logic | **85%** |
| AI strategy transitions | **80%** |
| Frame-data contradictions | **95%** |
| Physics / rendering | Out of scope |

> **Weighted total: ~50–60% of action-game bugs structurally eliminated.**

---

## Documents

| File | Content |
|---|---|
| [`AI_ONBOARDING.en.md`](AI_ONBOARDING.en.md) | **AI work guide (read first)**. Rules, tools, syntax, testing |
| [`AI_NATIVE_MASTER_BIBLE.md`](AI_NATIVE_MASTER_BIBLE.md) | The canonical document (Japanese). Asymmetry → Heavy Functions → 4-layer → REAL/SHADOW → 3Dplus → Event Sourcing → double-entry math |
| [`AI_UNDERSTANDING_MANIFESTO.en.md`](AI_UNDERSTANDING_MANIFESTO.en.md) | AI cognition characteristics: ±300-line spotlight, recency bias, file-switch cost |
| [`CONSTRAINT_FOLDING_MASTER.md`](CONSTRAINT_FOLDING_MASTER.md) | LLM application guide for the constraint-folding pattern (Japanese) |
| [`actions/ACTION_NATIVE_FOLDING_GUIDE.md`](actions/ACTION_NATIVE_FOLDING_GUIDE.md) | Action-game application guide |
| [`3dplus/README.md`](3dplus/README.md) | 3D implementation guide for double-entry math |

---

## Implementation and proof

### Tools

- **[`ai-desk.js`](ai-desk.js) (the hand)** — CLI for safely doing local edits via Emblem-tagged virtual partitioning, with `skeleton` / `focus` / `apply` modes.

```bash
node ai-desk.js path/to/file.js skeleton                     # structure overview (with line numbers)
node ai-desk.js path/to/file.js focus EmblemName             # local read
node ai-desk.js path/to/file.js apply patch.js [--dry-run]   # atomic apply (pre-flight; all-or-nothing)
node ai-desk.js path/to/file.js check                        # tag/vocabulary integrity check
node ai-desk.js path/to/file.js coverage                     # bridge coverage report
```

- **[`ai-eyes.js`](ai-eyes.js) (the eye)** — zero-dependency local server for browser error collection, snapshots, and remote control.

```bash
node ai-eyes.js           # start server (http://localhost:3000)
node eyes-e2e.js "goal"   # compress current state to one text and exit 0/1
```

### Minimal implementation
- [`constraint-janken.js`](constraint-janken.js) — three-player rock-paper-scissors, 27 worlds. **Read this first.**

### Action-game application
- [**`action-demos.html`**](https://aoyamarito.github.io/ai-desk/action-demos.html) + `action-demos.js` — 9 action-game algorithms (playable)
- [**`actions/index.html`**](https://aoyamarito.github.io/ai-desk/actions/index.html) — `fighter-cancel` implementation + 19/19 exhaustive tests

### Mining-paradigm proof of concept
- [`examples/`](examples/) — recovering legacy shipping-fee logic 100% from 50 samples

### Double-entry math / 3Dplus verification layer
- [`3dplus/cpu3d.js`](3dplus/cpu3d.js) + [`3dplus/render.js`](3dplus/render.js) — CPU Twin and GPU renderer pair (shared scene-JSON format)
- [`3dplus/tests/`](3dplus/tests/) — 77/77 PASS

```bash
node --test 3dplus/tests/projection.test.js
open 3dplus/examples/point-projection.html  # GPU vs CPU diff demo
```

---

## Adoption criteria

### Domains where Constraint Folding works
- Domain is finite and discrete / multiple independent state axes / **reverse lookup is meaningful** (the strongest indicator)
- Business rules, game rules, tax logic, and similar

### Domains where it doesn't work
- Continuous-value physics or interpolation / real-time render loops / tree or graph search

> **"Before you write `if`, ask: can you enumerate the possible worlds?
>  If you can, that set of worlds *is* the code."**

---

## Repository layout

```
ai-desk/
├── README.md                       # User-facing quickstart (Japanese)
├── README.en.md                    # User-facing quickstart (English)
├── README.ai.md                    # AI / architect detail (Japanese)
├── README.ai.en.md                 # This file (AI / architect detail, English)
├── CLAUDE.md / GEMINI.md           # auto-loaded by AI tools → routes to AI_ONBOARDING.md
├── AI_ONBOARDING.md / .en.md       # AI work guide (rules, tools, tag syntax)
├── AI_NATIVE_MASTER_BIBLE.md       # the canonical doc (Japanese)
├── AI_UNDERSTANDING_MANIFESTO.md   # AI cognition (Japanese)
├── CONSTRAINT_FOLDING_MASTER.md    # constraint folding guide (Japanese)
├── DOCS_REAL.js + build-docs.js    # Bible source (REAL) and build pipeline → BIBLE_SHADOW.md
├── ai-desk.js                      # Emblem CLI (the hand)
├── ai-eyes.js                      # autonomous observation/debug server (the eye)
├── eyes-e2e.js                     # state → text compressor
├── constraint-janken.js            # minimal implementation
├── index.html / en/index.html      # landing pages (Japanese / English)
├── demos/                          # vanilla canvas demos (burst / swarm / cascade / space-race)
├── action-demos.{html,css,js}
├── examples/                       # mining-paradigm PoC
├── 3dplus/                         # double-entry math (CPU Twin + GPU Renderer)
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

This repo is a development methodology redesigned from the premise: **"code is written by AI, read by AI; humans don't read code."**

- **Human's job**: declaring intent (requirements, constraints, rules, acceptance criteria), verifying outcomes (tests, runtime confirmation).
- **AI's job**: writing, structuring, naming, refactoring, attaching metadata — all of it.

This is a head-on rejection of human-era received wisdom. In the AI-native era the optimization target is the AI, not the human.

---

## License

MIT — use, modify, redistribute freely. A credit is appreciated.

## Author

Hiroyuki OKINOI / [AoyamaRito](https://github.com/AoyamaRito) (Aoyama Rito / 蒼山りと)

---

## Citation

```
AoyamaRito (2026). ai-desk: AI-Native Software Methodology.
https://github.com/AoyamaRito/ai-desk
```
