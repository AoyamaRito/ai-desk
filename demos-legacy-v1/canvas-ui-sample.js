// canvas-ui-sample.js
//
// 【Canvas 2D UI パターンサンプル】
// constraint-janken.js と同じ位置づけ。
// このファイルを読んで4層UIパターンを理解し、自分のゲームにインライン展開せよ。
// import も共有ヘルパーも不要。コードをそのままコピーして各自のゲームに適応させる。
//
// 操作: クリックでボタン押下 / ESCでポーズ / Dでダメージ / Sでスコア加算

// [ai_s_emblem:#config UIConfig]
const CANVAS_W = 640;
const CANVAS_H = 480;

// ボタン定義はデータ。描画・ヒットテストの両方がここを参照する
const BUTTONS = {
  title_start:    { x: 220, y: 260, w: 200, h: 50, label: 'START',  screen: 'title'    },
  pause_resume:   { x: 220, y: 200, w: 200, h: 50, label: 'RESUME', screen: 'pause'    },
  pause_quit:     { x: 220, y: 270, w: 200, h: 50, label: 'QUIT',   screen: 'pause'    },
  gameover_retry: { x: 220, y: 260, w: 200, h: 50, label: 'RETRY',  screen: 'gameover' },
  gameover_title: { x: 220, y: 330, w: 200, h: 50, label: 'TITLE',  screen: 'gameover' },
};

// 画面遷移を「データとして」宣言。if/else ゼロ
const SCREEN_TRANSITIONS = [
  { from: 'title',    input: 'start',  to: 'playing'  },
  { from: 'playing',  input: 'pause',  to: 'pause'    },
  { from: 'playing',  input: 'die',    to: 'gameover' },
  { from: 'pause',    input: 'resume', to: 'playing'  },
  { from: 'pause',    input: 'quit',   to: 'title'    },
  { from: 'gameover', input: 'retry',  to: 'playing'  },
  { from: 'gameover', input: 'quit',   to: 'title'    },
];
// [/ai_s_emblem: UIConfig]

// [ai_s_emblem:#high#logic ScreenReducer]
// 制約畳み込みで画面遷移を管理。全世界を列挙 → filterで絞る
function reduceScreen(constraints = {}) {
  let worlds = SCREEN_TRANSITIONS;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}

// L3 純粋 Reducer。副作用なし。DOM・乱数・Date に触れない
function applyCommand(state, cmd) {
  if (cmd.type === 'SCREEN') {
    const result = reduceScreen({ from: state.screen, input: cmd.input });
    if (result._contradiction) return state;
    const next = { ...state, screen: result._worlds_raw[0].to };
    if (cmd.input === 'start' || cmd.input === 'retry') {
      next.hp = 100;
      next.score = 0;
    }
    return next;
  }
  if (cmd.type === 'HOVER') {
    return { ...state, ui: { ...state.ui, hoveredId: cmd.id } };
  }
  if (cmd.type === 'DAMAGE') {
    const hp = Math.max(0, state.hp - cmd.amount);
    const next = { ...state, hp };
    if (hp === 0) return applyCommand(next, { type: 'SCREEN', input: 'die' });
    return next;
  }
  if (cmd.type === 'SCORE') {
    return { ...state, score: state.score + cmd.amount };
  }
  return state;
}
// [/ai_s_emblem: ScreenReducer]

// [ai_s_emblem:#mid#intent HitTest]
// L2 Intent: マウス座標 → ヒットテスト → Command JSON
// ここで副作用を完結させる。L3 には座標を渡さない
function intentMouseMove(state, mx, my) {
  const visible = Object.entries(BUTTONS).filter(([, btn]) => btn.screen === state.screen);
  const hit = visible.find(([, btn]) =>
    mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h
  );
  return { type: 'HOVER', id: hit ? hit[0] : null };
}

function intentClick(state, mx, my) {
  const visible = Object.entries(BUTTONS).filter(([, btn]) => btn.screen === state.screen);
  const hit = visible.find(([, btn]) =>
    mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h
  );
  if (!hit) return null;
  const id = hit[0];
  if (id === 'title_start')    return { type: 'SCREEN', input: 'start'  };
  if (id === 'pause_resume')   return { type: 'SCREEN', input: 'resume' };
  if (id === 'pause_quit')     return { type: 'SCREEN', input: 'quit'   };
  if (id === 'gameover_retry') return { type: 'SCREEN', input: 'retry'  };
  if (id === 'gameover_title') return { type: 'SCREEN', input: 'quit'   };
  return null;
}

function intentKeyDown(key, screen) {
  if (key === 'Escape' && screen === 'playing') return { type: 'SCREEN', input: 'pause'  };
  if (key === 'Escape' && screen === 'pause')   return { type: 'SCREEN', input: 'resume' };
  return null;
}
// [/ai_s_emblem: HitTest]

// [ai_s_bridge:L3toL4 bridgeLogic2Draw]
// 唯一の描画エントリポイント。REAL_state を L4 に伝搬する
function bridgeLogic2Draw(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (state.screen === 'title')    drawTitle(ctx, state);
  if (state.screen === 'playing')  drawPlaying(ctx, state);
  if (state.screen === 'pause')    drawPause(ctx, state);
  if (state.screen === 'gameover') drawGameover(ctx, state);
}
// [/ai_s_bridge: bridgeLogic2Draw]

// [ai_s_emblem:#mid#draw DrawTitle]
// L4 Draw: タイトル画面。共有ヘルパーなし — ボタン描画をインライン
function drawTitle(ctx, state) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CANVAS UI', CANVAS_W / 2, 180);

  ctx.fillStyle = '#a8a8b3';
  ctx.font = '16px monospace';
  ctx.fillText('ai-desk 4-Layer Sample', CANVAS_W / 2, 220);

  const btn = BUTTONS.title_start;
  const hov = state.ui.hoveredId === 'title_start';
  ctx.fillStyle = hov ? '#e94560' : '#16213e';
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hov ? '#fff' : '#e94560';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 8);
}
// [/ai_s_emblem: DrawTitle]

// [ai_s_emblem:#high#draw DrawPlaying]
// L4 Draw: プレイ中画面。HPゲージの比率は shadow — 変数に保存しない
function drawPlaying(ctx, state) {
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${state.score}`, 20, 38);

  // HP ゲージ — state.hp / 100 は shadow。その場で計算して使い捨て
  ctx.fillStyle = '#333';
  ctx.fillRect(20, 52, 200, 18);
  ctx.fillStyle = state.hp > 50 ? '#4ecca3' : state.hp > 25 ? '#f5a623' : '#e94560';
  ctx.fillRect(20, 52, 200 * (state.hp / 100), 18);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.strokeRect(20, 52, 200, 18);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(`HP ${state.hp}`, 228, 65);

  ctx.fillStyle = '#1a3a5c';
  ctx.fillRect(80, 110, CANVAS_W - 160, CANVAS_H - 170);
  ctx.fillStyle = '#a8d8ea';
  ctx.font = '15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[ game content goes here ]', CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.fillStyle = '#7f8c8d';
  ctx.font = '13px monospace';
  ctx.fillText('D: damage  S: +score  ESC: pause', CANVAS_W / 2, CANVAS_H / 2 + 20);

  ctx.fillStyle = '#a8a8b3';
  ctx.textAlign = 'right';
  ctx.fillText('ESC to pause', CANVAS_W - 16, 38);
}
// [/ai_s_emblem: DrawPlaying]

// [ai_s_emblem:#mid#draw DrawPause]
// L4 Draw: ポーズ画面。ボタン2つをインライン描画
function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CANVAS_W / 2, 160);

  for (const id of ['pause_resume', 'pause_quit']) {
    const btn = BUTTONS[id];
    const hov = state.ui.hoveredId === id;
    ctx.fillStyle = hov ? '#4ecca3' : '#0d1b2a';
    ctx.strokeStyle = '#4ecca3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hov ? '#000' : '#4ecca3';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 7);
  }
}
// [/ai_s_emblem: DrawPause]

// [ai_s_emblem:#mid#draw DrawGameover]
// L4 Draw: ゲームオーバー画面
function drawGameover(ctx, state) {
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 56px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', CANVAS_W / 2, 160);

  ctx.fillStyle = '#fff';
  ctx.font = '24px monospace';
  ctx.fillText(`SCORE: ${state.score}`, CANVAS_W / 2, 218);

  for (const id of ['gameover_retry', 'gameover_title']) {
    const btn = BUTTONS[id];
    const hov = state.ui.hoveredId === id;
    ctx.fillStyle = hov ? '#e94560' : '#2a0a0a';
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hov ? '#fff' : '#e94560';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 7);
  }
}
// [/ai_s_emblem: DrawGameover]

// [ai_s_emblem:#low#physical Bootstrap]
// L1 Physical: DOM セットアップ・イベント登録。ここだけ副作用を許す
let REAL_state = {
  screen: 'title',
  score: 0,
  hp: 100,
  ui: { hoveredId: null },
};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  const cmd = intentMouseMove(REAL_state, e.clientX - r.left, e.clientY - r.top);
  REAL_state = applyCommand(REAL_state, cmd);
});

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const cmd = intentClick(REAL_state, e.clientX - r.left, e.clientY - r.top);
  if (cmd) REAL_state = applyCommand(REAL_state, cmd);
});

document.addEventListener('keydown', e => {
  const cmd = intentKeyDown(e.key, REAL_state.screen);
  if (cmd) REAL_state = applyCommand(REAL_state, cmd);
  if (e.key === 'd' && REAL_state.screen === 'playing')
    REAL_state = applyCommand(REAL_state, { type: 'DAMAGE', amount: 20 });
  if (e.key === 's' && REAL_state.screen === 'playing')
    REAL_state = applyCommand(REAL_state, { type: 'SCORE',  amount: 100 });
});

function loop() {
  bridgeLogic2Draw(ctx, REAL_state);
  requestAnimationFrame(loop);
}
loop();
// [/ai_s_emblem: Bootstrap]
