#!/usr/bin/env node
// dev-server.js — 開発用 no-cache static server(Zero-Dep、~40 行)。
//
// ai-eyes と並走させる場合:
//   - dev-server: 8080 で v2/ を no-cache 配信(demo 本体)
//   - ai-eyes:    3000 で /client.js + /error + /input + /structure(AI 観測)
//   - index.html の <script src="http://localhost:3000/client.js"> は CORS 許可済み
//
// 起動:
//   node dev-server.js [port]   (省略時は 8080)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.argv[2]) || 8080;
const ROOT = resolve(process.argv[3] || '.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    const st = await stat(full);
    if (st.isDirectory()) { res.writeHead(302, { Location: p + '/' }); res.end(); return; }
    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Content-Length': data.length,
      ...NO_CACHE,
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, NO_CACHE);
    res.end('not found: ' + req.url);
  }
}).listen(PORT, () => {
  console.log(`dev-server (no-cache) listening on http://localhost:${PORT}/`);
  console.log(`  static root: ${ROOT}`);
});
