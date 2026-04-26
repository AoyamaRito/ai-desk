#!/usr/bin/env node

// Constraint Library Prototype: 3-Player Janken
// Not a calculator. Not a function. Knowledge with constraints.
// One pure function. No state. No side effects.

// [ai_s_emblem:#high#logic Janken-Knowledge]
function janken(constraints = {}) {
  const H = ["G", "C", "P"];
  const LABEL = { G: "Rock", C: "Scissors", P: "Paper" };
  const BEATS = { G: "C", C: "P", P: "G" };
  const PLAYERS = ["A", "B", "C"];

  // --- The Knowledge: all 27 possible worlds ---
  const allWorlds = [];
  for (const a of H) for (const b of H) for (const c of H) {
    const hands = { A: a, B: b, C: c };
    const types = new Set([a, b, c]);
    if (types.size !== 2) {
      allWorlds.push({ A: a, B: b, C: c, result: "draw", winners: [] });
    } else {
      const [t1, t2] = [...types];
      const winHand = BEATS[t1] === t2 ? t1 : t2;
      const winners = PLAYERS.filter(p => hands[p] === winHand);
      allWorlds.push({ A: a, B: b, C: c, result: "win", winners });
    }
  }

  // --- Apply Constraints: filter possible worlds ---
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (PLAYERS.includes(k)) {
      worlds = worlds.filter(w => w[k] === v);
    } else if (k === "result") {
      worlds = worlds.filter(w => w.result === v);
    } else if (k === "winner") {
      worlds = worlds.filter(w => w.winners.includes(v));
    } else if (k === "winners") {
      worlds = worlds.filter(w =>
        w.winners.length === v.length && v.every(x => w.winners.includes(x))
      );
    }
  }

  // --- Express: what remains ---
  if (worlds.length === 0) {
    return { _contradiction: true, _message: "No world satisfies these constraints." };
  }

  const VARS = ["A", "B", "C", "result", "winners"];
  const ser = x => JSON.stringify(x);

  // Separate determined (1 value) from free (multiple)
  const determined = {};
  const freeVars = [];

  for (const v of VARS) {
    const unique = [...new Set(worlds.map(w => ser(w[v])))];
    if (unique.length === 1) {
      determined[v] = JSON.parse(unique[0]);
    } else {
      freeVars.push(v);
    }
  }

  // Fully determined → return values
  if (freeVars.length === 0) {
    return { _worlds: 1, ...determined };
  }

  // Partially determined → return relationship
  // For free variables, express as conditional on other free variables
  const relations = {};

  for (const v of freeVars) {
    const others = freeVars.filter(f => f !== v);
    if (others.length === 0) {
      // No other free vars → list possible values
      relations[v] = [...new Set(worlds.map(w => ser(w[v])))].map(s => JSON.parse(s));
      continue;
    }

    // Group: condition(others) → possible values of v
    const groups = {};
    for (const w of worlds) {
      const key = others.map(f => `${f}=${ser(w[f])}`).join(", ");
      if (!groups[key]) groups[key] = new Set();
      groups[key].add(ser(w[v]));
    }

    // Compress: if same output for different conditions, merge them
    const reversed = {};
    for (const [cond, vals] of Object.entries(groups)) {
      const valKey = [...vals].sort().join("|");
      if (!reversed[valKey]) reversed[valKey] = [];
      reversed[valKey].push(cond);
    }

    const when = {};
    for (const [valKey, conds] of Object.entries(reversed)) {
      const vals = valKey.split("|").map(s => JSON.parse(s));
      const value = vals.length === 1 ? vals[0] : vals;
      for (const c of conds) {
        when[c] = value;
      }
    }

    relations[v] = { depends_on: others, when };
  }

  return {
    _worlds: worlds.length,
    ...determined,
    ...relations
  };
}
// [/ai_s_emblem: Janken-Knowledge]

// [ai_s_emblem:#mid#draw Demo]
function demo() {
  const line = (s) => console.log(`\n${"=".repeat(60)}\n${s}\n${"=".repeat(60)}`);
  const show = (label, constraints) => {
    console.log(`\n--- ${label} ---`);
    console.log(`constrain(${JSON.stringify(constraints)})`);
    console.log("→", JSON.stringify(janken(constraints), null, 2));
  };

  line("Constraint Library Prototype: 3-Player Janken");

  // Forward: fix hands, get result
  show("No constraints (raw knowledge)", {});
  show("Fix A only", { A: "G" });
  show("Fix A and B", { A: "G", B: "C" });
  show("Fix all three", { A: "G", B: "C", C: "P" });
  show("Fix all three (A wins)", { A: "G", B: "C", C: "C" });

  // Reverse: fix result, get hands
  show("Reverse: who draws?", { result: "draw" });
  show("Reverse: A must win", { winner: "A" });
  show("Reverse: A wins with Rock", { winner: "A", A: "G" });

  // Contradiction
  show("Contradiction: A=G but A must lose to B=P and C=P?",
    { A: "G", B: "P", C: "P", winner: "A" });

  // Recursive: constrain the constrained
  line("Recursive constraining");
  console.log("\nStep 1: Only know A plays Rock");
  const r1 = janken({ A: "G" });
  console.log("→", r1._worlds, "possible worlds");

  console.log("\nStep 2: Now also know B plays Scissors");
  const r2 = janken({ A: "G", B: "C" });
  console.log("→", r2._worlds, "possible worlds");
  console.log("→", JSON.stringify(r2, null, 2));

  console.log("\nStep 3: Now also know C plays Paper");
  const r3 = janken({ A: "G", B: "C", C: "P" });
  console.log("→", r3._worlds, "possible worlds");
  console.log("→", JSON.stringify(r3, null, 2));
}

demo();
// [/ai_s_emblem: Demo]
