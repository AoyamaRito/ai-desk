// ============================================================
// example-headless-demo.js — AI-Eyes 動作確認用の最小 demo
// ============================================================
//
// 観測可能性の最小要件(initialState / dispatch / render)を満たすだけの
// 「点を 1 個動かして、止まったら線で原点と結ぶ」だけの demo。
//
// node v2/eyes/ai-eyes.js v2/eyes/example-headless-demo.js -o /tmp/eyes-test.json
// で graph.json を出力できる。
// ============================================================

export function initialState() {
  return {
    point: { x: 100, y: 100 },
    trail: [],
    drawLine: false,
  };
}

export function dispatch(state, evt) {
  switch (evt.type) {
    case 'move':
      return {
        ...state,
        point: { x: evt.x, y: evt.y },
        trail: [...state.trail, { x: evt.x, y: evt.y }].slice(-20),
      };
    case 'connect':
      return { ...state, drawLine: true };
    case 'reset':
      return initialState();
    default:
      return state;
  }
}

export function render(ctx, state, dims) {
  // background
  ctx.fillStyle = '#fafbfc';
  ctx.fillRect(0, 0, dims.w, dims.h);

  // grid (every 40px, faint)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < dims.w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dims.h); ctx.stroke();
  }
  for (let y = 0; y < dims.h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dims.w, y); ctx.stroke();
  }

  // optional line origin → point
  if (state.drawLine) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(state.point.x, state.point.y);
    ctx.stroke();
  }

  // trail
  if (state.trail.length > 1) {
    ctx.strokeStyle = 'rgba(37,99,235,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(state.trail[0].x, state.trail[0].y);
    for (let i = 1; i < state.trail.length; i++) ctx.lineTo(state.trail[i].x, state.trail[i].y);
    ctx.stroke();
  }

  // point
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(state.point.x, state.point.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // label
  ctx.fillStyle = '#1a1d24';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`(${Math.round(state.point.x)}, ${Math.round(state.point.y)})`, 8, 8);
  ctx.fillText(`trail: ${state.trail.length} · drawLine: ${state.drawLine}`, 8, 24);
}

export const events = [
  { label: 'move-right',    evt: { type: 'move', x: 200, y: 100 } },
  { label: 'move-down',     evt: { type: 'move', x: 200, y: 200 } },
  { label: 'move-diagonal', evt: { type: 'move', x: 320, y: 280 } },
  { label: 'connect-line',  evt: { type: 'connect' } },
  { label: 'move-far',      evt: { type: 'move', x: 600, y: 400 } },
  { label: 'reset',         evt: { type: 'reset' } },
];

export default { initialState, dispatch, render, events };
