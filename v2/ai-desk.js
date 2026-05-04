// ai-desk.js
// Node.js CLI Shell for ai-desk v2
//
// This file handles I/O (filesystem, process) and delegates logic to ai-desk-core.js.
// Isomorphic Architecture: logic is platform-agnostic, shell is Node-specific.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import {
  Block, Graph, parseJS, parseMD, checkBraces, inferTags,
  exportModule, exportMermaid,
  virtualHeavy, expandVirtualHeavy, virtualApply,
  applyToBlock, applyBlockSmart, applyPatch, resolveImportsPure,
  constraintBlock, evalConstraint,
  observationBlock,
  graphStats, blockContext, formatContextForLLM,
  sameArr, sameRefs, hashVersion
} from './ai-desk-core.js';
import {
  Axioms, BlockTypes, Taboos, Vocabulary,
  Kernel as BibleKernel, VERSION as BIBLE_VERSION,
} from './AiRunAndRead_BIBLE.js';

// ============================================================
// Node-specific I/O helpers
// ============================================================

export function loadProject(files) {
  const graph = new Graph();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const blocks = f.endsWith('.md') ? parseMD(src, f) : parseJS(src, f);
    for (const b of blocks) graph.add(b);
  }
  return graph;
}

export function saveGraph(graph, path) {
  writeFileSync(path, JSON.stringify(graph.toJSON(), null, 2));
  return path;
}

export function loadGraph(path) {
  return Graph.fromJSON(JSON.parse(readFileSync(path, 'utf8')));
}

export function buildAndSave(files, outPath) {
  const g = loadProject(files);
  saveGraph(g, outPath);
  return g;
}

export function exportToFile(graph, moduleId, outPath) {
  const code = exportModule(graph, moduleId);
  writeFileSync(outPath, code);
  return outPath;
}

// Node-specific path resolver for resolveImports
function nodeResolvePath(fromId, target) {
  const baseDir = dirname(pathResolve(fromId));
  const abs = pathResolve(baseDir, target);
  const cand = [abs, abs + '.js', abs + '/index.js'].find(c => existsSync(c));
  return cand ? pathResolve(cand) : pathResolve(abs);
}

export function resolveImports(graph) {
  // graph 内の module は絶対パスで正規化しておく必要がある
  const idToAbs = new Map();
  for (const b of graph.byType('module')) idToAbs.set(pathResolve(b.id), b.id);

  return resolveImportsPure(graph, (mId, target) => {
    const abs = nodeResolvePath(mId, target);
    return idToAbs.get(abs);
  });
}

// ============================================================
// CLI hints
// ============================================================

const HINT_STATE_FILE = '.ai-desk-state.json';
const HINTS = [
  {
    key: '3dplus',
    detect: (g) => {
      const pats = [/\bWebGL2?\b/, /\bWebGPU\b/i, /\bTHREE\./, /\bnew\s+THREE\b/, /\b(?:Mat4|Matrix4|Vector3|Vec3|Quaternion)\b/];
      const matched = new Set();
      for (const b of g.all()) {
        const c = b.content || '';
        for (const re of pats) { const m = re.exec(c); if (m) matched.add(m[0]); if (matched.size >= 5) break; }
        if (matched.size >= 5) break;
      }
      return matched.size > 0 ? [...matched] : null;
    },
    render: (m) => `\n─── ai-desk hint ───\n  3D code detected: ${m.join(', ')}\n  → v2/3dplus/ provides a CPU 3D Twin.\n────────────────────\n`,
  },
];

function runHintsOnce(graphOrBlocks) {
  const g = (typeof graphOrBlocks.all === 'function') ? graphOrBlocks : { all: () => graphOrBlocks };
  let state = { hints_shown: [] };
  try { state = JSON.parse(readFileSync(HINT_STATE_FILE, 'utf8')); } catch {}
  let dirty = false;
  for (const h of HINTS) {
    if (state.hints_shown.includes(h.key)) continue;
    const m = h.detect(g);
    if (m) { process.stderr.write(h.render(m)); state.hints_shown.push(h.key); dirty = true; }
  }
  if (dirty) try { writeFileSync(HINT_STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

// ============================================================
// CLI Command Loop
// ============================================================

async function runCommand() {
  const [cmd, ...args] = process.argv.slice(2);
  const cliLoadProject = (files) => {
    const g = loadProject(files);
    runHintsOnce(g);
    return g;
  };
  const cliLoadGraph = (path) => {
    const g = loadGraph(path);
    runHintsOnce(g);
    return g;
  };

  switch (cmd) {
    case 'skeleton': {
      if (!args[0]) return console.error('usage: skeleton <file>');
      const g = cliLoadProject([args[0]]);
      for (const b of g.all()) {
        console.log(`${b.id} (${b.type})`);
        for (const r of b.refs) console.log(`  ${r.kind} -> ${r.target}`);
      }
      break;
    }
    case 'focus': {
      if (!args[0] || !args[1]) return console.error('usage: focus <file> <id>');
      const g = cliLoadProject([args[0]]);
      const b = g.get(args[1]);
      if (!b) return console.error('not found:', args[1]);
      console.log(b.content);
      break;
    }
    case 'graph': {
      if (args.length === 0) return console.error('usage: graph <file...>');
      console.log(JSON.stringify(cliLoadProject(args).toJSON(), null, 2));
      break;
    }
    case 'impact': {
      if (!args[0] || !args[1]) return console.error('usage: impact <file> <id>');
      const g = cliLoadProject([args[0]]);
      for (const b of g.impact(args[1])) console.log(b.id);
      break;
    }
    case 'self': {
      const me = new URL(import.meta.url).pathname;
      const blocks = parseJS(readFileSync(me, 'utf8'), 'ai-desk');
      runHintsOnce(blocks);
      console.log(`self-parse: ${blocks.length} blocks extracted from ${me}`);
      for (const b of blocks) {
        console.log(`  ${b.id.padEnd(40)} ${b.type.padEnd(10)} calls:${b.refs.filter(r => r.kind === 'calls').length} [${b.tags.join(',')}]`);
      }
      break;
    }
    case 'bible-info':
      console.log(`BIBLE.js version: ${BIBLE_VERSION}`);
      console.log(`[Axioms]`);
      for (const a of Object.values(Axioms)) console.log(`  - ${a.id} ${a.name}`);
      console.log(`\nBlock types`);
      for (const [name, t] of Object.entries(BlockTypes)) console.log(`  - ${name}: ${t.purpose.slice(0, 60)}`);
      console.log(`\nTaboos`);
      for (const t of Taboos) console.log(`  ${t.id}. ${t.name}`);
      console.log(`\nVocabulary`);
      for (const [k, v] of Object.entries(Vocabulary.use)) console.log(`  - ${k}: ${v.meaning}`);
      for (const v of Vocabulary.avoid) console.log(`  - avoid ${v.term}: ${v.reason.slice(0, 60)}`);
      break;
    case 'bible-check': {
      if (!args[0]) return console.error('usage: bible-check <file>');
      const res = BibleKernel.diagnose(readFileSync(args[0], 'utf8'), args[0]);
      console.log(JSON.stringify(res, null, 2));
      if (!res.ok) process.exit(1);
      break;
    }
    case 'bible-summon':
      process.stdout.write(BibleKernel.summonContext(args, { spotlight: true }));
      break;
    case 'tag': {
      if (!args[0] || !args[1]) return console.error('usage: tag <file> <tag>');
      const g = cliLoadProject([args[0]]);
      for (const b of g.byTag(args[1])) console.log(`  ${b.id} [${b.tags.join(',')}]`);
      break;
    }
    case 'tags': {
      if (!args[0]) return console.error('usage: tags <file>');
      const g = cliLoadProject([args[0]]);
      const counts = new Map();
      for (const b of g.all()) for (const t of b.tags) counts.set(t, (counts.get(t) || 0) + 1);
      for (const [t, c] of Array.from(counts.entries()).sort((a,b) => b[1]-a[1])) console.log(`  ${t.padEnd(15)} ${c}`);
      break;
    }
    case 'save': {
      if (args.length < 2) return console.error('usage: save <out.json> <files...>');
      const [out, ...files] = args;
      buildAndSave(files, out);
      console.log(`saved → ${out}`);
      break;
    }
    case 'load': {
      if (!args[0]) return console.error('usage: load <in.json>');
      const g = cliLoadGraph(args[0]);
      const v = g.verify();
      console.log(`loaded ${g.all().length} blocks, verify: ${JSON.stringify(v)}`);
      if (v.ok) console.log('ok: true');
      break;
    }
    case 'search': {
      if (!args[0] || !args[1]) return console.error('usage: search <file> <query>');
      const g = cliLoadProject([args[0]]);
      const hits = g.search(args[1]);
      for (const h of hits) console.log(`  ${h.block.id} (v${h.versionIndex})`);
      console.log(`${hits.length} hits`);
      break;
    }
    case 'diff': {
      if (!args[0] || !args[1]) return console.error('usage: diff <file> <id> [i] [j]');
      const g = cliLoadProject([args[0]]);
      const b = g.get(args[1]);
      if (!b) return console.error('not found:', args[1]);
      console.log(JSON.stringify(b.diff(args[2]?Number(args[2]):null, args[3]?Number(args[3]):null), null, 2));
      break;
    }
    case 'blame': {
      if (!args[0] || !args[1] || !args[2]) return console.error('usage: blame <file> <id> <target>');
      const g = cliLoadProject([args[0]]);
      const b = g.get(args[1]);
      if (!b) return console.error('not found:', args[1]);
      console.log(JSON.stringify(b.blameRef(args[2]) || 'no such ref', null, 2));
      break;
    }
    case 'apply': {
      if (args.length < 3) return console.error('usage: apply <graph.json> <patch.js> <moduleId>');
      const g = cliLoadGraph(args[0]);
      const updates = applyPatch(g, readFileSync(args[1], 'utf8'), args[2]);
      saveGraph(g, args[0]);
      for (const u of updates) console.log(`  ${u.action.padEnd(10)} ${u.id}`);
      break;
    }
    case 'apply-block': {
      if (args.length < 3) return console.error('usage: apply-block <graph.json> <id> <patch|->');
      const g = cliLoadGraph(args[0]);
      const src = args[2] === '-' ? readFileSync(0, 'utf8') : readFileSync(args[2], 'utf8');
      const res = applyBlockSmart(g, args[1], src);
      saveGraph(g, args[0]);
      console.log(`${res.action}: ${args[1]} (v${res.block.versions.length})`);
      break;
    }
    case 'resolve': {
      if (!args[0]) return console.error('usage: resolve <graph.json>');
      const g = cliLoadGraph(args[0]);
      const res = resolveImports(g);
      saveGraph(g, args[0]);
      console.log(`resolved in ${res.length} modules`);
      break;
    }
    case 'lint': {
      if (!args[0]) return console.error('usage: lint <file>');
      const g = cliLoadProject([args[0]]);
      const issues = g.lint();
      for (const i of issues) console.log(`  ${i.kind.padEnd(15)} ${JSON.stringify(i)}`);
      console.log(`${issues.length} issues`);
      break;
    }
    case 'export': {
      if (args.length < 2) return console.error('usage: export <graph.json> <moduleId> [out.js]');
      const g = cliLoadGraph(args[0]);
      const code = exportModule(g, args[1]);
      if (args[2]) { writeFileSync(args[2], code); console.log(`exported → ${args[2]}`); }
      else process.stdout.write(code);
      break;
    }
    case 'stats': {
      if (!args[0]) return console.error('usage: stats <file>');
      console.log(JSON.stringify(graphStats(cliLoadProject([args[0]])), null, 2));
      break;
    }
    case 'heavy': {
      if (args.length < 2) return console.error('usage: heavy <file> <root> [--depth=N]');
      let d = Infinity; for (const a of args) { const m = a.match(/^--depth=(\d+)$/); if (m) d = Number(m[1]); }
      process.stdout.write(expandVirtualHeavy(cliLoadProject([args[0]]), args[1], { depth: d }));
      break;
    }
    case 'virtual-apply': {
      if (args.length < 3) return console.error('usage: virtual-apply <graph.json> <root> <patch>');
      const g = cliLoadGraph(args[0]);
      const src = args[2] === '-' ? readFileSync(0, 'utf8') : readFileSync(args[2], 'utf8');
      for (const u of virtualApply(g, args[1], src)) console.log(`  ${u.action.padEnd(20)} ${u.id}`);
      saveGraph(g, args[0]);
      break;
    }
    case 'mermaid': {
      if (!args[0]) return console.error('usage: mermaid <file>');
      console.log(exportMermaid(cliLoadProject([args[0]])));
      break;
    }
    case 'infer-tags': {
      if (args.length < 2) return console.error('usage: infer-tags <file> <id>');
      const g = cliLoadProject([args[0]]);
      const b = g.get(args[1]);
      if (b) console.log(`tags: ${inferTags(b.content, b.type).join(', ')}`);
      break;
    }
    case 'context': {
      if (args.length < 2) return console.error('usage: context <file> <id> [depth]');
      const g = cliLoadProject([args[0]]);
      process.stdout.write(formatContextForLLM(blockContext(g, args[1], { depth: args[2]?Number(args[2]):1 }), args[1]));
      break;
    }
    case 'e2e': {
      // 実際の e2e.js を child process で起動(name と挙動を一致させる)
      const { spawnSync } = await import('node:child_process');
      const here = new URL('./e2e.js', import.meta.url).pathname;
      const r = spawnSync('node', [here], { stdio: 'inherit' });
      process.exit(r.status ?? 0);
    }
    case 'demo': {
      runDemo();
      break;
    }
    default:
      console.log('ai-desk v2 — All-as-Block, Versions-as-Body architecture');
      console.log('Block.versions が本体。すべてはここから派生する。');
      console.log('');
      console.log('first-time? → "node ai-desk.js bible-info" で公理 A0〜A13 を浴びる');
      console.log('動作確認?    → "node ai-desk.js demo" で in-memory な Block / Graph を見る');
      console.log('全テスト?    → "node ai-desk.js e2e" or "npm test"(166 tests, all green)');
      console.log('');
      console.log('Bible 系(まずここから):');
      console.log('  bible-info, bible-check <file>, bible-summon');
      console.log('');
      console.log('Block / Graph 操作:');
      console.log('  skeleton, focus, graph, impact, self, tag, tags, search, lint, stats, context');
      console.log('  save, load, diff, blame, apply, apply-block, resolve, export, mermaid, infer-tags');
      console.log('');
      console.log('Virtual Heavy Function:');
      console.log('  heavy, virtual-apply');
      console.log('');
      console.log('テスト / デモ:');
      console.log('  e2e(node e2e.js を spawn、111 tests), demo(in-memory 動作確認)');
      break;
  }
}

// 旧 runSelfTest を rename: ハードコード文字列だけで verify してないので「self-test」と
// 名乗らせない。`demo` に rename して in-memory な Block / Graph 動作確認の position に。
function runDemo() {
  process.stdout.write('=== ai-desk demo (in-memory Block / Graph) ===\n');
  const a = new Block({ id: 'a', type: 'function' });
  a.commit({ content: 'function a(){}' });
  const b = new Block({ id: 'b', type: 'function' });
  b.commit({ content: 'function b(){ a(); }', refs: [{ kind: 'calls', target: 'a' }] });
  const g = new Graph([a, b]);
  process.stdout.write(`graph size: ${g.all().length}\n`);
  process.stdout.write(`a impact (forward): ${JSON.stringify(g.impact('a').map(b => b.id))}\n`);
  process.stdout.write(`verify (hash chain): ${JSON.stringify(g.verify())}\n`);
  process.stdout.write('\nOK(本物の test は "node ai-desk.js e2e" or "npm test")\n');
}

if (typeof process !== 'undefined' && import.meta.url.endsWith(process.argv[1])) {
  runCommand().catch(console.error);
}
