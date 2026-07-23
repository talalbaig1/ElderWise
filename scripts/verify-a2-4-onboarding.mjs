/**
 * A2.4 — E2E onboarding writes via anon session + RLS.
 * Creates a disposable CT, walks Loved One → activate, asserts rows, then
 * deletes the Auth user (cascade). Same cleanup pattern as scripts/rls-proof.mjs.
 *
 * Usage: node --env-file=.env.local scripts/verify-a2-4-onboarding.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_EMAIL = `ct.a24-e2e-${Date.now()}@elderwise.dev`;
const TEST_PASSWORD = randomUUID();
const EP_WA = `+1555${String(Date.now()).slice(-7)}`;
const SEED_WA = "+919876543210"; // Kamala — global UNIQUE collision case

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
  console.log("Deleted E2E user", testUserId);
  testUserId = null;
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    throw new Error(msg);
  }
  console.log("OK:", msg);
}

try {
  await cleanup();

  const created = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "A24 E2E CT" },
  });
  if (created.error || !created.data.user) {
    console.error("Create failed:", created.error?.message);
    process.exit(1);
  }
  testUserId = created.data.user.id;
  console.log("Created E2E user", testUserId);

  const signed = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signed.error || !signed.data.session) {
    console.error("Sign-in failed:", signed.error?.message ?? "no session");
    throw new Error("sign-in failed");
  }

  const cp = await anon
    .from("care_partners")
    .upsert(
      {
        id: testUserId,
        full_name: "A24 E2E CT",
        email: TEST_EMAIL,
        timezone: "Asia/Riyadh",
        phone_number: "+966500099999",
      },
      { onConflict: "id" },
    )
    .select("id")
    .maybeSingle();
  assert(!cp.error && cp.data?.id === testUserId, "care_partners upsert");

  // Unique collision (different CT, seed WhatsApp)
  const collision = await anon
    .from("elders")
    .insert({
      care_partner_id: testUserId,
      first_name: "Clash",
      surname: "Test",
      gender: "prefer_not_to_say",
      whatsapp_number: SEED_WA,
      timezone: "Asia/Kolkata",
      address: "1 Test St",
      consent_attested_by_ct: true,
      consent_attested_at: new Date().toISOString(),
      active: false,
    })
    .select("id")
    .maybeSingle();
  assert(
    Boolean(collision.error) &&
      (collision.error.code === "23505" ||
        /whatsapp_number|duplicate key/i.test(collision.error.message)),
    `unique WhatsApp violation observed (code=${collision.error?.code})`,
  );

  const elderInsert = await anon
    .from("elders")
    .insert({
      care_partner_id: testUserId,
      first_name: "Asha",
      surname: "Patel",
      gender: "prefer_not_to_say",
      whatsapp_number: EP_WA,
      timezone: "Asia/Kolkata",
      address: "22 Lake Road, Pune",
      consent_attested_by_ct: true,
      consent_attested_at: new Date().toISOString(),
      active: false,
    })
    .select("id, active, consent_confirmed_at, consent_attested_by_ct")
    .maybeSingle();
  assert(
    !elderInsert.error && elderInsert.data?.id && elderInsert.data.active === false,
    "draft elder insert active=false",
  );
  assert(
    elderInsert.data.consent_attested_by_ct === true &&
      elderInsert.data.consent_confirmed_at == null,
    "consent attested; consent_confirmed_at NULL",
  );
  const elderId = elderInsert.data.id;

  const cfgInsert = await anon
    .from("domain_configs")
    .insert(
      ["medication", "food", "health"].map((domain) => ({
        elder_id: elderId,
        domain,
        enabled: false,
        frequency: { times: [] },
        ct_notification: "only_missed",
        escalate_to: "care_partner",
      })),
    )
    .select("domain, enabled");
  assert(
    !cfgInsert.error &&
      (cfgInsert.data?.length ?? 0) === 3 &&
      cfgInsert.data.every((r) => r.enabled === false),
    "three domain_configs enabled=false at creation",
  );

  const activeCountDraft = await anon
    .from("elders")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  assert(
    !activeCountDraft.error && (activeCountDraft.count ?? 0) === 0,
    "active elder count is 0 while draft",
  );

  const foodId = randomUUID();
  const medId = randomUUID();
  const healthId = randomUUID();

  const food = await anon
    .from("food_routines")
    .insert({
      id: foodId,
      elder_id: elderId,
      enabled: true,
      meal_name: "Lunch",
      meal_type: "lunch",
      check_in_time: "13:00",
      start_date: "2026-07-23",
      days_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      frequency: "daily",
      notify_care_partner: "only_missed",
      escalation_minutes: 45,
    })
    .select("id")
    .maybeSingle();
  assert(!food.error && food.data?.id, "food_routines insert");

  await anon
    .from("domain_configs")
    .update({ enabled: true, frequency: { times: ["13:00"] } })
    .eq("elder_id", elderId)
    .eq("domain", "food");

  const med = await anon
    .from("medications")
    .insert({
      id: medId,
      elder_id: elderId,
      enabled: true,
      name: "Amlodipine",
      dosage: "5",
      dosage_unit: "mg",
      times: ["08:00"],
      days_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      start_date: "2026-07-23",
      timing_preference: "no_preference",
      notify_care_partner: "only_missed",
      escalation_minutes: 30,
      active: true,
    })
    .select("id")
    .maybeSingle();
  assert(!med.error && med.data?.id, "medications insert");

  await anon
    .from("domain_configs")
    .update({ enabled: true, frequency: { times: ["08:00"] } })
    .eq("elder_id", elderId)
    .eq("domain", "medication");

  const health = await anon
    .from("health_routines")
    .insert({
      id: healthId,
      elder_id: elderId,
      enabled: true,
      name: "Morning wellbeing",
      type: "general_wellness",
      frequency: "daily",
      time: "09:00",
      start_date: "2026-07-23",
      days_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      question: "Are you feeling well today?",
      answer_type: "yes_no",
      notify_care_partner: "only_missed",
      escalation_minutes: 60,
    })
    .select("id")
    .maybeSingle();
  assert(!health.error && health.data?.id, "health_routines insert");

  await anon
    .from("domain_configs")
    .update({ enabled: true, frequency: { times: ["09:00"] } })
    .eq("elder_id", elderId)
    .eq("domain", "health");

  const activate = await anon
    .from("elders")
    .update({ active: true })
    .eq("id", elderId)
    .select("id, active")
    .maybeSingle();
  assert(
    !activate.error && activate.data?.active === true,
    "activate elder active=true",
  );

  const activeCount = await anon
    .from("elders")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  assert(
    !activeCount.error && (activeCount.count ?? 0) === 1,
    "active elder count is 1",
  );

  const cfgRead = await anon
    .from("domain_configs")
    .select("domain, enabled, frequency")
    .eq("elder_id", elderId);
  assert(
    !cfgRead.error &&
      (cfgRead.data?.length ?? 0) === 3 &&
      cfgRead.data.every((r) => r.enabled === true),
    "domain_configs enabled=true after routines",
  );

  await anon.auth.signOut();
  await cleanup();

  console.log("PASS — A2.4 onboarding E2E (draft → activate → cleanup)");
  console.log(
    JSON.stringify(
      {
        epWhatsapp: EP_WA,
        seedCollisionMessage:
          "This WhatsApp number is already registered to a Loved One",
        knownLimitation:
          "Resume: skipped Local Buddy vs not-reached are indistinguishable without localStorage",
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err);
  await cleanup();
  process.exit(1);
}
