const fs = require('fs');
const { execSync } = require('child_process');

const COG = 'node ai_desk.js';
const TEMP = 'stress_temp.txt';
let passed = 0;
let failed = 0;

const run = (file, args = '') => {
    return execSync(`${COG} ${file} ${args}`, { encoding: 'utf8', stdio: 'pipe' });
};

const test = (name, fn) => {
    process.stdout.write(`  ${name}... `);
    try {
        fn();
        console.log('✅');
        passed++;
    } catch (e) {
        console.log('❌');
        console.log(`    Error: ${e.message}`);
        failed++;
    }
};

const assertEqual = (a, b, msg = '') => {
    if (a !== b) throw new Error(msg || `Expected equality.\nGot: ${a}\nExpected: ${b}`);
};

const assertIncludes = (str, sub) => {
    if (!str.includes(sub)) throw new Error(`Expected to include: ${sub}`);
};

// ============================================================
console.log('\n=== Refined AI-Desk Tests ===');
// ============================================================

test('Skeleton mode (No mutation)', () => {
    const content = `//{ 01:A @high\nA\n//}\n//{ 02:B @low\nB\n//}\n`;
    fs.writeFileSync(TEMP, content);
    const out = run(TEMP, 'skeleton');
    assertIncludes(out, '01:A');
    assertIncludes(out, 'Collapsed');
    assertEqual(fs.readFileSync(TEMP, 'utf8'), content, 'File should not be changed by skeleton');
});

test('Focus mode (Extraction only)', () => {
    fs.writeFileSync(TEMP, `//{ 01:A @high $UID_A\nContentA\n//}\n//{ 02:B @low $UID_B\nContentB\n//}\n`);
    const out = run(TEMP, "focus '$UID_B'");
    console.log(`\nDEBUG focus output: [${out}]`);
    assertIncludes(out, 'ContentB');
    if (out.includes('ContentA')) throw new Error('Focus should only output targeted section');
});

test('Apply mode (In-place mutation)', () => {
    fs.writeFileSync(TEMP, `//{ 01:A @high $UID_A\nOld\n//}\n//{ 02:B @mid $UID_B\nStay\n//}\n`);
    const PATCH = 'patch_temp.txt';
    fs.writeFileSync(PATCH, `//{ 01:A @high $UID_A\nNew\n//}\n`);
    
    run(TEMP, `apply ${PATCH}`);
    const result = fs.readFileSync(TEMP, 'utf8');
    assertIncludes(result, 'New');
    assertIncludes(result, 'Stay');
    assertIncludes(result, '//{ 01:A'); // Header preserved
    
    fs.unlinkSync(PATCH);
});

test('Auto-UID generation on apply', () => {
    fs.writeFileSync(TEMP, `//{ 01:NewSection @high\nContent\n//}\n`);
    run(TEMP, 'skeleton'); // Should trigger ensureUIDs via reading
    // No, skeleton doesn't write back. Apply or focus - no.
    // In our new design, even focus/skeleton trigger ensureUIDs but don't write back.
    // To get UIDs saved, we need a mutation command or a dedicated 'fix' (which we didn't add).
    // Let's use 'apply' with an empty patch or just any apply to trigger save.
    const PATCH = 'empty_patch.txt';
    fs.writeFileSync(PATCH, '');
    run(TEMP, `apply ${PATCH}`);
    const result = fs.readFileSync(TEMP, 'utf8');
    assertIncludes(result, '$'); // Should have generated a UID
    fs.unlinkSync(PATCH);
});

test('Multi-language headers', () => {
    const html = 'test.html';
    fs.writeFileSync(html, `<!-- { 01:H @high\nHTML\n<!-- } -->\n`);
    const out = run(html, 'focus');
    assertIncludes(out, 'HTML');
    fs.unlinkSync(html);
});

// Cleanup
if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);

console.log(`\n==================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) process.exit(1);
