# Block Spreadsheet — ai-desk v2 demo

A spreadsheet where **every cell is a Block** — built to showcase v2 fundamentals.

> [▶ Play (GitHub Pages)](https://aoyamarito.github.io/ai-desk/v2/demos/block-spreadsheet/)

---

## Why this demo?

A spreadsheet is the **perfect** place to demonstrate v2 core ideas:

| v2 concept | Spreadsheet equivalent |
|---|---|
| **Block** = unit of structure | Each cell |
| **Block.refs** = dependency edges | Formula references (e.g. `=A1+B1` ⇒ refs to A1, B1) |
| **Block.versions** = REAL history | Every cell edit becomes a new version |
| **Graph.impact** = transitive impact | "What recomputes when this cell changes" |
| **Graph cycle detection** | Reject formulas that create circular references |
| **rollback()** = past as new commit | Per-cell Undo |

Open the demo, click a cell, and watch:
- The **side panel** shows the cell's id, refs (deps), backward refs (who uses it), and full version history.
- Selecting a cell highlights its **outgoing deps** (orange) and **incoming deps** (cyan) on the grid.
- Editing a cell recomputes only the cells in its `Graph.impact()` closure — not the whole grid.

---

## Features

- 6×6 grid (compact, focused)
- Formulas: `+ - * /`, parentheses, cell refs (`A1`), ranges (`SUM(A1:A3)`, `AVG`, `MIN`, `MAX`)
- **Cycle detection**: refuses any formula that would form a cycle in the Block graph
- **Per-cell Undo**: `rollback()` restores a past version as a new append-only version (history is preserved)
- **Live ref highlighting**: select a cell to see its dep network
- **Version history**: scroll through every commit each cell has had
- **Demo data button**: loads a small budget tracker showing `=SUM`, references, and tax computation

All in a single HTML file (~700 lines, zero deps, no build, no markers).

---

## Try this

1. Click **Load Demo (Budget)** — a small budget table with formulas appears.
2. Click cell `B6` (Grand Total) — see in the side panel that it depends on `D2, D3, D4, B5`.
3. Edit `B2` (apple cost) — Cells `D2`, `B5`, `B6` recompute automatically.
4. Watch the **versions** panel: B6 now has multiple versions, each commit visible.
5. Click **Undo this cell** on `B2` — its earlier version becomes the new current; dependents recompute.
6. Try entering `=B6` into `B1` — **cycle detected, rejected**. (B1 is a dep of B5 of B6, so B6 → B1 would close the loop.)

---

## v1 vs v2

The v1 spreadsheet ([`demos-legacy-v1/demos/spreadsheet.html`](../../../demos-legacy-v1/demos/spreadsheet.html)) does the same job in 585 lines, but:
- Cells live in a flat object map; dependencies tracked ad-hoc
- No structural history (a single `undo` stack tracks recent actions, not versions)
- No way to see "which cells depend on this one" without grep
- No cycle detection structure-level — has to be implemented per-formula

The v2 version uses `Block`, `Block.refs`, `Block.versions`, and `Graph.impact`/`backward`/`forward` directly. Cycle detection is one `forwardClosure().has(id)` call. Recompute is `Graph.impact(id)` in 3 lines.

**The structure of the language matches the structure of the problem.**

---

## License

MIT (same as ai-desk).
