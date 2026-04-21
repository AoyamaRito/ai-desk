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

const sectionRegex = /^\s*(?:(?:\/\/|\/\*|<!--|#)\s*\{|VVV)\s*(?:([0-9a-zA-Z]+):)?([^\s@#$]+)?(?:\s+@([a-zA-Z0-9/._-]+))?(?:\s+(#[^$]*))?(?:\s*(\$[0-9A-Za-z_]{1,50}))?(?:\s*-->)?/;
const sectionEndRegex = /^\s*(?:(?:\/\/|\/\*|<!--|-->|\*\/|#)\s*\}|AAA)/;

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

function splitLinesWithEndings(content) {
  const lines = [];
  let start = 0;
  while (start < content.length) {
    let rn = content.indexOf('\r\n', start);
    let n = content.indexOf('\n', start);
    let end = -1, ending = '';
    if (rn !== -1 && (n === -1 || rn < n)) { end = rn; ending = '\r\n'; }
    else if (n !== -1) { end = n; ending = '\n'; }

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
  let currentLines = [];
  let inSection = false;
  let curHeader = {};

  const buildContent = (lineObjs) => lineObjs.map(l => l.text + l.ending).join('');

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const text = lineObj.text;

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

  return { chunks };
}
//}

//{ 04:CoreLogic @high #core $D6E2F5B1C
function injectUID(lineText, style, uid) {
  const uidPattern = /\$[0-9A-Za-z_]{1,50}/;
  if (uidPattern.test(lineText)) return lineText.replace(uidPattern, uid);
  const trimmed = lineText.trimEnd();
  if (style.html && trimmed.endsWith("-->")) return trimmed.slice(0, -3).trimEnd() + ` ${uid} -->`;
  if (trimmed.endsWith("*/")) return trimmed.slice(0, -2).trimEnd() + ` ${uid} */`;
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
        lines[0].text = injectUID(lines[0].text, style, chunk.uid);
        chunk.content = lines.map(l => l.text + l.ending).join('');
      }
    }
  }
  return chunks;
}

function extractSections(chunks, targetUIDs = []) {
  if (targetUIDs.length === 0) {
    return chunks.filter(c => c.type === "section" && c.importance === IMPORTANCE.HIGH);
  }
  const targetSet = new Set(targetUIDs.map(t => t.startsWith('$') ? t : '$' + t));
  const targetNames = new Set(targetUIDs.filter(t => !t.startsWith('$')));
  
  return chunks.filter(c => {
    if (c.type !== "section") return false;
    return targetSet.has(c.uid) || targetNames.has(c.name);
  });
}

function createSkeleton(chunks, filename, targetUIDs = []) {
  const style = getStyleForFile(filename);
  const targetSet = new Set(targetUIDs);

  return chunks.map(c => {
    if (c.type === "section" && c.importance < IMPORTANCE.HIGH && !targetSet.has(c.uid)) {
      const lines = splitLinesWithEndings(c.content);
      if (lines.length >= 2) {
        const header = lines[0];
        const footer = lines[lines.length - 1];
        const collapsedMsg = `  ${style.inlineComment(`[Collapsed: ${lines.length - 2} lines]`)}`;
        const eol = header.ending || '\n';
        return new Chunk({ ...c, content: `${header.text}${eol}${collapsedMsg}${eol}${footer.text}${footer.ending}` });
      }
    }
    return c;
  });
}
//}

//{ 05:CLI @high #core $E7F3A2B1D
function printHelp() {
  console.log(`ai-desk - AI-Native Cognitive Workspace Manager (Refined)

Usage:
  ai-desk <filename> <mode> [args...]

Modes:
  skeleton [UID...]   Structure overview. Collapses mid/low sections.
  focus [UID...]      Extract specific sections to stdout (minimal tokens).
  apply <patch>       (Mutation) Applies updates from a patch file.
  test                Debug structure.

Examples:
  ai-desk app.js skeleton
  ai-desk app.js focus $AUTH01
  ai-desk app.js apply patch.js
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("-h") || args.includes("--help")) { printHelp(); return; }

  const filePath = args[0];
  let mode = args[1];
  const extraArgs = args.slice(2);

  if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }

  const content = fs.readFileSync(filePath, 'utf8');
  let { chunks } = parse(content);
  chunks = ensureUIDs(chunks, filePath);

  switch (mode) {
    case "test":
      chunks.forEach((c, i) => {
        if (c.type === "section") console.log(`[${i}] ${c.type} ${c.uid} ${c.sortOrder}:${c.name} @${c.importance}`);
        else console.log(`[${i}] ${c.type} (length: ${c.content.length})`);
      });
      break;

    case "skeleton":
      const skelChunks = createSkeleton(chunks, filePath, extraArgs);
      process.stdout.write(skelChunks.map(c => c.content).join(""));
      break;

    case "focus":
      const selected = extractSections(chunks, extraArgs);
      process.stdout.write(selected.map(c => c.content).join("\n"));
      break;

    case "apply":
      const patchPath = extraArgs[0];
      if (!patchPath) { console.error("Error: Patch file required."); process.exit(1); }
      const { chunks: patchChunks } = parse(fs.readFileSync(patchPath, 'utf8'));
      
      const patchUIDMap = new Map(), patchNameMap = new Map(), patchNameCount = new Map();
      patchChunks.filter(c => c.type === "section").forEach(pc => {
        if (pc.uid) patchUIDMap.set(pc.uid, pc);
        if (pc.name && pc.name !== "Unnamed") {
          patchNameMap.set(pc.name, pc);
          patchNameCount.set(pc.name, (patchNameCount.get(pc.name) || 0) + 1);
        }
      });

      const targetNameCount = new Map();
      chunks.filter(c => c.type === "section").forEach(c => {
        if (c.name && c.name !== "Unnamed") targetNameCount.set(c.name, (targetNameCount.get(c.name) || 0) + 1);
      });

      let appliedCount = 0;
      const usedUIDs = new Set();
      chunks.forEach((c, i) => {
        if (c.type !== "section") return;
        let pc = (c.uid && patchUIDMap.get(c.uid)) || 
                 (c.name && c.name !== "Unnamed" && targetNameCount.get(c.name) === 1 && patchNameCount.get(c.name) === 1 && patchNameMap.get(c.name));
        
        if (pc) {
          let newContent = pc.content;
          if (!newContent.endsWith('\n')) newContent += '\n';
          chunks[i] = new Chunk({ ...pc, content: newContent });
          usedUIDs.add(c.uid);
          appliedCount++;
        }
      });

      fs.writeFileSync(filePath, chunks.map(c => c.content).join(""), 'utf8');
      console.error(`Applied ${appliedCount} sections to ${filePath}.`);
      break;

    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
//}
