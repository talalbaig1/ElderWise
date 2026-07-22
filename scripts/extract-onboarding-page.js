const fs = require("fs");
const path = require("path");
const transcript =
  "C:/Users/samaq/.cursor/projects/c-Users-samaq-Documents-elderwise/agent-transcripts/64316606-5252-40ef-a497-adf47e86eec7/64316606-5252-40ef-a497-adf47e86eec7.jsonl";
const lines = fs.readFileSync(transcript, "utf8").split(/\n/).filter(Boolean);
const obj = JSON.parse(lines[83]);
for (const part of obj.message.content) {
  if (
    part.type === "tool_use" &&
    part.name === "Write" &&
    String(part.input.path).includes("onboarding\\page.tsx")
  ) {
    const dest =
      "C:/Users/samaq/Documents/elderwise-versions/_extracted-original/src/app/onboarding/page.tsx";
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, part.input.contents);
    console.log("Wrote", dest, part.input.contents.length);
  }
}
