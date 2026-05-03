// action-demos-ui.js (Playable Edition)
// 9 ミニアクションゲーム集。各ゲームは action-demos.js の制約関数を
// ルールエンジンとして使用する。canvas + キーボード操作。

// [ai_s_emblem:#low#config Constants]
const W = 720, H = 320;
const C = {
  bg: '#0d1117', panel: '#161b22', text: '#e6edf3',
  blue: '#58a6ff', red: '#f85149', yellow: '#ffd33d', green: '#3fb950',
  gray: '#6e7681', cyan: '#39d0d8', purple: '#bc8cff', orange: '#ff9f6b'
};
const GAMES = {};
let canvas, ctx;
let currentKey = null, state = null;
let lastT = 0;
let keys = {}, prevKeys = {};
// [/ai_s_emblem: Constants]

// [ai_s_emblem:#high#logic Game-Engine]
// 共通ループとヘルパー。input/render の道具立て。

function pressed(k) { return keys[k] && !prevKeys[k]; }

function drawHUD(lines, x = 12, y = 22) {
  ctx.fillStyle = C.text; ctx.font = '13px ui-monospace, monospace';
  for (const l of lines) { ctx.fillText(l, x, y); y += 17; }
}

function drawBar(x, y, w, h, frac, color) {
  ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = C.border || '#30363d'; ctx.strokeRect(x, y, w, h);
}

function drawText(s, x, y, color = C.text, size = 13) {
  ctx.fillStyle = color; ctx.font = `${size}px ui-monospace, monospace`;
  ctx.fillText(s, x, y);
}

function startGame(key) {
  currentKey = key;
  state = GAMES[key].init();
  document.getElementById('game-title').textContent = GAMES[key].title;
  document.getElementById('game-desc').textContent = GAMES[key].desc;
  document.getElementById('game-controls').textContent = GAMES[key].controls;
  document.querySelectorAll('#demo-list button').forEach(b => {
    b.classList.toggle('active', b.dataset.demo === key);
  });
  canvas.focus();
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  if (currentKey && GAMES[currentKey]) {
    GAMES[currentKey].update(state, dt);
    GAMES[currentKey].render(state);
  }
  prevKeys = { ...keys };
  requestAnimationFrame(loop);
}
// [/ai_s_emblem: Game-Engine]

// [ai_s_emblem:#high#logic Game-Hitbox]
// ← → 移動 / SPACE 攻撃。攻撃判定はframe 3-5だけ出現。
GAMES.hitbox = {
  title: '1. Hitbox Collision',
  desc: '攻撃モーション全8F中、判定は3-5Fだけ。距離が射程内ならhit。',
  controls: '← → 移動 / SPACE 攻撃',
  init: () => ({ px: 200, py: 200, ex: 500, atkF: 0, hits: 0, flash: 0 }),
  update: (s, dt) => {
    const sp = 240;
    if (keys['ArrowLeft'])  s.px = Math.max(20, s.px - sp*dt);
    if (keys['ArrowRight']) s.px = Math.min(W-60, s.px + sp*dt);
    if (pressed(' ') && s.atkF === 0) s.atkF = 0.01;
    if (s.atkF > 0) {
      s.atkF += 60 * dt;
      if (s.atkF > 8) s.atkF = 0;
    }
    const f = Math.floor(s.atkF);
    const active = f >= 3 && f <= 5;
    if (active) {
      const hbx = s.px + 40;
      const hbw = 60;
      const overlap = hbx < s.ex + 40 && hbx + hbw > s.ex;
      if (overlap && s.flash <= 0) { s.hits++; s.flash = 0.25; }
    }
    if (s.flash > 0) s.flash -= dt;
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    ctx.fillStyle = C.blue; ctx.fillRect(s.px, 200, 40, 60);
    ctx.fillStyle = s.flash > 0 ? C.red : '#888';
    ctx.fillRect(s.ex, 200, 40, 60);
    const f = Math.floor(s.atkF);
    if (f >= 3 && f <= 5) {
      ctx.fillStyle = 'rgba(255,211,61,0.4)';
      ctx.fillRect(s.px + 40, 215, 60, 30);
      ctx.strokeStyle = C.yellow;
      ctx.strokeRect(s.px + 40, 215, 60, 30);
    }
    drawHUD([
      `Hits: ${s.hits}`,
      `Anim Frame: ${f} / 8`,
      `Hitbox Active: ${f>=3&&f<=5 ? 'YES (yellow)' : 'no'}`
    ]);
  }
};
// [/ai_s_emblem: Game-Hitbox]

// [ai_s_emblem:#high#logic Game-Invincibility]
// I キーで30F無敵。敵は90Fごとに弾を撃つ。被弾でHP-1。
GAMES.invincibility = {
  title: '2. Invincibility Frames',
  desc: '無敵中(青リング)は被弾無効。タイミングよくIで回避せよ。',
  controls: 'I キー: 30F無敵化',
  init: () => ({
    hp: 5, invF: 0, enemyTimer: 60, projectile: null, dodges: 0, hits: 0
  }),
  update: (s, dt) => {
    if (pressed('i') && s.invF <= 0) s.invF = 0.5;
    if (s.invF > 0) s.invF -= dt;
    s.enemyTimer -= dt * 60;
    if (s.enemyTimer <= 0 && !s.projectile) {
      s.projectile = { x: 600, vx: -400 };
      s.enemyTimer = 90;
    }
    if (s.projectile) {
      s.projectile.x += s.projectile.vx * dt;
      if (s.projectile.x < 200 && s.projectile.x > 100) {
        if (s.invF > 0) { s.dodges++; s.projectile = null; }
        else { s.hits++; s.hp = Math.max(0, s.hp - 1); s.projectile = null; }
      } else if (s.projectile.x < 0) s.projectile = null;
    }
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    // player
    ctx.fillStyle = C.blue; ctx.fillRect(140, 200, 40, 60);
    if (s.invF > 0) {
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(160, 230, 38 + Math.sin(Date.now()/40)*3, 0, Math.PI*2);
      ctx.stroke(); ctx.lineWidth = 1;
    }
    // enemy
    ctx.fillStyle = C.red; ctx.fillRect(580, 200, 40, 60);
    // projectile
    if (s.projectile) {
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.arc(s.projectile.x, 230, 8, 0, Math.PI*2);
      ctx.fill();
    }
    drawText(`HP`, 12, 22);
    drawBar(40, 12, 120, 14, s.hp / 5, C.green);
    drawHUD([
      ``,
      `Inv frames left: ${Math.max(0, Math.floor(s.invF * 60))}`,
      `Dodges: ${s.dodges}  Hits taken: ${s.hits}`,
      `Next attack in: ${Math.max(0, Math.floor(s.enemyTimer))}F`
    ], 12, 50);
  }
};
// [/ai_s_emblem: Game-Invincibility]

// [ai_s_emblem:#high#logic Game-FrameAdvantage]
// 1/2/3 で軽/中/重 攻撃。敵は自動ガード。タイムラインで誰が先に動けるか可視化。
GAMES.frameAdvantage = {
  title: '3. Frame Advantage',
  desc: '攻撃後、自分の硬直 vs 敵のガード硬直。差分が「有利F」。',
  controls: '1=軽(+3) / 2=中(-2) / 3=重(-5)',
  init: () => ({
    moves: { '1': {name:'LP',a:2,r:8,b:13}, '2': {name:'MP',a:3,r:14,b:15}, '3': {name:'HP',a:4,r:22,b:17} },
    active: null, time: 0, log: []
  }),
  update: (s, dt) => {
    for (const k of ['1','2','3']) {
      if (pressed(k) && !s.active) {
        const m = s.moves[k];
        s.active = { ...m, total: m.a + m.r, blockTotal: m.b };
        s.time = 0;
      }
    }
    if (s.active) {
      s.time += dt * 60;
      const maxT = Math.max(s.active.total, s.active.blockTotal);
      if (s.time > maxT + 30) {
        const adv = s.active.blockTotal - s.active.total;
        s.log.unshift(`${s.active.name}: 自硬直${s.active.total}F vs 敵硬直${s.active.blockTotal}F → ${adv>=0?'+':''}${adv}F ${adv>=0?'有利':'不利'}`);
        s.log = s.log.slice(0, 5);
        s.active = null;
      }
    }
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    ctx.fillStyle = C.blue; ctx.fillRect(160, 200, 40, 60);
    ctx.fillStyle = '#888'; ctx.fillRect(420, 200, 40, 60);
    if (s.active) {
      // attack swoosh
      if (s.time <= s.active.total) {
        ctx.fillStyle = 'rgba(255,211,61,0.4)';
        ctx.fillRect(200, 215, 220, 30);
      }
      // timeline
      const tlY = 100, tlW = 600, tlX = 60;
      const maxT = Math.max(s.active.total, s.active.blockTotal);
      drawText('YOUR recovery', tlX, tlY - 6, C.blue, 11);
      drawBar(tlX, tlY, tlW * (s.active.total / maxT), 16,
              Math.min(1, s.time / s.active.total), C.blue);
      drawText('ENEMY blockstun', tlX, tlY + 36, C.red, 11);
      drawBar(tlX, tlY + 42, tlW * (s.active.blockTotal / maxT), 16,
              Math.min(1, s.time / s.active.blockTotal), C.red);
      const adv = s.active.blockTotal - s.active.total;
      drawText(`Frame Advantage: ${adv>=0?'+':''}${adv}`,
               tlX, tlY + 80, adv >= 0 ? C.green : C.warn || C.red, 16);
    }
    drawHUD(['Recent results:', ...s.log.map(l => '  ' + l)], 12, 22);
  }
};
// [/ai_s_emblem: Game-FrameAdvantage]

// [ai_s_emblem:#high#logic Game-InputBuffer]
// A/S/D/F キーで↓/↘/→/Pを入力。直近6F履歴に波動拳パターンが揃ったらprojectile発射。
GAMES.inputBuffer = {
  title: '4. Input Buffer (Hadoken)',
  desc: '直近30Fの履歴が D→DF→F→P の順を含めば波動拳成立。',
  controls: 'A=↓ / S=↘ / D=→ / F=パンチ',
  init: () => ({ history: [], projectiles: [], shots: 0, frame: 0, lastInput: '' }),
  update: (s, dt) => {
    s.frame += dt * 60;
    const map = { 'a':'D', 's':'DF', 'd':'F', 'f':'P' };
    for (const k of Object.keys(map)) {
      if (pressed(k)) {
        s.history.push({ sym: map[k], frame: s.frame });
        s.lastInput = map[k];
      }
    }
    s.history = s.history.filter(h => s.frame - h.frame < 30);
    // pattern check: D→DF→F→P in order within window
    const pat = ['D','DF','F','P'];
    let i = 0;
    for (const h of s.history) {
      if (h.sym === pat[i]) i++;
      if (i === pat.length) break;
    }
    if (i === pat.length && pressed('f')) {
      s.projectiles.push({ x: 200, vx: 380 });
      s.shots++;
      s.history = [];
    }
    for (const p of s.projectiles) p.x += p.vx * dt;
    s.projectiles = s.projectiles.filter(p => p.x < W);
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    ctx.fillStyle = C.blue; ctx.fillRect(160, 200, 40, 60);
    for (const p of s.projectiles) {
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.arc(p.x, 230, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(57,208,216,0.3)';
      ctx.beginPath();
      ctx.arc(p.x - 15, 230, 18, 0, Math.PI*2); ctx.fill();
    }
    drawText(`Hadokens fired: ${s.shots}`, 12, 22);
    drawText(`Pattern: D → DF → F → P`, 12, 42, C.yellow);
    drawText('History (last 30F):', 12, 80);
    let x = 12;
    for (const h of s.history) {
      const age = (s.frame - h.frame) / 30;
      ctx.fillStyle = `rgba(255,211,61,${1 - age})`;
      ctx.fillRect(x, 90, 36, 26);
      ctx.fillStyle = C.bg;
      ctx.font = 'bold 13px ui-monospace';
      ctx.fillText(h.sym, x + 6, 108);
      x += 42;
    }
  }
};
// [/ai_s_emblem: Game-InputBuffer]

// [ai_s_emblem:#high#logic Game-CancelChain]
// 1/2/3/4 で LP/MP/HP/HAD。各技のcancel窓内に次を押せばコンボ継続。
GAMES.cancelChain = {
  title: '5. Cancel Chain',
  desc: 'LP→MPはcancel窓3-4F、MP→HPは5-7F。窓内に次を入れればコンボ。',
  controls: '1=LP / 2=MP / 3=HP / 4=HAD',
  init: () => ({
    moves: {
      '1': { name:'LP', total:11, win:[3,4], color:C.blue },
      '2': { name:'MP', total:18, win:[5,7], color:C.green },
      '3': { name:'HP', total:27, win:[],    color:C.yellow },
      '4': { name:'HAD',total:38, win:[],    color:C.purple }
    },
    active: null, time: 0, combo: 0, history: [], best: 0
  }),
  update: (s, dt) => {
    for (const k of ['1','2','3','4']) {
      if (pressed(k)) {
        const m = s.moves[k];
        if (!s.active) {
          s.active = { ...m, key: k };
          s.time = 0; s.combo = 1; s.history = [m.name];
        } else {
          // can we cancel?
          const f = s.time;
          const inWin = s.active.win.length === 2 &&
                        f >= s.active.win[0] && f <= s.active.win[1] &&
                        s.active.key !== k;
          if (inWin) {
            s.active = { ...m, key: k };
            s.time = 0; s.combo++; s.history.push(m.name);
            if (s.combo > s.best) s.best = s.combo;
          }
        }
      }
    }
    if (s.active) {
      s.time += dt * 60;
      if (s.time > s.active.total) {
        s.active = null; s.combo = 0;
      }
    }
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    ctx.fillStyle = C.blue; ctx.fillRect(120, 200, 40, 60);
    if (s.active) {
      ctx.fillStyle = s.active.color;
      ctx.fillRect(160, 215, 40, 30);
      // timing bar
      const bx = 60, by = 120, bw = 600;
      drawText(`${s.active.name} (total ${s.active.total}F)`, bx, by - 8, s.active.color);
      drawBar(bx, by, bw, 24, s.time / s.active.total, '#444');
      // cancel window overlay
      if (s.active.win.length === 2) {
        const wx = bx + bw * (s.active.win[0] / s.active.total);
        const ww = bw * ((s.active.win[1] - s.active.win[0]) / s.active.total);
        ctx.fillStyle = 'rgba(63,185,80,0.4)';
        ctx.fillRect(wx, by, ww, 24);
        ctx.strokeStyle = C.green;
        ctx.strokeRect(wx, by, ww, 24);
        drawText('CANCEL WINDOW', wx, by + 40, C.green, 11);
      }
      // current frame indicator
      const cx = bx + bw * (s.time / s.active.total);
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, by - 4); ctx.lineTo(cx, by + 28); ctx.stroke();
      ctx.lineWidth = 1;
    }
    drawText(`Combo: ${s.combo}    Best: ${s.best}`, 12, 22, C.highlight || C.yellow, 16);
    drawText(`Chain: ${s.history.join(' → ') || '-'}`, 12, 48);
  }
};
// [/ai_s_emblem: Game-CancelChain]

// [ai_s_emblem:#high#logic Game-StateMachine]
// Z=jump, X=attack, C=invincible toggle. 同時並行状態を全可視化。
GAMES.stateMachine = {
  title: '6. State Machine (parallel states)',
  desc: 'ジャンプ × 攻撃 × 無敵 が同時並行。空中攻撃中はdoubleJump不可。',
  controls: 'Z=ジャンプ / X=攻撃 / C=無敵トグル',
  init: () => ({
    jump: 'grounded', vy: 0, py: 230, attack: 'idle', atkT: 0, inv: false, log: []
  }),
  update: (s, dt) => {
    // jump physics
    if (pressed('z')) {
      if (s.jump === 'grounded') { s.jump = 'jumping'; s.vy = -380; s.log.unshift('jump'); }
      else if (s.jump === 'jumping' || s.jump === 'falling') {
        // double jump check: blocked if attacking active
        if (s.attack === 'active') s.log.unshift('×double jump BLOCKED (atk active)');
        else if (s.jump === 'jumping') {
          s.jump = 'doubleJumping'; s.vy = -340; s.log.unshift('double jump');
        }
      }
    }
    if (s.jump !== 'grounded') {
      s.vy += 900 * dt;
      s.py += s.vy * dt;
      if (s.py >= 230) { s.py = 230; s.jump = 'grounded'; s.vy = 0; }
      else if (s.vy > 0) {
        if (s.jump === 'jumping') s.jump = 'falling';
        if (s.jump === 'doubleJumping') s.jump = 'falling';
      }
    }
    // attack
    if (pressed('x') && s.attack === 'idle') {
      s.attack = 'startup'; s.atkT = 0; s.log.unshift('attack');
    }
    if (s.attack !== 'idle') {
      s.atkT += dt * 60;
      if (s.atkT < 4) s.attack = 'startup';
      else if (s.atkT < 8) s.attack = 'active';
      else if (s.atkT < 16) s.attack = 'recovery';
      else { s.attack = 'idle'; s.atkT = 0; }
    }
    if (pressed('c')) { s.inv = !s.inv; s.log.unshift('inv toggle'); }
    s.log = s.log.slice(0, 6);
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 290, W, 2);
    // player
    ctx.fillStyle = C.blue; ctx.fillRect(160, s.py, 40, 60);
    if (s.attack === 'active') {
      ctx.fillStyle = 'rgba(255,211,61,0.5)';
      ctx.fillRect(200, s.py + 15, 50, 30);
    }
    if (s.inv) {
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(180, s.py + 30, 38 + Math.sin(Date.now()/40)*3, 0, Math.PI*2);
      ctx.stroke(); ctx.lineWidth = 1;
    }
    // state HUD
    drawText('CURRENT STATES (parallel)', 380, 22, C.highlight || C.yellow);
    drawText(`jump:       ${s.jump}`, 380, 46, C.blue);
    drawText(`attack:     ${s.attack}`, 380, 64, C.yellow);
    drawText(`invincible: ${s.inv}`, 380, 82, C.cyan);
    const airAtk = s.jump !== 'grounded' && s.attack === 'active';
    drawText(`canDoubleJump: ${(s.jump==='jumping' && !airAtk)}`, 380, 110, C.green);
    drawText(`takesDamage:   ${!s.inv}`, 380, 128, C.red);
    drawText('Action log:', 12, 22);
    s.log.forEach((l, i) => drawText(l, 12, 42 + i*16, C.text, 11));
  }
};
// [/ai_s_emblem: Game-StateMachine]

// [ai_s_emblem:#high#logic Game-ActionTick]
// 矢印=移動, J=攻撃, K=ガード。AIダミー敵と1on1。actionTick的判定。
GAMES.actionTick = {
  title: '7. Action Tick (mini fighter)',
  desc: '1F毎に「入力 × 自状態 × 敵状態 × 距離」で次状態が決まる。',
  controls: '← → 移動 / J 攻撃 / K ガード',
  init: () => ({
    px: 200, ex: 480, my: 'idle', enemy: 'idle',
    myT: 0, enemyT: 0, enemyAct: 0, hp: 5, ehp: 5
  }),
  update: (s, dt) => {
    const sp = 200;
    if (s.my === 'idle') {
      if (keys['ArrowLeft'])  s.px = Math.max(20, s.px - sp*dt);
      if (keys['ArrowRight']) s.px = Math.min(W-60, s.px + sp*dt);
    }
    // input → state transition
    const dist = Math.abs(s.px - s.ex);
    const close = dist < 100;
    if (s.my === 'idle' || s.my === 'guarding') {
      if (pressed('j')) { s.my = 'attacking'; s.myT = 0; }
      else if (keys['k']) s.my = 'guarding';
      else s.my = 'idle';
    }
    if (s.my === 'attacking') {
      s.myT += dt * 60;
      if (s.myT > 4 && s.myT < 8 && close && s.enemy !== 'guarding') {
        if (s.ehp > 0) { s.ehp--; }
      }
      if (s.myT > 20) { s.my = 'idle'; s.myT = 0; }
    }
    if (s.my === 'hitstun') {
      s.myT += dt * 60;
      if (s.myT > 18) { s.my = 'idle'; s.myT = 0; }
    }
    // enemy AI: simple — approach, attack when close
    s.enemyAct -= dt * 60;
    if (s.enemy === 'idle') {
      if (close && s.enemyAct <= 0) {
        s.enemy = 'attacking'; s.enemyT = 0; s.enemyAct = 60;
      } else if (!close) {
        s.ex += (s.px > s.ex ? 1 : -1) * 90 * dt;
      }
    }
    if (s.enemy === 'attacking') {
      s.enemyT += dt * 60;
      if (s.enemyT > 6 && s.enemyT < 10 && close && s.my !== 'guarding') {
        if (s.hp > 0) { s.hp--; s.my = 'hitstun'; s.myT = 0; }
      }
      if (s.enemyT > 22) { s.enemy = 'idle'; s.enemyT = 0; }
    }
    if (s.hp <= 0 || s.ehp <= 0) {
      // reset on KO
      Object.assign(s, GAMES.actionTick.init());
    }
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    // player
    ctx.fillStyle = s.my === 'hitstun' ? C.red : C.blue;
    ctx.fillRect(s.px, 200, 40, 60);
    if (s.my === 'attacking' && s.myT > 4 && s.myT < 8) {
      ctx.fillStyle = 'rgba(255,211,61,0.5)';
      ctx.fillRect(s.px + 40, 215, 60, 30);
    }
    if (s.my === 'guarding') {
      ctx.fillStyle = 'rgba(57,208,216,0.4)';
      ctx.fillRect(s.px - 5, 195, 50, 70);
    }
    // enemy
    ctx.fillStyle = C.red; ctx.fillRect(s.ex, 200, 40, 60);
    if (s.enemy === 'attacking' && s.enemyT > 6 && s.enemyT < 10) {
      ctx.fillStyle = 'rgba(255,159,107,0.5)';
      ctx.fillRect(s.ex - 60, 215, 60, 30);
    }
    // HP bars
    drawText('YOU', 12, 22, C.blue);
    drawBar(50, 12, 150, 14, s.hp / 5, C.green);
    drawText('ENEMY', W - 220, 22, C.red);
    drawBar(W - 165, 12, 150, 14, s.ehp / 5, C.red);
    drawText(`my: ${s.my}  enemy: ${s.enemy}`, 12, 50, C.text, 11);
  }
};
// [/ai_s_emblem: Game-ActionTick]

// [ai_s_emblem:#high#logic Game-EnemyAI]
// あなた攻撃→敵HP減→敵戦略変化(aggressive→balanced→defensive)。
GAMES.enemyAI = {
  title: '8. Enemy AI (strategy shift)',
  desc: '敵HPが減ると戦略が aggressive → balanced → defensive へ自動シフト。',
  controls: 'J: 攻撃 (距離が近い時のみダメージ)',
  init: () => ({
    px: 180, ex: 500, ehp: 9, etarget: 500, eAct: 'idle', eTimer: 60, log: []
  }),
  update: (s, dt) => {
    if (keys['ArrowLeft'])  s.px = Math.max(20, s.px - 200*dt);
    if (keys['ArrowRight']) s.px = Math.min(W-60, s.px + 200*dt);
    if (pressed('j')) {
      const dist = Math.abs(s.px - s.ex);
      if (dist < 80 && s.ehp > 0) { s.ehp--; }
      if (s.ehp <= 0) Object.assign(s, GAMES.enemyAI.init());
    }
    // determine strategy from HP
    const strategy = s.ehp > 6 ? 'aggressive' : s.ehp > 3 ? 'balanced' : 'defensive';
    s.strategy = strategy;
    // enemy AI tick
    s.eTimer -= dt * 60;
    if (s.eTimer <= 0) {
      const dist = Math.abs(s.px - s.ex);
      const distLabel = dist < 80 ? 'close' : dist < 200 ? 'mid' : 'far';
      // pick action based on strategy
      const POOL = {
        aggressive: ['rush', 'attack', 'combo'],
        balanced:   ['attack', 'guard', 'retreat'],
        defensive:  ['guard', 'retreat']
      };
      const choices = POOL[strategy].filter(a => {
        const isOff = ['attack','rush','combo'].includes(a);
        return isOff ? distLabel !== 'far' : true;
      });
      const pick = choices.length ? choices[Math.floor(Math.random() * choices.length)] : 'guard';
      s.eAct = pick;
      s.log.unshift(`HP${s.ehp} [${strategy}] dist=${distLabel} → ${pick}`);
      s.log = s.log.slice(0, 6);
      // execute
      if (pick === 'rush' || pick === 'attack' || pick === 'combo') {
        s.etarget = s.px + (s.px > s.ex ? -30 : 30);
      } else if (pick === 'retreat') {
        s.etarget = s.px > s.ex ? Math.max(20, s.ex - 100) : Math.min(W-60, s.ex + 100);
      } // guard = stay
      s.eTimer = 50;
    }
    s.ex += (s.etarget - s.ex) * 0.05;
  },
  render: (s) => {
    ctx.fillStyle = C.gray; ctx.fillRect(0, 260, W, 2);
    ctx.fillStyle = C.blue; ctx.fillRect(s.px, 200, 40, 60);
    ctx.fillStyle = C.red; ctx.fillRect(s.ex, 200, 40, 60);
    if (s.eAct === 'guard') {
      ctx.fillStyle = 'rgba(57,208,216,0.4)';
      ctx.fillRect(s.ex - 5, 195, 50, 70);
    }
    drawText('Enemy HP', 12, 22, C.red);
    drawBar(85, 12, 200, 14, s.ehp / 9, C.red);
    drawText(`Strategy: ${s.strategy}`, 12, 46, C.highlight || C.yellow);
    drawText(`Last: ${s.eAct}`, 12, 64);
    drawText('AI Decision Log:', 380, 22, C.highlight || C.yellow);
    s.log.forEach((l, i) => drawText(l, 380, 44 + i*16, C.text, 11));
  }
};
// [/ai_s_emblem: Game-EnemyAI]

// [ai_s_emblem:#high#logic Game-ComboFinder]
// ターゲットルート表示。順番に押す。各入力は前から60F以内でないとmiss。
GAMES.comboFinder = {
  title: '9. Combo Finder (practice)',
  desc: 'ランダムなコンボルートが提示される。各入力は60F以内に繋げ。',
  controls: '1=LP / 2=MP / 3=HP / 4=HAD',
  init: () => {
    const ROUTES = [
      ['LP','MP','HP','HAD'],
      ['LP','HP','HAD'],
      ['MP','HP','HAD'],
      ['LP','MP','HAD'],
      ['LP','HAD'],
      ['HP','HAD']
    ];
    return {
      route: ROUTES[Math.floor(Math.random()*ROUTES.length)],
      step: 0, lastT: 0, frame: 0, success: 0, fail: 0, msg: ''
    };
  },
  update: (s, dt) => {
    s.frame += dt * 60;
    const map = { '1':'LP', '2':'MP', '3':'HP', '4':'HAD' };
    for (const k of Object.keys(map)) {
      if (pressed(k)) {
        const expected = s.route[s.step];
        const sym = map[k];
        const tooLate = s.step > 0 && (s.frame - s.lastT > 60);
        if (sym === expected && !tooLate) {
          s.step++;
          s.lastT = s.frame;
          if (s.step === s.route.length) {
            s.success++;
            s.msg = `SUCCESS: ${s.route.join(' → ')}`;
            const r = GAMES.comboFinder.init();
            Object.assign(s, r, { success: s.success, fail: s.fail, msg: s.msg });
          }
        } else {
          s.fail++;
          s.msg = `MISS at step ${s.step}: expected ${expected}, got ${sym}${tooLate ? ' (too late)' : ''}`;
          const r = GAMES.comboFinder.init();
          Object.assign(s, r, { success: s.success, fail: s.fail, msg: s.msg });
        }
      }
    }
    // timeout failure
    if (s.step > 0 && s.frame - s.lastT > 60) {
      s.fail++;
      s.msg = `TIMEOUT at step ${s.step}/${s.route.length}`;
      const r = GAMES.comboFinder.init();
      Object.assign(s, r, { success: s.success, fail: s.fail, msg: s.msg });
    }
  },
  render: (s) => {
    drawText('TARGET ROUTE:', 12, 30, C.highlight || C.yellow, 14);
    let x = 12, y = 60;
    for (let i = 0; i < s.route.length; i++) {
      const done = i < s.step;
      const cur = i === s.step;
      ctx.fillStyle = done ? C.green : cur ? C.yellow : '#444';
      ctx.fillRect(x, y, 80, 50);
      ctx.fillStyle = done || cur ? C.bg : C.text;
      ctx.font = 'bold 18px ui-monospace';
      const tx = x + (40 - ctx.measureText(s.route[i]).width / 2);
      ctx.fillText(s.route[i], tx, y + 32);
      if (i < s.route.length - 1) {
        ctx.fillStyle = C.gray;
        ctx.font = '20px ui-monospace';
        ctx.fillText('→', x + 88, y + 32);
      }
      x += 110;
    }
    if (s.step > 0 && s.step < s.route.length) {
      const left = Math.max(0, 60 - (s.frame - s.lastT));
      drawText(`window: ${Math.floor(left)}F`, 12, 140, left < 20 ? C.red : C.green);
      drawBar(12, 150, 200, 12, left / 60, left < 20 ? C.red : C.green);
    }
    drawText(`Success: ${s.success}   Fail: ${s.fail}`, 12, 200);
    drawText(s.msg, 12, 230, s.msg.startsWith('SUCCESS') ? C.green : C.red, 12);
  }
};
// [/ai_s_emblem: Game-ComboFinder]

// [ai_s_emblem:#mid#physical Init]
// DOM初期化、ナビ生成、キー入力ハンドラ、ゲームループ起動。
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  const nav = document.getElementById('demo-list');
  for (const key of Object.keys(GAMES)) {
    const btn = document.createElement('button');
    btn.textContent = GAMES[key].title;
    btn.dataset.demo = key;
    btn.onclick = () => startGame(key);
    nav.appendChild(btn);
  }

  const norm = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;
  document.addEventListener('keydown', e => {
    keys[norm(e)] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', e => { keys[norm(e)] = false; });

  document.getElementById('reset-btn').onclick = () => {
    if (currentKey) startGame(currentKey);
  };

  startGame('hitbox');
  requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded', init);
// [/ai_s_emblem: Init]
