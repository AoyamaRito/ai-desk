#!/usr/bin/env node

// [ai_s_emblem:#high#logic Eyes-E2E-Runner]
// Bible §1.5 適合: AI自律デバッグランナー (eyes-e2e)
//   Observe -> Think (Short-term Prompt) -> Act -> Wait のループを回す。
//   人間を介さず、AIがブラウザの実行状態を直接制御・修正するための心臓部。

const http = require('http');
const fs = require('fs');
const path = require('path');

const API = process.env.AI_EYES_URL || 'http://localhost:3000';
const SNAPSHOT_DIR = './snapshots';

async function request(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API);
    const options = {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getLatestSnapshot() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ name: f, time: fs.statSync(path.join(SNAPSHOT_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length === 0) return null;
  return fs.readFileSync(path.join(SNAPSHOT_DIR, files[0].name), 'utf8');
}

async function runLoop(goal, maxSteps = 10) {
  console.log(`\n🚀 Starting eyes-e2e session: "${goal}"`);
  
  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n--- Step ${step}/${maxSteps} ---`);
    
    // 1. Observe: 最新のスナップショットを取得
    const html = await getLatestSnapshot();
    if (!html) {
      console.log('Waiting for initial snapshot...');
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    // 2. Think: 短期プロンプトの構成
    // DOMから重要な情報を抽出（ここでは簡易的に id="diff" や id="status" を探す）
    const diffMatch = html.match(/id="diff"[^>]*>([\s\S]*?)<\/pre>/);
    const statusMatch = html.match(/id="status"[^>]*>([\s\S]*?)<\/span>/);
    const diffText = diffMatch ? diffMatch[1].trim() : 'No data';
    const statusText = statusMatch ? statusMatch[1].trim() : 'Unknown';

    console.log(`[Observation] Status: ${statusText}, Diff: ${diffText}`);

    // AI への短期プロンプト出力
    // この出力を見た AI (エージェント) が次のアクションを決定する。
    console.log(`\n[SHORT-TERM PROMPT]
Context: Step ${step} of goal "${goal}"
Current Observation:
  - Browser Status: ${statusText}
  - Engine Diff: ${diffText}
Instruction:
  Decide the next action (eval code) to move closer to the goal.
  Example: window.step_forward(0.016)
  Format: ACTION: <code>
[/SHORT-TERM PROMPT]\n`);

    // 3. Act: AIからの入力を待つ (今回はデモとしてエージェントの次のターンに委ねる)
    // 実際の自動化では、ここで LLM API を呼ぶ。
    console.log('Waiting for AI ACTION input via tool or next turn...');
    
    // ※ ここでは実装の器として、一旦停止して入力を待つ（または AI がツールでこの続きを書く）
    // とりあえず今回は「AIへのヒント」を出して1ステップ分で終了させる。
    return;
  }
}

const goal = process.argv[2] || "Verify 3D projection is error-free";
runLoop(goal).catch(console.error);
// [/ai_s_emblem: Eyes-E2E-Runner]
