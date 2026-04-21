const fs = require('fs');
const { execSync } = require('child_process');

const COG = 'node ai_desk.js';
const TEMP = 'mega_stress_temp.js';

console.log('=== Mega Stress Test ===');

// 1. 大規模ファイルの生成
console.log('Generating massive file (10,000 sections, ~10MB)...');
let content = '//@ order = \n';
content += 'const giantData = [];\n\n';

for (let i = 0; i < 10000; i++) {
    const importance = i % 3 === 0 ? '@high' : i % 2 === 0 ? '@mid' : '@low';
    const tag = `#tag${i % 10}`;
    const sortOrder = String(i).padStart(5, '0');
    
    content += `//{ ${sortOrder}:Section_${i} ${importance} ${tag}\n`;
    content += `function process_${i}() {\n`;
    content += `  // Data block ${i}\n`;
    content += `  return ${i * 100};\n`;
    content += `}\n`;
    content += `giantData.push(process_${i});\n`;
    content += `//}\n\n`;
}

fs.writeFileSync(TEMP, content);
const stats = fs.statSync(TEMP);
console.log(`Generated file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// 2. 計測関数の定義
function measureTime(name, cmd) {
    process.stdout.write(`  ${name.padEnd(20)} ... `);
    const start = performance.now();
    try {
        execSync(cmd, { encoding: 'utf8' });
        const end = performance.now();
        console.log(`${((end - start) / 1000).toFixed(3)}s ✅`);
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }
}

// 3. テストの実行
console.log('\nRunning operations:');
measureTime('1. Initial Restore', `${COG} ${TEMP} restore`);
measureTime('2. Focus Mode', `${COG} ${TEMP} focus`);
measureTime('3. Save Bookmark', `${COG} ${TEMP} "<<" stress_bm`);
measureTime('4. Restore Mode', `${COG} ${TEMP} restore`);
measureTime('5. Load Bookmark', `${COG} ${TEMP} ">>" stress_bm`);
measureTime('6. Skeleton Mode', `${COG} ${TEMP} skeleton > skeleton_output.js`);

// 4. パッチ適用のストレステスト
console.log('\nPatch application stress:');
const patchFile = 'mega_patch.js';
let patchContent = '';
// 1000個のセクションを更新するパッチを作成
for (let i = 0; i < 1000; i++) {
    const targetIdx = i * 10; // 0, 10, 20...
    const sortOrder = String(targetIdx).padStart(5, '0');
    patchContent += `//{ ${sortOrder}:Section_${targetIdx}\n`;
    patchContent += `function process_${targetIdx}() {\n`;
    patchContent += `  // UPDATED Data block ${targetIdx}\n`;
    patchContent += `  return ${targetIdx * 100} * 2;\n`;
    patchContent += `}\n`;
    patchContent += `//}\n\n`;
}
fs.writeFileSync(patchFile, patchContent);

measureTime('7. Apply 1000 patches', `${COG} ${TEMP} apply ${patchFile}`);

// クリーンアップ
console.log('\nCleaning up...');
fs.unlinkSync(TEMP);
fs.unlinkSync(patchFile);
fs.unlinkSync('skeleton_output.js');
console.log('Done.');
