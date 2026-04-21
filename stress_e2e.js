const fs = require('fs');
const { execSync } = require('child_process');

const COG = 'node ai_desk.js';
const TEMP = 'stress_temp.txt';
let passed = 0;
let failed = 0;

const run = (file, args = '') => {
    // 全モードがstdoutデフォルトなので、ファイル更新が必要な場合は -w を付与
    let cmdArgs = args;
    if (['focus', 'restore', 'load', 'apply', '<<'].some(m => args.includes(m)) && !args.includes('-w')) {
        cmdArgs += ' -w';
    }
    return execSync(`${COG} ${file} ${cmdArgs}`, { encoding: 'utf8', stdio: 'pipe' });
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
    if (a !== b) {
        throw new Error(msg || `Expected equality.\nGot length: ${a.length}, Expected: ${b.length}\nGot (JSON): ${JSON.stringify(a.slice(0, 50))}...\nExpected: ${JSON.stringify(b.slice(0, 50))}...`);
    }
};

const assertIncludes = (str, sub) => {
    if (!str.includes(sub)) {
        throw new Error(`Expected to include: ${sub}`);
    }
};

// ============================================================
console.log('\n=== Phase 0: Stability & Idempotency ===');
// ============================================================

test('Restore idempotency (No-op on multiple runs)', () => {
    const content = `//{ 01:A @high
A
//}
//{ 02:B @low
B
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore'); // 初回: UID付与と正規化
    const firstRun = fs.readFileSync(TEMP, 'utf8');
    
    run(TEMP, 'restore'); // 2回目
    const secondRun = fs.readFileSync(TEMP, 'utf8');
    assertEqual(firstRun, secondRun, 'File changed on second restore run');
    
    run(TEMP, 'focus'); // focusしてからrestore
    run(TEMP, 'restore');
    const afterFocusRestore = fs.readFileSync(TEMP, 'utf8');
    assertEqual(firstRun, afterFocusRestore, 'File changed after focus-restore cycle');
});

// ============================================================
console.log('\n=== Phase 1: Bookmark Stress ===');
// ============================================================

test('Bookmark save/load 20 times', () => {
    fs.writeFileSync(TEMP, `//{ 01:A @high
A
//}
//{ 02:B @low
B
//}
//{ 03:C @mid
C
//}`);
    run(TEMP, 'restore'); // UID付与 + 安定化

    // セクション部分だけを抽出する関数
    const extractSections = s => {
        const lines = s.split(/\r?\n/);
        const sections = [];
        let inSection = false;
        let current = [];
        for (const line of lines) {
            if (line.trim().match(/^(?:\/\/|\/\*|<!--|#)\s*\{/)) {
                inSection = true;
                current = [line];
            } else if (line.trim().match(/^(?:\/\/|\/\*|<!--|-->|\*\/|#)\s*\}/)) {
                current.push(line);
                sections.push(current.join('\n'));
                inSection = false;
            } else if (inSection) {
                current.push(line);
            }
        }
        return sections.sort().join('\n---\n');
    };

    const initial = extractSections(fs.readFileSync(TEMP, 'utf8'));

    // 20個のブックマーク作成
    for (let i = 1; i <= 20; i++) {
        run(TEMP, `<< bm${i}`);
    }

    // ランダムに切り替え
    for (let i = 0; i < 50; i++) {
        const n = (i % 20) + 1;
        run(TEMP, `>> bm${n}`);
    }

    run(TEMP, 'restore');
    const final = extractSections(fs.readFileSync(TEMP, 'utf8'));

    assertEqual(initial, final, 'Section content mismatch after bookmark stress');
});

test('Rapid bookmark switching', () => {
    fs.writeFileSync(TEMP, `//{ 01:X @high
X
//}
//{ 02:Y @mid
Y
//}`);
    run(TEMP, 'restore');
    run(TEMP, '<< b1');
    run(TEMP, 'focus');
    run(TEMP, '<< b2');
    
    run(TEMP, '>> b1');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'X');
    run(TEMP, '>> b2');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'X');
});

// ============================================================
console.log('\n=== Phase 2: Edge Cases ===');
// ============================================================

test('Empty sections', () => {
    fs.writeFileSync(TEMP, `//{ 01:Empty @high\n//}\n`);
    run(TEMP, 'restore');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), '01:Empty');
});

test('Sections only (no plain text)', () => {
    const content = `//{ 01:A @high
A
//}
//{ 02:B @mid
B
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'focus');
    const out = fs.readFileSync(TEMP, 'utf8');
    assertIncludes(out, '01:A');
    assertIncludes(out, '02:B');
});

test('Plain text only (no sections)', () => {
    const content = `Just plain text
No sections here
Line 3
Line 4`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    assertEqual(fs.readFileSync(TEMP, 'utf8'), content);
});

test('Single section', () => {
    const content = `//{ 01:Single @high
Content
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'focus');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'Content');
});

// ============================================================
console.log('\n=== Phase 3: Special Characters ===');
// ============================================================

test('Japanese content', () => {
    const content = `//{ 01:日本語 @high
日本語のコンテンツ
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), '日本語のコンテンツ');
});

test('Base64-like content', () => {
    const content = `//{ 01:B64 @high
SGVsbG8gV29ybGQhCg==
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'SGVsbG8gV29ybGQhCg==');
});

test('Special regex characters', () => {
    const content = `//{ 01:Regex @high
.*+?^$[]{}()|\\
//}
`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), '.*+?^$[]{}()|\\');
});

// ============================================================
console.log('\n=== Phase 4: Stress Combinations ===');
// ============================================================

test('Many sections rapid shuffle', () => {
    let content = '';
    for(let i=0; i<100; i++) {
        content += `//{ ${i}:S${i} @mid\nContent ${i}\n//}\n`;
    }
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const out = fs.readFileSync(TEMP, 'utf8');
    assertIncludes(out, 'Content 0');
    assertIncludes(out, 'Content 99');
});

// ============================================================
console.log('\n=== Phase 5: Real-world Simulation ===');
// ============================================================

test('Workflow simulation', () => {
    fs.writeFileSync(TEMP, `//{ 01:Init @low
init();
//}
//{ 02:Logic @high
run();
//}
`);
    run(TEMP, 'restore'); // Normal state
    run(TEMP, 'focus');   // AI focus state
    
    // Patch simulation
    const patch = fs.readFileSync(TEMP, 'utf8').replace('run();', 'run_v2();');
    const PATCH = 'patch_temp.txt';
    fs.writeFileSync(PATCH, patch);
    
    run(TEMP, `apply ${PATCH}`);
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'run_v2();');
    
    run(TEMP, 'restore'); // Back to git-friendly state
    assertIncludes(fs.readFileSync(TEMP, 'utf8'), 'run_v2();');
    
    fs.unlinkSync(PATCH);
});

// ============================================================
console.log('\n=== Phase 6: Multi-Language Support ===');
// ============================================================

test('HTML format support', () => {
    const html = 'test.html';
    fs.writeFileSync(html, `<!-- { 01:H @high
<div>HTML</div>
<!-- } -->
`);
    run(html, 'restore');
    const out = fs.readFileSync(html, 'utf8');
    assertIncludes(out, '<!-- { 01:H @high');
    assertIncludes(out, '-->'); // Check for the fix of missing closing tag in header
    fs.unlinkSync(html);
});

test('CSS format support', () => {
    const css = 'test.css';
    fs.writeFileSync(css, `/* { 01:C @high
  color: red;
/* } */
`);
    run(css, 'restore');
    assertIncludes(fs.readFileSync(css, 'utf8'), 'color: red;');
    fs.unlinkSync(css);
});

// ============================================================
console.log('\n=== Phase 7: Skeleton mode ===');
// ============================================================

test('Skeleton mode output format', () => {
    fs.writeFileSync(TEMP, `//{ 01:H @high
High
//}
//{ 02:M @mid
Mid
//}
`);
    const out = run(TEMP, 'skeleton'); // Should output to stdout
    assertIncludes(out, 'High');
    assertIncludes(out, 'Collapsed');
});

// クリーンアップ
fs.unlinkSync(TEMP);

console.log(`\n==================================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) process.exit(1);
