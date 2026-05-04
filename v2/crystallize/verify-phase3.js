// verify-phase3.js — nodeId / inferTags / checkBraces を JS 側で実行
//
// 使い方:
//   ./crystallize --phase3 --emit-cases | node verify-phase3.js
//
// 注: nodeId は ai-desk-core.js で非 export なので、ここで同等再実装する。

import { inferTags, checkBraces } from '../ai-desk-core.js';
import { readFileSync } from 'node:fs';

function nodeId(id) {
  return 'n_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
}

const data = readFileSync(0, 'utf8');
const cases = JSON.parse(data);

const results = cases.map(c => {
  let result;
  if (c.op === 'nodeId') result = nodeId(c.content);
  else if (c.op === 'inferTags') result = inferTags(c.content, c.type || null);
  else if (c.op === 'checkBraces') result = checkBraces(c.content);
  return { name: c.name, result };
});

console.log(JSON.stringify(results, null, 2));
