// ai-desk.js
// All-as-Block, Versions-as-Body architecture
//
// 思想:
// - すべて Block(関数・クラス・モジュール・ドキュメント・制約)
// - Block の本体は **versions の羅列**(バージョン履歴 = REAL)
// - 現在の状態は versions から計算される **派生値(SHADOW)**
// - 保持禁止 = current content を変数として持たない、その場で取り出す
// - Block.refs = グラフのエッジ(各 version 内に持つ)
// - 純JS、Zero-Dependency、ESM、Eternal Compatibility
// - マーカー廃止、コード構造そのものが境界
//
// Bible v2 §0.16 Block Graph Versioning の最小実装

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';

// ============================================================
// Version — Block の状態スナップショット(これが REAL)
// ============================================================
//
// 1つの Version = ある時点の完全な状態(content + refs + children + meta)。
// Block の「現在」とは "versions[最後] のスナップショット"。
// 履歴を捨てて状態を保存する従来モデルの逆 — 履歴が本体、状態は派生。
//
// 各 Version はハッシュチェーン(prevHash + hash)で改ざん検知可能。
// Bible v1 §5 Sequential Hashing をそのまま継承。

function makeVersion({ content, refs = [], children = [], tags = [], meta = {} }, prev = null) {
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
function sameArr(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameRefs(a, b) {
  if (a.length !== b.length) return false;
  const key = r => `${r.kind}:${r.target}`;
  const aKeys = a.map(key).sort();
  const bKeys = b.map(key).sort();
  for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return false;
  return true;
}

// 軽量 FNV-1a 32bit。Zero-Dep。
// crypto.subtle が使える環境なら SHA-256 に置換可能。
function hashVersion(v) {
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
//
// Block の唯一の状態は **versions: Version[]**。
// content / refs / children は versions の最後から取り出す派生値。
// 派生値はゲッタ経由で都度計算 — 保持しない(SHADOW 規約)。

export class Block {
  constructor({ id, type, versions = [], meta = {} }) {
    if (!id) throw new Error('Block requires id');
    if (!type) throw new Error('Block requires type');
    this.id = id;
    this.type = type;
    this.versions = versions;
    this.meta = meta;
  }

  // 新しい version を append。これが唯一の状態更新。
  commit({ content = null, refs = [], children = [], tags = [], meta = {} } = {}) {
    const prev = this.head();
    const v = makeVersion({ content, refs, children, tags, meta }, prev);
    this.versions.push(v);
    return v;
  }

  // 最新 version(派生)
  head() {
    return this.versions.length > 0
      ? this.versions[this.versions.length - 1]
      : null;
  }

  // 任意時点の version(time travel)
  at(timestamp) {
    let result = null;
    for (const v of this.versions) {
      if (v.timestamp > timestamp) break;
      result = v;
    }
    return result;
  }

  // 派生 getter — 都度計算、保持しない(SHADOW)
  get content() { return this.head()?.content ?? null; }
  get refs()    { return this.head()?.refs    ?? []; }
  get children(){ return this.head()?.children?? []; }
  get tags()    { return this.head()?.tags    ?? []; }

  // タグ判定ユーティリティ
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

  // 2つの version を比較。i, j は index。省略なら最後の2つ。
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

  // 特定の述語にマッチする最初の version を返す(blame)
  // 例: blame(v => v.refs.some(r => r.target === 'x')) → x への参照が最初に追加された version
  blame(predicate) {
    for (let i = 0; i < this.versions.length; i++) {
      const v = this.versions[i];
      if (predicate(v)) return { version: v, index: i };
    }
    return null;
  }

  // ある target への ref が初めて追加された version
  blameRef(target, kind = null) {
    return this.blame(v =>
      v.refs.some(r => r.target === target && (kind == null || r.kind === kind))
    );
  }

  // Block 単位の直接 apply — content を差し替え、他は head から継承
  // opts で refs/tags/children/meta を上書き可能(指定なければ既存維持)
  // 中身が同じなら新 version は作らず unchanged を返す
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

  // 過去 version の状態をそのままコピーした新 version を commit(履歴は保持)
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

  // タグでフィルタ
  byTag(tag)         { return this.all().filter(b => b.hasTag(tag)); }
  byAllTags(tags)    { return this.all().filter(b => b.hasAllTags(tags)); }
  byAnyTag(tags)     { return this.all().filter(b => b.hasAnyTag(tags)); }

  // type でフィルタ
  byType(type)       { return this.all().filter(b => b.type === type); }

  // ============================================================
  // lint — グラフ整合性の検査(漏れ検出強化版)
  // ============================================================
  //
  // ルール一覧(opts でカテゴリごとに無効化可能):
  //   - broken      : target が存在しない ref
  //   - orphan      : 誰からも参照されない非 module Block
  //   - circular    : forward の循環
  //   - brace       : content の `{` `}` 数が合わない
  //   - calls       : content に他関数呼び出しがあるが calls ref がない
  //   - tags        : type と tags が整合してない
  //   - empty       : content も refs も children も空
  //   - hash        : version の hash チェーン破損
  //
  // 例: g.lint({ orphan: false }) で orphan 検出を切る
  lint(opts = {}) {
    const enable = key => opts[key] !== false;
    const issues = [];
    const ids = new Set(this.blocks.keys());

    // 1. broken refs
    // import 系は外部モジュールを除外:
    //   - 相対パス(./...) は resolveImports で解決される予定なのでスキップ
    //   - 'node:fs' のような node 標準
    //   - 'react'のような npm モジュール(/ で始まらず . 以外)
    // → 検査対象は内部 Block 同士の参照のみ
    if (enable('broken')) {
      for (const b of this.blocks.values()) {
        for (const r of b.refs) {
          if (r.kind === 'import') {
            const isExternal =
              !r.target.startsWith('.') &&  // 相対パスじゃない
              !r.target.startsWith('/');     // 絶対パスじゃない(=外部 or built-in)
            if (isExternal || r.target.startsWith('.')) continue;
          }
          if (!ids.has(r.target)) {
            issues.push({ kind: 'broken-ref', from: b.id, ref: r });
          }
        }
      }
    }

    // 2. orphans
    if (enable('orphan')) {
      for (const b of this.blocks.values()) {
        if (b.type === 'module') continue;
        if (this.backward(b.id).length === 0) {
          issues.push({ kind: 'orphan', id: b.id, type: b.type });
        }
      }
    }

    // 3. circular
    if (enable('circular')) {
      for (const b of this.blocks.values()) {
        const cycle = this._findCycle(b.id);
        if (cycle) issues.push({ kind: 'circular', cycle });
      }
    }

    // 4. brace mismatch — content の構文整合
    if (enable('brace')) {
      for (const b of this.blocks.values()) {
        if (!b.content) continue;
        const r = checkBraces(b.content);
        if (r) issues.push({ kind: 'brace-mismatch', id: b.id, ...r });
      }
    }

    // 5. calls leak — 同モジュール内で名前が出てるのに calls ref が無い
    if (enable('calls')) {
      const moduleNameMap = new Map(); // moduleId -> Map<name, blockId>
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
        const declared = new Set(
          b.refs.filter(r => r.kind === 'calls').map(r => r.target)
        );
        for (const [name, id] of peers) {
          if (id === b.id) continue;
          const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`);
          if (re.test(b.content) && !declared.has(id)) {
            issues.push({ kind: 'calls-leak', from: b.id, missing: id, name });
          }
        }
      }
    }

    // 6. tag mismatch — type と tags の整合
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

    // 7. empty block
    if (enable('empty')) {
      for (const b of this.blocks.values()) {
        if (b.type === 'module') continue;
        if (!b.content && b.refs.length === 0 && b.children.length === 0) {
          issues.push({ kind: 'empty-block', id: b.id });
        }
      }
    }

    // 8. hash チェーン破損
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
    if (path.includes(startId)) {
      return [...path, startId].slice(path.indexOf(startId));
    }
    if (localVisited.has(startId)) return null;
    localVisited.add(startId);
    const next = this.forward(startId);
    for (const b of next) {
      const cycle = this._findCycle(b.id, [...path, startId], localVisited);
      if (cycle) return cycle;
    }
    return null;
  }

  // content を query で検索(string なら部分一致、RegExp ならそのまま)
  // opts: { type, tag, includeOldVersions } で絞り込み
  search(query, opts = {}) {
    const { type = null, tag = null, includeOldVersions = false } = opts;
    const re = query instanceof RegExp
      ? query
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
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
    return b.refs
      .filter(r => kind == null || r.kind === kind)
      .map(r => this.blocks.get(r.target))
      .filter(x => x != null);
  }

  backward(id, kind = null) {
    const result = [];
    for (const b of this.blocks.values()) {
      if (b.id === id) continue;
      const hit = b.refs.some(r =>
        r.target === id && (kind == null || r.kind === kind)
      );
      if (hit) result.push(b);
    }
    return result;
  }

  impact(id, kind = null, visited = new Set()) {
    if (visited.has(id)) return [];
    visited.add(id);
    const direct = this.backward(id, kind);
    const result = [...direct];
    for (const b of direct) {
      result.push(...this.impact(b.id, kind, visited));
    }
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

  toJSON() {
    return Array.from(this.blocks.values()).map(b => b.toJSON());
  }

  static fromJSON(json) {
    return new Graph(json.map(Block.fromJSON));
  }

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
//
// 抽出対象:
// - module(ファイル全体)
// - function(function 宣言、 export function、 async function)
// - class(class 宣言、 export class)
// - arrow function(const foo = () => ...)
// - import(モジュール間エッジ)
// - calls(関数間エッジ — 名前で同一モジュール内のみ検出)
//
// ※正規表現ベースの最小実装。文字列リテラル中の `function` 等は誤検出する。
// 本格用途では AST(acorn 等)に置換予定。Zero-Dep を維持するなら自作parser。

export function parseJS(source, moduleId = 'mod') {
  const blocks = [];
  const moduleBlock = new Block({ id: moduleId, type: 'module', meta: { source: moduleId } });

  // ---- import 文 ----
  const imports = [];
  for (const m of source.matchAll(/(?:^|(?<=[;}]))\s*import\s+[^'"]*['"]([^'"]+)['"]/gm)) {
    imports.push({ kind: 'import', target: m[1] });
  }

  // ---- function 宣言 ----
  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm)) {
    const name = m[1];
    const start = m.index;
    // 引数リストを skip して関数本体の { を見つける(destructuring 引数対応)
    const bodyStart = findFunctionBody(source, start);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(start, end + 1);
    const head = m[0];
    const tags = ['function'];
    if (/\basync\b/.test(head)) tags.push('async');
    if (/\bexport\b/.test(head)) tags.push('export');
    if (/function\s*\*/.test(head)) tags.push('generator');
    tags.push(...extractInlineTags(source, start));
    pushBlock(blocks, moduleId, 'function', name, content, tags);
  }

  // ---- arrow function (const/let/var name = (...) => { ... }) ----
  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/gm)) {
    const name = m[1];
    const start = m.index;
    const bodyStart = findFunctionBody(source, start);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(start, end + 1);
    const head = m[0];
    const tags = ['function', 'arrow'];
    if (/\basync\b/.test(head)) tags.push('async');
    if (/\bexport\b/.test(head)) tags.push('export');
    tags.push(...extractInlineTags(source, start));
    pushBlock(blocks, moduleId, 'function', name, content, tags);
  }

  // ---- class 宣言 ----
  for (const m of source.matchAll(/(?:^|(?<=[;}{]))\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)/gm)) {
    const name = m[1];
    const start = m.index;
    const bodyStart = source.indexOf('{', start);
    if (bodyStart < 0) continue;
    const end = matchBrace(source, bodyStart);
    const content = source.slice(start, end + 1);
    const head = m[0];
    const tags = ['class'];
    if (/\bexport\b/.test(head)) tags.push('export');
    if (/\bdefault\b/.test(head)) tags.push('default');
    tags.push(...extractInlineTags(source, start));
    pushBlock(blocks, moduleId, 'class', name, content, tags);
  }

  // ---- 呼び出しグラフ: 各 Block 内で同モジュールの定義名を検索 ----
  const nameToId = new Map(blocks.map(b => [b.meta.name, b.id]));
  for (const b of blocks) {
    const calls = new Set();
    for (const [name, id] of nameToId) {
      if (id === b.id) continue;
      const re = new RegExp(`\\b${escapeRe(name)}\\s*\\(`);
      if (re.test(b.content)) calls.add(id);
    }
    if (calls.size === 0) continue;
    const head = b.head();
    // 既存 head の content/tags を保ちつつ、refs に calls を追加した新 version を commit
    b.commit({
      content: head.content,
      refs: [...head.refs, ...Array.from(calls).map(target => ({ kind: 'calls', target }))],
      children: head.children,
      tags: head.tags,
      meta: head.meta,
    });
  }

  // ---- module Block: import + contains を refs に ----
  moduleBlock.commit({
    content: null,
    refs: [
      ...imports,
      ...blocks.map(b => ({ kind: 'contains', target: b.id })),
    ],
  });

  return [moduleBlock, ...blocks];
}

function pushBlock(arr, moduleId, type, name, content, tags = []) {
  const prefix = type === 'class' ? 'class' : 'fn';
  const id = `${moduleId}:${prefix}:${name}`;
  if (arr.some(b => b.id === id)) return; // 重複(arrow が function と被る等)を回避
  const b = new Block({ id, type, meta: { name } });
  b.commit({ content, tags });
  arr.push(b);
}

// content の直前コメントから v1 emblem マーカーや @tags 注釈を抽出
function extractInlineTags(source, declStart) {
  // 直前の行を遡る(空行 or 該当行で停止)
  const tags = new Set();
  // declStart より上の改行までの 5 行を見る
  let lineEnd = source.lastIndexOf('\n', declStart - 1);
  for (let i = 0; i < 5 && lineEnd > 0; i++) {
    const lineStart = source.lastIndexOf('\n', lineEnd - 1) + 1;
    const line = source.slice(lineStart, lineEnd);
    if (!line.trim()) break;
    // v1 emblem 互換: // [ai_s_emblem:#high#logic Name] や // [EMBLEM:#high#logic Name]
    const emblem = line.match(/\[(?:ai_s_emblem|EMBLEM):([^\s\]]+)\s+\w+/);
    if (emblem) {
      for (const t of emblem[1].split('#').filter(Boolean)) tags.add(t);
    }
    // @tags: foo, bar 形式
    const at = line.match(/@tags\s*[:=]\s*([\w\s,]+)/);
    if (at) {
      for (const t of at[1].split(',').map(s => s.trim()).filter(Boolean)) tags.add(t);
    }
    lineEnd = lineStart - 1;
  }
  return Array.from(tags);
}

// 文字列リテラル / コメント / 正規表現リテラルを skip しながら brace を数える
function matchBrace(source, openIdx) {
  return matchPair(source, openIdx, '{', '}');
}

function matchParen(source, openIdx) {
  return matchPair(source, openIdx, '(', ')');
}

function matchPair(source, openIdx, openCh, closeCh) {
  let depth = 0;
  let inString = null; // null | '"' | "'" | '`'
  let escape = false;
  let inTemplate = 0;  // template literal 内の ${} ネスト
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }

    // 文字列リテラル中
    if (inString) {
      if (c === inString) inString = null;
      else if (inString === '`' && c === '$' && source[i + 1] === '{') {
        inTemplate++;
        i++;
      }
      continue;
    }
    if (inTemplate > 0 && c === '}') {
      inTemplate--;
      continue;
    }

    // 文字列開始
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }

    // 行コメント
    if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    // ブロックコメント
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    // 正規表現リテラル(雑判定: 直前が "(" "," "=" 等なら regex とみなす)
    if (c === '/' && isRegexContext(source, i)) {
      i = skipRegex(source, i);
      continue;
    }

    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

// '/' の直前が「式の終わり(値)」なら割り算、そうでなければ regex
function isRegexContext(source, slashIdx) {
  for (let j = slashIdx - 1; j >= 0; j--) {
    const c = source[j];
    if (c === ' ' || c === '\t') continue;
    if (c === '\n') return true;  // 行頭は regex
    // 「値」の終わり = 割り算
    if (/[\w$\]\)]/.test(c)) return false;
    // 「式の境界」= regex
    return true;
  }
  return true;
}

function skipRegex(source, startIdx) {
  // /.../flags の閉じる位置を返す。class([])内の `/` は無視。
  let inClass = false;
  let escape = false;
  for (let i = startIdx + 1; i < source.length; i++) {
    const c = source[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      // フラグを skip
      let j = i + 1;
      while (j < source.length && /[gimuysd]/.test(source[j])) j++;
      return j - 1;
    }
    if (c === '\n') return i; // 改行で終わり(雑、unterminated regex)
  }
  return source.length - 1;
}

// 関数宣言の引数リストを skip して本体 `{` の位置を返す
function findFunctionBody(source, declStart) {
  const argStart = source.indexOf('(', declStart);
  if (argStart < 0) return -1;
  const argEnd = matchParen(source, argStart);
  return source.indexOf('{', argEnd);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// content 中の brace 整合性をチェック
// 文字列リテラル(`'"`)・コメント(// /**/)・正規表現リテラル(/.../)を skip。
// 戻り値: 不整合があれば { error, ... }、整合してれば null
export function checkBraces(content) {
  let depth = 0;
  let inString = null;
  let escape = false;
  let inTemplate = 0;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (inString) {
      if (c === inString) inString = null;
      else if (inString === '`' && c === '$' && content[i + 1] === '{') {
        inTemplate++;
        i++;
      }
      continue;
    }
    if (inTemplate > 0 && c === '}') {
      inTemplate--;
      continue;
    }
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
    if (c === '/' && isRegexContext(content, i)) {
      i = skipRegex(content, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) return { error: 'extra-closing-brace', at: i };
    }
  }
  if (depth !== 0) return { error: 'unbalanced-braces', remaining: depth };
  return null;
}

// ============================================================
// parseMD — Markdown を Block に分解
// ============================================================
//
// section(#〜######)を Block(type: 'section')に変換。
// code block(```lang ... ```)を子 Block(type: 'code')に変換。
// [text](url) のリンクは refs(kind: 'link')に。
//
// これで「コード = function/class Block」と「ドキュメント = section/code Block」が
// 同じ Graph 上で**一緒に**管理できる。Bible v2 「すべて Block」の実証。

export function parseMD(source, moduleId = 'doc') {
  const blocks = [];
  const lines = source.split('\n');
  const moduleBlock = new Block({ id: moduleId, type: 'document', meta: { source: moduleId } });

  const sections = [];
  let current = null;
  let inCode = false;
  let codeLang = null;
  let codeBuf = [];

  for (const line of lines) {
    const codeStart = line.match(/^```(\w*)/);
    if (codeStart && !inCode) {
      inCode = true; codeLang = codeStart[1] || 'text'; codeBuf = []; continue;
    }
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
      for (const m of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        current.refs.push({ kind: 'link', target: m[2], label: m[1] });
      }
    }
  }

  const slugCount = new Map();
  const moduleRefs = [];
  for (const s of sections) {
    let slug = slugify(s.title);
    const n = (slugCount.get(slug) || 0) + 1;
    slugCount.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;
    const id = `${moduleId}:sec:${slug}`;
    const sb = new Block({ id, type: 'section', meta: { title: s.title, level: s.level } });
    const childRefs = [];

    for (let j = 0; j < s.codeBlocks.length; j++) {
      const cb = s.codeBlocks[j];
      const codeId = `${id}:code:${j}`;
      const codeBlock = new Block({
        id: codeId, type: 'code',
        meta: { lang: cb.lang, parent: id },
      });
      codeBlock.commit({ content: cb.content, tags: ['code', cb.lang] });
      blocks.push(codeBlock);
      childRefs.push({ kind: 'contains', target: codeId });
    }

    sb.commit({
      content: s.content.join('\n').trim(),
      refs: [...s.refs, ...childRefs],
      tags: ['section', `h${s.level}`],
    });
    blocks.push(sb);
    moduleRefs.push({ kind: 'contains', target: id });
  }

  moduleBlock.commit({ content: null, refs: moduleRefs });
  return [moduleBlock, ...blocks];
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ============================================================
// Mermaid output — Graph を mermaid フローチャートに
// ============================================================
//
// README に貼れる。視覚化はデモ価値が高い。
// `flowchart LR` 形式で出力、refs.kind がエッジラベル。

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
//
// 既存の auto-tag(function/class/export/async 等)に加え、
// 内容ベースのヒューリスティックタグを抽出。
// LLM が Block を分類しやすくするための補助。

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

  // pure 判定(I/O・副作用なしの関数)
  const hasSideEffect = /\b(console\.|fs\.|writeFileSync|readFileSync|fetch\(|process\.)/.test(content);
  if (!hasSideEffect && type === 'function') tags.add('pure');

  const numLines = content.split('\n').length;
  if (numLines > 50) tags.add('large');
  if (numLines < 10 && type === 'function') tags.add('small');

  return Array.from(tags);
}

// ============================================================
// Project — 複数ファイルを Graph に取り込む
// ============================================================

export function loadProject(files) {
  const graph = new Graph();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const blocks = f.endsWith('.md') ? parseMD(src, f) : parseJS(src, f);
    for (const b of blocks) graph.add(b);
  }
  return graph;
}

// ============================================================
// 永続化 — Graph 全体を JSON ファイルに保存・復元
// ============================================================
//
// JSON 1ファイルに全 Block + 全 versions を保存する。
// Bible v1 §5 Eternal Compatibility を継承 — 10年後も読める単純構造。

export function saveGraph(graph, path) {
  writeFileSync(path, JSON.stringify(graph.toJSON(), null, 2));
  return path;
}

export function loadGraph(path) {
  return Graph.fromJSON(JSON.parse(readFileSync(path, 'utf8')));
}

// ファイル群から graph を構築 → JSON に保存(よくある使い方の便利関数)
export function buildAndSave(files, outPath) {
  const g = loadProject(files);
  saveGraph(g, outPath);
  return g;
}

// ============================================================
// Virtual Heavy Function — 仮想重厚関数
// ============================================================
//
// 起点 Block + その依存先(forward 推移閉包)を、論理的に **1つの重厚関数**
// として扱う仕組み。物理的には複数の Block に分散しているが、LLM に渡すときは
// **1つの巨大 content** に展開する。戻ってきたら **virtualApply** が
// 各 Block に自動的に逆配分する。
//
// 思想:
//  - §0.1 重厚関数(全文脈を1つに集約)— LLM 視点の利点
//  - Block 分割(管理・履歴・検索)         — 永続層の利点
//  両者を物理層と論理層で分離する。
//
// 「依存性ごと撃つ」= 1 root Block を patch するとき、refs で辿れる
// 関連 Block も自動的に対象に含める。

// 仮想重厚関数のメンバ Block を集める(forward 推移閉包)
export function virtualHeavy(graph, rootId, opts = {}) {
  const { depth = Infinity, kind = 'calls' } = opts;
  const collected = new Map();
  function collect(id, d) {
    if (collected.has(id) || d > depth) return;
    const b = graph.get(id);
    if (!b) return;
    collected.set(id, b);
    for (const r of b.refs) {
      if (kind && r.kind !== kind) continue;
      collect(r.target, d + 1);
    }
  }
  collect(rootId, 0);
  return Array.from(collected.values());
}

// 仮想重厚関数を 1つの content に展開(LLM プロンプト用)
// 各 Block の境界は コメントヘッダ `// --- <id> (<type>) ---` で示す
// virtualApply はこのヘッダを目印に逆配分する
export function expandVirtualHeavy(graph, rootId, opts = {}) {
  const blocks = virtualHeavy(graph, rootId, opts);
  const lines = [];
  lines.push(`// === Virtual Heavy Function rooted at ${rootId} ===`);
  lines.push(`// ${blocks.length} blocks combined into one logical heavy function`);
  lines.push('// Edit the bodies; do not change the boundary headers.');
  lines.push('');
  for (const b of blocks) {
    lines.push(`// --- BLOCK: ${b.id} (${b.type}) ---`);
    if (b.tags.length) lines.push(`// tags: ${b.tags.join(', ')}`);
    if (b.refs.length) {
      const refStr = b.refs.map(r => `${r.kind}->${r.target}`).join(', ');
      lines.push(`// refs: ${refStr}`);
    }
    if (b.content) lines.push(b.content);
    lines.push('');
  }
  lines.push(`// === end of virtual heavy ===`);
  return lines.join('\n');
}

// 仮想 Apply — 展開された content を受け取って各 Block に逆配分する
// 「依存性ごと撃つ」の核心 — 1コマンドで重厚関数の範囲全体を更新
export function virtualApply(graph, rootId, expandedContent, opts = {}) {
  const heavyBlocks = virtualHeavy(graph, rootId, opts);
  const heavyById = new Map(heavyBlocks.map(b => [b.id, b]));

  // BLOCK ヘッダで content を切り出す
  const segments = splitByBlockHeader(expandedContent);
  const updates = [];
  for (const seg of segments) {
    const target = heavyById.get(seg.id);
    if (!target) {
      updates.push({ action: 'skipped-out-of-scope', id: seg.id });
      continue;
    }
    const r = target.applyPatch(seg.content.trim());
    updates.push({ action: r.action, id: seg.id });
  }
  return updates;
}

// `// --- BLOCK: <id> (<type>) ---` ヘッダで content を分割
function splitByBlockHeader(content) {
  const re = /^\s*\/\/\s*---\s*BLOCK:\s*(\S+)\s*\(([^)]+)\)\s*---\s*$/gm;
  const segments = [];
  const matches = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({ index: m.index, end: m.index + m[0].length, id: m[1], type: m[2] });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    let body = content.slice(cur.end, next ? next.index : content.length);
    // 末尾の `// === end of virtual heavy ===` を除去
    body = body.replace(/\n?\/\/\s*===\s*end of virtual heavy\s*===\s*$/, '');
    // 先頭の `// tags:` `// refs:` 行を除去(commit 時に refs/tags は head 継承するため)
    body = body.replace(/^\s*\/\/\s*tags:.*$/gm, '');
    body = body.replace(/^\s*\/\/\s*refs:.*$/gm, '');
    segments.push({ id: cur.id, type: cur.type, content: body });
  }
  return segments;
}

// ============================================================
// Codegen — Graph から JS ファイルを再生成
// ============================================================
//
// module Block を起点に、imports + contains 順の Block の content を結合する。
// 注: import の named/default/namespace の区別は現状のメタ情報からは復元できない。
// originalTarget(または target)から `import * as X from '...'` 形式の雑な復元になる。
// 完全な round-trip を望むなら parseJS 側で imports の spec を保存する必要あり。

export function exportModule(graph, moduleId) {
  const m = graph.get(moduleId);
  if (!m) throw new Error(`module not found: ${moduleId}`);
  if (m.type !== 'module') throw new Error(`not a module: ${moduleId}`);

  const lines = [];

  // imports
  const imports = m.refs.filter(r => r.kind === 'import');
  for (const r of imports) {
    const target = r.originalTarget || r.target;
    lines.push(`import './${target.replace(/^\.\//, '')}';`); // 雑な再生成
  }
  if (imports.length > 0) lines.push('');

  // contains 順に Block の content を出力
  for (const r of m.refs.filter(r => r.kind === 'contains')) {
    const child = graph.get(r.target);
    if (child && child.content) {
      lines.push(child.content);
      lines.push('');
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function exportToFile(graph, moduleId, outPath) {
  const code = exportModule(graph, moduleId);
  writeFileSync(outPath, code);
  return outPath;
}

// ============================================================
// Stats — Graph の統計情報
// ============================================================

export function graphStats(graph) {
  const all = graph.all();
  const byType = {};
  const byTag = {};
  let totalVersions = 0;
  let totalRefs = 0;
  let totalContent = 0;

  for (const b of all) {
    byType[b.type] = (byType[b.type] || 0) + 1;
    for (const t of b.tags) byTag[t] = (byTag[t] || 0) + 1;
    totalVersions += b.versions.length;
    totalRefs += b.refs.length;
    if (b.content) totalContent += b.content.length;
  }

  return {
    blocks: all.length,
    versions: totalVersions,
    refs: totalRefs,
    contentChars: totalContent,
    avgVersions: all.length > 0 ? +(totalVersions / all.length).toFixed(2) : 0,
    avgRefs: all.length > 0 ? +(totalRefs / all.length).toFixed(2) : 0,
    byType,
    byTag,
  };
}

// ============================================================
// Context — AI-prompt 用に Block + 関連 Block を抽出
// ============================================================
//
// LLM に「この関数を変更したい、関連も見せて」と渡すための塊。
// depth で forward / backward を何段拡張するか指定。
// formatContextForLLM で markdown 形式に整形できる。

export function blockContext(graph, blockId, opts = {}) {
  const { depth = 1, includeBackward = true, includeForward = true } = opts;
  const target = graph.get(blockId);
  if (!target) throw new Error(`block not found: ${blockId}`);

  const collected = new Map();
  collected.set(target.id, target);

  function expand(id, currentDepth) {
    if (currentDepth >= depth) return;
    const neighbors = [];
    if (includeForward) neighbors.push(...graph.forward(id));
    if (includeBackward) neighbors.push(...graph.backward(id));
    for (const b of neighbors) {
      if (!collected.has(b.id)) {
        collected.set(b.id, b);
        expand(b.id, currentDepth + 1);
      }
    }
  }
  expand(blockId, 0);

  return Array.from(collected.values());
}

export function formatContextForLLM(blocks, targetId) {
  const lines = [`# Context for ${targetId}\n`];
  lines.push(`Total ${blocks.length} blocks(target + related).\n`);
  for (const b of blocks) {
    const isTarget = b.id === targetId;
    lines.push(`## ${isTarget ? '⭐ ' : ''}${b.id}`);
    lines.push(`- type: ${b.type}`);
    if (b.tags.length) lines.push(`- tags: ${b.tags.join(', ')}`);
    if (b.versions.length) lines.push(`- versions: ${b.versions.length}`);
    if (b.refs.length) {
      lines.push(`- refs:`);
      for (const r of b.refs) lines.push(`  - ${r.kind} → ${r.target}`);
    }
    if (b.content) {
      lines.push('');
      lines.push('```js');
      lines.push(b.content);
      lines.push('```');
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ============================================================
// Block-level apply — 1 Block への直接 patch
// ============================================================
//
// content だけを差し替えて新 version を commit する単純版と、
// content を mini-source として parseJS にかけて refs/tags も
// 自動再計算する高機能版の 2 種類。

// graph 内の特定 Block を新 content で更新(refs/tags は引き継ぎ)
export function applyToBlock(graph, blockId, content, opts = {}) {
  const b = graph.get(blockId);
  if (!b) throw new Error(`block not found: ${blockId}`);
  return b.applyPatch(content, opts);
}

// content を mini-source としてパースし、その Block の refs/tags を自動計算した上で適用
// 関数1個分のパッチ用(class や arrow も対応)
export function applyBlockSmart(graph, blockId, content) {
  const target = graph.get(blockId);
  if (!target) throw new Error(`block not found: ${blockId}`);
  // mini-parse(他 Block を巻き込まないため moduleId はランダム)
  const mid = `__patch__${Date.now()}`;
  const parsed = parseJS(content, mid);
  const fnBlock = parsed.find(b => b.type !== 'module');
  if (!fnBlock) {
    // 関数として認識できなかった場合は単純 apply
    return target.applyPatch(content);
  }
  // 抽出された refs から calls 以外(import等)を取り、tags も拾う
  // calls エッジは元の Graph 上で再計算されるべき(別途 reparseCalls)
  const inheritedRefs = fnBlock.refs.filter(r => r.kind !== 'calls');
  return target.applyPatch(fnBlock.content, {
    refs: inheritedRefs,
    tags: fnBlock.tags,
  });
}

// ============================================================
// Apply — パッチ(JS)を既存 Graph に取り込む
// ============================================================
//
// v1 の `ai-desk apply` 相当。
// パッチソースをパースして、既存 Block と比較:
//   - 同じ id があれば → 新 version を commit(履歴は累積、保持)
//   - 同じ id がなければ → 新規 Block 追加
//   - 既存にあって patch にない Block は **削除しない**(明示的削除のみ)
//
// 戻り値: { id, action: 'updated'|'added'|'unchanged' } の配列

export function applyPatch(graph, source, moduleId) {
  const patched = parseJS(source, moduleId);
  const updates = [];
  for (const newBlock of patched) {
    const existing = graph.get(newBlock.id);
    const newHead = newBlock.head();
    if (!newHead) continue;
    if (existing) {
      const existingHead = existing.head();
      const sameContent = existingHead?.content === newHead.content;
      const sameRefsLen = existingHead?.refs?.length === newHead.refs.length;
      const sameTagsLen = existingHead?.tags?.length === newHead.tags.length;
      if (sameContent && sameRefsLen && sameTagsLen) {
        updates.push({ id: existing.id, action: 'unchanged' });
      } else {
        existing.commit({
          content: newHead.content,
          refs: newHead.refs,
          children: newHead.children,
          tags: newHead.tags,
          meta: { ...newHead.meta, appliedAt: Date.now() },
        });
        updates.push({ id: existing.id, action: 'updated' });
      }
    } else {
      graph.add(newBlock);
      updates.push({ id: newBlock.id, action: 'added' });
    }
  }
  return updates;
}

// ============================================================
// Resolve imports — 相対パスの import target を実 Block ID に解決
// ============================================================
//
// loadProject は moduleId に file path を使うため、
// import './foo.js' のような相対パスを resolve すれば
// 実際のモジュール Block の id にマッピングできる。

export function resolveImports(graph) {
  // moduleIds は絶対パスで正規化
  const idToAbs = new Map();
  for (const b of graph.byType('module')) {
    idToAbs.set(pathResolve(b.id), b.id);
  }
  const resolved = [];
  for (const m of graph.byType('module')) {
    const head = m.head();
    if (!head) continue;
    let changed = false;
    const newRefs = head.refs.map(r => {
      if (r.kind !== 'import') return r;
      if (!r.target.startsWith('.')) return r; // node_modules 等
      const baseDir = dirname(pathResolve(m.id));
      const abs = pathResolve(baseDir, r.target);
      const candidates = [abs, abs + '.js', abs + '/index.js'];
      const foundAbs = candidates.find(c => idToAbs.has(c));
      if (foundAbs) {
        changed = true;
        return { ...r, target: idToAbs.get(foundAbs), originalTarget: r.target };
      }
      return r;
    });
    if (changed) {
      m.commit({
        content: head.content,
        refs: newRefs,
        children: head.children,
        tags: head.tags,
        meta: { ...head.meta, importsResolved: true },
      });
      resolved.push(m.id);
    }
  }
  return resolved;
}

// ============================================================
// Constraint Block — Constraint Folding の Block 表現
// ============================================================
//
// constraint Block は { axes, values, derive } を JSON で content に持つ。
// evalConstraint で全可能世界を列挙し、filter で残った世界を返す。
// Bible v1 §0.15 の現代版実装(Block 統一抽象上で)。

export function constraintBlock({ id, axes, values, derive, tags = [] }) {
  if (typeof derive !== 'function') {
    throw new Error('constraintBlock: derive must be a function');
  }
  const b = new Block({ id, type: 'constraint', meta: { axes } });
  b.commit({
    content: JSON.stringify({ axes, values, derive: derive.toString() }),
    tags: ['constraint', ...tags],
  });
  return b;
}

export function evalConstraint(block, filter = {}) {
  const data = JSON.parse(block.content);
  const { axes, values } = data;
  // derive 関数を再構築。eval じゃなく Function コンストラクタ。
  const derive = new Function('combo', `return (${data.derive})(combo);`);

  function* gen(idx, current) {
    if (idx === axes.length) { yield current; return; }
    const axis = axes[idx];
    for (const v of values[axis]) {
      yield* gen(idx + 1, { ...current, [axis]: v });
    }
  }

  const worlds = [];
  for (const w of gen(0, {})) {
    const derived = derive(w) || {};
    const merged = { ...w, ...derived };
    let pass = true;
    for (const [k, v] of Object.entries(filter)) {
      if (k.startsWith('_')) continue;
      if (merged[k] !== v) { pass = false; break; }
    }
    if (pass) worlds.push(merged);
  }

  if (worlds.length === 0) return { _contradiction: true };
  return { _worlds: worlds.length, worlds };
}

// ============================================================
// Observation Block — AI-Eyes 観測結果の Block 表現
// ============================================================
//
// AI-Eyes(Bible v1 §1.5)の観測スナップショットを Block として記録。
// 観測対象 Block への ref を持ち、グラフ走査で原因追跡できる。

export function observationBlock({ id, observedId, snapshot, tags = [] }) {
  const b = new Block({ id, type: 'observation', meta: { observedId } });
  b.commit({
    content: JSON.stringify(snapshot),
    refs: [{ kind: 'observes', target: observedId }],
    tags: ['observation', ...tags],
  });
  return b;
}

// ============================================================
// CLI
// ============================================================
//
// 使い方:
//   node ai-desk.js                    -- self-test
//   node ai-desk.js skeleton <file>    -- ファイルの Block 構造を表示
//   node ai-desk.js focus <file> <id>  -- 特定 Block の内容を表示
//   node ai-desk.js graph <file...>    -- 複数ファイルから Graph 抽出して JSON 出力
//   node ai-desk.js impact <file> <id> -- ある Block を変更したときの影響範囲

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) runSelfTest();
  else runCommand(cmd, rest);
}

function runCommand(cmd, args) {
  switch (cmd) {
    case 'skeleton': {
      if (!args[0]) return console.error('usage: skeleton <file>');
      const blocks = parseJS(readFileSync(args[0], 'utf8'), args[0]);
      for (const b of blocks) {
        console.log(`${b.id} (${b.type})`);
        for (const r of b.refs) console.log(`  ${r.kind} -> ${r.target}`);
      }
      break;
    }
    case 'focus': {
      if (!args[0] || !args[1]) return console.error('usage: focus <file> <id>');
      const blocks = parseJS(readFileSync(args[0], 'utf8'), args[0]);
      const found = blocks.find(b => b.id === args[1]);
      if (!found) return console.error('not found:', args[1]);
      console.log(found.content);
      break;
    }
    case 'graph': {
      if (args.length === 0) return console.error('usage: graph <file...>');
      const g = loadProject(args);
      console.log(JSON.stringify(g.toJSON(), null, 2));
      break;
    }
    case 'impact': {
      if (!args[0] || !args[1]) return console.error('usage: impact <file> <id>');
      const g = loadProject([args[0]]);
      const affected = g.impact(args[1]);
      for (const b of affected) console.log(b.id);
      break;
    }
    case 'self': {
      // 自己読み込みテスト: ai-desk.js が ai-desk.js を解析する
      const me = new URL(import.meta.url).pathname;
      const blocks = parseJS(readFileSync(me, 'utf8'), 'ai-desk');
      console.log(`self-parse: ${blocks.length} blocks extracted from ${me}`);
      for (const b of blocks) {
        const callOut = b.refs.filter(r => r.kind === 'calls').length;
        const tags = b.tags.length ? '[' + b.tags.join(',') + ']' : '';
        console.log(`  ${b.id.padEnd(40)} ${b.type.padEnd(10)} calls:${callOut} ${tags}`);
      }
      break;
    }
    case 'tag': {
      // タグでフィルタ: node ai-desk.js tag <file> <tag>
      if (!args[0] || !args[1]) return console.error('usage: tag <file> <tag>');
      const blocks = parseJS(readFileSync(args[0], 'utf8'), args[0]);
      const g = new Graph(blocks);
      const hits = g.byTag(args[1]);
      for (const b of hits) {
        const tags = b.tags.length ? '[' + b.tags.join(',') + ']' : '';
        console.log(`  ${b.id} ${tags}`);
      }
      break;
    }
    case 'save': {
      // node ai-desk.js save <out.json> <files...>
      if (args.length < 2) return console.error('usage: save <out.json> <files...>');
      const [out, ...files] = args;
      const g = buildAndSave(files, out);
      console.log(`saved ${g.all().length} blocks → ${out}`);
      break;
    }
    case 'load': {
      // node ai-desk.js load <in.json>
      if (!args[0]) return console.error('usage: load <in.json>');
      const g = loadGraph(args[0]);
      console.log(`loaded ${g.all().length} blocks from ${args[0]}`);
      console.log('verify:', g.verify());
      break;
    }
    case 'search': {
      // node ai-desk.js search <file> <query>
      if (!args[0] || !args[1]) return console.error('usage: search <file> <query>');
      const g = loadProject([args[0]]);
      const hits = g.search(args[1]);
      for (const h of hits) {
        console.log(`  ${h.block.id} (v${h.versionIndex})`);
      }
      console.log(`${hits.length} hits`);
      break;
    }
    case 'diff': {
      // node ai-desk.js diff <file> <id> [i] [j]
      if (!args[0] || !args[1]) return console.error('usage: diff <file> <id> [i] [j]');
      const g = loadProject([args[0]]);
      const b = g.get(args[1]);
      if (!b) return console.error('not found:', args[1]);
      const i = args[2] != null ? Number(args[2]) : null;
      const j = args[3] != null ? Number(args[3]) : null;
      const d = b.diff(i, j);
      console.log(JSON.stringify(d, null, 2));
      break;
    }
    case 'blame': {
      // node ai-desk.js blame <file> <id> <ref-target>
      if (!args[0] || !args[1] || !args[2]) {
        return console.error('usage: blame <file> <id> <ref-target>');
      }
      const g = loadProject([args[0]]);
      const b = g.get(args[1]);
      if (!b) return console.error('not found:', args[1]);
      const r = b.blameRef(args[2]);
      console.log(r ? JSON.stringify(r, null, 2) : 'no such ref');
      break;
    }
    case 'apply': {
      // node ai-desk.js apply <graph.json> <patch.js> <moduleId>
      if (args.length < 3) return console.error('usage: apply <graph.json> <patch.js> <moduleId>');
      const [graphPath, patchPath, moduleId] = args;
      const g = loadGraph(graphPath);
      const updates = applyPatch(g, readFileSync(patchPath, 'utf8'), moduleId);
      saveGraph(g, graphPath);
      for (const u of updates) console.log(`  ${u.action.padEnd(10)} ${u.id}`);
      console.log(`${updates.length} blocks processed`);
      break;
    }
    case 'apply-block': {
      // node ai-desk.js apply-block <graph.json> <block-id> <patch-file>
      // patch-file は関数1個分のソース。-- を渡すと stdin から読む
      if (args.length < 3) return console.error('usage: apply-block <graph.json> <block-id> <patch-file|->');
      const [graphPath, blockId, patchSrc] = args;
      const g = loadGraph(graphPath);
      const content = patchSrc === '-'
        ? readFileSync(0, 'utf8')  // stdin
        : readFileSync(patchSrc, 'utf8');
      const result = applyBlockSmart(g, blockId, content);
      saveGraph(g, graphPath);
      console.log(`${result.action}: ${blockId}`);
      console.log(`versions: ${result.block.versions.length}`);
      break;
    }
    case 'resolve': {
      // node ai-desk.js resolve <graph.json>
      if (!args[0]) return console.error('usage: resolve <graph.json>');
      const g = loadGraph(args[0]);
      const resolved = resolveImports(g);
      saveGraph(g, args[0]);
      console.log(`resolved imports in ${resolved.length} modules`);
      for (const id of resolved) console.log(`  ${id}`);
      break;
    }
    case 'lint': {
      // node ai-desk.js lint <file> [--only=K1,K2] [--summary]
      if (!args[0]) return console.error('usage: lint <file> [--only=K1,K2] [--summary]');
      const opts = {};
      let summary = false;
      let onlyKinds = null;
      for (const a of args.slice(1)) {
        if (a === '--summary') summary = true;
        const m = a.match(/^--only=(.+)$/);
        if (m) onlyKinds = new Set(m[1].split(','));
      }
      const g = loadProject([args[0]]);
      let issues = g.lint(opts);
      if (onlyKinds) issues = issues.filter(i => onlyKinds.has(i.kind.replace(/-.*/, '')));
      if (summary) {
        const counts = {};
        for (const i of issues) counts[i.kind] = (counts[i.kind] || 0) + 1;
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) console.log('OK — no issues');
        else for (const [k, c] of sorted) console.log(`  ${k.padEnd(15)} ${c}`);
        console.log(`total: ${issues.length}`);
      } else if (issues.length === 0) {
        console.log('OK — no issues found');
      } else {
        for (const i of issues) console.log(`  ${i.kind.padEnd(15)} ${JSON.stringify(i)}`);
        console.log(`${issues.length} issues found`);
      }
      break;
    }
    case 'export': {
      // node ai-desk.js export <graph.json> <moduleId> [out.js]
      if (args.length < 2) return console.error('usage: export <graph.json> <moduleId> [out.js]');
      const [graphPath, moduleId, outPath] = args;
      const g = loadGraph(graphPath);
      const code = exportModule(g, moduleId);
      if (outPath) {
        writeFileSync(outPath, code);
        console.log(`exported → ${outPath}`);
      } else {
        process.stdout.write(code);
      }
      break;
    }
    case 'stats': {
      // node ai-desk.js stats <file>
      if (!args[0]) return console.error('usage: stats <file>');
      const g = loadProject([args[0]]);
      const s = graphStats(g);
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    case 'heavy': {
      // node ai-desk.js heavy <file> <root-id> [--depth=N]
      // 仮想重厚関数を展開して stdout に出す(LLM に渡す用)
      if (args.length < 2) return console.error('usage: heavy <file> <root-id> [--depth=N]');
      const [file, rootId, ...rest] = args;
      const opts = {};
      for (const a of rest) {
        const m = a.match(/^--depth=(\d+)$/);
        if (m) opts.depth = Number(m[1]);
      }
      const g = loadProject([file]);
      process.stdout.write(expandVirtualHeavy(g, rootId, opts));
      break;
    }
    case 'virtual-apply': {
      // node ai-desk.js virtual-apply <graph.json> <root-id> <patch-file>
      // patch-file は expand したフォーマットで戻されたもの。BLOCK ヘッダで分割される。
      if (args.length < 3) return console.error('usage: virtual-apply <graph.json> <root-id> <patch-file>');
      const [graphPath, rootId, patchPath] = args;
      const g = loadGraph(graphPath);
      const content = patchPath === '-' ? readFileSync(0, 'utf8') : readFileSync(patchPath, 'utf8');
      const updates = virtualApply(g, rootId, content);
      saveGraph(g, graphPath);
      for (const u of updates) console.log(`  ${u.action.padEnd(20)} ${u.id}`);
      console.log(`${updates.length} blocks processed`);
      break;
    }
    case 'mermaid': {
      // node ai-desk.js mermaid <file> [--kind=...] [--type=...]
      if (!args[0]) return console.error('usage: mermaid <file> [--kind=K] [--type=T]');
      const opts = {};
      for (const a of args.slice(1)) {
        const m = a.match(/^--(\w+)=(.+)$/);
        if (m) opts[m[1]] = m[2];
      }
      const g = loadProject([args[0]]);
      console.log(exportMermaid(g, opts));
      break;
    }
    case 'infer-tags': {
      // node ai-desk.js infer-tags <file> <id>
      if (args.length < 2) return console.error('usage: infer-tags <file> <id>');
      const [file, id] = args;
      const g = loadProject([file]);
      const b = g.get(id);
      if (!b) return console.error('not found:', id);
      const tags = inferTags(b.content, b.type);
      console.log(`existing: ${b.tags.join(', ') || '(none)'}`);
      console.log(`inferred: ${tags.join(', ') || '(none)'}`);
      break;
    }
    case 'context': {
      // node ai-desk.js context <file> <blockId> [depth]
      if (args.length < 2) return console.error('usage: context <file> <blockId> [depth]');
      const [file, blockId, depthArg] = args;
      const g = loadProject([file]);
      const blocks = blockContext(g, blockId, { depth: depthArg ? Number(depthArg) : 1 });
      process.stdout.write(formatContextForLLM(blocks, blockId));
      break;
    }
    case 'e2e': {
      // e2e テスト走らせる
      import('./e2e.js').catch(e => { console.error(e); process.exit(1); });
      break;
    }
    case 'tags': {
      // 全タグの一覧と件数: node ai-desk.js tags <file>
      if (!args[0]) return console.error('usage: tags <file>');
      const blocks = parseJS(readFileSync(args[0], 'utf8'), args[0]);
      const tagCount = new Map();
      for (const b of blocks) {
        for (const t of b.tags) {
          tagCount.set(t, (tagCount.get(t) || 0) + 1);
        }
      }
      const sorted = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]);
      for (const [tag, count] of sorted) console.log(`  ${tag.padEnd(15)} ${count}`);
      break;
    }
    default:
      console.error('unknown command:', cmd);
      console.error('commands: skeleton, focus, graph, impact, self, tag, tags, save, load, search, diff, blame, apply, apply-block, resolve, lint, export, stats, context, heavy, virtual-apply, mermaid, infer-tags, e2e');
  }
}

function runSelfTest() {
  console.log('=== ai-desk self-test ===\n');

  const a = new Block({ id: 'a', type: 'function' });
  a.commit({ content: 'function a(){}' });
  a.commit({ content: 'function a(){ return 1; }' });
  a.commit({ content: 'function a(){ return 2; }' });
  console.log('1. Block.versions が本体');
  console.log('   versions count:', a.versions.length);
  console.log('   current content (SHADOW):', a.content);
  console.log('   verify:', a.verify());

  const t1 = a.versions[0].timestamp;
  console.log('\n2. Time travel');
  console.log('   at v0:', a.at(t1).content);

  const b = new Block({ id: 'b', type: 'function' });
  b.commit({
    content: 'function b(){ a(); }',
    refs: [{ kind: 'calls', target: 'a' }],
  });
  const g = new Graph([a, b]);
  console.log('\n3. Graph 双方向走査');
  console.log('   forward(b):', g.forward('b').map(x => x.id));
  console.log('   backward(a):', g.backward('a').map(x => x.id));
  console.log('   impact(a):', g.impact('a').map(x => x.id));

  const src = `
import { foo } from './foo.js';
export function add(x, y) { return x + y; }
function inner() { return add(1, 2); }
class Calc { run() { return add(1, 2); } }
const sub = (x, y) => { return x - y; };
`;
  const parsed = parseJS(src, 'sample');
  console.log('\n4. parseJS (function/arrow/class/calls)');
  for (const blk of parsed) {
    const callOut = blk.refs.filter(r => r.kind === 'calls').map(r => r.target).join(',');
    console.log('  ', blk.id, '(' + blk.type + ')', callOut ? '-> calls: ' + callOut : '');
  }

  const g2 = Graph.fromJSON(g.toJSON());
  console.log('\n5. Round-trip JSON');
  console.log('   a content after roundtrip:', g2.get('a').content);
  console.log('   verify:', g2.verify());
}
