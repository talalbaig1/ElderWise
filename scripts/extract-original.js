const fs = require("fs");
const path = require("path");

const transcript =
  "C:/Users/samaq/.cursor/projects/c-Users-samaq-Documents-elderwise/agent-transcripts/64316606-5252-40ef-a497-adf47e86eec7/64316606-5252-40ef-a497-adf47e86eec7.jsonl";
const lines = fs.readFileSync(transcript, "utf8").split(/\n/).filter(Boolean);

function norm(p) {
  return String(p).replace(/\\/g, "/");
}

/** @type {Map<string, {i:number, contents:string}[]>} */
const writesByPath = new Map();

for (let i = 0; i < lines.length; i++) {
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  for (const part of obj.message?.content || []) {
    if (part.type !== "tool_use" || part.name !== "Write") continue;
    const p = norm(part.input?.path || "");
    const contents = part.input?.contents;
    if (!p || typeof contents !== "string") continue;
    if (!writesByPath.has(p)) writesByPath.set(p, []);
    writesByPath.get(p).push({ i, contents });
  }
}

const outRoot = "C:/Users/samaq/Documents/elderwise-versions";
const origDir = path.join(outRoot, "_extracted-original");
fs.mkdirSync(origDir, { recursive: true });

const keysWanted = [
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/reports/page.tsx",
  "src/components/dashboard/charts.tsx",
  "src/components/reports/report-charts.tsx",
  "src/lib/dashboard-analytics.ts",
  "src/lib/report-analytics.ts",
  "src/lib/onboarding.ts",
  "src/app/onboarding/page.tsx",
  "src/components/onboarding/wizard-shell.tsx",
  "src/components/onboarding/onboarding-context.tsx",
  "src/components/onboarding/fields.tsx",
  "src/components/onboarding/steps/care-partner-step.tsx",
  "src/components/onboarding/steps/loved-one-step.tsx",
  "src/components/onboarding/steps/local-buddy-step.tsx",
  "src/components/onboarding/steps/doctor-step.tsx",
  "src/components/onboarding/steps/medication-step.tsx",
  "src/components/onboarding/steps/food-step.tsx",
  "src/components/onboarding/steps/health-step.tsx",
  "src/components/onboarding/steps/review-step.tsx",
  "src/components/onboarding/steps/completion-step.tsx",
];

function pick(rel) {
  let entries = null;
  for (const [p, arr] of writesByPath) {
    if (p.endsWith("/" + rel) || p.endsWith(rel)) {
      entries = arr;
      break;
    }
  }
  if (!entries?.length) return null;

  if (rel.includes("dashboard/page.tsx")) {
    const hit = entries.find((e) => e.i === 92) || entries.find((e) => e.contents.length > 8000);
    return (hit || entries[0]).contents;
  }

  if (rel.includes("reports/page.tsx")) {
    const hit =
      entries.find((e) => e.contents.includes("ReportTrendChart") && e.contents.length > 8000) ||
      entries.find((e) => e.contents.length > 8000);
    return (hit || entries[0]).contents;
  }

  // Prefer first write (original), not last simplified overwrite
  return entries[0].contents;
}

const manifest = [];
for (const rel of keysWanted) {
  const contents = pick(rel);
  if (!contents) {
    manifest.push("MISSING " + rel);
    continue;
  }
  const dest = path.join(origDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
  manifest.push(`OK ${rel} (${contents.length})`);
}

fs.writeFileSync(path.join(outRoot, "extract-manifest.txt"), manifest.join("\n"));
console.log(manifest.join("\n"));
console.log("\nExtracted to", origDir);
