const fs = require('fs');
const { execSync } = require('child_process');

const COG = 'ai_desk';
const TEMP = 'stress_temp.txt';
let passed = 0;
let failed = 0;

const run = (file, args = '') => {
    execSync(`${COG} ${file} ${args}`, { encoding: 'utf8' });
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
        throw new Error(msg || `Expected equality.\nGot: ${a.slice(0, 100)}...\nExpected: ${b.slice(0, 100)}...`);
    }
};

const assertIncludes = (str, sub) => {
    if (!str.includes(sub)) {
        throw new Error(`Expected to include: ${sub}`);
    }
};

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
        const lines = s.split('\n');
        const sections = [];
        let inSection = false;
        let current = [];
        for (const line of lines) {
            if (line.trim().startsWith('//{')) {
                inSection = true;
                current = [line];
            } else if (line.trim().startsWith('//}')) {
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
//}
//{ 03:Z @low
Z
//}`);
    run(TEMP, 'test');
    run(TEMP, '<< state1');
    run(TEMP, 'focus');
    run(TEMP, '<< state2');

    for (let i = 0; i < 100; i++) {
        run(TEMP, '>> state1');
        run(TEMP, '>> state2');
    }

    run(TEMP, 'restore');
    // No crash = pass
});

// ============================================================
console.log('\n=== Phase 2: Edge Cases ===');
// ============================================================

test('Empty sections', () => {
    fs.writeFileSync(TEMP, `//{ 01:Empty1 @high
//}
//{ 02:Empty2 @low
//}
//{ 03:Empty3 @mid
//}`);
    run(TEMP, 'restore'); // UID付与 + restore
    const initial = fs.readFileSync(TEMP, 'utf8');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Sections only (no plain text)', () => {
    fs.writeFileSync(TEMP, `//{ 01:A @high
content A
//}
//{ 02:B @mid
content B
//}
//{ 03:C @low
content C
//}`);
    run(TEMP, 'restore'); // UID付与 + 安定化
    const initial = fs.readFileSync(TEMP, 'utf8');

    for (let i = 0; i < 30; i++) {
        run(TEMP, 'focus');
        run(TEMP, 'restore');
    }

    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Plain text only (no sections)', () => {
    const content = `Just plain text
No sections here
Line 3
Line 4`;
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(content + '\n', final); // may add trailing newline
});

test('Single section', () => {
    fs.writeFileSync(TEMP, `Header
//{ 01:Only @high
content
//}
Footer`);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

// ============================================================
console.log('\n=== Phase 3: Special Characters ===');
// ============================================================

test('Japanese content', () => {
    fs.writeFileSync(TEMP, `//{ 01:日本語 @high #タグ
これは日本語のコンテンツです。
漢字、ひらがな、カタカナ
//}
//{ 02:絵文字 @mid
🎉🚀💻🔥
//}`);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Base64-like content', () => {
    const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.repeat(100);
    fs.writeFileSync(TEMP, `//{ 01:Base64 @high
${base64}
//}
//{ 02:Another @low
data
//}`);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Special regex characters', () => {
    fs.writeFileSync(TEMP, `//{ 01:Regex @high
const regex = /\\d+\\.\\d+/g;
const str = "a$b^c*d+e?f";
//}
//{ 02:More @low
[brackets] {braces} (parens)
//}`);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');
    run(TEMP, 'focus');
    run(TEMP, 'restore');
    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

// ============================================================
console.log('\n=== Phase 4: Stress Combinations ===');
// ============================================================

test('Many sections rapid shuffle', () => {
    let content = '';
    for (let i = 1; i <= 50; i++) {
        const imp = ['@high', '@mid', '@low'][i % 3];
        content += `//{ ${String(i).padStart(2, '0')}:Sec${i} ${imp} #t${i % 5}\nContent ${i}\n//}\n`;
    }
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');

    for (let i = 0; i < 100; i++) {
        run(TEMP, 'focus');
        run(TEMP, 'restore');
    }

    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Mixed plain and sections stress', () => {
    let content = 'HEADER\n';
    for (let i = 1; i <= 20; i++) {
        content += `Plain text block ${i}\n`;
        content += `//{ ${String(i).padStart(2, '0')}:S${i} @mid\nCode ${i}\n//}\n`;
    }
    content += 'FOOTER\n';
    fs.writeFileSync(TEMP, content);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');

    run(TEMP, '<< mixed1');
    for (let i = 0; i < 50; i++) {
        run(TEMP, 'focus');
        run(TEMP, '>> mixed1');
        run(TEMP, 'restore');
    }

    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

test('Long content in sections', () => {
    const longLine = 'X'.repeat(10000);
    fs.writeFileSync(TEMP, `//{ 01:Long @high
${longLine}
//}
//{ 02:Short @low
short
//}`);
    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');

    for (let i = 0; i < 20; i++) {
        run(TEMP, 'focus');
        run(TEMP, 'restore');
    }

    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

// ============================================================
console.log('\n=== Phase 5: Real-world Simulation ===');
// ============================================================

test('Workflow simulation', () => {
    fs.writeFileSync(TEMP, `<!DOCTYPE html>
<html>
<head><title>App</title></head>
<body>
<div id="state">
//{ 01:State @high #core
let state = { count: 0 };
//}
</div>
<div id="logic">
//{ 02:Logic @high #core
function increment() { state.count++; }
//}
</div>
<div id="ui">
//{ 03:Render @mid #ui
function render() { console.log(state.count); }
//}
</div>
<div id="init">
//{ 04:Init @low #boot
window.onload = () => { render(); };
//}
</div>
</body>
</html>`);

    run(TEMP, 'restore');
    const initial = fs.readFileSync(TEMP, 'utf8');

    // Simulate real workflow
    run(TEMP, '<< original');
    run(TEMP, 'focus');           // AI作業用にソート
    run(TEMP, '<< ai_view');
    run(TEMP, '>> original');     // 戻す
    run(TEMP, 'focus');           // またソート
    run(TEMP, '>> ai_view');      // AI viewに
    run(TEMP, 'restore');         // git commit用に復元

    const final = fs.readFileSync(TEMP, 'utf8');
    assertEqual(initial, final);
});

// ============================================================
// Cleanup & Summary
// ============================================================

try { fs.unlinkSync(TEMP); } catch {}

console.log('\n' + '='.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
}
