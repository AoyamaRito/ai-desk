# Node Graph — ai-desk v2 demo

Visual dataflow editor where **every node is a Block** and **every wire is an entry in `Block.refs`**.

## v2 concepts on display

- **Block per node**: each node = `Block { id, type:'node', meta:{nodeType}, versions:[] }`. Move / edit / wire = `commit()` on the same Block.
- **Wires = `Block.refs`**: a wire is not a separate object — it's a `{kind:'input', target, fromOut, toIn}` ref stored in the **target** node's head version.
- **Cycle detection via `Graph.forwardClosure`**: before adding wire A→B, compute `forwardClosure(B)`; reject if it contains A. Structural rejection, no separate validator.
- **Per-node history**: `Block.versions` is append-only — every move, edit, wire creates a new version. The inspector shows the full history per selected node.
- **DAG evaluator**: `evaluate()` walks `Block.refs` recursively, with a per-path `seen` set as a safety net for cycles.

## Spec-First lens (Bible §A8)

A node's lifecycle is its `versions[]`:
- v0 = `create` (logical existence: type + initial position)
- v1+ = `move` / `edit-value` / `wire` / `unwire` / `cascade-unwire`

The same field (`refs`) carries both spec-relevant edges and impl-time wiring — so changing a wire is a logical edit observable from the version list, not a hidden side effect.

## File

Single HTML, ~700 lines, zero deps. Pure 2D canvas.

> ▶ **[Try it (GitHub Pages)](https://aoyamarito.github.io/ai-desk/v2/demos/node-graph/)**
