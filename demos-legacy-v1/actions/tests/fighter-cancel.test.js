// [ai_s_emblem:#high#logic Fighter-Cancel-Tests]
// node --test で実行する。Zero-Dep。
// 走らせ方:
//   node --test /Users/AoyamaRito/PJs/ai-desk/actions/tests/fighter-cancel.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../demos/fighter-cancel.logic.js');
const { MOVES, TRANSITIONS, resolveTransition, routesTo, tick, simulate, initialState } = L;

// 単一tickの薄いショートハンド
const step = (state, ev) => tick(state, ev || {}).state;
const fire = (state, ev) => tick(state, ev || {}).fired;

// frameをn進める（入力なし）
function advance(state, n) {
  let s = state;
  for (let i = 0; i < n; i++) s = step(s);
  return s;
}

// === 1. 初期状態 ===
test('initial state is IDLE', () => {
  const s = initialState();
  assert.equal(s.action, 'IDLE');
  assert.equal(s.frame, 0);
  assert.equal(s.hit, false);
});

// === 2. 全スタート技 ===
test('IDLE + A → JAB', () => {
  const s = step(initialState(), { input: 'A' });
  assert.equal(s.action, 'JAB');
  assert.equal(s.frame, 0);
});
test('IDLE + B → STRONG', () => {
  assert.equal(step(initialState(), { input: 'B' }).action, 'STRONG');
});
test('IDLE + C → SPECIAL', () => {
  assert.equal(step(initialState(), { input: 'C' }).action, 'SPECIAL');
});
test('IDLE + G → GUARD (with guardHeld true)', () => {
  const s = step(initialState(), { input: 'G', guardHeld: true });
  assert.equal(s.action, 'GUARD');
});

// === 3. キャンセルチェーン: hit確認＋窓内 ===
test('JAB(hit, frame in 4..8) + C → SPECIAL', () => {
  let s = step(initialState(), { input: 'A' });           // → JAB f0
  s = advance(s, 3);                                       // → JAB f3
  s = step(s, { hitFlag: true });                          // → JAB f4 hit=true
  s = step(s, { input: 'C' });                             // → SPECIAL
  assert.equal(s.action, 'SPECIAL');
});

// === 4. hit無しならキャンセル不可 ===
test('JAB(no hit) + C does NOT cancel; stays in JAB chain', () => {
  let s = step(initialState(), { input: 'A' });
  s = advance(s, 4);                                       // → JAB f5 hit=false
  s = step(s, { input: 'C' });
  assert.equal(s.action, 'JAB', 'hit無しではキャンセル不発でJAB継続');
});

// === 5. キャンセル窓の境界 ===
test('JAB hit at frame 3 (before window) + C does NOT cancel', () => {
  let s = step(initialState(), { input: 'A' });
  s = step(s, { hitFlag: true });                          // f1 hit
  s = advance(s, 1);                                       // f2
  s = step(s, { input: 'C' });                             // 窓は4..8、まだ到達せず
  assert.equal(s.action, 'JAB');
});
test('JAB hit + C at frame 9 (after window) does NOT cancel', () => {
  let s = step(initialState(), { input: 'A' });
  s = advance(s, 3);
  s = step(s, { hitFlag: true });                          // f4
  s = advance(s, 4);                                       // f8
  s = step(s, { input: 'C' });                             // f9で発火試行
  assert.equal(s.action, 'JAB');
});

// === 6. STRONGからのキャンセル ===
test('STRONG(hit, frame in 8..14) + C → SPECIAL', () => {
  let s = step(initialState(), { input: 'B' });            // STRONG
  s = advance(s, 7);                                       // f7
  s = step(s, { hitFlag: true });                          // f8 hit
  s = step(s, { input: 'C' });                             // SPECIAL
  assert.equal(s.action, 'SPECIAL');
});

// === 7. 自然回復 ===
test('JAB after dur(10) → IDLE', () => {
  let s = step(initialState(), { input: 'A' });
  s = advance(s, 10);
  assert.equal(s.action, 'IDLE', 'JABはdur=10で自然にIDLEへ');
});

// === 8. ガード解除 ===
test('GUARD then release guardHeld → IDLE', () => {
  let s = step(initialState(), { input: 'G', guardHeld: true });
  s = step(s, { guardHeld: false });
  assert.equal(s.action, 'IDLE');
});

// === 9. 強制割り込み ===
test('JAB + !hit → HITSTUN', () => {
  let s = step(initialState(), { input: 'A' });
  s = advance(s, 2);
  s = step(s, { input: '!hit' });
  assert.equal(s.action, 'HITSTUN');
});

// === 10. ガードは被弾を吸収 ===
test('GUARD is immune to !hit', () => {
  let s = step(initialState(), { input: 'G', guardHeld: true });
  s = step(s, { input: '!hit', guardHeld: true });
  assert.equal(s.action, 'GUARD', 'ガード中の!hitは無効');
});

// === 11. 逆引きクエリの網羅性 ===
test('routesTo(SPECIAL) returns exactly start + 2 cancels', () => {
  const r = routesTo('SPECIAL');
  assert.equal(r.length, 3);
  const tags = r.map(t => t.tag).sort();
  assert.deepEqual(tags, ['cancel', 'cancel', 'start']);
});
test('routesTo(HITSTUN) is the global interrupt route', () => {
  const r = routesTo('HITSTUN');
  assert.equal(r.length, 1);
  assert.equal(r[0].from, 'ANY');
  assert.equal(r[0].input, '!hit');
});

// === 12. simulate: 連続シナリオ ===
test('simulate: A → wait3 → hit → C ⇒ SPECIAL', () => {
  const events = [
    { input: 'A' },                      // tick1: IDLE → JAB
    {}, {}, {},                          // tick2-4: JAB f1-3
    { hitFlag: true },                   // tick5: JAB f4 hit
    { input: 'C' },                      // tick6: → SPECIAL
  ];
  const { state, log } = simulate(events);
  assert.equal(state.action, 'SPECIAL');
  assert.equal(log.length, 2);
  assert.deepEqual(log.map(l => l.next), ['JAB', 'SPECIAL']);
  assert.equal(log[1].tag, 'cancel');
});

// === 13. 矛盾検査 (網羅) ===
// 全 (action × input × hit × frame境界) 組合せに対して、
// resolveTransition が「nullまたは正しい型のtransition」を返し、決して例外を投げない。
test('exhaustive: resolveTransition is total over enumerated worlds', () => {
  const actions = Object.keys(MOVES);
  const inputs = ['A','B','C','G','-','$','!hit','X'];  // Xは未定義入力
  const hits = [false, true];
  const frames = [0, 3, 4, 5, 8, 9, 10, 14, 18, 30];
  const guards = [false, true];
  let total = 0, hits2 = 0;
  for (const action of actions) {
    for (const input of inputs) {
      for (const hit of hits) {
        for (const frame of frames) {
          for (const guardHeld of guards) {
            const s = { action, frame, hit, guardHeld };
            const r = resolveTransition(s, input);
            total++;
            if (r) {
              hits2++;
              assert.ok(typeof r.next === 'string', 'next should be string');
              assert.ok(typeof r.prio === 'number', 'prio should be number');
              assert.ok(MOVES[r.next], `next ${r.next} must be a known state`);
            }
          }
        }
      }
    }
  }
  // 何件か少なくとも発火する＝制約が空集合でない健全性チェック
  assert.ok(hits2 > 0, 'at least one transition must fire across the world');
  console.log(`  exhaustive: ${total} worlds, ${hits2} fired, ${total - hits2} silent`);
});

// === 14. 全TRANSITIONSに到達可能性があるか (whenが常に偽でない) ===
test('every TRANSITION has at least one firing world', () => {
  const orphans = [];
  for (const t of TRANSITIONS) {
    let ok = false;
    for (const frame of [0, 4, 5, 8, 10, 12, 14, 18, 20, 30]) {
      for (const hit of [false, true]) {
        for (const guardHeld of [false, true]) {
          const action = t.from === 'ANY' ? 'JAB' : t.from;
          if (t.when({ action, frame, hit, guardHeld })) { ok = true; break; }
        }
        if (ok) break;
      }
      if (ok) break;
    }
    if (!ok) orphans.push(`${t.from}+${t.input}→${t.next}`);
  }
  assert.deepEqual(orphans, [], 'orphan transitions (when=常に偽): ' + orphans.join(', '));
});
// [/ai_s_emblem: Fighter-Cancel-Tests]
