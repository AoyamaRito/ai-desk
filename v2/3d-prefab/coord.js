// coord.js — A11 Domain-Tagged Coordinates の実装。
//
// すべての coord 値は domain 接頭辞付き string で表現する:
//   "world:5,0,2" / "local:0,1,0" / "screen:300,200" / "ortho:0.7,0.85"
//
// builders: w / l / s / o
// parsers : parseCoord / requireDomain
//
// pure / Zero-Dep / crystallize 整合(Go の string ↔ struct と 1:1)。

export const w = (...v) => `world:${v.join(',')}`;
export const l = (...v) => `local:${v.join(',')}`;
export const s = (...v) => `screen:${v.join(',')}`;
export const o = (...v) => `ortho:${v.join(',')}`;

export function parseCoord(str) {
  if (typeof str !== 'string') {
    throw new Error(`coord must be string, got ${typeof str}`);
  }
  const idx = str.indexOf(':');
  if (idx < 0) throw new Error(`coord missing domain prefix: "${str}"`);
  const domain = str.slice(0, idx);
  const parts = str.slice(idx + 1).split(',');
  const values = parts.map(Number);
  if (values.some(Number.isNaN)) {
    throw new Error(`coord parse failed: "${str}"`);
  }
  return { domain, values };
}

export function requireDomain(str, expected) {
  const c = parseCoord(str);
  if (c.domain !== expected) {
    throw new Error(`coord domain mismatch: expected "${expected}", got "${c.domain}" in "${str}"`);
  }
  return c.values;
}

// builders は array でも受け取れる(便利、入力境界用)
export const wArr = (arr) => w(...arr);
export const lArr = (arr) => l(...arr);
