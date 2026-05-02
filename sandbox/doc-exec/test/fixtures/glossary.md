# <<Heavy Function>>

<!-- @category: principle -->
<!-- @aliases: 重厚関数 -->

A function that contains all logic for one concern, with no shared helpers.

---

# <<Spotlight>>

<!-- @category: principle -->

The local reading scope of an LLM (~±300 lines).

---

# <<Twin>>

<!-- @category: verification -->

A duplicated verification function placed adjacent to the implementation.

---

# <<L1>>

<!-- @category: layer -->
<!-- @aliases: physical -->

Physical I/O layer (DOM, events, file I/O).

---

# <<L2>>

<!-- @category: layer -->
<!-- @aliases: intent -->

Intent translation layer.

---

# <<L3>>

<!-- @category: layer -->
<!-- @aliases: logic -->

Logic layer (pure reducers, state).

---

# <<L4>>

<!-- @category: layer -->
<!-- @aliases: draw -->

Rendering layer.

---

# <<REAL>>

<!-- @category: state -->

The authoritative source of truth.

---

# <<SHADOW>>

<!-- @category: state -->

A derived view of REAL, never edited directly.
