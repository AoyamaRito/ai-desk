#!/usr/bin/env node
//@ order = $77B49386E, $B3DB3E3B8, $7C1BC8E1E, $C8B7D0ED1, $6D8801094

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

//{ 01:Types @high #core $77B49386E
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

//{ 02:Utilities @mid #core $B3DB3E3B8
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
  // Accept any alphanumeric UID (user-provided)
  // Only generate new UID when section has no UID at all
  const body = uid.substring(1);
  if (body.length === 0) return false;
  // Allow alphanumeric, underscore (for user-defined UIDs like $MY_UID)
  return /^[0-9A-Za-z_]+$/.test(body);
}

// Regex refined to be less greedy and support HTML/CSS properly
// UID pattern: $XXXX (alphanumeric + underscore, 1-50 chars)
const sectionRegex = /^(?:(?:\/\/|\/\*|<!--|#)\s*\{|VVV)\s*(?:([0-9a-zA-Z]+):)?([^\s@#$]+)?(?:\s+@([a-zA-Z0-9/._-]+))?(?:\s+(#[^$]*))?(?:\s*(\$[0-9A-Za-z_]{1,50}))?(?:\s*-->)?/;
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
      return { prefix: "<!-- {", suffix: "<!-- } -->", html: true };
    case ".css": case ".scss": case ".less":
      return { prefix: "/* {", suffix: "/* } */" };
    case ".js": case ".ts": case ".go": case ".c": case ".cpp": case ".java": case ".rust": case ".rs": case ".php": case ".swift": case ".kt":
      return { prefix: "//{", suffix: "//}" };
    case ".py": case ".rb": case ".sh": case ".yaml": case ".yml": case ".toml": case ".conf":
      return { prefix: "# {", suffix: "# }" };
    default:
      return { prefix: "VVV", suffix: "AAA" };
  }
}
//}

//{ 03:Parsing @high #core $7C1BC8E1E
function parse(content) {
  // Detect line endings to preserve them
  const isCRLF = content.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  
  // Accurately preserve trailing newline state
  const endsWithNewline = content.endsWith('\n');
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const chunks = [];
  const meta = new Metadata();
  let currentLines = [];
  let inSection = false;
  let curHeader = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("//@")) {
      const orderMatch = trimmedLine.match(metaOrderRegex);
      if (orderMatch) {
        meta.order = orderMatch[1].split(",").map(s => s.trim()).filter(s => s);
        continue;
      }
      const bookmarkMatch = trimmedLine.match(metaBookmarkRegex);
      if (bookmarkMatch) {
        const name = bookmarkMatch[1];
        const uids = bookmarkMatch[2].split(",").map(s => s.trim()).filter(s => s);
        meta.bookmarks[name] = uids;
        continue;
      }
    }

    if (sectionRegex.test(trimmedLine) && !sectionEndRegex.test(trimmedLine)) {
      if (!inSection && currentLines.length > 0) {
        chunks.push(new Chunk({ type: "plain", content: currentLines.join(eol) + eol }));
        currentLines = [];
      }
      inSection = true;
      curHeader = parseHeader(trimmedLine);
      currentLines.push(line);
    } else if (sectionEndRegex.test(trimmedLine) && inSection) {
      currentLines.push(line);
      chunks.push(new Chunk({
        type: "section",
        ...curHeader,
        content: currentLines.join(eol) + eol
      }));
      currentLines = [];
      inSection = false;
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    chunks.push(new Chunk({ type: "plain", content: currentLines.join(eol) + (endsWithNewline ? eol : "") }));
  }

  return { chunks, meta, eol };
}
//}

//{ 04:CoreLogic @high #core $C8B7D0ED1
function ensureUIDs(chunks, filename) {
  const existingSet = new Set(chunks.filter(c => c.uid).map(c => c.uid));
  const style = getStyleForFile(filename);

  for (const chunk of chunks) {
    if (chunk.type === "section" && (!chunk.uid || !isValidUID(chunk.uid))) {
      const oldUID = chunk.uid;
      chunk.uid = generateUID(existingSet);
      existingSet.add(chunk.uid);
      
      const lines = chunk.content.split(/\r?\n/);
      if (lines.length > 0) {
        // Re-construct header with correct format and closing tag if HTML
        const h = parseHeader(lines[0]);
        const tagsStr = h.tags.length ? " #" + h.tags.join(" #") : "";
        let newHeader = `${style.prefix.replace(/ $/, '')} ${h.sortOrder}:${h.name} @${h.importance === 3 ? "high" : h.importance === 2 ? "mid" : "low"}${tagsStr} ${chunk.uid}${style.html ? " -->" : ""}`;
        lines[0] = newHeader;
        chunk.content = lines.join(chunk.content.includes('\r\n') ? '\r\n' : '\n');
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

function sortForFocus(chunks) {
  const sections = chunks.filter(c => c.type === "section");
  const sectionIndices = chunks.map((c, i) => c.type === "section" ? i : -1).filter(i => i !== -1);

  sections.sort((a, b) => {
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

function sortForSkeleton(chunks, filename) {
  const style = getStyleForFile(filename);
  const commentPrefix = style.prefix.split(' ')[0]; // e.g., //, #, /*

  return chunks.map(c => {
    if (c.type === "section" && c.importance < IMPORTANCE.HIGH) {
      const lines = c.content.split(/\r?\n/).filter(l => l !== "");
      if (lines.length >= 2) {
        const header = lines[0];
        const footer = lines[lines.length - 1];
        return new Chunk({
          ...c,
          content: `${header}\n  ${commentPrefix} [Collapsed: ${lines.length - 2} lines]\n${footer}\n`
        });
      }
    }
    return c;
  });
}
//}

//{ 05:CLI @high #core $6D8801094
function printHelp() {
  console.log(`ai-desk - AI-Native Cognitive Workspace Manager

Usage:
  ai-desk <filename> [mode] [args...]

Modes:
  focus         Sorts by Importance (@high) and Tags.
  restore       Normalizes order for Git.
  skeleton      Collapses mid/low sections for AI context.
  apply <patch> Applies section updates from patch.
  save << name  Save current order as bookmark.
  load >> name  Load bookmark order.
  list          Show all bookmarks.
  test          Debug structure.

Options:
  -w, --write   Write result to file (default: stdout for all modes).

Examples:
  ai-desk app.js focus              # Preview focused view
  ai-desk app.js focus -w           # Apply focused order to file
  ai-desk app.js apply patch.js     # Preview patched result
  ai-desk app.js apply patch.js -w  # Actually apply the patch
  ai-desk app.js restore -w         # Normalize for git commit
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  const filePath = args[0];
  const isWrite = args.includes("-w") || args.includes("--write");
  const modeArg = args.find(a => !a.startsWith("-") && a !== filePath) || "focus";
  const extraArgs = args.filter(a => !a.startsWith("-") && a !== filePath && a !== modeArg);

  let mode = modeArg;
  if (mode === "<<" && extraArgs[0]) mode = "save";
  else if (mode === ">>" && extraArgs[0]) mode = "load";

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let { chunks, meta, eol } = parse(content);

  // Record original UIDs before ensureUIDs (for apply mode matching)
  const originalUIDMap = new Map();
  chunks.forEach((c, i) => {
    if (c.type === "section" && c.uid) {
      originalUIDMap.set(c.uid, i);
    }
  });

  // Always ensure UIDs when reading
  chunks = ensureUIDs(chunks, filePath);
  if (!meta.order || meta.order.length === 0) {
    meta.order = chunks.filter(c => c.type === "section").map(c => c.uid);
  }

  let outputChunks = chunks;

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
      outputChunks = sortForFocus(chunks);
      break;

    case "restore":
      outputChunks = sortForRestore(chunks, meta);
      break;

    case "skeleton":
      if (isWrite) {
        console.error("Error: skeleton mode cannot write to file (destructive). Use stdout only.");
        process.exit(1);
      }
      const focused = sortForFocus(chunks);
      outputChunks = sortForSkeleton(focused, filePath);
      break;

    case "apply":
      const patchPath = extraArgs[0];
      if (!patchPath) {
        console.error("Error: Patch file required.");
        process.exit(1);
      }
      const patchContent = fs.readFileSync(patchPath, 'utf8');
      const { chunks: patchChunks } = parse(patchContent);

      const patchUIDMap = new Map();
      const patchNameMap = new Map();
      patchChunks.filter(c => c.type === "section").forEach(pc => {
        if (pc.uid) patchUIDMap.set(pc.uid, pc);
        if (pc.name && pc.name !== "Unnamed") patchNameMap.set(pc.name, pc);
      });

      let appliedCount = 0;
      const usedUIDs = new Set();

      // Helper: apply patch content while preserving target UID
      const applyPatch = (target, patch) => {
        const targetUID = target.uid;
        const patchLines = patch.content.split(/\r?\n/);
        if (patchLines.length > 0) {
          // Replace UID in patch header with target's UID
          patchLines[0] = patchLines[0].replace(/\$[0-9A-Z]{4,9}/g, targetUID);
        }
        return new Chunk({
          ...patch,
          uid: targetUID,
          content: patchLines.join(patch.content.includes('\r\n') ? '\r\n' : '\n')
        });
      };

      // Match using original UIDs (before ensureUIDs rewrote them)
      patchUIDMap.forEach((patch, patchUID) => {
        if (originalUIDMap.has(patchUID)) {
          const idx = originalUIDMap.get(patchUID);
          chunks[idx] = applyPatch(chunks[idx], patch);
          usedUIDs.add(patchUID);
          appliedCount++;
        }
      });

      // Fallback: match by name for patches not matched by UID
      chunks.forEach((c, i) => {
        if (c.type !== "section") return;
        // Skip if already applied
        if ([...originalUIDMap.entries()].some(([uid, idx]) => idx === i && usedUIDs.has(uid))) return;

        if (patchNameMap.has(c.name) && !usedUIDs.has(patchNameMap.get(c.name).uid)) {
          chunks[i] = applyPatch(c, patchNameMap.get(c.name));
          console.error(`  Warning: Matched "${c.name}" by Name.`);
          appliedCount++;
        }
      });

      // Warn about unused patches
      patchUIDMap.forEach((_, uid) => {
        if (!usedUIDs.has(uid)) console.error(`  Warning: Patch UID ${uid} not found in target file.`);
      });

      console.error(`Applied ${appliedCount} sections.`);
      outputChunks = chunks;
      break;

    case "save":
      const saveName = extraArgs[0];
      if (!saveName) {
        console.error("Error: Bookmark name required.");
        process.exit(1);
      }
      meta.bookmarks[saveName] = chunks.filter(c => c.type === "section").map(c => c.uid);
      console.error(`Bookmark '${saveName}' saved.`);
      break;

    case "load":
      const loadName = extraArgs[0];
      if (!loadName) {
        console.error("Error: Bookmark name required.");
        process.exit(1);
      }
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

  if (isWrite) {
    fs.writeFileSync(filePath, result, 'utf8');
    console.error(`File ${filePath} updated.`);
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
