#!/usr/bin/env node

// action-demos.js
// AI-Native Action Game Algorithm Demos
// Date: 2026-04-30
//
// 「if文ゼロでアクションゲームの全アルゴリズムを書く」ショーケース。
// 各デモは「全可能世界を生成 → 制約でfilter → 残った世界を返す」という
// constraint-janken と同型のパターンに従う。
// Bible §0.15「条件畳み込み一発判定」の実証。
//
// 順引き（状態→結果）と逆引き（結果→状態）の両方を1つの関数で扱える。
// 矛盾する制約は _contradiction として即座に検出される。

// [ai_s_emblem:#low#config Constants]
const FRAMES = [1, 2, 3, 4, 5, 6, 7, 8];
const POSITIONS = [0, 10, 20, 30, 40];
// [/ai_s_emblem: Constants]

// [ai_s_emblem:#high#logic Compose-Core]
// 制約関数の合成器。pipe(直列) / join(並列直積) / meta(階層) の3関数。
// 各デモはこれを通じて多段化される。
// この emblem だけは「共有ヘルパー」として例外的に許可される（Bible §6 Q4）。

// pipe: f1 → f2 → f3 と直列に流す。各段の出力が次段の制約に積まれる。
function pipe(...fns) {
  return (initial = {}) => {
    let acc = { ...initial };
    for (const fn of fns) {
      const next = fn(acc);
      if (next._contradiction) return next;
      acc = { ...acc, ...next };
    }
    return acc;
  };
}

// join: 複数ドメインの可能世界を直積。link関数で跨ぎ制約をfilter。
function join(fns, link) {
  return (constraints = {}) => {
    const worldSets = fns.map(fn => (fn(constraints)._worlds_raw) || []);
    let joint = worldSets.reduce(
      (acc, set) => acc.flatMap(a => set.map(s => [...a, s])),
      [[]]
    );
    if (link) joint = joint.filter(tuple => link(...tuple));
    if (joint.length === 0) {
      return { _contradiction: true, _message: "Joined worlds are empty under link constraint." };
    }
    return { _worlds: joint.length, _worlds_raw: joint };
  };
}

// meta: 上位制約が下位の探索空間を縮小する階層関係。
function meta(upper, lower) {
  return (upperC = {}, lowerC = {}) => {
    const u = upper(upperC);
    if (u._contradiction) return u;
    return lower({ ...u, ...lowerC });
  };
}
// [/ai_s_emblem: Compose-Core]

// [ai_s_emblem:#high#logic Lazy-Core]
// 世界爆発対策。Cartesian積をジェネレータで遅延生成し、_takeで早期終了する。
// 使い分け: 軸の総積が ~10万 を超える / _take:1 で「存在確認」するとき → lazy。
// 小規模ドメイン(< 1万) は Eager の方が読みやすく速い。

function* lazyCartesian(axisMap) {
  const entries = Object.entries(axisMap);
  function* gen(i, curr) {
    if (i === entries.length) { yield { ...curr }; return; }
    const [key, vals] = entries[i];
    for (const v of vals) {
      curr[key] = v;
      yield* gen(i + 1, curr);
    }
  }
  yield* gen(0, {});
}

function filterLazy(genFn, derive, constraints, opts = {}) {
  // _take: metadata key (skipped as filter field). Sets early-exit limit — stop after N matches.
  const take = (constraints._take != null) ? constraints._take : (opts.take || Infinity);
  const results = [];
  for (const base of genFn()) {
    const world = derive ? { ...base, ...derive(base) } : base;
    let match = true;
    for (const [k, v] of Object.entries(constraints)) {
      if (k.startsWith('_')) continue;
      if (world[k] !== v) { match = false; break; }
    }
    if (match) {
      results.push(world);
      if (results.length >= take) break;
    }
  }
  return results;
}
// [/ai_s_emblem: Lazy-Core]

// [ai_s_emblem:#high#logic Hitbox-Collision]
// デモ1: 攻撃者位置 × 防御者位置 × フレーム の可能世界から、
// 「攻撃判定が出ているフレーム × 距離が射程内」の世界だけ残す。
// 順引き: 状態 → ヒット判定。逆引き: hit:true → 全ての当たる構成。
function hitbox(constraints = {}) {
  const ATTACK_FRAMES = [3, 4, 5];
  const RANGE = 15;
  const POS = [0, 10, 20, 30, 40];
  const FR = [1, 2, 3, 4, 5, 6, 7];

  const allWorlds = [];
  for (const ax of POS) {
    for (const dx of POS) {
      for (const f of FR) {
        const attacking = ATTACK_FRAMES.includes(f);
        const distance = Math.abs(ax - dx);
        const inRange = distance <= RANGE;
        const hit = attacking && inRange;
        allWorlds.push({ attacker: ax, defender: dx, frame: f, attacking, distance, inRange, hit });
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Hitbox: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Hitbox-Collision]

// [ai_s_emblem:#high#logic Hitbox-Lazy]
// デモ1の遅延版。同一ロジック・同一制約インターフェース。
// _take:N で N件見つかり次第ストップ。_take:1 で「この状態は hit可能か?」を O(1) に近い速度で確認。
// 逆引き { hit: true, _take: 1 } → 最初のヒット世界だけ返す（全175世界を走査しない）。
function hitboxLazy(constraints = {}) {
  const ATTACK_FRAMES = [3, 4, 5];
  const RANGE = 15;

  const worlds = filterLazy(
    () => lazyCartesian({
      attacker: [0, 10, 20, 30, 40],
      defender: [0, 10, 20, 30, 40],
      frame:    [1, 2, 3, 4, 5, 6, 7]
    }),
    ({ attacker, defender, frame }) => {
      const attacking = ATTACK_FRAMES.includes(frame);
      const distance  = Math.abs(attacker - defender);
      const inRange   = distance <= RANGE;
      return { attacking, distance, inRange, hit: attacking && inRange };
    },
    constraints
  );

  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Hitbox-Lazy: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds, _lazy: true };
}
// [/ai_s_emblem: Hitbox-Lazy]

// [ai_s_emblem:#high#logic Invincibility]
// デモ2: フレーム × 攻撃の有無 × 無敵の有無 から damage = attack ∧ ¬invincible。
// 「無敵中は当たらない」を if 文ゼロで表現。
function invincibility(constraints = {}) {
  const FR = [1, 2, 3, 4, 5, 6, 7, 8];
  const allWorlds = [];
  for (const f of FR) {
    for (const attack of [true, false]) {
      for (const inv of [true, false]) {
        allWorlds.push({ frame: f, attack, invincible: inv, damage: attack && !inv });
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Invincibility: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Invincibility]

// [ai_s_emblem:#high#logic Frame-Advantage]
// デモ3: 発生×持続×硬直×ガード硬直 → advantage = block - (active+recovery)。
// 逆引き: advantage:3 → +3になる全フレームデータの組み合わせ。
function frameAdvantage(constraints = {}) {
  const allWorlds = [];
  for (let startup = 5; startup <= 12; startup++) {
    for (let active = 2; active <= 5; active++) {
      for (let recovery = 8; recovery <= 18; recovery++) {
        for (let block = 10; block <= 24; block++) {
          const total = startup + active + recovery;
          const advantage = block - (active + recovery);
          allWorlds.push({ startup, active, recovery, block, total, advantage });
        }
      }
    }
  }
  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Frame-Adv: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Frame-Advantage]

// [ai_s_emblem:#high#logic Input-Buffer]
// デモ4: 入力履歴(直近6F) × 現在状態 から成立コマンドを判定。
// パターン: 波動拳 = D→DF→F→P / 昇龍拳 = F→D→DF→P
// 履歴に部分列として現れるかをチェック（ゆるめ受付）。
function inputBuffer(constraints = {}) {
  // 昇龍拳を先に判定（より複雑な技を優先）
  const PATTERNS = {
    shoryuken: ['F', 'D', 'DF', 'P'],
    hadoken: ['D', 'DF', 'F', 'P']
  };
  const HISTORIES = [
    ['N', 'N', 'D', 'DF', 'F', 'P'],
    ['F', 'N', 'D', 'DF', 'F', 'P'],
    ['F', 'D', 'DF', 'P', 'N', 'N'],
    ['N', 'N', 'N', 'N', 'N', 'P'],
    ['D', 'DF', 'F', 'P', 'N', 'N']
  ];
  const STATES = ['ground', 'air', 'stun'];

  const allWorlds = [];
  for (const h of HISTORIES) {
    for (const state of STATES) {
      let matched = 'none';
      for (const [name, pat] of Object.entries(PATTERNS)) {
        let i = pat.length - 1;
        for (let j = h.length - 1; j >= 0 && i >= 0; j--) {
          if (h[j] === pat[i]) i--;
        }
        if (i < 0) { matched = name; break; }
      }
      const command = (state === 'ground' && matched !== 'none') ? matched : 'idle';
      allWorlds.push({ history: h.join(','), state, matched, command });
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Input-Buffer: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Input-Buffer]

// [ai_s_emblem:#high#logic Cancel-Chain]
// デモ5: 技A → キャンセル可能窓内 → 技B の連鎖判定。
// timing が cancelWindow に入っていて、かつ moveA がキャンセル可なら valid。
// 多段直列の典型。逆引きで「HADへ繋がる入口」が出る。
function cancelChain(constraints = {}) {
  const MOVES = {
    LP: { cancelable: true, cancelWindow: [3, 4] },
    MP: { cancelable: true, cancelWindow: [5, 7] },
    HP: { cancelable: false, cancelWindow: [] },
    HAD: { cancelable: false, cancelWindow: [] }
  };
  const NAMES = Object.keys(MOVES);

  const allWorlds = [];
  for (const a of NAMES) {
    for (const b of NAMES) {
      for (let timing = 1; timing <= 12; timing++) {
        const moveA = MOVES[a];
        const inWindow = moveA.cancelable &&
          timing >= moveA.cancelWindow[0] &&
          timing <= moveA.cancelWindow[1];
        const valid = inWindow && a !== b;
        allWorlds.push({ moveA: a, moveB: b, timing, valid });
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Cancel-Chain: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Cancel-Chain]

// [ai_s_emblem:#high#logic State-Machine]
// デモ6: ジャンプ × 攻撃 × 無敵 の同時並行状態を直積で生成。
// 跨ぎ制約: 「空中で攻撃中なら二段ジャンプ不可」「無敵中は被弾無効」。
// 従来 if のネスト爆発が発生する場所を畳み込む。
function stateMachine(constraints = {}) {
  const jumpStates = [
    { jump: 'grounded', baseDouble: false },
    { jump: 'jumping', baseDouble: true },
    { jump: 'doubleJumping', baseDouble: false },
    { jump: 'falling', baseDouble: false }
  ];
  const attackStates = [
    { attack: 'idle' },
    { attack: 'startup' },
    { attack: 'active' },
    { attack: 'recovery' }
  ];
  const invStates = [
    { invincible: true },
    { invincible: false }
  ];

  const allWorlds = [];
  for (const j of jumpStates) {
    for (const a of attackStates) {
      for (const i of invStates) {
        const airAttacking = (j.jump !== 'grounded') && (a.attack === 'active');
        const w = {
          jump: j.jump,
          attack: a.attack,
          invincible: i.invincible,
          canDoubleJump: j.baseDouble && !airAttacking,
          takesDamage: !i.invincible
        };
        allWorlds.push(w);
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `State-Machine: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: State-Machine]

// [ai_s_emblem:#high#logic Action-Tick]
// デモ7（山場）: 1フレームの全判定。
// 入力 × 自状態 × 敵状態 × 距離 → 次状態 と 被弾フラグ。
// アクションゲームの主要バグ（同時並行状態の不整合）はここで構造的に消える。
function actionTick(constraints = {}) {
  const inputs = ['none', 'attack', 'jump', 'guard'];
  const myStates = ['idle', 'attacking', 'jumping', 'guarding'];
  const enemyStates = ['idle', 'attacking'];
  const distances = ['close', 'mid', 'far'];

  const allWorlds = [];
  for (const inp of inputs) {
    for (const my of myStates) {
      for (const en of enemyStates) {
        for (const d of distances) {
          const canAct = my === 'idle';
          const intentNext =
            !canAct ? my :
            inp === 'attack' ? 'attacking' :
            inp === 'jump' ? 'jumping' :
            inp === 'guard' ? 'guarding' :
            'idle';
          const enemyHits = en === 'attacking' && d === 'close' && intentNext !== 'guarding';
          allWorlds.push({
            input: inp, myState: my, enemyState: en, distance: d,
            nextState: enemyHits ? 'hitstun' : intentNext,
            tookDamage: enemyHits
          });
        }
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Action-Tick: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Action-Tick]

// [ai_s_emblem:#high#logic Enemy-AI]
// デモ8（meta）: 階層制約。上位（戦略）が下位（行動選択）の探索空間を縮小。
// hp_low → defensive → ['guard','retreat'] のみ許可。
function enemyAI(constraints = {}) {
  const STRATEGIES = {
    aggressive: ['attack', 'rush', 'combo'],
    balanced: ['attack', 'guard', 'retreat'],
    defensive: ['guard', 'retreat']
  };

  const allWorlds = [];
  for (const hp of ['high', 'mid', 'low']) {
    for (const dist of ['close', 'mid', 'far']) {
      const strategy = hp === 'low' ? 'defensive' : hp === 'mid' ? 'balanced' : 'aggressive';
      const allowed = STRATEGIES[strategy];
      for (const action of allowed) {
        const isOffense = action === 'attack' || action === 'rush' || action === 'combo';
        const distOK = isOffense ? dist !== 'far' : true;
        if (!distOK) continue;
        allWorlds.push({ hp, distance: dist, strategy, action });
      }
    }
  }

  let worlds = allWorlds;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) {
    return { _contradiction: true, _message: `Enemy-AI: no world for ${JSON.stringify(constraints)}` };
  }
  return { _worlds: worlds.length, _worlds_raw: worlds };
}
// [/ai_s_emblem: Enemy-AI]

// [ai_s_emblem:#high#logic Combo-Finder]
// デモ9: cancel-chain を反復適用してコンボルートを全列挙。
// {starter, ender} で始点と終点を指定すると、中間ルートが全部出る。
// pipe を再帰的に使った形。
function comboFinder(constraints = {}) {
  const MOVES = {
    LP: { cancelTo: ['MP', 'HP', 'HAD'] },
    MP: { cancelTo: ['HP', 'HAD'] },
    HP: { cancelTo: ['HAD'] },
    HAD: { cancelTo: [] }
  };

  const starter = constraints.starter;
  const ender = constraints.ender;
  const maxDepth = constraints.maxDepth || 5;

  const routes = [];
  function dfs(path, depth) {
    const last = path[path.length - 1];
    if (path.length > 1 && last === ender) {
      routes.push([...path]);
      return;
    }
    if (depth >= maxDepth) return;
    const move = MOVES[last];
    if (!move) return;
    for (const next of move.cancelTo) {
      path.push(next);
      dfs(path, depth + 1);
      path.pop();
    }
  }

  if (starter && ender) {
    dfs([starter], 0);
  } else {
    for (const start of Object.keys(MOVES)) {
      dfs([start], 0);
    }
  }

  if (routes.length === 0) {
    return { _contradiction: true, _message: `Combo-Finder: no route from ${starter} to ${ender}` };
  }
  return {
    _worlds: routes.length,
    _worlds_raw: routes.map(r => ({ route: r.join(' → '), length: r.length }))
  };
}
// [/ai_s_emblem: Combo-Finder]

// [ai_s_emblem:#mid#draw Demo-Runner]
// 各デモを順次実行。Forward(状態→結果)とReverse(結果→状態)の両方を見せる。
function runDemos() {
  const line = (s) => console.log(`\n${'='.repeat(64)}\n${s}\n${'='.repeat(64)}`);
  const sub = (s) => console.log(`\n--- ${s} ---`);
  const show = (label, q, fn) => {
    sub(label);
    console.log(`query: ${JSON.stringify(q)}`);
    const r = fn(q);
    if (r._contradiction) {
      console.log(`→ CONTRADICTION: ${r._message}`);
    } else {
      console.log(`→ ${r._worlds} world(s)`);
      const sample = (r._worlds_raw || []).slice(0, 5);
      for (const w of sample) console.log(`  ${JSON.stringify(w)}`);
      if (r._worlds > 5) console.log(`  ... (+${r._worlds - 5} more)`);
    }
  };

  line('Demo 1: Hitbox Collision');
  show('Forward: 距離10で攻撃判定中(F4)→ヒット?', { attacker: 0, defender: 10, frame: 4 }, hitbox);
  show('Reverse: 全ヒット世界', { hit: true }, hitbox);
  show('Contradiction: 距離40で当たる?', { distance: 40, hit: true }, hitbox);

  line('Demo 2: Invincibility');
  show('Forward: 攻撃あり×無敵あり', { attack: true, invincible: true }, invincibility);
  show('Reverse: ダメージ受けた世界', { damage: true }, invincibility);

  line('Demo 3: Frame Advantage');
  show('Forward: 発生5/持続3/硬直10/ガード硬直16', { startup: 5, active: 3, recovery: 10, block: 16 }, frameAdvantage);
  show('Reverse: 有利+3になる構成数', { advantage: 3 }, frameAdvantage);

  line('Demo 4: Input Buffer');
  show('Forward: 履歴D,DF,F,Pで地上', { history: 'D,DF,F,P,N,N', state: 'ground' }, inputBuffer);
  show('Reverse: 波動拳が成立する状況', { command: 'hadoken' }, inputBuffer);

  line('Demo 5: Cancel Chain');
  show('Forward: LP→MP timing4でキャンセル可?', { moveA: 'LP', moveB: 'MP', timing: 4 }, cancelChain);
  show('Reverse: HADへ繋がる入口', { moveB: 'HAD', valid: true }, cancelChain);

  line('Demo 6: State Machine (Join)');
  show('Forward: 空中攻撃中', { jump: 'jumping', attack: 'active' }, stateMachine);
  show('Reverse: 二段ジャンプ可能な状況', { canDoubleJump: true }, stateMachine);

  line('Demo 7: Action Tick (山場)');
  show('Forward: idle×attack入力×敵idle×close', { input: 'attack', myState: 'idle', enemyState: 'idle', distance: 'close' }, actionTick);
  show('Reverse: 被弾する全状況', { tookDamage: true }, actionTick);

  line('Demo 8: Enemy AI (Meta)');
  show('Forward: HP低×近距離', { hp: 'low', distance: 'close' }, enemyAI);
  show('Reverse: attackを選ぶ条件', { action: 'attack' }, enemyAI);

  line('Demo 9: Combo Finder');
  show('LP始動→HAD終わり', { starter: 'LP', ender: 'HAD' }, comboFinder);
  show('MP始動→HAD終わり', { starter: 'MP', ender: 'HAD' }, comboFinder);

  line('Lazy Demo: Hitbox-Lazy vs Hitbox (世界爆発対策)');
  show('Lazy: 全ヒット世界 (遅延生成)', { hit: true }, hitboxLazy);
  show('Lazy: _take:1 で最初の1件だけ', { hit: true, _take: 1 }, hitboxLazy);
  show('Lazy: 矛盾 (距離40でヒット?)', { distance: 40, hit: true }, hitboxLazy);
  show('Eager: 同等クエリ (比較用)', { hit: true }, hitbox);

  line('All demos completed.');
}

if (typeof window === 'undefined') runDemos();
// [/ai_s_emblem: Demo-Runner]
