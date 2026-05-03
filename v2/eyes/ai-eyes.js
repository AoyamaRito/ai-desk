// ============================================================
// AI-Eyes — v2 観測ハーネス(Node-side, in-memory)
// ============================================================
//
// LLM が demo の挙動を browser なしで witness するためのランナー。
// demo は以下のインターフェイスを満たすこと(v2 観測可能性 = 公理 A8 系列):
//
//   demo = {
//     initialState():       state                — 初期状態(JSON-serializable)
//     dispatch(state, evt): state                — pure reducer
//     render(ctx, state, dims): void              — pure renderer (ctx は VirtualCanvasContext)
//     events?:              [{label, evt}, ...]  — 任意。runSession のデフォルトシナリオ
//   }
//
// 出力は ai-desk.js v2 の `loadGraph` がそのまま読める形式の Block Graph。
// 各 snapshot Block の content には PNG でなく **draw operation log** が入る
// (公理 A0 — 透明な算術として LLM が直接読める)。
//
// CLI:
//   node v2/eyes/ai-eyes.js <demo.js>          — シナリオ実行 + graph.json 標準出力
//   node v2/eyes/ai-eyes.js <demo.js> -o file  — file に書き出し
//   node v2/eyes/ai-eyes.js <demo.js> -s       — summary だけ表示
// ============================================================

import { writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Block, Graph } from '../ai-desk.js';
import { createVirtualCanvas, summarizeOps } from './virtual-canvas.js';

// ============================================================
// 1 frame を捕捉
// ============================================================
export function captureFrame(demo, state, dims = { w: 800, h: 600 }) {
  const canvas = createVirtualCanvas(dims.w, dims.h);
  const ctx = canvas.getContext('2d');
  demo.render(ctx, state, dims);
  return {
    capturedAt: Date.now(),
    dims,
    state: clone(state),
    draw_ops: ctx.ops,
    summary: summarizeOps(ctx.ops),
  };
}

// ============================================================
// 1 セッションを実行(初期 snap + tx ごとに snap)
// ============================================================
export function runSession(demo, options = {}) {
  const dims = options.dims || { w: 800, h: 600 };
  const events = options.events || demo.events || [];
  const sessionId = options.sessionId || ('session_' + Math.random().toString(36).slice(2, 10));
  const startedAt = Date.now();

  const graph = new Graph();
  const session = new Block({
    id: sessionId, type: 'session',
    meta: { startedAt, dims, demo: options.demoLabel || null, ua: 'node/ai-eyes' },
  });
  session.commit({
    content: { startedAt, dims },
    children: [],
    meta: { action: 'session-start' },
  });
  graph.add(session);

  let state = demo.initialState();
  let lastTxId = null;
  let txSeq = 0;
  let snapSeq = 0;

  function appendChild(id) {
    const head = session.head();
    session.commit({
      content: head.content,
      children: [...head.children, id],
      meta: { action: 'append-child', child: id },
    });
  }
  function recordSnap(label) {
    snapSeq++;
    const id = `${sessionId}_snap_${String(snapSeq).padStart(3, '0')}`;
    const refs = [{ kind: 'observes', target: sessionId }];
    if (lastTxId) refs.push({ kind: 'after', target: lastTxId });
    const snap = new Block({ id, type: 'snapshot', meta: { seq: snapSeq, sessionId, label } });
    snap.commit({
      content: captureFrame(demo, state, dims),
      refs,
      meta: { action: 'snapshot', label },
    });
    graph.add(snap);
    appendChild(id);
    return snap;
  }
  function recordTx(label, evtList) {
    txSeq++;
    const id = `${sessionId}_tx_${String(txSeq).padStart(4, '0')}`;
    const refs = [{ kind: 'in-session', target: sessionId }];
    if (lastTxId) refs.push({ kind: 'after', target: lastTxId });
    const tx = new Block({ id, type: 'tx', meta: { seq: txSeq, sessionId, label } });
    tx.commit({
      content: { events: evtList, label },
      refs,
      meta: { action: 'tx', label, count: evtList.length },
    });
    graph.add(tx);
    appendChild(id);
    lastTxId = id;
    return tx;
  }

  // 初期 snap
  recordSnap('initial');

  // events シナリオを順に適用
  for (const step of events) {
    const evtList = Array.isArray(step.evt) ? step.evt : [step.evt];
    for (const e of evtList) state = demo.dispatch(state, e);
    recordTx(step.label || `step-${txSeq + 1}`, evtList);
    if (step.snapshot !== false) recordSnap(step.label || `after-step-${txSeq}`);
  }

  return { graph, finalState: state, sessionId };
}

// ============================================================
// 出力 — ai-desk.js loadGraph 互換(配列ルート)
// ============================================================
export function dumpGraph(graph, path) {
  const json = JSON.stringify(graph.toJSON(), null, 2);
  writeFileSync(path, json);
  return path;
}

function clone(v) {
  // 浅い JSON コピー。state が serializable 前提。
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

// ============================================================
// CLI
// ============================================================
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`AI-Eyes (Node, in-memory) — observe a v2 demo headless

Usage:
  node v2/eyes/ai-eyes.js <demo.js>               run scenario, write graph.json
  node v2/eyes/ai-eyes.js <demo.js> -o <file>     write to file
  node v2/eyes/ai-eyes.js <demo.js> -s            print summary only
  node v2/eyes/ai-eyes.js <demo.js> --width=W --height=H

The demo module must export an object with:
  initialState(): state
  dispatch(state, evt): newState
  render(ctx, state, dims): void
  events?: [{label, evt, snapshot?}, ...]
`);
    process.exit(0);
  }

  const demoPath = resolve(args[0]);
  const outIdx = args.indexOf('-o');
  const summaryOnly = args.includes('-s') || args.includes('--summary');
  let dims = { w: 800, h: 600 };
  for (const a of args) {
    const m = /^--width=(\d+)$/.exec(a); if (m) dims.w = Number(m[1]);
    const n = /^--height=(\d+)$/.exec(a); if (n) dims.h = Number(n[1]);
  }
  const outPath = outIdx >= 0 && args[outIdx + 1]
    ? resolve(args[outIdx + 1])
    : resolve(`./ai-eyes-${basename(demoPath, '.js')}.json`);

  const demoUrl = pathToFileURL(demoPath).href;
  const mod = await import(demoUrl);
  const demo = mod.default || mod;
  const { graph, finalState, sessionId } = runSession(demo, {
    dims,
    demoLabel: basename(demoPath),
  });
  if (summaryOnly) {
    const summary = {
      sessionId,
      blocks: graph.all().length,
      snapshots: graph.all().filter(b => b.type === 'snapshot').length,
      tx: graph.all().filter(b => b.type === 'tx').length,
      finalState,
    };
    console.log(JSON.stringify(summary, null, 2));
  } else {
    dumpGraph(graph, outPath);
    console.log(`written: ${outPath} (${graph.all().length} blocks, session ${sessionId})`);
  }
}
