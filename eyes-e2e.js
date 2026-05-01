#!/usr/bin/env node

// [ai_s_emblem:#high#logic Eyes-E2E-Runner]
// Bible §1.5 適合: APIキー不要の観測翻訳機 (Keyless Transducer)
//   人間を介さず、AI(CLIエージェント等)がブラウザの実行状態を把握するためのインターフェース。
//   最新のスナップショットを読み込み、不要なDOM要素を削ぎ落として
//   AIが「次の一手」を決定するための【最小トークンの短期プロンプト】を標準出力に返す。
//   外部API通信やLLMの内包は行わない（Zero-Dependency / Unix Philosophy）。

const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || './snapshots';

function getLatestSnapshot() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return null;
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.html') && f.startsWith('snapshot_'))
    .map(f => ({ name: f, time: fs.statSync(path.join(SNAPSHOT_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length === 0) return null;
  return {
    filename: files[0].name,
    html: fs.readFileSync(path.join(SNAPSHOT_DIR, files[0].name), 'utf8')
  };
}

function observe(goal) {
  const snapshot = getLatestSnapshot();
  if (!snapshot) {
    console.log('[SHORT-TERM PROMPT]\nStatus: No snapshots found. Run ai-eyes and trigger an initial render.\n[/SHORT-TERM PROMPT]');
    process.exit(0);
  }

  // DOMから重要な情報を抽出（ここでは簡易的に id="diff" や id="status" を探す）
  const html = snapshot.html;
  const diffMatch = html.match(/id="diff"[^>]*>([\s\S]*?)<\/pre>/);
  const statusMatch = html.match(/id="status"[^>]*>([\s\S]*?)<\/span>/);
  const errorMatch = html.match(/class="error"[^>]*>([\s\S]*?)<\/div>/);
  
  const diffText = diffMatch ? diffMatch[1].trim() : 'No data';
  const statusText = statusMatch ? statusMatch[1].trim() : 'Unknown';
  const errorText = errorMatch ? errorMatch[1].trim() : 'None';

  // CLIエージェント（親プロセス）に読ませるための短期プロンプトを出力
  console.log(`[SHORT-TERM PROMPT]
Context: Goal "${goal}"
Snapshot: ${snapshot.filename}

Current Observation:
  - Browser Status: ${statusText}
  - Engine Diff: ${diffText}
  - Errors: ${errorText}

Instruction:
  Based on the observation above, use 'curl' to send the next action to ai-eyes (/input) 
  or use 'ai-desk' to fix the code.
  Example Action: curl -X POST localhost:3000/input -d '{"action":"eval", "code":"window.step_forward()"}'
[/SHORT-TERM PROMPT]`);
}

const goal = process.argv[2] || "Autonomous Debugging";
observe(goal);
// [/ai_s_emblem: Eyes-E2E-Runner]
