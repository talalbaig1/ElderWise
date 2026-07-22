/**
 * Rebuild ElderWise src from transcript tool calls BEFORE the
 * "production / not a demo" landing redesign prompt (line 245).
 */
const fs = require("fs");
const path = require("path");

const TRANSCRIPT =
  "C:/Users/samaq/.cursor/projects/c-Users-samaq-Documents-elderwise/agent-transcripts/64316606-5252-40ef-a497-adf47e86eec7/64316606-5252-40ef-a497-adf47e86eec7.jsonl";
const CUTOFF = 245; // exclusive — redesign prompt starts here
const OUT =
  "C:/Users/samaq/Documents/elderwise-versions/PRE-REDESIGN";
const MAIN_SRC = "C:/Users/samaq/Documents/elderwise/src";

const lines = fs.readFileSync(TRANSCRIPT, "utf8").split(/\n/).filter(Boolean);

/** @type {Map<string, string>} */
const files = new Map();

function norm(p) {
  return String(p).replace(/\\/g, "/");
}

function toRel(p) {
  const n = norm(p);
  const marker = "/elderwise/";
  const idx = n.toLowerCase().lastIndexOf(marker);
  if (idx === -1) return null;
  return n.slice(idx + marker.length);
}

let writes = 0;
let patches = 0;
let deletes = 0;

for (let i = 0; i < CUTOFF && i < lines.length; i++) {
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  for (const part of obj.message?.content || []) {
    if (part.type !== "tool_use") continue;
    const name = part.name;
    const input = part.input || {};

    if (name === "Write" && input.path && typeof input.contents === "string") {
      const rel = toRel(input.path);
      if (!rel) continue;
      files.set(rel, input.contents);
      writes++;
    }

    if (name === "StrReplace" && input.path && typeof input.old_string === "string") {
      const rel = toRel(input.path);
      if (!rel || !files.has(rel)) continue;
      const cur = files.get(rel);
      if (!cur.includes(input.old_string)) continue;
      const next = input.replace_all
        ? cur.split(input.old_string).join(input.new_string)
        : cur.replace(input.old_string, input.new_string);
      files.set(rel, next);
      patches++;
    }

    if (name === "Delete" && input.path) {
      const rel = toRel(input.path);
      if (rel && files.has(rel)) {
        files.delete(rel);
        deletes++;
      }
    }
  }
}

// Write snapshot
fs.mkdirSync(OUT, { recursive: true });
const srcOut = path.join(OUT, "src");
if (fs.existsSync(srcOut)) {
  fs.rmSync(srcOut, { recursive: true, force: true });
}

let written = 0;
for (const [rel, contents] of files) {
  if (!rel.startsWith("src/") && !rel.startsWith("public/") && !rel.startsWith("package.json")) {
    // still write other project roots we care about
  }
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
  written++;
}

// Also restore into main project src (+ public if present)
const mainBackup = "C:/Users/samaq/Documents/elderwise-versions/_backup-before-pre-redesign-restore";
if (fs.existsSync(MAIN_SRC)) {
  fs.mkdirSync(path.dirname(mainBackup), { recursive: true });
  // light marker only — full src restore below
}

// Clear and restore main src from reconstructed files
const keepPublicImages = path.join(MAIN_SRC, "..", "public");
for (const [rel, contents] of files) {
  if (!rel.startsWith("src/")) continue;
  const dest = path.join("C:/Users/samaq/Documents/elderwise", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
}

// Restore public assets from transcript if any
for (const [rel, contents] of files) {
  if (!rel.startsWith("public/")) continue;
  const dest = path.join("C:/Users/samaq/Documents/elderwise", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
}

const manifest = [
  `Cutoff line: ${CUTOFF} (exclusive)`,
  `Writes applied: ${writes}`,
  `StrReplace applied: ${patches}`,
  `Deletes: ${deletes}`,
  `Files in snapshot: ${written}`,
  `Key files present:`,
  ...["src/app/(public)/page.tsx", "src/app/(app)/dashboard/page.tsx", "src/app/(app)/reports/page.tsx", "src/app/onboarding/page.tsx", "src/data/mock.ts", "src/lib/store.tsx"]
    .map((k) => `  ${k}: ${files.has(k) ? "YES (" + files.get(k).length + ")" : "NO"}`),
].join("\n");

fs.writeFileSync(path.join(OUT, "RESTORE-MANIFEST.txt"), manifest);
console.log(manifest);
