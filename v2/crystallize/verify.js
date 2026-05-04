// verify.js — JS 側で hashVersion を実行、Go 側結果と比較するための入出力ツール
//
// 使い方:
//   ./crystallize --emit-cases | node verify.js
//   → JS hashVersion の結果を JSON で出力
//
// これと ./crystallize --emit-go-results を diff 比較する。

import { hashVersion } from '../ai-desk-core.js';
import { readFileSync } from 'node:fs';

// stdin から test cases を読む
const data = readFileSync(0, 'utf8');
const cases = JSON.parse(data);

const results = cases.map(c => ({
  name: c.name,
  hash: hashVersion(c.input),
}));

console.log(JSON.stringify(results, null, 2));
