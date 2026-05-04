// verify-phase4.js — parseJS helpers を JS 側で実行
import { matchBrace, matchParen, findFunctionBody, extractInlineTags } from '../ai-desk-core.js';
import { readFileSync } from 'node:fs';

const data = readFileSync(0, 'utf8');
const cases = JSON.parse(data);

const results = cases.map(c => {
  let result;
  if (c.op === 'matchBrace') result = matchBrace(c.source, c.openIdx);
  else if (c.op === 'matchParen') result = matchParen(c.source, c.openIdx);
  else if (c.op === 'findFunctionBody') result = findFunctionBody(c.source, c.declStart);
  else if (c.op === 'extractInlineTags') result = extractInlineTags(c.source, c.declStart);
  return { name: c.name, result };
});

console.log(JSON.stringify(results, null, 2));
