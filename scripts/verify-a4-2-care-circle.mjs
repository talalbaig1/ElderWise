/**
 * A4.2 — Care Circle RPC smoke test via anon session + RLS (not service role).
 * Covers: both optional cards, both skipped, re-save deleting buddy,
 * duplicate WhatsApp same tenant, domain_configs × 3, approved_by_ct = false.
 *
 * Usage: node --env-file=.env.local scripts/verify-a4-2-care-circle.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = Date.now();
const TEST_EMAIL = `ct.a42-smoke-${stamp}@elderwise.dev`;
const TEST_PASSWORD = randomUUID();

function wa(suffix) {
  // Unique E.164-ish test numbers (not real lines)
  return `+1555${String(stamp).slice(-6)}${String(suffix).padStart(2, "0")}`;
}

if (!url || !anonKey || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, and SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let testUserId = null;

async function cleanup() {
  if (!testUserId) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listed.data.users.find((u) => u.email === TEST_EMAIL);
    if (existing) testUserId = existing.id;
  }
  if (!testUserId) return;
  const del = await admin.auth.admin.deleteUser(testUserId);
  if (del.error) {
    console.error("Cleanup delete failed:", del.error.message);
    process.exit(1);
  }
  console.log("Deleted smoke user", testUserId);
  testUserId = null;
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    throw new Error(msg);
  }
  console.log("OK:", msg);
}

function cpPayload() {
  return {
    whatsapp_number: wa(90),
    timezone: "Asia/Riyadh",
    first_name: "A42",
    last_name: "Smoke",
    email: TEST_EMAIL,
  };
}

function elderPayload(overrides = {}) {
  return {
    first_name: "Loved",
    last_name: "One",
    age: 72,
    relationship_to_care_partner: "Parent",
    whatsapp_number: wa(1),
    timezone: "Asia/Kolkata",
    address: "12 Test Lane",
    ...overrides,
  };
}

async function rpc(carePartner, elder, localBuddy, doctor) {
  return anon.rpc("save_care_circle_draft", {
    p_care_partner: carePartner,
    p_elder: elder,
    p_local_buddy: localBuddy,
    p_doctor: doctor,
  });
}

try {
  await cleanup();

  const created = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "A42 Smoke CT" },
  });
  if (created.error || !created.data.user) {
    console.error("Create failed:", created.error?.message);
    process.exit(1);
  }
  testUserId = created.data.user.id;
  console.log("Created smoke user", testUserId);

  const signed = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signed.error || !signed.data.session) {
    console.error("Sign-in failed:", signed.error?.message ?? "no session");
    throw new Error("sign-in failed");
  }
  console.log("Signed in via anon key (RLS path)");

  // -------------------------------------------------------------------------
  // 1) New elder with both optional cards
  // -------------------------------------------------------------------------
  const both = await rpc(
    cpPayload(),
    elderPayload({ whatsapp_number: wa(1), first_name: "Both" }),
    {
      first_name: "Local",
      last_name: "Buddy",
      whatsapp_number: wa(11),
    },
    {
      first_name: "Doc",
      last_name: "Mehta",
      whatsapp_number: wa(12),
      clinic_name: "City Clinic",
    },
  );
  assert(!both.error && both.data, `both cards: ${both.error?.message ?? "ok"}`);
  const elderBothId = both.data;
  console.log("elder (both cards)", elderBothId);

  const buddy1 = await anon
    .from("local_caregivers")
    .select("id, first_name")
    .eq("elder_id", elderBothId)
    .maybeSingle();
  assert(buddy1.data?.first_name === "Local", "buddy row present");

  const doc1 = await anon
    .from("doctors")
    .select("id, approved_by_ct, clinic_name")
    .eq("elder_id", elderBothId)
    .maybeSingle();
  assert(doc1.data?.clinic_name === "City Clinic", "doctor row present");
  assert(doc1.data?.approved_by_ct === false, "approved_by_ct is false at draft");

  const cfg1 = await anon
    .from("domain_configs")
    .select("domain")
    .eq("elder_id", elderBothId);
  const domains1 = (cfg1.data ?? []).map((r) => r.domain).sort();
  assert(
    domains1.join(",") === "food,health,medication",
    `domain_configs ×3 after both-cards: ${domains1.join(",")}`,
  );

  // Hard-delete draft so next case can create a fresh elder without one-draft block
  const del1 = await anon.from("elders").delete().eq("id", elderBothId).eq("active", false);
  assert(!del1.error, `discard both-cards draft: ${del1.error?.message ?? "ok"}`);

  // -------------------------------------------------------------------------
  // 2) New elder with both skipped
  // -------------------------------------------------------------------------
  const skipped = await rpc(
    cpPayload(),
    elderPayload({ whatsapp_number: wa(2), first_name: "Skipped" }),
    null,
    null,
  );
  assert(!skipped.error && skipped.data, `both skipped: ${skipped.error?.message ?? "ok"}`);
  const elderSkipId = skipped.data;

  const buddySkip = await anon
    .from("local_caregivers")
    .select("id")
    .eq("elder_id", elderSkipId)
    .maybeSingle();
  assert(!buddySkip.data, "no buddy row when skipped");

  const docSkip = await anon
    .from("doctors")
    .select("id")
    .eq("elder_id", elderSkipId)
    .maybeSingle();
  assert(!docSkip.data, "no doctor row when skipped");

  const cfg2 = await anon
    .from("domain_configs")
    .select("domain")
    .eq("elder_id", elderSkipId);
  const domains2 = (cfg2.data ?? []).map((r) => r.domain).sort();
  assert(
    domains2.join(",") === "food,health,medication",
    `domain_configs ×3 after skipped: ${domains2.join(",")}`,
  );

  // -------------------------------------------------------------------------
  // 3) Re-save that deletes a previously-saved buddy
  // -------------------------------------------------------------------------
  const withBuddy = await rpc(
    cpPayload(),
    elderPayload({
      id: elderSkipId,
      whatsapp_number: wa(2),
      first_name: "Skipped",
    }),
    {
      first_name: "Temp",
      last_name: "Buddy",
      whatsapp_number: wa(21),
    },
    null,
  );
  assert(!withBuddy.error, `add buddy on re-save: ${withBuddy.error?.message ?? "ok"}`);

  const buddyTemp = await anon
    .from("local_caregivers")
    .select("id")
    .eq("elder_id", elderSkipId)
    .maybeSingle();
  assert(Boolean(buddyTemp.data), "buddy present before null re-save");

  const clearBuddy = await rpc(
    cpPayload(),
    elderPayload({
      id: elderSkipId,
      whatsapp_number: wa(2),
      first_name: "Skipped",
    }),
    null,
    null,
  );
  assert(!clearBuddy.error, `re-save null buddy: ${clearBuddy.error?.message ?? "ok"}`);

  const buddyGone = await anon
    .from("local_caregivers")
    .select("id")
    .eq("elder_id", elderSkipId)
    .maybeSingle();
  assert(!buddyGone.data, "buddy deleted on null re-save");

  // Activate so WA is locked for duplicate-within-tenant case
  const activate = await anon
    .from("elders")
    .update({ active: true })
    .eq("id", elderSkipId)
    .select("id, active")
    .maybeSingle();
  assert(activate.data?.active === true, "activated elder for duplicate WA case");

  // -------------------------------------------------------------------------
  // 4) Duplicate WhatsApp within the same tenant
  // -------------------------------------------------------------------------
  const dup = await rpc(
    cpPayload(),
    elderPayload({ whatsapp_number: wa(2), first_name: "Dup" }),
    null,
    null,
  );
  assert(Boolean(dup.error), "duplicate WA same tenant must error");
  assert(
    /already registered to a Loved One/i.test(dup.error?.message ?? ""),
    `friendly WA message: ${dup.error?.message ?? ""}`,
  );

  console.log("\nAll A4.2 Care Circle smoke checks passed.");
} catch (err) {
  console.error("\nSmoke test failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await cleanup();
}
