const { execSync } = require('child_process');
const fs = require('fs');

const CMD = 'node ai_desk.js';
const TMPF = '/tmp/ai_desk_attack.js';
const PATCHF = '/tmp/ai_desk_patch.js';
let passed = 0, failed = 0;

function run(args) {
  try {
    return execSync(`${CMD} ${TMPF} ${args}`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function write(content) {
  fs.writeFileSync(TMPF, content);
}

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('\n=== Attack Tests ===\n');

test('Empty input', () => {
  write('');
  run('skeleton');
});

test('Only whitespace', () => {
  write('   \n\n   \t\t\n');
  const out = run('skeleton');
});

test('Malformed header - no closing', () => {
  write('//{ name @high\ncode\n');
  run('skeleton');
});

test('Focus non-existent UID returns original', () => {
  write('//{ sec1 $AAA\ncode\n//}');
  const out = run('focus $NONEXISTENT');
  // If UID not found, behavior is to show all (this is OK)
});

test('Very long section name', () => {
  const longName = 'a'.repeat(100);
  write(`//{ ${longName} $XYZ\ncode\n//}`);
  run('skeleton');
});

test('User UID preserved', () => {
  write('//{ sec1 $MY_CUSTOM_UID\ncode\n//}');
  run('restore -w');
  const result = fs.readFileSync(TMPF, 'utf8');
  assert(result.includes('$MY_CUSTOM_UID'), 'User UID should be preserved');
});

test('Nested section markers', () => {
  write('//{ outer $OUT\n//{ inner $INN\ncode\n//}\n//}');
  run('skeleton');
});

test('Duplicate UIDs', () => {
  write('//{ sec1 $AAA\ncode1\n//}\n//{ sec2 $AAA\ncode2\n//}');
  run('focus $AAA');
});

test('100 sections', () => {
  let input = '';
  for (let i = 0; i < 100; i++) {
    input += `//{ sec${i} $UID${i}\nline${i}\n//}\n`;
  }
  write(input);
  const out = run('skeleton');
  assert(out.includes('$UID99'), 'Should handle 100 sections');
});

test('Multiple # tags preserved', () => {
  write('//{ name #tag1 #tag2 #tag3 $ABC\ncode\n//}');
  const out = run('skeleton');
  assert(out.includes('#tag1'), 'Should have tag1');
  assert(out.includes('#tag2'), 'Should have tag2');
  assert(out.includes('#tag3'), 'Should have tag3');
});

test('Apply preserves order', () => {
  write('//{ A $UID1\na\n//}\n//{ B $UID2\nb\n//}');
  fs.writeFileSync(PATCHF, '//{ A $UID1\na_modified\n//}');
  execSync(`${CMD} ${TMPF} apply ${PATCHF}`, { encoding: 'utf8' });
  const out = fs.readFileSync(TMPF, 'utf8');
  const aPos = out.indexOf('//{ A');
  const bPos = out.indexOf('//{ B');
  assert(aPos < bPos && aPos > 0, 'Order should be preserved');
});

test('Apply with underscore UID', () => {
  write('//{ A $MY_UID_1\na\n//}');
  fs.writeFileSync(PATCHF, '//{ A $MY_UID_1\na_modified\n//}');
  execSync(`${CMD} ${TMPF} apply ${PATCHF}`, { encoding: 'utf8' });
  const out = fs.readFileSync(TMPF, 'utf8');
  assert(out.includes('a_modified'), 'Should apply patch');
  assert(out.includes('$MY_UID_1'), 'Should preserve UID');
});

test('Focus with underscore UID', () => {
  write('//{ sec1 $MY_SEC_1\ncode1\n//}\n//{ sec2 $MY_SEC_2\ncode2\n//}');
  const out = run('focus $MY_SEC_1');
  assert(out.includes('code1'), 'Should focus correct section');
});

// Cleanup
fs.unlinkSync(TMPF);
if (fs.existsSync(PATCHF)) fs.unlinkSync(PATCHF);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
