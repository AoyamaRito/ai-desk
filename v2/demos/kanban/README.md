# Kanban — ai-desk v2 demo

A Trello-like kanban board where **every card is a Block** and **every column is a Block whose `children` list is the ordered card ids**.

## v2 concepts on display

- **Card = Block { type:'card' }**: text edits, moves, reorders all become new versions on the same Block.
- **Column = Block { type:'column' }**: `Block.children` is the canonical ordering of cards (公理 A6 — children are part of REAL).
- **Move card = two commits**: source column commits with the card removed; target column commits with the card inserted. Card itself also commits to record the move in its own history.
- **Per-card history**: every move / rename / reorder / text-edit is recorded — visible in the inspector.
- **`rollback()` per card**: restore an old text as a new commit (history preserved).

## Spec-First lens (Bible §A8 / §4.1.1)

Each card's `versions[]` reads as a chronological log of intent:

```
[0] 14:02:11 create      — "Define onboarding flow"
[1] 14:05:32 move        — Backlog → In Progress
[2] 14:18:07 edit-text   — "Define onboarding flow (mobile-first)"
[3] 14:22:55 move        — In Progress → Done
```

No separate audit log, no separate validator — the structure is the log.

## File

Single HTML, ~750 lines, zero deps. Pure DOM (no canvas, since it's text-heavy UI).

> ▶ **[Try it (GitHub Pages)](https://aoyamarito.github.io/ai-desk/v2/demos/kanban/)**
