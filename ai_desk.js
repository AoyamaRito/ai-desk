#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

//{ 01:Types @high #core
class Chunk {
  constructor({ type, sortOrder = "", name = "Unnamed", importance = 1, tags = [], content = "" }) {
    this.type = type; // "section" or "plain"
    this.sortOrder = sortOrder;
    this.name = name;
    this.importance = importance;
    this.tags = tags;
    this.content = content;
  }
}

const IMPORTANCE = { HIGH: 3, MID: 2, LOW: 1 };
//}

//{ 02:Utilities @mid #core
const sectionRegex = /^\s*(?:(?:\/\/|\/\*|<!--|#)\s*\{|VVV)\s*(?:([0-9a-zA-Z]+):)?([^\s@#$]+)?(?:\s+@([a-zA-Z0-9/._-]+))?(?:\s+(#[^$]*))?(?:\s*-->)?/;
const sectionEndRegex = /^\s*(?:(?:\/\/|\/\*|<!--|-->|\*\/|#)\s*\}|AAA)/;

function parseHeader(line) {
  const matches = line.match(sectionRegex);
  if (!matches) return { sortOrder: "", name: "Unknown", importance: IMPORTANCE.LOW, tags: [] };

  const sortOrder = matches[1] || "";
  let name = (matches[2] || "").trim();
  if (!name) name = "Unnamed";

  const impStr = (matches[3] || "").toLowerCase();
  let importance = IMPORTANCE.LOW;
  if (impStr === "high" || impStr === "3") importance = IMPORTANCE.HIGH;
  else if (impStr === "mid" || impStr === "2" || impStr === "medium") importance = IMPORTANCE.MID;

  const tagsStr = (matches[4] || "").trim();
  const tags = tagsStr ? tagsStr.split(/\s+/).map(t => t.replace(/^#/, "")).filter(t => t) : [];

  return { sortOrder, name, importance, tags };
}

function getStyleForFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".html": case ".htm": case ".vue": case ".svelte": case ".xml":
      return { prefix: "<!-- {", suffix: "<!-- } -->", inlineComment: (msg) => `<!-- ${msg} -->` };
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
    if (end === -1) { lines.push({ text: content.substring(start), ending: '' }); break; }
    else { lines.push({ text: content.substring(start, end), ending }); start = end + ending.length; }
  }
  return lines;
}
//}

//{ 03:Parsing @high #core
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
      chunks.push(new Chunk({ type: "section", ...curHeader, content: buildContent(currentLines) }));
      currentLines = [];
      inSection = false;
    } else {
      currentLines.push(lineObj);
    }
  }
  if (currentLines.length > 0) chunks.push(new Chunk({ type: "plain", content: buildContent(currentLines) }));
  return { chunks };
}
//}

//{ 04:CoreLogic @high #core
function extractSections(chunks, targets = []) {
  if (targets.length === 0) return chunks.filter(c => c.type === "section" && c.importance === IMPORTANCE.HIGH);
  const targetSet = new Set(targets);
  return chunks.filter(c => c.type === "section" && targetSet.has(c.name));
}

function createSkeleton(chunks, filename, targets = []) {
  const style = getStyleForFile(filename);
  const targetSet = new Set(targets);
  return chunks.map(c => {
    if (c.type === "section" && c.importance < IMPORTANCE.HIGH && !targetSet.has(c.name)) {
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

//{ 05:CLI @high #core
function printHelp() {
  console.log(`ai-desk - AI-Native Cognitive Workspace Manager (Name-Only Edition)

Usage:
  ai-desk <filename> <mode> [args...]

Modes:
  skeleton [Name...]  Structure overview. Collapses mid/low sections.
  focus [Name...]     Extract specific sections by Name to stdout.
  apply <patch>       (Mutation) Applies updates from a patch file using Name matching.
  test                Debug structure.
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

  switch (mode) {
    case "test":
      chunks.forEach((c, i) => {
        if (c.type === "section") console.log(`[${i}] ${c.type} ${c.sortOrder}:${c.name} @${c.importance}`);
        else console.log(`[${i}] ${c.type} (len: ${c.content.length})`);
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
      
      const patchMap = new Map(), patchCount = new Map();
      patchChunks.filter(c => c.type === "section").forEach(pc => {
        if (pc.name && pc.name !== "Unnamed") {
          patchMap.set(pc.name, pc);
          patchCount.set(pc.name, (patchCount.get(pc.name) || 0) + 1);
        }
      });

      const targetCount = new Map();
      chunks.filter(c => c.type === "section").forEach(c => {
        if (c.name && c.name !== "Unnamed") targetCount.set(c.name, (targetCount.get(c.name) || 0) + 1);
      });

      let appliedCount = 0;
      chunks.forEach((c, i) => {
        if (c.type !== "section") return;
        if (c.name && c.name !== "Unnamed" && targetCount.get(c.name) === 1 && patchCount.get(c.name) === 1 && patchMap.has(c.name)) {
          let pc = patchMap.get(c.name);
          let newContent = pc.content;
          if (!newContent.endsWith('\n')) newContent += '\n';
          chunks[i] = new Chunk({ ...pc, content: newContent });
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
