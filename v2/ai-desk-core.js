// ai-desk-core.js
// Pure domain logic for ai-desk v2 (Platform Agnostic)
//
// This file contains the core data structures and logic for Block-based 
// code management. It has ZERO dependencies on Node.js or any other runtime.
// It can run in Browsers, Deno, Bun, or any standard JS environment.

// ============================================================
// Version — Block の状態スナップショット(これが REAL)
// ============================================================

export function makeVersion({ content, refs = [], children = [], tags = [], meta = {} }, prev = null) {
  const v = {
    timestamp: Date.now(),
    prevHash: prev ? prev.hash : null,
    content,
    refs,
    children,
    tags,
    meta,
  };
  v.hash = hashVersion(v);
  return v;
}

// refs / 配列の浅い比較(applyPatch の unchanged 判定用)
export function sameArr(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function sameRefs(a, b) {
  if (a.length !== b.length) return false;
  const key = r => `${r.kind}:${r.target}`;
  const aKeys = a.map(key).sort();
  const bKeys = b.map(key).sort();
  for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return false;
  return true;
}

// 軽量 FNV-1a 32bit。Zero-Dep。
export function hashVersion(v) {
  const { hash, ...rest } = v;
  const stable = JSON.stringify(rest, Object.keys(rest).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ============================================================
// Block — versions の羅列が本体
// ============================================================

export class Block {
  constructor({ id, type, versions = [], meta = {} }) {
    if (!id) throw new Error('Block requires id');
    if (!type) throw new Error('Block requires type');
    this.id = id;
    this.type = type;
    this.versions = versions;
    this.meta = meta;
  }

  commit({ content = null, refs = [], children = [], tags = [], meta = {} } = {}) {
    const prev = this.head();
    const v = makeVersion({ content, refs, children, tags, meta }, prev);
    this.versions.push(v);
    return v;
  }

  head() {
    return this.versions.length > 0 ? this.versions[this.versions.length - 1] : null;
  }

  at(timestamp) {
    let result = null;
    for (const v of this.versions) {
      if (v.timestamp > timestamp) break;
      result = v;
    }
    return result;
  }

  get content() { return this.head()?.content ?? null; }
  get refs()    { return this.head()?.refs    ?? []; }
  get children(){ return this.head()?.children?? []; }
  get tags()    { return this.head()?.tags    ?? []; }

  hasTag(tag) { return this.tags.includes(tag); }
  hasAllTags(tags) { return tags.every(t => this.tags.includes(t)); }
  hasAnyTag(tags) { return tags.some(t => this.tags.includes(t)); }

  verify() {
    for (let i = 0; i < this.versions.length; i++) {
      const v = this.versions[i];
      const expectedPrev = i === 0 ? null : this.versions[i - 1].hash;
      if (v.prevHash !== expectedPrev) {
        return { ok: false, brokenAt: i, reason: 'prevHash mismatch' };
      }
      if (v.hash !== hashVersion(v)) {
        return { ok: false, brokenAt: i, reason: 'hash mismatch' };
      }
    }
    return { ok: true };
  }

  diff(i, j) {
    if (this.versions.length < 2) return null;
    if (i == null) i = this.versions.length - 2;
    if (j == null) j = this.versions.length - 1;
    const a = this.versions[i];
    const b = this.versions[j];
    if (!a || !b) return null;
    const refKey = r => `${r.kind}:${r.target}`;
    const aRefs = new Set(a.refs.map(refKey));
    const bRefs = new Set(b.refs.map(refKey));
    return {
      contentChanged: a.content !== b.content,
      content: { from: a.content, to: b.content },
      refsAdded: b.refs.filter(r => !aRefs.has(refKey(r))),
      refsRemoved: a.refs.filter(r => !bRefs.has(refKey(r))),
      tagsAdded: b.tags.filter(t => !a.tags.includes(t)),
      tagsRemoved: a.tags.filter(t => !b.tags.includes(t)),
      timeDelta: b.timestamp - a.timestamp,
    };
  }

  blame(predicate) {
    for (let i = 0; i < this.versions.length; i++) {
      const v = this.versions[i];
      if (predicate(v)) return { version: v, index: i };
    }
    return null;
  }

  blameRef(target, kind = null) {
    return this.blame(v =>
      v.refs.some(r => r.target === target && (kind == null || r.kind === kind))
    );
  }

  applyPatch(content, opts = {}) {
    const head = this.head();
    if (head && head.content === content
        && (opts.refs == null || sameRefs(opts.refs, head.refs))
        && (opts.tags == null || sameArr(opts.tags, head.tags))) {
      return { action: 'unchanged', block: this };
    }
    this.commit({
      content,
      refs: opts.refs ?? head?.refs ?? [],
      children: opts.children ?? head?.children ?? [],
      tags: opts.tags ?? head?.tags ?? [],
      meta: { ...(head?.meta ?? {}), ...(opts.meta ?? {}), appliedAt: Date.now() },
    });
    return { action: head ? 'updated' : 'created', block: this };
  }

  rollback(versionIndex) {
    const target = this.versions[versionIndex];
    if (!target) throw new Error(`no such version: ${versionIndex}`);
    return this.commit({
      content: target.content,
      refs: target.refs,
      children: target.children,
      tags: target.tags,
      meta: { ...target.meta, rollbackFrom: target.hash, rollbackIndex: versionIndex },
    });
  }

  toJSON() {
    return { id: this.id, type: this.type, versions: this.versions, meta: this.meta };
  }

  static fromJSON(json) {
    return new Block({
      id: json.id,
      type: json.type,
      versions: json.versions || [],
      meta: json.meta || {},
    });
  }
}

// ============================================================
// Graph — Block の集合 + 双方向走査
// ============================================================

export class Graph {
  constructor(blocks = []) {
    this.blocks = new Map();
    for (const b of blocks) this.add(b);
  }

  add(block) {
    if (!(block instanceof Block)) block = Block.fromJSON(block);
    this.blocks.set(block.id, block);
    return this;
  }

  get(id) { return this.blocks.get(id); }
  has(id) { return this.blocks.has(id); }
  remove(id) { return this.blocks.delete(id); }

  ids() { return Array.from(this.blocks.keys()); }
  all() { return Array.from(this.blocks.values()); }

  byTag(tag)         { return this.all().filter(b => b.hasTag(tag)); }
  byAllTags(tags)    { return this.all().filter(b => b.hasAllTags(tags)); }
  byAnyTag(tags)     { return this.all().filter(b => b.hasAnyTag(tags)); }
  byType(type)       { return this.all().filter(b => b.type === type); }

  lint(opts = {}) {
    const enable = key => opts[key] !== false;
    const issues = [];
    const ids = new Set(this.blocks.keys());

    if (enable('broken')) {
      for (const b of this.blocks.values()) {
        for (const r of b.refs) {
          if (r.kind === 'import') {
            const isExternal = !r.target.startsWith('.') && !r.target.startsWith('/');
            if (isExternal || r.target.startsWith('.')) continue;
          }
          if (!ids.has(r.target)) {
            issues.push({ kind: 'broken-ref', from: b.id, ref: r });
          }
        }
      }
    }

    if (enable('orphan')) {
      for (const b of this.blocks.values()) {
        if (b.type === 'module') continue;
        if (this.backward(b.id).length === 0) {
          issues.push({ kind: 'orphan', id: b.id, type: b.type });
        }
      }
    }

    if (enable('circular')) {
      for (const b of this.blocks.values()) {
        const cycle = this._findCycle(b.id);
        if (cycle) issues.push({ kind: 'circular', cycle });
      }
    }

    if (enable('brace')) {
      for (const b of this.blocks.values()) {
        if (!b.content) continue;
        const r = checkBraces(b.content);
        if (r) issues.push({ kind: 'brace-mismatch', id: b.id, ...r });
      }
    }

    if (enable('calls')) {
      const moduleNameMap = new Map();
      for (const b of this.blocks.values()) {
        if (!b.meta?.name) continue;
        if (b.type !== 'function' && b.type !== 'class') continue;
        const moduleId = b.id.split(':').slice(0, -2).join(':');
        if (!moduleNameMap.has(moduleId)) moduleNameMap.set(moduleId, new Map());
        moduleNameMap.get(moduleId).set(b.meta.name, b.id);
      }
      for (const b of this.blocks.values()) {
        if (!b.content || !b.meta?.name) continue;
        const moduleId = b.id.split(':').slice(0, -2).join(':');
        const peers = moduleNameMap.get(moduleId);
        if (!peers) continue;
        const declared = new Set(b.refs.filter(r => r.kind === 'calls').map(r => r.target));
        for (const [name, id] of peers) {
          if (id === b.id) continue;
          const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`);
          if (re.test(b.content) && !declared.has(id)) {
            issues.push({ kind: 'calls-leak', from: b.id, missing: id, name });
          }
        }
      }
    }

    if (enable('tags')) {
      for (const b of this.blocks.values()) {
        if (b.type === 'function' && !b.tags.includes('function')) {
          issues.push({ kind: 'tag-mismatch', id: b.id, expected: 'function', actual: b.tags });
        }
        if (b.type === 'class' && !b.tags.includes('class')) {
          issues.push({ kind: 'tag-mismatch', id: b.id, expected: 'class', actual: b.tags });
        }
      }
    }

    if (enable('empty')) {
      for (const b of this.blocks.values()) {
        if (b.type === 'module') continue;
        if (!b.content && b.refs.length === 0 && b.children.length === 0) {
          issues.push({ kind: 'empty-block', id: b.id });
        }
      }
    }

    if (enable('hash')) {
      for (const b of this.blocks.values()) {
        const r = b.verify();
        if (!r.ok) {
          issues.push({ kind: 'hash-broken', id: b.id, reason: r.reason, brokenAt: r.brokenAt });
        }
      }
    }

    return issues;
  }

  _findCycle(startId, path = [], localVisited = new Set()) {
    if (path.includes(startId)) return [...path, startId].slice(path.indexOf(startId));
    if (localVisited.has(startId)) return null;
    localVisited.add(startId);
    const next = this.forward(startId);
    for (const b of next) {
      const cycle = this._findCycle(b.id, [...path, startId], localVisited);
      if (cycle) return cycle;
    }
    return null;
  }

  search(query, opts = {}) {
    const { type = null, tag = null, includeOldVersions = false } = opts;
    const re = query instanceof RegExp ? query : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const result = [];
    for (const b of this.blocks.values()) {
      if (type && b.type !== type) continue;
      if (tag && !b.hasTag(tag)) continue;
      if (includeOldVersions) {
        for (let i = 0; i < b.versions.length; i++) {
          if (b.versions[i].content && re.test(b.versions[i].content)) {
            result.push({ block: b, versionIndex: i });
          }
        }
      } else {
        if (b.content && re.test(b.content)) {
          result.push({ block: b, versionIndex: b.versions.length - 1 });
        }
      }
    }
    return result;
  }

  forward(id, kind = null) {
    const b = this.blocks.get(id);
    if (!b) return [];
    return b.refs.filter(r => kind == null || r.kind === kind).map(r => this.blocks.get(r.target)).filter(x => x != null);
  }

  backward(id, kind = null) {
    const result = [];
    for (const b of this.blocks.values()) {
      if (b.id === id) continue;
      const hit = b.refs.some(r => r.target === id && (kind == null || r.kind === kind));
      if (hit) result.push(b);
    }
    return result;
  }

  impact(id, kind = null, visited = new Set()) {
    if (visited.has(id)) return [];
    visited.add(id);
    const direct = this.backward(id, kind);
    const result = [...direct];
    for (const b of direct) result.push(...this.impact(b.id, kind, visited));
    return result;
  }

  at(timestamp) {
    const snapshot = new Graph();
    for (const b of this.blocks.values()) {
      const v = b.at(timestamp);
      if (v == null) continue;
      const cloned = new Block({
        id: b.id, type: b.type, meta: b.meta,
        versions: b.versions.filter(x => x.timestamp <= timestamp),
      });
      snapshot.add(cloned);
    }
    return snapshot;
  }

  toJSON() { return Array.from(this.blocks.values()).map(b => b.toJSON()); }
  static fromJSON(json) { return new Graph(json.map(Block.fromJSON)); }
  verify() {
    for (const b of this.blocks.values()) {
      const r = b.verify();
      if (!r.ok) return { ok: false, blockId: b.id, ...r };
    }
    return { ok: true };
  }
}

// ============================================================
// Parse — JS ソースから Block を抽出
// ============================================================

export function parseJS(source, moduleId = 'mod') {
  const blocks = [];
  const moduleBlock = new Block({ id: moduleId, type: 'module', meta: { source: moduleId } });
  const imports = [];
  for (const m of source.matchAll(/(?:^|(?<=[;}]))\s*import\s+[^'"]*['"]([^'"]+)['"]/gm)) {
    imports.push({ kind: 'import', target: m[1] });
  }

  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm)) {
    const name = m[1];
    const bodyStart = findFunctionBody(source, m.index);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(m.index, end + 1);
    const head = m[0];
    const tags = ['function'];
    if (/\basync\b/.test(head)) tags.push('async');
    if (/\bexport\b/.test(head)) tags.push('export');
    if (/function\s*\*/.test(head)) tags.push('generator');
    tags.push(...extractInlineTags(source, m.index));
    pushBlock(blocks, moduleId, 'function', name, content, tags);
  }

  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/gm)) {
    const name = m[1];
    const bodyStart = findFunctionBody(source, m.index);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(m.index, end + 1);
    const head = m[0];
    const tags = ['function', 'arrow'];
    if (/\basync\b/.test(head)) tags.push('async');
    if (/\bexport\b/.test(head)) tags.push('export');
    tags.push(...extractInlineTags(source, m.index));
    pushBlock(blocks, moduleId, 'function', name, content, tags);
  }

  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)/gm)) {
    const name = m[1];
    const bodyStart = source.indexOf('{', m.index);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(m.index, end + 1);
    const head = m[0];
    const tags = ['class'];
    if (/\bexport\b/.test(head)) tags.push('export');
    if (/\bdefault\b/.test(head)) tags.push('default');
    tags.push(...extractInlineTags(source, m.index));
    pushBlock(blocks, moduleId, 'class', name, content, tags);
  }

  const nameToId = new Map(blocks.map(b => [b.meta.name, b.id]));
  for (const b of blocks) {
    const calls = new Set();
    for (const [name, id] of nameToId) {
      if (id === b.id) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`);
      if (re.test(b.content)) calls.add(id);
    }
    if (calls.size === 0) continue;
    const head = b.head();
    b.commit({
      content: head.content,
      refs: [...head.refs, ...Array.from(calls).map(target => ({ kind: 'calls', target }))],
      children: head.children,
      tags: head.tags,
      meta: head.meta,
    });
  }

  moduleBlock.commit({ content: null, refs: [...imports, ...blocks.map(b => ({ kind: 'contains', target: b.id }))] });
  return [moduleBlock, ...blocks];
}

function pushBlock(arr, moduleId, type, name, content, tags = []) {
  const prefix = type === 'class' ? 'class' : 'fn';
  const id = `${moduleId}:${prefix}:${name}`;
  if (arr.some(b => b.id === id)) return;
  const b = new Block({ id, type, meta: { name } });
  b.commit({ content, tags });
  arr.push(b);
}

export function extractInlineTags(source, declStart) {
  const tags = new Set();
  let lineEnd = source.lastIndexOf('\n', declStart - 1);
  for (let i = 0; i < 20 && lineEnd > 0; i++) {
    const lineStart = source.lastIndexOf('\n', lineEnd - 1) + 1;
    const line = source.slice(lineStart, lineEnd);
    if (!line.trim()) break;
    const emblem = line.match(/\[(?:ai_s_emblem|EMBLEM):([^\s\]]+)\s+\w+/);
    if (emblem) for (const t of emblem[1].split('#').filter(Boolean)) tags.add(t);
    const at = line.match(/@tags\s*[:=]\s*([\w\s,]+)/);
    if (at) for (const t of at[1].split(',').map(s => s.trim()).filter(Boolean)) tags.add(t);
    lineEnd = lineStart - 1;
  }
  return Array.from(tags);
}

export function matchBrace(source, openIdx) { return matchPair(source, openIdx, '{', '}'); }
export function matchParen(source, openIdx) { return matchPair(source, openIdx, '(', ')'); }

export function matchPair(source, openIdx, openCh, closeCh) {
  let depth = 0, inString = null, escape = false, inTemplate = 0;
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (inString) {
      if (c === inString) inString = null;
      else if (inString === '`' && c === '$' && source[i + 1] === '{') { inTemplate++; i++; }
      continue;
    }
    if (inTemplate > 0 && c === '}') { inTemplate--; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (c === '/' && isRegexContext(source, i)) { i = skipRegex(source, i); continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
  }
  return source.length - 1;
}

function isRegexContext(source, slashIdx) {
  for (let j = slashIdx - 1; j >= 0; j--) {
    const c = source[j];
    if (c === ' ' || c === '\t') continue;
    if (c === '\n') return true;
    if (/[\w$\]\)]/.test(c)) return false;
    return true;
  }
  return true;
}

function skipRegex(source, startIdx) {
  let inClass = false, escape = false;
  for (let i = startIdx + 1; i < source.length; i++) {
    const c = source[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      let j = i + 1;
      while (j < source.length && /[gimuysd]/.test(source[j])) j++;
      return j - 1;
    }
    if (c === '\n') return i;
  }
  return source.length - 1;
}

export function findFunctionBody(source, declStart) {
  const argStart = source.indexOf('(', declStart);
  if (argStart < 0) return -1;
  const argEnd = matchParen(source, argStart);
  return source.indexOf('{', argEnd);
}

export function checkBraces(content) {
  let depth = 0, inString = null, escape = false, inTemplate = 0;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (inString) {
      if (c === inString) inString = null;
      else if (inString === '`' && c === '$' && content[i + 1] === '{') { inTemplate++; i++; }
      continue;
    }
    if (inTemplate > 0 && c === '}') { inTemplate--; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i);
      i = nl < 0 ? content.length : nl;
      continue;
    }
    if (c === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      i = end < 0 ? content.length : end + 1;
      continue;
    }
    if (c === '/' && isRegexContext(content, i)) { i = skipRegex(content, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth < 0) return { error: 'extra-closing-brace', at: i }; }
  }
  if (depth !== 0) return { error: 'unbalanced-braces', remaining: depth };
  return null;
}

// ============================================================
// parseMD — Markdown を Block に分解
// ============================================================

export function parseMD(source, moduleId = 'doc') {
  const blocks = [];
  const lines = source.split('\n');
  const moduleBlock = new Block({ id: moduleId, type: 'document', meta: { source: moduleId } });
  const sections = [];
  let current = null, inCode = false, codeLang = null, codeBuf = [];

  for (const line of lines) {
    const codeStart = line.match(/^```(\w*)/);
    if (codeStart && !inCode) { inCode = true; codeLang = codeStart[1] || 'text'; codeBuf = []; continue; }
    if (inCode && /^```\s*$/.test(line)) {
      inCode = false;
      if (current) current.codeBlocks.push({ lang: codeLang, content: codeBuf.join('\n') });
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      current = { level: h[1].length, title: h[2].trim(), content: [], codeBlocks: [], refs: [] };
      sections.push(current);
      continue;
    }
    if (current) {
      current.content.push(line);
      for (const m of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) current.refs.push({ kind: 'link', target: m[2], label: m[1] });
    }
  }

  const slugCount = new Map(), moduleRefs = [];
  for (const s of sections) {
    let slug = s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const n = (slugCount.get(slug) || 0) + 1; slugCount.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;
    const id = `${moduleId}:sec:${slug}`;
    const sb = new Block({ id, type: 'section', meta: { title: s.title, level: s.level } });
    const childRefs = [];
    for (let j = 0; j < s.codeBlocks.length; j++) {
      const cb = s.codeBlocks[j], codeId = `${id}:code:${j}`;
      const codeBlock = new Block({ id: codeId, type: 'code', meta: { lang: cb.lang, parent: id } });
      codeBlock.commit({ content: cb.content, tags: ['code', cb.lang] });
      blocks.push(codeBlock);
      childRefs.push({ kind: 'contains', target: codeId });
    }
    sb.commit({ content: s.content.join('\n').trim(), refs: [...s.refs, ...childRefs], tags: ['section', `h${s.level}`] });
    blocks.push(sb);
    moduleRefs.push({ kind: 'contains', target: id });
  }
  moduleBlock.commit({ content: null, refs: moduleRefs });
  return [moduleBlock, ...blocks];
}

// ============================================================
// Mermaid output — Graph を mermaid フローチャートに
// ============================================================

export function exportMermaid(graph, opts = {}) {
  const { kind = null, type = null, maxBlocks = 50 } = opts;
  const lines = ['flowchart LR'];
  const filtered = graph.all().filter(b => !type || b.type === type);
  const visible = filtered.slice(0, maxBlocks);
  const visibleIds = new Set(visible.map(b => b.id));

  for (const b of visible) {
    const short = b.id.split(':').slice(-2).join(':');
    const label = `${short}<br/><i>${b.type}</i>`;
    lines.push(`  ${nodeId(b.id)}["${label.replace(/"/g, "'")}"]`);
  }

  for (const b of visible) {
    for (const r of b.refs) {
      if (kind && r.kind !== kind) continue;
      if (!visibleIds.has(r.target)) continue;
      lines.push(`  ${nodeId(b.id)} -->|${r.kind}| ${nodeId(r.target)}`);
    }
  }

  return lines.join('\n');
}

function nodeId(id) {
  return 'n_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ============================================================
// inferTags — content から自動的にタグを推論
// ============================================================

export function inferTags(content, type = null) {
  const tags = new Set();
  if (!content) return [];
  if (/\b(test|describe|it)\s*\(\s*['"]/.test(content)) tags.add('test');
  if (/\bassert\b/.test(content)) tags.add('assertion');
  if (/\b(readFileSync|writeFileSync|readFile|writeFile|fs\.)/.test(content)) tags.add('io');
  if (/\bfetch\s*\(|\bXMLHttpRequest\b/.test(content)) tags.add('network');
  if (/\bconsole\./.test(content)) tags.add('logging');
  if (/\basync\b|\bawait\b/.test(content)) tags.add('async');
  if (/\bnew\s+RegExp|\/[^\/\n]+\/[gimuy]*/.test(content)) tags.add('regex');
  if (/\bclass\s+\w+\s+extends\b/.test(content)) tags.add('inheritance');
  if (/\bMap\s*\(|\bSet\s*\(/.test(content)) tags.add('collection');
  if (!/\b(console\.|fs\.|writeFileSync|readFileSync|fetch\(|process\.)/.test(content) && type === 'function') tags.add('pure');
  const numLines = content.split('\n').length;
  if (numLines > 50) tags.add('large');
  if (numLines < 10 && type === 'function') tags.add('small');
  return Array.from(tags);
}

// ============================================================
// Virtual Heavy Function — 仮想重厚関数
// ============================================================

export function virtualHeavy(graph, rootId, opts = {}) {
  const { depth = Infinity, kind = 'calls' } = opts;
  const collected = new Map();
  function collect(id, d) {
    if (collected.has(id) || d > depth) return;
    const b = graph.get(id); if (!b) return;
    collected.set(id, b);
    for (const r of b.refs) if (kind == null || r.kind === kind) collect(r.target, d + 1);
  }
  collect(rootId, 0);
  return Array.from(collected.values());
}

export function expandVirtualHeavy(graph, rootId, opts = {}) {
  const blocks = virtualHeavy(graph, rootId, opts);
  const lines = [`// === Virtual Heavy Function rooted at ${rootId} ===`, `// ${blocks.length} blocks combined into one logical heavy function`, '// Edit the bodies; do not change the boundary headers.', ''];
  for (const b of blocks) {
    lines.push(`// --- BLOCK: ${b.id} (${b.type}) ---`);
    if (b.tags.length) lines.push(`// tags: ${b.tags.join(', ')}`);
    if (b.refs.length) lines.push(`// refs: ${b.refs.map(r => `${r.kind}->${r.target}`).join(', ')}`);
    if (b.content) lines.push(b.content);
    lines.push('');
  }
  lines.push('// === end of virtual heavy ===');
  return lines.join('\n');
}

export function virtualApply(graph, rootId, expandedContent, opts = {}) {
  const heavyBlocks = virtualHeavy(graph, rootId, opts);
  const heavyById = new Map(heavyBlocks.map(b => [b.id, b]));
  const re = /^\s*\/\/\s*---\s*BLOCK:\s*(\S+)\s*\(([^)]+)\)\s*---\s*$/gm;
  const updates = [];
  let m, lastEnd = 0, lastId = null;
  while ((m = re.exec(expandedContent)) !== null) {
    if (lastId) {
      const body = expandedContent.slice(lastEnd, m.index).replace(/\n?\/\/\s*===\s*end of virtual heavy\s*===\s*$/, '').replace(/^\s*\/\/\s*(tags|refs):.*$/gm, '').trim();
      const target = heavyById.get(lastId);
      if (target) updates.push({ id: lastId, ...target.applyPatch(body) });
      else updates.push({ id: lastId, action: 'skipped-out-of-scope' });
    }
    lastId = m[1]; lastEnd = m.index + m[0].length;
  }
  if (lastId) {
    const body = expandedContent.slice(lastEnd).replace(/\n?\/\/\s*===\s*end of virtual heavy\s*===\s*$/, '').replace(/^\s*\/\/\s*(tags|refs):.*$/gm, '').trim();
    const target = heavyById.get(lastId);
    if (target) updates.push({ id: lastId, ...target.applyPatch(body) });
    else updates.push({ id: lastId, action: 'skipped-out-of-scope' });
  }
  return updates;
}

// ============================================================
// Codegen — Graph から JS ファイルを再生成
// ============================================================

export function exportModule(graph, moduleId) {
  const m = graph.get(moduleId); if (!m || m.type !== 'module') throw new Error(`invalid module: ${moduleId}`);
  const lines = [];
  for (const r of m.refs.filter(r => r.kind === 'import')) lines.push(`import './${(r.originalTarget || r.target).replace(/^\.\//, '')}';`);
  if (lines.length) lines.push('');
  for (const r of m.refs.filter(r => r.kind === 'contains')) {
    const child = graph.get(r.target);
    if (child && child.content) { lines.push(child.content); lines.push(''); }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ============================================================
// Stats / Context / Block Apply
// ============================================================

export function graphStats(graph) {
  const all = graph.all();
  const byType = {}, byTag = {};
  let v = 0, r = 0, c = 0;
  for (const b of all) {
    byType[b.type] = (byType[b.type] || 0) + 1;
    for (const t of b.tags) byTag[t] = (byTag[t] || 0) + 1;
    v += b.versions.length; r += b.refs.length; if (b.content) c += b.content.length;
  }
  return { blocks: all.length, versions: v, refs: r, contentChars: c, avgVersions: +(v/all.length||0).toFixed(2), avgRefs: +(r/all.length||0).toFixed(2), byType, byTag };
}

export function blockContext(graph, blockId, opts = {}) {
  const { depth = 1, includeBackward = true, includeForward = true } = opts;
  const target = graph.get(blockId); if (!target) throw new Error(`not found: ${blockId}`);
  const collected = new Map(); collected.set(target.id, target);
  function expand(id, d) {
    if (d >= depth) return;
    const n = []; if (includeForward) n.push(...graph.forward(id)); if (includeBackward) n.push(...graph.backward(id));
    for (const b of n) if (!collected.has(b.id)) { collected.set(b.id, b); expand(b.id, d + 1); }
  }
  expand(blockId, 0); return Array.from(collected.values());
}

export function formatContextForLLM(blocks, targetId) {
  const lines = [`# Context for ${targetId}\nTotal ${blocks.length} blocks.\n`];
  for (const b of blocks) {
    lines.push(`## ${b.id === targetId ? '⭐ ' : ''}${b.id}\n- type: ${b.type}${b.tags.length ? `\n- tags: ${b.tags.join(', ')}` : ''}\n- versions: ${b.versions.length}`);
    if (b.refs.length) lines.push(`- refs:\n${b.refs.map(r => `  - ${r.kind} → ${r.target}`).join('\n')}`);
    if (b.content) lines.push(`\n\`\`\`js\n${b.content}\n\`\`\`\n`);
  }
  return lines.join('\n');
}

export function applyToBlock(graph, blockId, content, opts = {}) {
  const b = graph.get(blockId); if (!b) throw new Error(`not found: ${blockId}`);
  return b.applyPatch(content, opts);
}

export function applyBlockSmart(graph, blockId, content) {
  const target = graph.get(blockId); if (!target) throw new Error(`not found: ${blockId}`);
  const parsed = parseJS(content, `__patch__${Date.now()}`);
  const fnBlock = parsed.find(b => b.type !== 'module');
  if (!fnBlock) return target.applyPatch(content);
  return target.applyPatch(fnBlock.content, { refs: fnBlock.refs.filter(r => r.kind !== 'calls'), tags: fnBlock.tags });
}

export function applyPatch(graph, source, moduleId) {
  const patched = parseJS(source, moduleId), updates = [];
  for (const nb of patched) {
    const existing = graph.get(nb.id), nh = nb.head(); if (!nh) continue;
    if (existing) {
      const eh = existing.head();
      if (eh?.content === nh.content && eh?.refs?.length === nh.refs.length && eh?.tags?.length === nh.tags.length) updates.push({ id: existing.id, action: 'unchanged' });
      else { existing.commit({ content: nh.content, refs: nh.refs, children: nh.children, tags: nh.tags, meta: { ...nh.meta, appliedAt: Date.now() } }); updates.push({ id: existing.id, action: 'updated' }); }
    } else { graph.add(nb); updates.push({ id: nb.id, action: 'added' }); }
  }
  return updates;
}

// Pure Resolve Imports (No node:path)
export function resolveImportsPure(graph, resolvePathFn) {
  const resolved = [];
  for (const m of graph.byType('module')) {
    const head = m.head(); if (!head) continue;
    let changed = false;
    const newRefs = head.refs.map(r => {
      if (r.kind !== 'import' || !r.target.startsWith('.')) return r;
      const resolvedTarget = resolvePathFn(m.id, r.target);
      if (resolvedTarget && graph.has(resolvedTarget)) { changed = true; return { ...r, target: resolvedTarget, originalTarget: r.target }; }
      return r;
    });
    if (changed) { m.commit({ content: head.content, refs: newRefs, children: head.children, tags: head.tags, meta: { ...head.meta, importsResolved: true } }); resolved.push(m.id); }
  }
  return resolved;
}

// ============================================================
// Constraint / Observation
// ============================================================

export function constraintBlock({ id, axes, values, derive, tags = [] }) {
  if (typeof derive !== 'function') throw new Error('derive must be a function');
  const b = new Block({ id, type: 'constraint', meta: { axes } });
  b.commit({ content: JSON.stringify({ axes, values, derive: derive.toString() }), tags: ['constraint', ...tags] });
  return b;
}

export function evalConstraint(block, filter = {}) {
  const data = JSON.parse(block.content), { axes, values } = data;
  const derive = new Function('combo', `return (${data.derive})(combo);`);
  function* gen(idx, current) {
    if (idx === axes.length) { yield current; return; }
    const axis = axes[idx]; for (const v of values[axis]) yield* gen(idx + 1, { ...current, [axis]: v });
  }
  const worlds = [];
  for (const w of gen(0, {})) {
    const derived = derive(w) || {}, merged = { ...w, ...derived };
    let pass = true; for (const [k, v] of Object.entries(filter)) if (!k.startsWith('_') && merged[k] !== v) { pass = false; break; }
    if (pass) worlds.push(merged);
  }
  return worlds.length === 0 ? { _contradiction: true } : { _worlds: worlds.length, worlds };
}

export function observationBlock({ id, observedId, snapshot, tags = [] }) {
  const b = new Block({ id, type: 'observation', meta: { observedId } });
  b.commit({ content: JSON.stringify(snapshot), refs: [{ kind: 'observes', target: observedId }], tags: ['observation', ...tags] });
  return b;
}
