#!/usr/bin/env node

// [ai_s_emblem:#high#logic Eyes-E2E-Runner]
// Bible §1.5 適合: APIキー不要の観測翻訳機 (Keyless Transducer)
//   最新状態を最小トークンのテキストに変換して標準出力に吐き出す単機能の翻訳機。
//   外部API通信・LLM内包は行わない（Zero-Dependency / Unix Philosophy）。
//
// 安定性の保証:
//   - error.log の最新エラーを統合（ai-eyes.js が記録した実エラーを見る）
//   - スナップショット鮮度チェック（STALE_SEC 秒超で警告）
//   - DOMを固定IDに依存せず汎用サマリーに変換
//   - eyes.port から実際のポートを取得（curl例のポートがズレない）
//   - エラー有無で exit code を分岐（AIループがif文で判断できる）

const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || './snapshots';
const LOG_FILE     = process.env.LOG_FILE      || './error.log';
const PORT_FILE    = process.env.PORT_FILE     || path.join(__dirname, 'eyes.port');
const STALE_SEC    = parseInt(process.env.STALE_SEC) || 30;
const LOG_TAIL     = parseInt(process.env.LOG_TAIL)  || 5;

function observe(goal) {
  const now = Date.now();

  // --- 1. 実際のポートを取得 ---
  let port = '3000';
  try { port = fs.readFileSync(PORT_FILE, 'utf8').trim(); } catch {}

  // --- 2. 最新スナップショット ---
  let snapshotInfo = 'No snapshots found. Run ai-eyes and trigger an initial render.';
  let hasSnapshot  = false;
  let snapshotStale = false;
  let bodyText     = '';
  if (fs.existsSync(SNAPSHOT_DIR)) {
    const files = fs.readdirSync(SNAPSHOT_DIR)
      .filter(f => f.endsWith('.html') && f.startsWith('snapshot_'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(SNAPSHOT_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      hasSnapshot = true;
      const latest = files[0];
      const ageSec = Math.floor((now - latest.mtime) / 1000);
      snapshotStale = ageSec > STALE_SEC;

      const html = fs.readFileSync(path.join(SNAPSHOT_DIR, latest.name), 'utf8');
      // タグを除去してテキストだけ抽出し、先頭400文字に圧縮
      const stripped = html.replace(/<style[\s\S]*?<\/style>/gi, '')
                           .replace(/<script[\s\S]*?<\/script>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim()
                           .slice(0, 400);
      bodyText = stripped || '(empty body)';
      snapshotInfo = `${latest.name} (${ageSec}s ago${snapshotStale ? ' ⚠ STALE' : ''}, total: ${files.length})`;
    }
  }

  // --- 3. error.log の最新N件 ---
  let recentErrors = [];
  if (fs.existsSync(LOG_FILE)) {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    recentErrors = lines.slice(-LOG_TAIL).map(l => {
      try {
        const e = JSON.parse(l);
        // snapshot イベントは除外（ノイズ）
        if (e.type === 'snapshot') return null;
        return `[${e.type}] ${(e.message || '').slice(0, 120)}`;
      } catch { return l.slice(0, 120); }
    }).filter(Boolean);
  }
  const hasErrors = recentErrors.length > 0;

  // --- 4. SHORT-TERM PROMPT 出力 ---
  const errBlock = hasErrors
    ? recentErrors.map(e => `  ! ${e}`).join('\n')
    : '  (none)';

  console.log(`[SHORT-TERM PROMPT]
Goal: "${goal}"
Port: ${port}  (curl target: localhost:${port})

[Snapshot]
  ${snapshotInfo}
  Body preview: ${bodyText}

[Recent Errors (last ${LOG_TAIL} from error.log)]
${errBlock}

[Next Action]
  If errors exist → use ai-desk to fix code, then trigger a new snapshot.
  If snapshot is STALE → reload the browser or send: curl -X POST localhost:${port}/input -H "Content-Type: application/json" -d '{"action":"eval","code":"location.reload()"}'
  To observe state → curl -X POST localhost:${port}/input -H "Content-Type: application/json" -d '{"action":"eval","code":"window.step_forward && window.step_forward()"}'
[/SHORT-TERM PROMPT]`);

  // エラーあり or スナップショット未到達 → exit 1（AIループがエラー状態を認識できる）
  process.exit(hasErrors || !hasSnapshot ? 1 : 0);
}

if (!process.argv.includes('--test')) {
  const goal = process.argv[2] || "Autonomous Debugging";
  observe(goal);
}
// [/ai_s_emblem: Eyes-E2E-Runner]

// [ai_s_emblem:#mid#verify Eyes-E2E-SelfTest]
// eyes-e2e.js 自身のふるまいを検証するテストスイート。
// 各ケースは独立した一時ディレクトリを使い、spawnで自分自身を呼び出して stdout/exitCode を確認する。
if (process.argv.includes('--test')) {
  const { spawnSync } = require('child_process');
  const os = require('os');

  const TMP_BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'eyes-e2e-test-'));
  let passed = 0, failed = 0;

  function assert(cond, msg) {
    if (cond) { passed++; console.log(`  ✓ ${msg}`); }
    else       { failed++; console.log(`  ✗ ${msg}`); }
  }

  function run(env = {}, args = []) {
    const r = spawnSync(process.execPath, [__filename, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8'
    });
    return { out: r.stdout || '', exit: r.status ?? 1 };
  }

  function makeSnapDir(base) {
    const dir = path.join(TMP_BASE, base);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function makeSnapshot(snapDir, content = '<p>Hello world</p>', ageMs = 0) {
    const name = `snapshot_test_${Date.now()}.html`;
    const file = path.join(snapDir, name);
    fs.writeFileSync(file, `<html><body>${content}</body></html>`);
    if (ageMs > 0) {
      const t = new Date(Date.now() - ageMs);
      fs.utimesSync(file, t, t);
    }
    return name;
  }

  function makeLog(logPath, entries) {
    const lines = entries.map(e => JSON.stringify(e)).join('\n');
    fs.writeFileSync(logPath, lines + '\n');
  }

  console.log('=== eyes-e2e.js Self-Test ===\n');

  // ---- Case 1: スナップショットなし → exit 1 ----
  console.log('[Case 1: No snapshots]');
  {
    const snapDir = makeSnapDir('c1_snap');
    const logFile = path.join(TMP_BASE, 'c1.log');
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' });
    assert(r.exit === 1,                           'exit 1 when no snapshots');
    assert(r.out.includes('No snapshots found'),   'output contains "No snapshots found"');
    assert(r.out.includes('[SHORT-TERM PROMPT]'),  'output wrapped in SHORT-TERM PROMPT');
  }

  // ---- Case 2: 新鮮なスナップショット、エラーなし → exit 0 ----
  console.log('\n[Case 2: Fresh snapshot, no errors]');
  {
    const snapDir = makeSnapDir('c2_snap');
    const logFile = path.join(TMP_BASE, 'c2.log');
    makeSnapshot(snapDir, '<p>Game running</p>', 0);
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' });
    assert(r.exit === 0,                           'exit 0 when fresh snapshot and no errors');
    assert(!r.out.includes('⚠ STALE'),             'no STALE warning for fresh snapshot');
    assert(r.out.includes('Game running'),         'body preview contains snapshot content');
    assert(r.out.includes('(none)'),               'errors section shows (none)');
  }

  // ---- Case 3: 古いスナップショット（STALE）、エラーなし → exit 0 + STALE表示 ----
  console.log('\n[Case 3: Stale snapshot, no errors]');
  {
    const snapDir = makeSnapDir('c3_snap');
    const logFile = path.join(TMP_BASE, 'c3.log');
    makeSnapshot(snapDir, '<p>Old frame</p>', 60 * 1000); // 60秒前
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' });
    assert(r.exit === 0,                           'exit 0 when stale but no errors');
    assert(r.out.includes('⚠ STALE'),             'STALE warning shown');
    assert(r.out.includes('Old frame'),            'body preview shown even for stale');
  }

  // ---- Case 4: エラーログあり → exit 1 + エラー表示 ----
  console.log('\n[Case 4: Snapshot + errors in log]');
  {
    const snapDir = makeSnapDir('c4_snap');
    const logFile = path.join(TMP_BASE, 'c4.log');
    makeSnapshot(snapDir, '<p>Crashed</p>', 0);
    makeLog(logFile, [
      { type: 'error', message: 'TypeError: cannot read property foo of undefined' },
      { type: 'console.error', message: 'WebGL context lost' }
    ]);
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' });
    assert(r.exit === 1,                                           'exit 1 when errors present');
    assert(r.out.includes('TypeError'),                            'error message shown');
    assert(r.out.includes('WebGL context lost'),                   'second error shown');
  }

  // ---- Case 5: ログの snapshot イベントはフィルタされる ----
  console.log('\n[Case 5: snapshot-type log entries filtered]');
  {
    const snapDir = makeSnapDir('c5_snap');
    const logFile = path.join(TMP_BASE, 'c5.log');
    makeSnapshot(snapDir, '<p>OK</p>', 0);
    makeLog(logFile, [
      { type: 'snapshot', message: 'Snapshot saved: snapshot_xyz.html' }
    ]);
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' });
    assert(r.exit === 0,               'exit 0 when only snapshot-type entries in log');
    assert(r.out.includes('(none)'),   'snapshot-type entries filtered from errors');
  }

  // ---- Case 6: PORT_FILE env var → curl 例に反映 ----
  console.log('\n[Case 6: eyes.port used for curl example]');
  {
    const snapDir = makeSnapDir('c6_snap');
    const logFile = path.join(TMP_BASE, 'c6.log');
    const portFile = path.join(TMP_BASE, 'c6.port');
    makeSnapshot(snapDir, '<p>port test</p>', 0);
    fs.writeFileSync(portFile, '4321');
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30', PORT_FILE: portFile });
    assert(r.out.includes('Port: 4321'),          'port from eyes.port shown');
    assert(r.out.includes('localhost:4321'),       'curl example uses correct port');
  }

  // ---- Case 7: LOG_TAIL=2 → 最新2件のみ ----
  console.log('\n[Case 7: LOG_TAIL limits error lines]');
  {
    const snapDir = makeSnapDir('c7_snap');
    const logFile = path.join(TMP_BASE, 'c7.log');
    makeSnapshot(snapDir, '<p>tail test</p>', 0);
    makeLog(logFile, [
      { type: 'error', message: 'Error A' },
      { type: 'error', message: 'Error B' },
      { type: 'error', message: 'Error C' }
    ]);
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30', LOG_TAIL: '2' });
    assert(!r.out.includes('Error A'),  'oldest entry excluded by LOG_TAIL');
    assert(r.out.includes('Error B'),   'second entry shown');
    assert(r.out.includes('Error C'),   'latest entry shown');
    assert(r.out.includes('last 2'),    'header reflects LOG_TAIL value');
  }

  // ---- Case 8: goal 引数が出力に反映される ----
  console.log('\n[Case 8: goal argument reflected in output]');
  {
    const snapDir = makeSnapDir('c8_snap');
    const logFile = path.join(TMP_BASE, 'c8.log');
    makeSnapshot(snapDir, '<p>ok</p>', 0);
    const r = run({ SNAPSHOT_DIR: snapDir, LOG_FILE: logFile, STALE_SEC: '30' }, ['Check render pipeline']);
    assert(r.out.includes('Check render pipeline'), 'goal shown in output');
  }

  // ---- cleanup ----
  fs.rmSync(TMP_BASE, { recursive: true, force: true });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
// [/ai_s_emblem: Eyes-E2E-SelfTest]
