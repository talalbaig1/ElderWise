/**
 * GATE A3 (X1) — two-tenant RLS isolation.
 * Care partner A must not read or write care partner B's data (and reverse).
 *
 * Uses ANON key + each tenant's real session only. Never service-role.
 *
 * Required env (never hardcoded, never logged):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TENANT_A_EMAIL / TENANT_A_PASSWORD / TENANT_A_ELDER_ID
 *   TENANT_B_EMAIL / TENANT_B_PASSWORD / TENANT_B_ELDER_ID
 *
 * Usage: node --env-file=.env.local scripts/rls-cross-tenant.mjs
 * Exit non-zero on any failure. Counts and ids only — no tokens, passwords, or row bodies.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const tenants = {
  A: {
    label: "A",
    email: process.env.TENANT_A_EMAIL,
    password: process.env.TENANT_A_PASSWORD,
    elderId: process.env.TENANT_A_ELDER_ID,
  },
  B: {
    label: "B",
    email: process.env.TENANT_B_EMAIL,
    password: process.env.TENANT_B_PASSWORD,
    elderId: process.env.TENANT_B_ELDER_ID,
  },
};

/** Tables that store elder_id directly. */
const ELDER_SCOPED_TABLES = [
  "medications",
  "food_routines",
  "health_routines",
  "domain_configs",
  "local_caregivers",
  "doctors",
  "checkins",
  "sos_events",
  "ct_notifications",
];

if (!url || !anonKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

for (const t of Object.values(tenants)) {
  if (!t.email || !t.password || !t.elderId) {
    console.error(
      `Need TENANT_${t.label}_EMAIL, TENANT_${t.label}_PASSWORD, TENANT_${t.label}_ELDER_ID`,
    );
    process.exit(1);
  }
}

/** @type {{ dir: string, test: string, result: "PASS" | "FAIL" | "ABORT", detail: string }[]} */
const results = [];
let aborted = false;
let failed = false;

function record(dir, test, result, detail) {
  results.push({ dir, test, result, detail });
  const mark = result === "PASS" ? "PASS" : result;
  console.log(`[${dir}] ${mark.padEnd(5)} ${test} — ${detail}`);
  if (result === "ABORT") aborted = true;
  if (result === "FAIL" || result === "ABORT") failed = true;
}

function client() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ label: string, email: string, password: string, elderId: string }} self
 * @param {{ label: string, elderId: string }} other
 * @param {string} dir
 */
async function runDirection(supabase, self, other, dir) {
  const signed = await supabase.auth.signInWithPassword({
    email: self.email,
    password: self.password,
  });
  if (signed.error || !signed.data.session || !signed.data.user) {
    record(
      dir,
      "sign-in",
      "ABORT",
      `sign-in failed (${signed.error?.message ?? "no session"})`,
    );
    return;
  }

  const sessionUserId = signed.data.user.id;
  console.log(`[${dir}] signed in as user id ${sessionUserId}`);

  // --- CONTROL: own elder by id → exactly 1; bind session to expected tenant ---
  const own = await supabase
    .from("elders")
    .select("id, care_partner_id")
    .eq("id", self.elderId);
  if (own.error) {
    record(dir, "CONTROL own elder", "ABORT", `query error: ${own.error.message}`);
    await supabase.auth.signOut();
    return;
  }
  const ownRows = own.data ?? [];
  if (ownRows.length !== 1) {
    record(
      dir,
      "CONTROL own elder",
      "ABORT",
      `expected 1 row for elder ${self.elderId}, got ${ownRows.length}`,
    );
    await supabase.auth.signOut();
    return;
  }
  if (ownRows[0].care_partner_id !== sessionUserId) {
    record(
      dir,
      "CONTROL session↔tenant",
      "ABORT",
      `session user ${sessionUserId} ≠ elder care_partner_id ${ownRows[0].care_partner_id}`,
    );
    await supabase.auth.signOut();
    return;
  }
  record(
    dir,
    "CONTROL own elder",
    "PASS",
    `1 row; session matches care_partner_id`,
  );

  // --- TEST 3: select other elder by id → 0 ---
  const otherElder = await supabase
    .from("elders")
    .select("id")
    .eq("id", other.elderId);
  if (otherElder.error) {
    record(dir, "TEST 3 select other elder", "FAIL", `query error: ${otherElder.error.message}`);
  } else {
    const n = (otherElder.data ?? []).length;
    record(
      dir,
      "TEST 3 select other elder",
      n === 0 ? "PASS" : "FAIL",
      `rows=${n} (want 0) elder=${other.elderId}`,
    );
  }

  // --- TEST 4: update other elder → 0 rows affected ---
  const upd = await supabase
    .from("elders")
    .update({ first_name: "__rls_cross_tenant_probe__" })
    .eq("id", other.elderId)
    .select("id");
  {
    const n = (upd.data ?? []).length;
    // RLS may return empty data (no error) or an error; either is fine if 0 rows returned.
    const ok = n === 0;
    record(
      dir,
      "TEST 4 update other elder",
      ok ? "PASS" : "FAIL",
      ok
        ? `affected=0 elder=${other.elderId}${upd.error ? ` (error suppressed by RLS: ${upd.error.message})` : ""}`
        : `affected=${n} (want 0) elder=${other.elderId}`,
    );
  }

  // --- TEST 5: each child table filtered on OTHER elder_id → 0 ---
  for (const table of ELDER_SCOPED_TABLES) {
    const { data, error, count } = await supabase
      .from(table)
      .select("id", { count: "exact" })
      .eq("elder_id", other.elderId);
    if (error) {
      record(dir, `TEST 5 ${table}`, "FAIL", `query error: ${error.message}`);
      continue;
    }
    const n = count ?? (data ?? []).length;
    record(
      dir,
      `TEST 5 ${table}`,
      n === 0 ? "PASS" : "FAIL",
      `rows=${n} (want 0) elder=${other.elderId}`,
    );
  }

  // voice_replies: no elder_id — filter via checkins.elder_id
  {
    const { data, error, count } = await supabase
      .from("voice_replies")
      .select("id, checkins!inner(id)", { count: "exact" })
      .eq("checkins.elder_id", other.elderId);
    if (error) {
      record(dir, "TEST 5 voice_replies", "FAIL", `query error: ${error.message}`);
    } else {
      const n = count ?? (data ?? []).length;
      record(
        dir,
        "TEST 5 voice_replies",
        n === 0 ? "PASS" : "FAIL",
        `rows=${n} (want 0) via checkins.elder_id=${other.elderId}`,
      );
    }
  }

  // --- TEST 5b: unfiltered select — no other-tenant rows ---
  {
    const { data, error } = await supabase.from("elders").select("id");
    if (error) {
      record(dir, "TEST 5b elders", "FAIL", `query error: ${error.message}`);
    } else {
      const rows = data ?? [];
      const leaked = rows.filter((r) => r.id === other.elderId).length;
      record(
        dir,
        "TEST 5b elders",
        leaked === 0 ? "PASS" : "FAIL",
        `visible=${rows.length} other_leaked=${leaked} (want 0)`,
      );
    }
  }

  for (const table of ELDER_SCOPED_TABLES) {
    const { data, error } = await supabase.from(table).select("id, elder_id");
    if (error) {
      record(dir, `TEST 5b ${table}`, "FAIL", `query error: ${error.message}`);
      continue;
    }
    const rows = data ?? [];
    const leaked = rows.filter((r) => r.elder_id === other.elderId).length;
    record(
      dir,
      `TEST 5b ${table}`,
      leaked === 0 ? "PASS" : "FAIL",
      `visible=${rows.length} other_leaked=${leaked} (want 0)`,
    );
  }

  {
    const { data, error } = await supabase
      .from("voice_replies")
      .select("id, checkin_id");
    if (error) {
      record(dir, "TEST 5b voice_replies", "FAIL", `query error: ${error.message}`);
    } else {
      const rows = data ?? [];
      let leaked = 0;
      for (const row of rows) {
        const chk = await supabase
          .from("checkins")
          .select("id, elder_id")
          .eq("id", row.checkin_id)
          .maybeSingle();
        if (chk.error) {
          record(
            dir,
            "TEST 5b voice_replies",
            "FAIL",
            `checkin lookup error: ${chk.error.message}`,
          );
          leaked = -1;
          break;
        }
        if (!chk.data) {
          // Visible voice_reply whose checkin is invisible — treat as leak/anomaly
          leaked += 1;
        } else if (chk.data.elder_id === other.elderId) {
          leaked += 1;
        } else if (chk.data.elder_id !== self.elderId) {
          // Row for some third elder — still not "own"; count as failure for isolation
          leaked += 1;
        }
      }
      if (leaked >= 0) {
        record(
          dir,
          "TEST 5b voice_replies",
          leaked === 0 ? "PASS" : "FAIL",
          `visible=${rows.length} other_or_foreign_leaked=${leaked} (want 0)`,
        );
      }
    }
  }

  await supabase.auth.signOut();
}

console.log("RLS cross-tenant isolation — GATE A3 (X1)");
console.log(`Tenant A elder: ${tenants.A.elderId}`);
console.log(`Tenant B elder: ${tenants.B.elderId}`);
console.log("---");

const supabaseA = client();
await runDirection(supabaseA, tenants.A, tenants.B, "A→B");
if (aborted) {
  printSummary();
  process.exit(1);
}

const supabaseB = client();
await runDirection(supabaseB, tenants.B, tenants.A, "B→A");

printSummary();
process.exit(failed ? 1 : 0);

function printSummary() {
  console.log("---");
  console.log("Summary");
  console.log(
    `${"Dir".padEnd(6)} ${"Result".padEnd(6)} Test`,
  );
  for (const r of results) {
    console.log(`${r.dir.padEnd(6)} ${r.result.padEnd(6)} ${r.test}`);
  }
  const pass = results.filter((r) => r.result === "PASS").length;
  const fail = results.filter((r) => r.result === "FAIL").length;
  const abort = results.filter((r) => r.result === "ABORT").length;
  console.log("---");
  if (abort > 0) {
    console.error(`ABORT — ${abort} control/setup failure(s); ${pass} pass, ${fail} fail`);
  } else if (fail > 0) {
    console.error(`FAIL — ${fail} assertion(s) failed; ${pass} pass`);
  } else {
    console.log(`PASS — all ${pass} checks passed (A→B and B→A)`);
  }
}
