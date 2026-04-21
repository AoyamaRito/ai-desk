#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

//{ 01:Types @high #core $4E8D9F23C
class Chunk {
  constructor({ type, sortOrder = "", name = "Unnamed", importance = 1, tags = [], uid = "", content = "" }) {
    this.type = type; // "section" or "plain"
    this.sortOrder = sortOrder;
    this.name = name;
    this.importance = importance;
    this.tags = tags;
    this.uid = uid;
    this.content = content;
  }
}

class Metadata {
  constructor() {
    this.order = []; // $UIDs
    this.bookmarks = {}; // name -> $UIDs
  }
}

const IMPORTANCE = {
  HIGH: 3,
  MID: 2,
  LOW: 1
};
//}

//{ 02:Utilities @mid #core $B2A8C1F4D
function calcChecksum(base) {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += base.charCodeAt(i);
  }
  return "0123456789ABCDEF"[sum % 16];
}

function generateUID(existingSet = new Set()) {
  let uid;
  do {
    const bytes = crypto.randomBytes(4); // 32-bit for safety
    const base = bytes.toString('hex').toUpperCase();
    const checksum = calcChecksum(base);
    uid = "$" + base + checksum;
  } while (existingSet.has(uid));
  return uid;
}

function isValidUID(uid) {
  if (!uid || !uid.startsWith("$")) return false;
  const body = uid.substring(1);
  if (body.length === 0) return false;
  return /^[0-9A-Za-z_]+$/.test(body);
}

// ^\s* を追加し、インデント対応。非破壊対応のため適度に緩くマッチさせる。
const sectionRegex = /^\s*(?:(?:\/\/|\/\*|<!--|#)\s*\{|VVV)\s*(?:([0-9a-zA-Z]+):)?([^\s@#$]+)?(?:\s+@([a-zA-Z0-9/._-]+))?(?:\s+(#[^$]*))?(?:\s*(\$[0-9A-Za-z_]{1,50}))?(?:\s*-->)?/;
const sectionEndRegex = /^\s*(?:(?:\/\/|\/\*|<!--|-->|\*\/|#)\s*\}|AAA)/;
const metaOrderRegex = /^\/\/@\s*order\s*=\s*(.+)$/;
const metaBookmarkRegex = /^\/\/@\s*bookmark:(\w+)\s*=\s*(.+)$/;

function parseHeader(line) {
  const matches = line.match(sectionRegex);
  if (!matches) return { sortOrder: "", name: "Unknown", importance: IMPORTANCE.LOW, tags: [], uid: "" };

  const sortOrder = matches[1] || "";
  let name = (matches[2] || "").trim();
  if (!name) name = "Unnamed";

  const impStr = (matches[3] || "").toLowerCase();
  let importance = IMPORTANCE.LOW;
  if (impStr === "high" || impStr === "3") importance = IMPORTANCE.HIGH;
  else if (impStr === "mid" || impStr === "2" || impStr === "medium") importance = IMPORTANCE.MID;
  else if (impStr === "low" || impStr === "1") importance = IMPORTANCE.LOW;

  const tagsStr = (matches[4] || "").trim();
  const tags = tagsStr ? tagsStr.split(/\s+/).map(t => t.replace(/^#/, "")).filter(t => t) : [];
  const uid = (matches[5] || "").trim();

  return { sortOrder, name, importance, tags, uid };
}

function getStyleForFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".html": case ".htm": case ".vue": case ".svelte": case ".xml":
      return { prefix: "<!-- {", suffix: "<!-- } -->", inlineComment: (msg) => `<!-- ${msg} -->`, html: true };
    case ".css": case ".scss": case ".less":
      return { prefix: "/* {", suffix: "/* } */", inlineComment: (msg) => `/* ${msg} */` };
    case ".js": case ".ts": case ".go": case ".c": case ".cpp": case ".java": case ".rust": case ".rs": case ".php": case ".swift": case ".kt":
      return { prefix: "// {", suffix: "// }", inlineComment: (msg) => `// ${msg}` };
    case ".py": case ".rb": case ".sh": case ".yaml": case ".yml": case ".toml": case ".conf":
      return { prefix: "# {", suffix: "# }", inlineComment: (msg) => `# ${msg}` };
    default:
      return { prefix: "VVV", suffix: "AAA", inlineComment: (msg) => `[${msg}]` };
  }
}

// 行分割ユーティリティ（改行コードを保持し、末尾の改行なし状態も完璧に復元可能にする）
function splitLinesWithEndings(content) {
  const lines = [];
  let start = 0;
  while (start < content.length) {
    let rn = content.indexOf('\r\n', start);
    let n = content.indexOf('\n', start);
    
    let end = -1;
    let ending = '';
    if (rn !== -1 && (n === -1 || rn < n)) {
      end = rn;
      ending = '\r\n';
    } else if (n !== -1) {
      end = n;
      ending = '\n';
    }

    if (end === -1) {
      lines.push({ text: content.substring(start), ending: '' });
      break;
    } else {
      lines.push({ text: content.substring(start, end), ending });
      start = end + ending.length;
    }
  }
  return lines;
}
//}

//{ 03:Parsing @high #core $C5D1E4F8A
function parse(content) {
  const lines = splitLinesWithEndings(content);
  
  const chunks = [];
  const meta = new Metadata();
  let currentLines = [];
  let inSection = false;
  let curHeader = {};

  const buildContent = (lineObjs) => lineObjs.map(l => l.text + l.ending).join('');

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const text = lineObj.text;
    const trimmedText = text.trim();

    if (trimmedText.startsWith("//@")) {
      const orderMatch = trimmedText.match(metaOrderRegex);
      if (orderMatch) {
        meta.order = orderMatch[1].split(",").map(s => s.trim()).filter(s => s);
        continue;
      }
      const bookmarkMatch = trimmedText.match(metaBookmarkRegex);
      if (bookmarkMatch) {
        const name = bookmarkMatch[1];
        const uids = bookmarkMatch[2].split(",").map(s => s.trim()).filter(s => s);
        meta.bookmarks[name] = uids;
        continue;
      }
    }

    if (sectionRegex.test(text) && !sectionEndRegex.test(text)) {
      if (!inSection && currentLines.length > 0) {
        chunks.push(new Chunk({ type: "plain", content: buildContent(currentLines) }));
        currentLines = [];
      }
      inSection = true;
      curHeader = parseHeader(text);
      currentLines.push(lineObj);
    } else if (sectionEndRegex.test(text) && inSection) {
      currentLines.push(lineObj);
      chunks.push(new Chunk({
        type: "section",
        ...curHeader,
        content: buildContent(currentLines)
      }));
      currentLines = [];
      inSection = false;
    } else {
      currentLines.push(lineObj);
    }
  }

  if (currentLines.length > 0) {
    chunks.push(new Chunk({ type: "plain", content: buildContent(currentLines) }));
  }

  return { chunks, meta };
}
//}

//{ 04:CoreLogic @high #core $D6E2F5B1C
function injectUID(lineText, style, uid) {
  // すでにUIDがある場合は置換、なければ挿入
  const uidPattern = /\$[0-9A-Za-z_]{1,50}/;
  if (uidPattern.test(lineText)) {
    return lineText.replace(uidPattern, uid);
  }

  // 元の行のインデントや自由コメントを維持しつつUIDを末尾(または閉じタグの手前)に挿入する
  const trimmed = lineText.trimEnd();
  if (style.html && trimmed.endsWith("-->")) {
     return trimmed.slice(0, -3).trimEnd() + ` ${uid} -->`;
  }
  if (trimmed.endsWith("*/")) {
     return trimmed.slice(0, -2).trimEnd() + ` ${uid} */`;
  }
  return trimmed + ` ${uid}`;
}

function ensureUIDs(chunks, filename) {
  const existingSet = new Set(chunks.filter(c => c.uid).map(c => c.uid));
  const style = getStyleForFile(filename);

  for (const chunk of chunks) {
    if (chunk.type === "section" && (!chunk.uid || !isValidUID(chunk.uid))) {
      chunk.uid = generateUID(existingSet);
      existingSet.add(chunk.uid);
      
      const lines = splitLinesWithEndings(chunk.content);
      if (lines.length > 0) {
        // ヘッダー行を完全に再構築するのではなく、元の行にUIDを挿入する
        lines[0].text = injectUID(lines[0].text, style, chunk.uid);
        chunk.content = lines.map(l => l.text + l.ending).join('');
      }
    }
  }
  return chunks;
}

function formatMetadata(meta) {
  const lines = [];
  if (meta.order && meta.order.length > 0) {
    lines.push(`//@ order = ${meta.order.join(", ")}`);
  }
  const bookmarkNames = Object.keys(meta.bookmarks).sort();
  for (const name of bookmarkNames) {
    lines.push(`//@ bookmark:${name} = ${meta.bookmarks[name].join(", ")}`);
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

function sortForFocus(chunks, targetUIDs = []) {
  const sections = chunks.filter(c => c.type === "section");
  const sectionIndices = chunks.map((c, i) => c.type === "section" ? i : -1).filter(i => i !== -1);
  const targetSet = new Set(targetUIDs);

  sections.sort((a, b) => {
    // Target UIDs come first
    const aIsTarget = targetSet.has(a.uid);
    const bIsTarget = targetSet.has(b.uid);
    if (aIsTarget && !bIsTarget) return -1;
    if (!aIsTarget && bIsTarget) return 1;

    if (a.importance !== b.importance) return b.importance - a.importance;
    const tagA = a.tags[0] || "";
    const tagB = b.tags[0] || "";
    if (tagA !== tagB) return tagA.localeCompare(tagB);
    return a.sortOrder.localeCompare(b.sortOrder);
  });

  const result = [...chunks];
  sectionIndices.forEach((idx, i) => {
    result[idx] = sections[i];
  });
  return result;
}

function sortForRestore(chunks, meta) {
  const sections = chunks.filter(c => c.type === "section");
  const sectionIndices = chunks.map((c, i) => c.type === "section" ? i : -1).filter(i => i !== -1);

  if (meta.order && meta.order.length > 0) {
    const uidIndex = {};
    meta.order.forEach((uid, i) => uidIndex[uid] = i);
    sections.sort((a, b) => {
      const idxA = uidIndex[a.uid];
      const idxB = uidIndex[b.uid];
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return -1;
      if (idxB !== undefined) return 1;
      return a.sortOrder.localeCompare(b.sortOrder);
    });
  } else {
    sections.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        if (!a.sortOrder) return 1;
        if (!b.sortOrder) return -1;
        return a.sortOrder.localeCompare(b.sortOrder);
      }
      return a.name.localeCompare(b.name);
    });
  }

  const result = [...chunks];
  sectionIndices.forEach((idx, i) => {
    result[idx] = sections[i];
  });
  return result;
}

function sortForSkeleton(chunks, filename, targetUIDs = []) {
  const style = getStyleForFile(filename);
  const targetSet = new Set(targetUIDs);

  return chunks.map(c => {
    // Collapse if not HIGH importance AND not a target UID
    if (c.type === "section" && c.importance < IMPORTANCE.HIGH && !targetSet.has(c.uid)) {
      const lines = splitLinesWithEndings(c.content);
      const validLines = lines.filter(l => l.text.trim() !== "");
      if (validLines.length >= 2) {
        const header = lines[0];
        const footer = lines[lines.length - 1];
        const collapsedCount = lines.length - 2;
        const collapsedMsg = `  ${style.inlineComment(`[Collapsed: ${collapsedCount} lines]`)}`;
        const eol = header.ending || '\n';
        return new Chunk({
          ...c,
          content: `${header.text}${eol}${collapsedMsg}${eol}${footer.text}${footer.ending}`
        });
      }
    }
    return c;
  });
}
//}

//{ 05:CLI @high #core $E7F3A2B1D
function printHelp() {
  console.log(`ai-desk - AI-Native Cognitive Workspace Manager

Usage:
  ai-desk <filename> <mode> [args...]

Modes:
  focus [UID...]      Sorts by Importance (@high) and Tags. Priority to UID.
  restore             Normalizes order for Git.
  skeleton [UID...]   Collapses mid/low sections. Keeps UID expanded.
  apply <patch>       (Mutation) Applies section updates from patch.
  list                Show all bookmarks.
  test                Debug structure.

Options:
  -w, --write         Write results back to file (Default is stdout for Views).

Examples:
  ai-desk app.js focus -w      # Write focused view to file
  ai-desk app.js focus $UID    # Prioritize specific section
  ai-desk app.js skeleton $UID # Structure with target expanded
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  // 位置引数を厳密化: 0=file, 1=mode
  const filePath = args[0];
  let mode = args[1];
  
  // flags
  let isWrite = args.includes("-w") || args.includes("--write");
  const extraArgs = args.slice(2).filter(a => a !== "-w" && a !== "--write");

  if (mode === "<<" && extraArgs[0]) mode = "save";
  else if (mode === ">>" && extraArgs[0]) mode = "load";

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let { chunks, meta } = parse(content);

  // Always ensure UIDs when reading
  chunks = ensureUIDs(chunks, filePath);
  if (!meta.order || meta.order.length === 0) {
    meta.order = chunks.filter(c => c.type === "section").map(c => c.uid);
  }

  let outputChunks = chunks;
  let isMutation = false;

  switch (mode) {
    case "test":
      chunks.forEach((c, i) => {
        if (c.type === "section") {
          console.log(`[${i}] ${c.type} ${c.uid} ${c.sortOrder}:${c.name} @${c.importance}`);
        } else {
          console.log(`[${i}] ${c.type} (length: ${c.content.length})`);
        }
      });
      return;

    case "focus":
      outputChunks = sortForFocus(chunks, extraArgs);
      break;

    case "restore":
      outputChunks = sortForRestore(chunks, meta);
      break;

    case "skeleton":
      // Skeleton は絶対に書き戻さない (データ破壊防止)
      isWrite = false;
      const focused = sortForFocus(chunks, extraArgs);
      outputChunks = sortForSkeleton(focused, filePath, extraArgs);
      break;

    case "apply":
      isMutation = true;
      const patchPath = extraArgs[0];
      if (!patchPath) {
        console.error("Error: Patch file required.");
        process.exit(1);
      }
      const patchContent = fs.readFileSync(patchPath, 'utf8');
      const { chunks: patchChunks } = parse(patchContent);
      
      const patchUIDMap = new Map();
      const patchNameMap = new Map();
      const patchNameCount = new Map();
      
      patchChunks.filter(c => c.type === "section").forEach(pc => {
        if (pc.uid) patchUIDMap.set(pc.uid, pc);
        if (pc.name && pc.name !== "Unnamed") {
          patchNameMap.set(pc.name, pc);
          patchNameCount.set(pc.name, (patchNameCount.get(pc.name) || 0) + 1);
        }
      });

      // ターゲット側の Name カウント
      const targetNameCount = new Map();
      chunks.filter(c => c.type === "section").forEach(c => {
        if (c.name && c.name !== "Unnamed") {
          targetNameCount.set(c.name, (targetNameCount.get(c.name) || 0) + 1);
        }
      });

      let appliedCount = 0;
      const usedUIDs = new Set();
      let hasUnmatched = false;

      chunks.forEach((c, i) => {
        if (c.type !== "section") return;
        
        let patchChunk = null;
        if (c.uid && patchUIDMap.has(c.uid)) {
          patchChunk = patchUIDMap.get(c.uid);
          usedUIDs.add(c.uid);
          appliedCount++;
        } else if (c.name && c.name !== "Unnamed" && patchNameMap.has(c.name)) {
          // Name 衝突検知
          if (targetNameCount.get(c.name) > 1 || patchNameCount.get(c.name) > 1) {
             console.error(`  Warning: Ambiguous Name "${c.name}". Found multiple instances. Skipping patch for safety.`);
             return;
          }
          patchChunk = patchNameMap.get(c.name);
          console.error(`  Notice: Matched "${c.name}" by Name. UID was missing or mismatched.`);
          usedUIDs.add(c.uid); // dummy mark
          appliedCount++;
        }

        if (patchChunk) {
           let content = patchChunk.content;
           if (!content.endsWith('\n')) {
              content += '\n';
           }
           chunks[i] = new Chunk({ ...patchChunk, content });
        }
      });
      
      // Warn about unused patches
      patchUIDMap.forEach((pc, uid) => {
        if (!usedUIDs.has(uid)) {
          console.error(`  Warning: Unmatched patch section: [UID: ${uid}, Name: ${pc.name}]. Use manual insertion to add new sections.`);
          hasUnmatched = true;
        }
      });

      console.error(`Applied ${appliedCount} sections.`);
      outputChunks = chunks;
      break;
    
    case "save":
      isMutation = true;
      const saveName = extraArgs[0];
      meta.bookmarks[saveName] = chunks.filter(c => c.type === "section").map(c => c.uid);
      console.error(`Bookmark '${saveName}' saved.`);
      break;
    
    case "load":
      isMutation = true;
      const loadName = extraArgs[0];
      if (meta.bookmarks[loadName]) {
        const uids = meta.bookmarks[loadName];
        const uidMap = new Map(chunks.filter(c => c.type === "section").map(s => [s.uid, s]));
        const sortedSections = uids.map(uid => uidMap.get(uid)).filter(s => s);
        
        // Append missing ones
        const bookmarkUIDs = new Set(uids);
        chunks.filter(c => c.type === "section").forEach(s => {
          if (!bookmarkUIDs.has(s.uid)) sortedSections.push(s);
        });

        const sectionIndices = chunks.map((c, i) => c.type === "section" ? i : -1).filter(i => i !== -1);
        outputChunks = [...chunks];
        sectionIndices.forEach((idx, i) => { if(sortedSections[i]) outputChunks[idx] = sortedSections[i]; });
        console.error(`Bookmark '${loadName}' loaded.`);
      } else {
        console.error(`Error: Bookmark '${loadName}' not found.`);
        process.exit(1);
      }
      break;

    case "list":
      console.log(`Bookmarks in ${filePath}:`);
      Object.keys(meta.bookmarks).sort().forEach(name => {
        console.log(`  ${name.padEnd(12)} (${meta.bookmarks[name].length} sections)`);
      });
      return;

    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
  }

  const result = formatMetadata(meta) + outputChunks.map(c => c.content).join("");
  
  if (isWrite || isMutation) {
    fs.writeFileSync(filePath, result, 'utf8');
    if (isMutation || isWrite) {
       console.error(`File ${filePath} updated.`);
    }
  } else {
    process.stdout.write(result);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
//}
