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
    try { fn(); console.log('✅'); passed++; } 
    catch (e) { console.log('❌'); console.log(`    Error: ${e.message}`); failed++; }
};

const assertIncludes = (str, sub) => {
    if (!str.includes(sub)) throw new Error(`Expected to include: ${sub}`);
};

// ============================================================
console.log('\n=== Name-Only AI-Desk Tests ===');
// ============================================================

test('Skeleton mode', () => {
    const content = `//{ 01:ModuleA @high\nA\n//}\n//{ 02:ModuleB @low\nB\n//}\n`;
    fs.writeFileSync(TEMP, content);
    const out = run(TEMP, 'skeleton');
    assertIncludes(out, 'ModuleA');
    assertIncludes(out, 'Collapsed');
});

test('Focus mode (By Name)', () => {
    fs.writeFileSync(TEMP, `//{ 01:Target @high\nContent\n//}\n//{ 02:Other @low\nOther\n//}\n`);
    const out = run(TEMP, 'focus Target');
    assertIncludes(out, 'Content');
    if (out.includes('Other')) throw new Error('Should only output targeted section');
});

test('Apply mode (By Name Matching)', () => {
    fs.writeFileSync(TEMP, `//{ 01:Auth @high\nOld\n//}\n`);
    const PATCH = 'patch_temp.txt';
    fs.writeFileSync(PATCH, `//{ 01:Auth @high\nNew\n//}\n`);
    run(TEMP, `apply ${PATCH}`);
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'New');
    fs.unlinkSync(PATCH);
});

test('Safety: Skip duplicate names on apply', () => {
    fs.writeFileSync(TEMP, `//{ Dup @high\n1\n//}\n//{ Dup @high\n2\n//}\n`);
    const PATCH = 'patch_temp.txt';
    fs.writeFileSync(PATCH, `//{ Dup @high\nMODIFIED\n//}\n`);
    run(TEMP, `apply ${PATCH}`);
    if (fs.readFileSync(TEMP, 'utf8').includes('MODIFIED')) throw new Error('Should not apply to duplicate names');
    fs.unlinkSync(PATCH);
});

// Cleanup
if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);

console.log(`\n==================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) process.exit(1);
