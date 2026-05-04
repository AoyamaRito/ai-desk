// verify-phase5.js — parseJS の output を flat ParseResult に変換して比較
import { parseJS } from '../ai-desk-core.js';
import { readFileSync } from 'node:fs';

const data = readFileSync(0, 'utf8');
const cases = JSON.parse(data);

function flatten(blocks) {
  return blocks.map(b => {
    const head = b.head ? b.head() : (b.versions[b.versions.length - 1] || {});
    return {
      id: b.id,
      type: b.type,
      name: b.meta?.name || b.id,
      content: head.content || '',
      tags: head.tags || [],
      refs: (head.refs || []).map(r => ({ kind: r.kind, target: r.target })),
    };
  });
}

const results = cases.map(c => ({
  name: c.name,
  result: flatten(parseJS(c.source, c.moduleId)),
}));

console.log(JSON.stringify(results, null, 2));
