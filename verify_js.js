const fs = require('fs');
const { execSync } = require('child_process');

const JS_APP = 'node ai_desk.js';
const TEST_FILE = 'test_run.js';

function run(args) {
    console.log(`> ${JS_APP} ${args}`);
    return execSync(`${JS_APP} ${args}`, { encoding: 'utf8' });
}

// テスト用ファイルの作成
fs.writeFileSync(TEST_FILE, `
//{ 02:Main @high #app
function main() {
  console.log("Hello");
}
//}
//{ 01:Utils @low #lib
function add(a, b) {
  return a + b;
}
//}
`);

console.log('--- Initial File ---');
console.log(fs.readFileSync(TEST_FILE, 'utf8'));

// Focusモード実行
run(`${TEST_FILE} focus`);
console.log('--- After Focus ---');
console.log(fs.readFileSync(TEST_FILE, 'utf8'));

// Restoreモードの検証 (順番を入れ替えてから)
const manualContent = `//@ order = $8120B, $8700F

//{ 02:Main @high #app $8700F
function main() {
  console.log("Hello");
}
//}
//{ 01:Utils @low #lib $8120B
function add(a, b) {
  return a + b;
}
//}
`;
fs.writeFileSync(TEST_FILE, manualContent);
console.log('--- Manually Reordered (Utils first in order) ---');
run(`${TEST_FILE} restore`);
console.log(fs.readFileSync(TEST_FILE, 'utf8'));

// Bookmarkテスト
console.log('--- Bookmark Test ---');
run(`${TEST_FILE} "<<" mybook`);
const listOutput = run(`${TEST_FILE} list`);
console.log('List Output:', listOutput);

// Applyテスト
console.log('--- Apply Test ---');
const patchFile = 'patch.txt';
fs.writeFileSync(patchFile, `
//{ 02:Main @high $8700F
function main() {
  console.log("Updated Hello");
}
//}
`);
run(`${TEST_FILE} apply ${patchFile}`);
console.log(fs.readFileSync(TEST_FILE, 'utf8'));

// クリーンアップ
fs.unlinkSync(patchFile);
// fs.unlinkSync(TEST_FILE);

