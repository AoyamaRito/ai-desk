const { execSync } = require('child_process');
const fs = require('fs');

const CMD = 'node ai_desk.js';
const TMPF = '/tmp/ai_desk_attack.js';
const PATCHF = '/tmp/ai_desk_patch.js';
let passed = 0, failed = 0;

function run(args) {
  try {
    return execSync(`${CMD} ${TMPF} ${args}`, { encoding: 'utf8', timeout: 5000 });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function write(content) { fs.writeFileSync(TMPF, content); }

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

console.log('\n=== Attack Tests (Refined) ===\n');

test('Empty input', () => {
  write('');
  run('skeleton');
});

test('Malformed header - no closing', () => {
  write('//{ name @high\ncode\n');
  const out = run('skeleton');
  assert(!out.includes('Collapsed'), 'Should not collapse if not closed');
});

test('Focus non-existent UID returns nothing', () => {
  write('//{ sec1 $AAA\ncode\n//}');
  const out = run("focus '$NONEXISTENT'");
  assert(out.trim() === '', 'Should return empty for non-existent UID');
});

test('Duplicate Name matching (Safe skip)', () => {
  // 名前が重複している場合は安全のため apply しない
  write('//{ A $U1\na1\n//}\n//{ A $U2\na2\n//}');
  fs.writeFileSync(PATCHF, '//{ A\nmodified\n//}');
  run(`apply ${PATCHF}`);
  const result = fs.readFileSync(TMPF, 'utf8');
  assert(!result.includes('modified'), 'Should not apply to duplicate names');
});

test('Apply preserves plain text', () => {
  write('plain1\n//{ A $U1\na\n//}\nplain2');
  fs.writeFileSync(PATCHF, '//{ A $U1\nmodified\n//}');
  run(`apply ${PATCHF}`);
  const result = fs.readFileSync(TMPF, 'utf8');
  assert(result.startsWith('plain1') && result.endsWith('plain2'), 'Plain text should be preserved');
});

// Cleanup
if (fs.existsSync(TMPF)) fs.unlinkSync(TMPF);
if (fs.existsSync(PATCHF)) fs.unlinkSync(PATCHF);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
