// one-stroke.js — 一筆書きパズルゲーム
//
// canvas-ui-sample.js のパターンを土台に、実際のゲームロジックを乗せた実証。
// 5×5 グリッドの全タイルを4方向移動で一筆書きする。
// 「有効な次の手の列挙」が constraint folding の自然な応用になっている。
//
// 操作: クリックでタイル選択・移動 / Z でアンドゥ

// [ai_s_emblem:#config GameConfig]
const CANVAS_W = 640;
const CANVAS_H = 480;

const ROWS = 5;
const COLS = 5;
const TILE = 62;
const GAP  = 5;
const OX   = (CANVAS_W - (COLS * (TILE + GAP) - GAP)) / 2;
const OY   = 58;

const BUTTONS = {
  title_start: { x: 220, y: 340, w: 200, h: 50, label: 'START', screen: 'title' },
  clear_retry: { x: 150, y: 400, w: 140, h: 46, label: 'RETRY', screen: 'clear' },
  clear_title: { x: 350, y: 400, w: 140, h: 46, label: 'TITLE', screen: 'clear' },
  stuck_retry: { x: 150, y: 400, w: 140, h: 46, label: 'RETRY', screen: 'stuck' },
  stuck_title: { x: 350, y: 400, w: 140, h: 46, label: 'TITLE', screen: 'stuck' },
};

const SCREEN_TRANSITIONS = [
  { from: 'title',   input: 'start', to: 'playing' },
  { from: 'playing', input: 'clear', to: 'clear'   },
  { from: 'playing', input: 'stuck', to: 'stuck'   },
  { from: 'clear',   input: 'retry', to: 'playing' },
  { from: 'clear',   input: 'title', to: 'title'   },
  { from: 'stuck',   input: 'retry', to: 'playing' },
  { from: 'stuck',   input: 'title', to: 'title'   },
];
// [/ai_s_emblem: GameConfig]

// [ai_s_emblem:#high#logic GameReducer]
function makePlayState() {
  return {
    visited: Array.from({ length: ROWS }, () => Array(COLS).fill(false)),
    path: [],
    current: null,
  };
}

// 4方向の有効な次の手を列挙 — constraint folding の核心
// 「全方向を生成 → 盤外を除く → 訪問済みを除く」で if/else なし
function getValidMoves(state) {
  if (!state.current) return [];
  const { r, c } = state.current;
  return [[-1,0],[1,0],[0,-1],[0,1]]
    .map(([dr,dc]) => ({ r: r+dr, c: c+dc }))
    .filter(({r,c}) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
    .filter(({r,c}) => !state.visited[r][c]);
}

function reduceScreen(constraints = {}) {
  let worlds = SCREEN_TRANSITIONS;
  for (const [k, v] of Object.entries(constraints)) {
    if (k.startsWith('_')) continue;
    worlds = worlds.filter(w => w[k] === v);
  }
  if (worlds.length === 0) return { _contradiction: true };
  return { _worlds: worlds.length, _worlds_raw: worlds };
}

function applyCommand(state, cmd) {
  if (cmd.type === 'SCREEN') {
    const result = reduceScreen({ from: state.screen, input: cmd.input });
    if (result._contradiction) return state;
    const next = { ...state, screen: result._worlds_raw[0].to };
    if (cmd.input === 'start' || cmd.input === 'retry') return { ...next, ...makePlayState() };
    return next;
  }
  if (cmd.type === 'HOVER') {
    return { ...state, ui: { hoveredId: cmd.id, hoveredTile: cmd.tile } };
  }
  if (cmd.type === 'TILE_CLICK') {
    const { r, c } = cmd;
    if (state.current === null) {
      const visited = state.visited.map(row => [...row]);
      visited[r][c] = true;
      const path = [{ r, c }];
      return { ...state, visited, path, current: { r, c } };
    }
    const valid = getValidMoves(state);
    if (!valid.some(m => m.r === r && m.c === c)) return state;
    const visited = state.visited.map(row => [...row]);
    visited[r][c] = true;
    const path = [...state.path, { r, c }];
    const next = { ...state, visited, path, current: { r, c } };
    if (path.length === ROWS * COLS)           return applyCommand(next, { type: 'SCREEN', input: 'clear' });
    if (getValidMoves(next).length === 0)      return applyCommand(next, { type: 'SCREEN', input: 'stuck' });
    return next;
  }
  if (cmd.type === 'UNDO') {
    if (state.path.length === 0) return state;
    const path = state.path.slice(0, -1);
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    path.forEach(({ r, c }) => { visited[r][c] = true; });
    return { ...state, visited, path, current: path.length > 0 ? path[path.length - 1] : null };
  }
  return state;
}
// [/ai_s_emblem: GameReducer]

// [ai_s_emblem:#mid#intent IntentHandlers]
// L2: ピクセル座標 → タイル/ボタン → Command JSON
function tileAt(mx, my) {
  const col = Math.floor((mx - OX) / (TILE + GAP));
  const row = Math.floor((my - OY) / (TILE + GAP));
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  const tx = OX + col * (TILE + GAP);
  const ty = OY + row * (TILE + GAP);
  if (mx > tx + TILE || my > ty + TILE) return null;
  return { r: row, c: col };
}

function intentMove(state, mx, my) {
  const visible = Object.entries(BUTTONS).filter(([,b]) => b.screen === state.screen);
  const btn = visible.find(([,b]) => mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h);
  const tile = state.screen === 'playing' ? tileAt(mx, my) : null;
  return { type: 'HOVER', id: btn ? btn[0] : null, tile };
}

function intentClick(state, mx, my) {
  const visible = Object.entries(BUTTONS).filter(([,b]) => b.screen === state.screen);
  const btn = visible.find(([,b]) => mx >= b.x && mx <= b.x+b.w && my >= b.y && my <= b.y+b.h);
  if (btn) {
    const id = btn[0];
    if (id === 'title_start')                       return { type: 'SCREEN', input: 'start' };
    if (id === 'clear_retry' || id === 'stuck_retry') return { type: 'SCREEN', input: 'retry' };
    if (id === 'clear_title' || id === 'stuck_title') return { type: 'SCREEN', input: 'title' };
    return null;
  }
  if (state.screen === 'playing') {
    const tile = tileAt(mx, my);
    if (tile) return { type: 'TILE_CLICK', ...tile };
  }
  return null;
}

function intentKey(key) {
  if (key === 'z' || key === 'Z') return { type: 'UNDO' };
  return null;
}
// [/ai_s_emblem: IntentHandlers]

// [ai_s_bridge:L3toL4 bridgeLogic2Draw]
function bridgeLogic2Draw(ctx, state) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  if (state.screen === 'title')   { drawTitle(ctx, state); return; }
  drawPlaying(ctx, state);
  if (state.screen === 'clear')     drawClear(ctx, state);
  if (state.screen === 'stuck')     drawStuck(ctx, state);
}
// [/ai_s_bridge: bridgeLogic2Draw]

// [ai_s_emblem:#mid#draw DrawTitle]
function drawTitle(ctx, state) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ミニグリッドプレビュー（完成パスを示す装飾）
  const ms = 14, mg = 2;
  const mx0 = (CANVAS_W - COLS * (ms + mg) + mg) / 2;
  const my0 = 80;
  const demoPath = [[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[1,3],[1,2],[1,1],[1,0],
                    [2,0],[2,1],[2,2],[2,3],[2,4],[3,4],[3,3],[3,2],[3,1],[3,0],
                    [4,0],[4,1],[4,2],[4,3],[4,4]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(mx0 + c*(ms+mg), my0 + r*(ms+mg), ms, ms);
  }
  ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  demoPath.forEach(([r,c], i) => {
    const x = mx0 + c*(ms+mg) + ms/2, y = my0 + r*(ms+mg) + ms/2;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();
  // highlight first and last
  ctx.fillStyle = '#4ecca3';
  ctx.fillRect(mx0, my0, ms, ms);
  ctx.fillStyle = '#e94560';
  ctx.fillRect(mx0 + 4*(ms+mg), my0 + 4*(ms+mg), ms, ms);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px monospace';
  ctx.fillText('一筆書き', CANVAS_W/2, 248);
  ctx.fillStyle = '#a8a8b3';
  ctx.font = '15px monospace';
  ctx.fillText('Visit all 25 tiles in one stroke — 4 directions only', CANVAS_W/2, 280);
  ctx.fillStyle = '#555';
  ctx.font = '13px monospace';
  ctx.fillText('Z: undo', CANVAS_W/2, 304);

  const btn = BUTTONS.title_start;
  const hov = state.ui.hoveredId === 'title_start';
  ctx.fillStyle = hov ? '#e94560' : '#1a0a2e';
  ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hov ? '#fff' : '#e94560';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 8);
}
// [/ai_s_emblem: DrawTitle]

// [ai_s_emblem:#high#draw DrawPlaying]
function drawPlaying(ctx, state) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.path.length} / ${ROWS * COLS}`, 20, 34);
  if (state.current && state.screen === 'playing') {
    const n = getValidMoves(state).length;
    ctx.fillStyle = n === 0 ? '#e94560' : '#a8a8b3';
    ctx.font = '13px monospace';
    ctx.fillText(`next: ${n}`, 20, 52);
  }
  ctx.fillStyle = '#444';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Z: undo', CANVAS_W - 16, 34);

  // 有効な次の手（shadow — ここで生成して即使う）
  const validSet = new Set(getValidMoves(state).map(({r,c}) => `${r},${c}`));

  // グリッド描画
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tx = OX + c*(TILE+GAP);
      const ty = OY + r*(TILE+GAP);
      const isCur  = state.current && state.current.r === r && state.current.c === c;
      const isVis  = state.visited[r][c];
      const isNext = validSet.has(`${r},${c}`);
      const isHov  = state.ui.hoveredTile && state.ui.hoveredTile.r === r && state.ui.hoveredTile.c === c;

      if (isCur) {
        ctx.fillStyle = '#e94560';
      } else if (isVis) {
        // パスの順番で色をグラデーション（shadow: インライン計算）
        const idx = state.path.findIndex(p => p.r === r && p.c === c);
        const t = state.path.length > 1 ? idx / (state.path.length - 1) : 0;
        const gb = Math.round(160 + t * 63);
        ctx.fillStyle = `rgb(20,${gb + 20},${gb + 50})`;
      } else if (isNext) {
        ctx.fillStyle = isHov ? '#c47c00' : '#1e3020';
      } else {
        ctx.fillStyle = '#14142a';
      }

      ctx.beginPath(); ctx.roundRect(tx, ty, TILE, TILE, 7); ctx.fill();

      ctx.strokeStyle = isCur ? '#ff8099' : isNext ? '#4a8a5a' : '#252545';
      ctx.lineWidth = isCur ? 2.5 : 1;
      ctx.beginPath(); ctx.roundRect(tx, ty, TILE, TILE, 7); ctx.stroke();

      // 訪問番号
      const idx = state.path.findIndex(p => p.r === r && p.c === c);
      if (idx >= 0) {
        ctx.fillStyle = isCur ? '#fff' : 'rgba(255,255,255,0.55)';
        ctx.font = `${isCur ? 'bold ' : ''}14px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(idx + 1, tx + TILE/2, ty + TILE/2 + 5);
      }
    }
  }

  // パスライン
  if (state.path.length >= 2) {
    ctx.strokeStyle = 'rgba(233,69,96,0.55)';
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    state.path.forEach(({r,c}, i) => {
      const x = OX + c*(TILE+GAP) + TILE/2;
      const y = OY + r*(TILE+GAP) + TILE/2;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  if (!state.current) {
    ctx.fillStyle = '#444';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Click any tile to begin', CANVAS_W/2, OY + ROWS*(TILE+GAP) + 20);
  }
}
// [/ai_s_emblem: DrawPlaying]

// [ai_s_emblem:#mid#draw DrawClear]
function drawClear(ctx, state) {
  ctx.fillStyle = 'rgba(0,16,8,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#4ecca3';
  ctx.font = 'bold 62px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CLEAR!', CANVAS_W/2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`All ${ROWS * COLS} tiles — perfect path`, CANVAS_W/2, 230);
  for (const id of ['clear_retry', 'clear_title']) {
    const btn = BUTTONS[id];
    const hov = state.ui.hoveredId === id;
    ctx.fillStyle = hov ? '#4ecca3' : '#021408';
    ctx.strokeStyle = '#4ecca3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hov ? '#000' : '#4ecca3';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 6);
  }
}
// [/ai_s_emblem: DrawClear]

// [ai_s_emblem:#mid#draw DrawStuck]
function drawStuck(ctx, state) {
  ctx.fillStyle = 'rgba(18,0,0,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 58px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STUCK', CANVAS_W/2, 190);
  ctx.fillStyle = '#a8a8b3';
  ctx.font = '18px monospace';
  ctx.fillText(`${state.path.length} / ${ROWS * COLS} tiles visited`, CANVAS_W/2, 228);
  for (const id of ['stuck_retry', 'stuck_title']) {
    const btn = BUTTONS[id];
    const hov = state.ui.hoveredId === id;
    ctx.fillStyle = hov ? '#e94560' : '#180000';
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hov ? '#fff' : '#e94560';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 6);
  }
}
// [/ai_s_emblem: DrawStuck]

// [ai_s_emblem:#low#physical Bootstrap]
let REAL_state = {
  screen: 'title',
  ...makePlayState(),
  ui: { hoveredId: null, hoveredTile: null },
};

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  REAL_state = applyCommand(REAL_state, intentMove(REAL_state, e.clientX - rect.left, e.clientY - rect.top));
});
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const cmd = intentClick(REAL_state, e.clientX - rect.left, e.clientY - rect.top);
  if (cmd) REAL_state = applyCommand(REAL_state, cmd);
});
document.addEventListener('keydown', e => {
  const cmd = intentKey(e.key);
  if (cmd && REAL_state.screen === 'playing') REAL_state = applyCommand(REAL_state, cmd);
});

function loop() { bridgeLogic2Draw(ctx, REAL_state); requestAnimationFrame(loop); }
loop();
// [/ai_s_emblem: Bootstrap]
