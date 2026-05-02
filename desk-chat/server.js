#!/usr/bin/env node
// desk-chat server (Stage A) — local PTY bridge.
//
// Serves index.html and a thin WebSocket that proxies bytes between
// the browser-side terminal UI and a child PTY (default: `gemini`).
//
// Usage:
//   node server.js                     # listens on http://localhost:4000, runs `gemini`
//   PORT=5000 CMD=claude node server.js
//   CMD_ARGS='chat --model=pro' node server.js
//
// Why two deps (node-pty, ws):
//   - node-pty is the OS-level PTY syscall wrapper (forkpty / CreatePseudoConsole).
//     Without it, gemini-cli sees stdin as non-tty and degrades to a non-interactive mode.
//     There is no built-in Node alternative.
//   - ws is the WebSocket server. Implementing the WS handshake + frame parsing
//     by hand is ~200 lines; we keep it as a stage-A dependency. Stage B (no server)
//     will remove this entirely (browser will speak HTTP directly to Gemini).

const http = require('http');
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 4000);
const CMD = process.env.CMD || 'gemini';
const CMD_ARGS = (process.env.CMD_ARGS || '').trim().length > 0
  ? process.env.CMD_ARGS.split(/\s+/)
  : [];
const SHELL_FALLBACK = process.env.SHELL || '/bin/bash';

const STATIC = {
  '/':            { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html':  { file: 'index.html', type: 'text/html; charset=utf-8' },
};

// --- HTTP server (static + upgrade entry point)
const server = http.createServer((req, res) => {
  const route = STATIC[req.url];
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not Found');
    return;
  }
  const filePath = path.join(__dirname, route.file);
  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Read error: ' + err.message);
      return;
    }
    res.writeHead(200, { 'content-type': route.type });
    res.end(body);
  });
});

// --- WebSocket: one PTY per connection
const wss = new WebSocketServer({ server, path: '/pty' });

wss.on('connection', (ws, req) => {
  // optional cmd override per connection via query string
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const overrideCmd = url.searchParams.get('cmd') || CMD;
  const overrideArgs = url.searchParams.get('args')
    ? url.searchParams.get('args').split(/\s+/)
    : CMD_ARGS;

  let term;
  try {
    term = pty.spawn(overrideCmd, overrideArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (e) {
    // If the configured CMD isn't installed, fall back to a plain shell so the
    // user can at least see the terminal works and pick a different command.
    console.warn(`[desk-chat] failed to spawn '${overrideCmd}': ${e.message}. Falling back to ${SHELL_FALLBACK}`);
    term = pty.spawn(SHELL_FALLBACK, [], {
      name: 'xterm-256color', cols: 80, rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  }

  console.log(`[desk-chat] spawned pid=${term.pid} (${overrideCmd} ${overrideArgs.join(' ')})`);

  // PTY → ws (binary frames carry raw bytes)
  term.onData(data => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  term.onExit(({ exitCode, signal }) => {
    console.log(`[desk-chat] pty exit code=${exitCode} signal=${signal}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
      ws.close();
    }
  });

  // ws → PTY (text frames carry either input bytes or a control JSON)
  ws.on('message', msg => {
    const text = msg.toString();
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const obj = JSON.parse(text);
        if (obj.type === 'resize' && Number.isInteger(obj.cols) && Number.isInteger(obj.rows)) {
          term.resize(obj.cols, obj.rows);
          return;
        }
        if (obj.type === 'input' && typeof obj.data === 'string') {
          term.write(obj.data);
          return;
        }
      } catch { /* fall through to raw write */ }
    }
    term.write(text);
  });

  ws.on('close', () => {
    try { term.kill(); } catch { /* already gone */ }
  });
});

server.listen(PORT, () => {
  console.log(`[desk-chat] listening on http://localhost:${PORT}`);
  console.log(`[desk-chat] CMD='${CMD}' CMD_ARGS=${JSON.stringify(CMD_ARGS)}`);
  console.log(`[desk-chat] open the URL in your browser to start chatting`);
});
