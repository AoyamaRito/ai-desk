// verify-phase2.js — Phase 2 の sameArr / sameRefs を JS 側で実行して結果を JSON 出力
//
// 使い方:
//   ./crystallize --phase2 --emit-cases | node verify-phase2.js
//   → JS sameArr/sameRefs の結果を JSON で出力

import { sameArr, sameRefs } from '../ai-desk-core.js';
import { readFileSync } from 'node:fs';

const data = readFileSync(0, 'utf8');
const cases = JSON.parse(data);

const results = cases.map(c => {
  let result;
  if (c.op === 'sameArr') result = sameArr(c.a, c.b);
  else if (c.op === 'sameRefs') result = sameRefs(c.a, c.b);
  return { name: c.name, result };
});

console.log(JSON.stringify(results, null, 2));
