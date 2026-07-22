const fs = require("fs");

const map = {
  "loved-one-step.tsx": 0,
  "care-partner-step.tsx": 1,
  "local-buddy-step.tsx": 2,
  "doctor-step.tsx": 3,
  "food-step.tsx": 4,
  "medication-step.tsx": 5,
  "health-step.tsx": 6,
  "review-step.tsx": 7,
  "completion-step.tsx": 8,
};

for (const [file, idx] of Object.entries(map)) {
  const p = `C:/Users/samaq/Documents/elderwise/src/components/onboarding/steps/${file}`;
  let t = fs.readFileSync(p, "utf8");
  if (t.includes(`sectionIndex={${idx}}`)) {
    console.log("skip", file);
    continue;
  }
  t = t.replace(/<WizardShell(\s)/g, `<WizardShell sectionIndex={${idx}}$1`);
  t = t.replace(/<WizardShell>/g, `<WizardShell sectionIndex={${idx}}>`);
  t = t.replace(/<WizardShell\n/g, `<WizardShell\n      sectionIndex={${idx}}\n`);
  fs.writeFileSync(p, t);
  console.log("patched", file, t.includes(`sectionIndex={${idx}}`));
}
