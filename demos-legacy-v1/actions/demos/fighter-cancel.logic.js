// [ai_s_emblem:#high#logic Fighter-Cancel-Logic]
// L3 Logic層: 純粋関数のみ。DOM/RAF/canvasに依存しない。
// browser: window.FighterCancelLogic / node: module.exports でエクスポート。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FighterCancelLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const MOVES = {
    IDLE:    { color:'#3fb950', dur:Infinity, active:[0,0],   reach:0,   label:'IDLE' },
    JAB:     { color:'#58a6ff', dur:10,       active:[3,5],   reach:80,  label:'JAB (10f)' },
    STRONG:  { color:'#ffd33d', dur:18,       active:[7,11],  reach:110, label:'STRONG (18f)' },
    SPECIAL: { color:'#ff7b72', dur:30,       active:[12,18], reach:160, label:'SPECIAL (30f)' },
    GUARD:   { color:'#8b949e', dur:Infinity, active:[0,0],   reach:0,   label:'GUARD' },
    HITSTUN: { color:'#f85149', dur:20,       active:[0,0],   reach:0,   label:'HITSTUN (20f)' },
  };

  const TRANSITIONS = [
    { from:'IDLE',    input:'A', next:'JAB',     prio:1, when:_=>true,                                  tag:'start' },
    { from:'IDLE',    input:'B', next:'STRONG',  prio:1, when:_=>true,                                  tag:'start' },
    { from:'IDLE',    input:'C', next:'SPECIAL', prio:1, when:_=>true,                                  tag:'start' },
    { from:'IDLE',    input:'G', next:'GUARD',   prio:1, when:_=>true,                                  tag:'start' },
    { from:'GUARD',   input:'-', next:'IDLE',    prio:1, when:s=>!s.guardHeld,                          tag:'release' },

    { from:'JAB',     input:'B', next:'STRONG',  prio:5, when:s=>s.hit&&s.frame>=4&&s.frame<=8,         tag:'cancel' },
    { from:'JAB',     input:'C', next:'SPECIAL', prio:6, when:s=>s.hit&&s.frame>=4&&s.frame<=8,         tag:'cancel' },
    { from:'STRONG',  input:'C', next:'SPECIAL', prio:6, when:s=>s.hit&&s.frame>=8&&s.frame<=14,        tag:'cancel' },

    { from:'JAB',     input:'$', next:'IDLE',    prio:0, when:s=>s.frame>=MOVES.JAB.dur,                tag:'recover' },
    { from:'STRONG',  input:'$', next:'IDLE',    prio:0, when:s=>s.frame>=MOVES.STRONG.dur,             tag:'recover' },
    { from:'SPECIAL', input:'$', next:'IDLE',    prio:0, when:s=>s.frame>=MOVES.SPECIAL.dur,            tag:'recover' },
    { from:'HITSTUN', input:'$', next:'IDLE',    prio:0, when:s=>s.frame>=MOVES.HITSTUN.dur,            tag:'recover' },

    { from:'ANY',     input:'!hit', next:'HITSTUN', prio:99, when:s=>s.action!=='GUARD',                tag:'interrupt' },
  ];

  function resolveTransition(state, input) {
    const candidates = TRANSITIONS.filter(t =>
      (t.from === state.action || t.from === 'ANY') &&
      t.input === input &&
      t.when(state)
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.prio - a.prio);
    return candidates[0];
  }

  function routesTo(target) {
    return TRANSITIONS.filter(t => t.next === target);
  }

  // simulate: テスト・リプレイ用。1tick進めて新stateを返す純粋関数。
  // events は { input?, hitFlag?, guardHeld? } で外部介入を表現する。
  function tick(state, events = {}) {
    let s = { ...state, frame: state.frame + 1 };

    if (typeof events.guardHeld === 'boolean') s.guardHeld = events.guardHeld;
    if (events.hitFlag === true) s.hit = true;

    if (events.input === '!hit') {
      const fired = resolveTransition(s, '!hit');
      if (fired) return { state: applyFire(s, fired), fired };
    }

    const tryInputs = [];
    if (events.input && events.input !== '!hit') tryInputs.push(events.input);
    if (!s.guardHeld && s.action === 'GUARD') tryInputs.push('-');
    tryInputs.push('$');

    for (const inp of tryInputs) {
      const fired = resolveTransition(s, inp);
      if (fired) return { state: applyFire(s, fired), fired };
    }
    return { state: s, fired: null };
  }

  function applyFire(s, fired) {
    return { ...s, action: fired.next, frame: 0, hit: false };
  }

  function initialState(over = {}) {
    return { action:'IDLE', frame:0, hit:false, guardHeld:false, ...over };
  }

  // simulate: events列を順に流し、最終state＋発火履歴を返す。
  function simulate(events, initOver = {}) {
    let s = initialState(initOver);
    const log = [];
    for (const ev of events) {
      const r = tick(s, ev || {});
      s = r.state;
      if (r.fired) log.push({ from: r.fired.from, input: r.fired.input, next: r.fired.next, tag: r.fired.tag });
    }
    return { state: s, log };
  }

  return { MOVES, TRANSITIONS, resolveTransition, routesTo, tick, simulate, initialState };
});
// [/ai_s_emblem: Fighter-Cancel-Logic]
