#!/usr/bin/env node
// eval.js — doc-exec 効果測定ハーネス (手動採点 MVP)
//
// ワークフロー:
//   1. node eval.js prompt deps     → eval/prompts/deps.md を生成 (deps バンドル + 質問)
//      node eval.js prompt bundle   → eval/prompts/bundle.md (関連リスト無し bundle + 質問)
//      node eval.js prompt direct   → eval/prompts/direct.md (個別 md を素で連結 + 質問)
//   2. 各 prompt を別の LLM (Claude / GPT / Gemini 等) に渡し、回答を
//      eval/answers/<context>.md に保存 (q1: ... 形式)
//   3. node eval.js score deps      → answers/deps.md を questions.json の基準で採点
//      node eval.js score all       → 3 context 全て採点して比較表を出す
//
// 採点モデル:
//   - 各 question に must_include キーワードを設定
//   - 回答にキーワードが何個含まれているかで部分点
//   - 完全自動化はしない (LLM 答えの意味判断は人間 / 別 LLM が最終確認)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // sandbox/doc-exec/
const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const PROMPTS_DIR = path.join(__dirname, 'prompts');
const ANSWERS_DIR = path.join(__dirname, 'answers');

const CONTEXTS = {
  deps:   { file: 'all-docs-deps.md', label: 'A: deps (関連リスト + glossary 付き bundle)' },
  bundle: { file: 'all-docs.md',      label: 'B: bundle (素の連結のみ)' },
  direct: { file: null,                label: 'C: direct (個別 md を素のまま連結 — bundle.js なし)' },
};

function loadQuestions() {
  return JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8')).questions;
}

function buildContextDirect() {
  // direct: ../.. の md を素のまま、変換なしで連結。bundle-docs.js のスキップ条件と同じセット。
  const REPO = path.resolve(ROOT, '..', '..');
  const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.claude', 'snapshots']);
  const EXCLUDE_FILE_RE = [
    /^all-docs.*\.md$/, /^glossary(-deps)?\.md$/, /-deps\.md$/, /-term\.md$/,
    /^converted-/, /^expanded-/, /^bible-term\.md$/,
  ];
  const isExcluded = n => EXCLUDE_FILE_RE.some(re => re.test(n));
  const out = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name)) continue;
        walk(full);
      } else if (e.isFile() && /\.md$/i.test(e.name) && !isExcluded(e.name)) {
        const rel = path.relative(REPO, full);
        out.push(`\n=== FILE: ${rel} ===\n` + fs.readFileSync(full, 'utf8'));
      }
    }
  }
  walk(REPO);
  return out.join('\n');
}

function loadContext(ctx) {
  if (ctx === 'direct') return buildContextDirect();
  const f = path.join(ROOT, CONTEXTS[ctx].file);
  if (!fs.existsSync(f)) {
    console.error(`Error: ${f} missing. Run bundle-docs.js / prepend-deps.js first.`);
    process.exit(1);
  }
  return fs.readFileSync(f, 'utf8');
}

function cmdPrompt(ctx) {
  if (!CONTEXTS[ctx]) { console.error(`Unknown context: ${ctx}`); process.exit(1); }
  const questions = loadQuestions();
  const context = loadContext(ctx);
  const qBlock = questions.map(q => `## ${q.id}\n\n${q.q}`).join('\n\n');
  const prompt = `# doc-exec evaluation — context: ${CONTEXTS[ctx].label}

以下に与える文書群のみを根拠に、最後の質問群に答えてください。
推測ではなく文書内の記述に基づいて答えること。
各回答は 3 行以内、回答ヘッダは "## <id>" を保つこと。

---

${context}

---

# 質問群

${qBlock}
`;
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  const out = path.join(PROMPTS_DIR, `${ctx}.md`);
  fs.writeFileSync(out, prompt);
  console.error(`[prompt] wrote ${out} (${prompt.length} bytes)`);
  console.error(`[prompt] paste into your LLM, save its answers to ${path.join(ANSWERS_DIR, ctx + '.md')}`);
}

function parseAnswers(text) {
  // "## q1-heavy-function" 形式のヘッダで分割。最後のセクションも確実に取るため split で実装。
  const out = {};
  const parts = text.split(/^##\s+/m);
  for (const part of parts) {
    const m = part.match(/^([\w-]+)\s*\n([\s\S]*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function scoreOne(question, answer) {
  if (!answer || answer.trim() === '') return { hits: 0, total: question.must_include.length, missed: question.must_include };
  const lower = answer.toLowerCase();
  const hits = [];
  const missed = [];
  for (const kw of question.must_include) {
    if (lower.includes(kw.toLowerCase())) hits.push(kw); else missed.push(kw);
  }
  return { hits: hits.length, total: question.must_include.length, missed };
}

function cmdScore(target) {
  const questions = loadQuestions();
  const targets = target === 'all' ? Object.keys(CONTEXTS) : [target];
  const results = {};
  for (const ctx of targets) {
    const f = path.join(ANSWERS_DIR, `${ctx}.md`);
    if (!fs.existsSync(f)) {
      console.error(`[skip] ${ctx}: ${f} not found`);
      continue;
    }
    const answers = parseAnswers(fs.readFileSync(f, 'utf8'));
    const perQ = {};
    let totalHits = 0, totalNeeded = 0;
    for (const q of questions) {
      const s = scoreOne(q, answers[q.id]);
      perQ[q.id] = s;
      totalHits += s.hits;
      totalNeeded += s.total;
    }
    results[ctx] = { perQ, totalHits, totalNeeded, pct: totalNeeded ? (totalHits / totalNeeded * 100).toFixed(1) : '0.0' };
  }
  // 出力
  console.log('\n=== doc-exec eval scoreboard ===\n');
  const ctxKeys = Object.keys(results);
  if (ctxKeys.length === 0) {
    console.log('No answer files found. Run `node eval.js prompt <ctx>` then fill answers/<ctx>.md.');
    return;
  }
  console.log('Question                          ' + ctxKeys.map(c => c.padEnd(12)).join(''));
  console.log('-'.repeat(34 + ctxKeys.length * 12));
  for (const q of questions) {
    const row = q.id.padEnd(34) + ctxKeys.map(c => {
      const s = results[c].perQ[q.id];
      return `${s.hits}/${s.total}`.padEnd(12);
    }).join('');
    console.log(row);
  }
  console.log('-'.repeat(34 + ctxKeys.length * 12));
  console.log('TOTAL'.padEnd(34) + ctxKeys.map(c => `${results[c].totalHits}/${results[c].totalNeeded} (${results[c].pct}%)`.padEnd(12)).join(''));
  console.log('\n注意: キーワード一致は必要条件であって十分条件ではない。意味判定は人間が最終確認すること。');
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'prompt') cmdPrompt(arg);
else if (cmd === 'score') cmdScore(arg);
else {
  console.log(`Usage:
  node eval.js prompt <deps|bundle|direct>   # build prompt file
  node eval.js score  <deps|bundle|direct|all>  # score answers/<ctx>.md against questions.json

Workflow:
  1) node eval.js prompt deps     → prompts/deps.md
  2) paste into LLM, save answers → answers/deps.md  (use ## <q-id> headers)
  3) repeat for bundle / direct
  4) node eval.js score all       → comparison table
`);
}
