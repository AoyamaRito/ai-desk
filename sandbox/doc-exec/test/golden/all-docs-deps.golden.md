---

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

---

# alpha

> 原則: <<Heavy Function>> <<Spotlight>>
> 層: <<L1>> <<L2>> <<L4>>
> 検証: <<Twin>>

<!-- @source: alpha.md -->

# Alpha

This document discusses the Heavy Function pattern and how it interacts with Spotlight scope.

The L1 layer handles physical I/O. The L2 layer handles intent.

```
This is a code block. Heavy Function should not be detected here.
```

A `Heavy Function` in inline code is also masked.

The Twin verification pattern doubles every L4 output.

---

# beta

> 原則: <<Heavy Function>>
> 状態: <<REAL>> <<SHADOW>>
> 層: <<L3>>

<!-- @source: beta.md -->

# Beta

This file uses an alias: 重厚関数 instead of the canonical name.

It also mentions L3 (logic layer) and the REAL/SHADOW state distinction.

***
This horizontal rule should be converted to *** in bundle output.

---

# sub-gamma

> 原則: <<Spotlight>>

<!-- @source: sub/gamma.md -->

# Gamma

A nested file. Discusses Spotlight only.
