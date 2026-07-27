/**
 * A4.0 — full data reset for the live ElderWise Supabase project (Phases.md).
 *
 * There is only one Supabase project: vkrjupjqwdeghvpjsvai ("ElderWise MVP").
 * It serves the live site. This script deletes ALL public rows and ALL Auth users
 * on that project. Irreversible. Team lead runs it manually after a backup —
 * never auto-run.
 *
 * Safely re-runnable against a partial wipe: remaining elders / care_partners /
 * Auth users are deleted; tables already empty stay empty; tables missing from
 * the schema are SKIPPED (not a hard failure).
 *
 * Required env (never logged):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node --env-file=.env.local scripts/a4-reset.mjs --i-understand-this-deletes-everything
 *
 * After printing a deletion summary, the operator must type the project ref at an
 * interactive prompt. A flag alone cannot execute the wipe (shell-history recall
 * must not re-trigger deletion).
 *
 * Refuses to run if NEXT_PUBLIC_SUPABASE_URL is not the ElderWise MVP project.
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

/** Live ElderWise MVP project (only Supabase project — serves the live site). */
const TARGET_PROJECT_REF = "vkrjupjqwdeghvpjsvai";
const TARGET_HOST = `${TARGET_PROJECT_REF}.supabase.co`;

/**
 * Child → parent order so FK deletes succeed without CASCADE assumptions.
 * Keep in sync with Architecture.md / migrations. Tables listed here that are
 * not present in the live schema are SKIPPED (e.g. voice_journal_entries —
 * not created in the MVP).
 */
const PUBLIC_TABLES = [
  "checkin_medication_items",
  "voice_replies",
  "sos_notifications",
  "ct_notifications",
  "checkins",
  "sos_events",
  "medications",
  "food_routines",
  "health_routines",
  "domain_configs",
  "doctor_share_links",
  "local_caregivers",
  "doctors",
  "message_templates",
  "voice_journal_entries",
  "elders",
  "care_partners",
];

const CONFIRM_FLAG = "--i-understand-this-deletes-everything";

const args = new Set(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/** PostgREST / schema-cache errors for tables that do not exist. */
function isMissingTableError(message) {
  if (!message) return false;
  return /could not find the table|schema cache|relation .* does not exist|PGRST205/i.test(
    message,
  );
}

if (!args.has(CONFIRM_FLAG)) {
  fail(
    [
      "Refusing to run: missing explicit confirmation flag.",
      "",
      `Usage: node --env-file=.env.local scripts/a4-reset.mjs ${CONFIRM_FLAG}`,
      "",
      "After the summary, you must type the project ref at the prompt to delete.",
    ].join("\n"),
  );
}

if (!url || !serviceKey) {
  fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
}

if (host !== TARGET_HOST) {
  fail(
    [
      "Refusing to run: Supabase URL is not the ElderWise MVP project (live site).",
      `  expected host: ${TARGET_HOST}`,
      `  got host:      ${host}`,
    ].join("\n"),
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * @returns {{ table: string, count: number | null, present: boolean, error: string | null }}
 */
async function countRows(table) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    if (isMissingTableError(error.message)) {
      return { table, count: null, present: false, error: null };
    }
    return { table, count: null, present: true, error: error.message };
  }
  return { table, count: count ?? 0, present: true, error: null };
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) fail(`auth.admin.listUsers failed: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

function printTableCount(row) {
  if (!row.present) {
    console.log(`  public.${row.table.padEnd(28)} not present`);
    return;
  }
  if (row.error) {
    console.log(`  public.${row.table.padEnd(28)} ERROR — ${row.error}`);
    return;
  }
  console.log(
    `  public.${row.table.padEnd(28)} ${String(row.count).padStart(6)} rows`,
  );
}

console.log("A4.0 reset — ElderWise MVP (LIVE project)");
console.log(`  project: ${TARGET_PROJECT_REF} ("ElderWise MVP")`);
console.log(`  host:    ${host}`);
console.log("  WARNING: This is the only Supabase project and it serves the live site.");
console.log("");
console.log("Will delete (after backup by team lead):");
console.log("  1. ALL rows in public tables that exist (order below)");
console.log("  2. ALL Supabase Auth users");
console.log("  3. Does NOT touch Storage buckets or Upstash Redis");
console.log("  4. Tables missing from the schema are SKIPPED (not a failure)");
console.log("");

const tableCounts = [];
for (const table of PUBLIC_TABLES) {
  const row = await countRows(table);
  tableCounts.push(row);
  printTableCount(row);
}

const authUsers = await listAllAuthUsers();
console.log("");
console.log(`  auth.users                         ${String(authUsers.length).padStart(6)} users`);
for (const u of authUsers) {
  // Email + id only — never passwords or keys
  console.log(`    - ${u.id}  ${u.email ?? "(no email)"}`);
}

console.log("");
console.log("No deletions yet. Type the project ref to proceed, or anything else to abort.");
const rl = readline.createInterface({ input, output });
const typed = (
  await rl.question(`Type exactly "${TARGET_PROJECT_REF}" to delete: `)
).trim();
rl.close();

if (typed !== TARGET_PROJECT_REF) {
  fail("Confirmation did not match. Aborting. No deletions performed.");
}

console.log("");
console.log("EXECUTE: deleting public rows, then Auth users…");

/** @type {string[]} */
const skippedTables = [];

for (const table of PUBLIC_TABLES) {
  const prior = tableCounts.find((t) => t.table === table);
  if (prior && !prior.present) {
    console.log(`  SKIPPED — not present in schema: public.${table}`);
    skippedTables.push(table);
    continue;
  }
  // delete with a filter that matches all rows (PostgREST requires a filter)
  const { error } = await admin.from(table).delete().neq(
    "id",
    "00000000-0000-0000-0000-000000000000",
  );
  if (error) {
    if (isMissingTableError(error.message)) {
      console.log(`  SKIPPED — not present in schema: public.${table}`);
      skippedTables.push(table);
      continue;
    }
    fail(`Failed deleting public.${table}: ${error.message}`);
  }
  console.log(`  deleted public.${table}`);
}

for (const u of authUsers) {
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) {
    fail(`Failed deleting auth user ${u.id}: ${error.message}`);
  }
  console.log(`  deleted auth user ${u.id}`);
}

console.log("");
console.log("VERIFY: re-counting public tables and Auth users…");
let verifyFailed = false;
const verifyRows = [];
for (const table of PUBLIC_TABLES) {
  const row = await countRows(table);
  verifyRows.push(row);
  printTableCount(row);
  if (!row.present) continue;
  if (row.error) {
    console.error(`  VERIFY ERROR public.${table}: ${row.error}`);
    verifyFailed = true;
    continue;
  }
  if ((row.count ?? 0) > 0) {
    console.error(`  VERIFY FAIL public.${table}: still has ${row.count} rows`);
    verifyFailed = true;
  }
}

const authRemaining = await listAllAuthUsers();
console.log(
  `  auth.users                         ${String(authRemaining.length).padStart(6)} users`,
);
if (authRemaining.length > 0) {
  console.error(`  VERIFY FAIL auth.users: still has ${authRemaining.length} users`);
  verifyFailed = true;
}

console.log("");
if (skippedTables.length > 0) {
  console.log("SKIPPED — not present in schema:");
  for (const t of skippedTables) {
    console.log(`  - public.${t}`);
  }
  console.log("");
}

if (verifyFailed) {
  fail(
    "A4.0 reset INCOMPLETE: verification found remaining rows or Auth users. Re-run after investigating.",
  );
}

console.log("A4.0 reset complete — verification passed (all present tables empty; Auth empty).");
console.log("Next (manual):");
console.log("  1. Apply A4.1 migrations (empty DB required for new NOT NULL columns).");
console.log("  2. Re-onboard two tenants; update TENANT_A_* / TENANT_B_* in .env.local.");
console.log("  3. A4.5 seed — see scripts/a4-seed-checklist.md (includes message_templates).");
console.log("  4. Re-run rls-cross-tenant / rls-proof / share-link-isolation / verify-* scripts.");
process.exit(0);
