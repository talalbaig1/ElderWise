/**
 * A2.3 Pass 2 — REQUIRED write verification via seed CT session + read-back.
 * Mirrors server-action payloads (anon key + auth.uid RLS). Never service-role.
 *
 * Kept (A4 triage): covers consent-column immutability, medication soft-delete,
 * domain_configs frequency sync, and food/health soft-disable — none of which
 * verify-a4-2-care-circle.mjs exercises (that script only smokes the Care Circle RPC).
 *
 * Usage: node --env-file=.env.local scripts/verify-pass2-writes.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.DEV_SEED_EMAIL ?? "ct.seed@elderwise.dev";
const password = process.env.DEV_SEED_PASSWORD ?? "ElderWise-Seed-Dev-2026!";

const CT = "a0000000-0000-4000-8000-000000000001";
const EP = "a0000000-0000-4000-8000-000000000002";
const BUDDY = "a0000000-0000-4000-8000-000000000010";
const DOC = "a0000000-0000-4000-8000-000000000011";

if (!url || !anonKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and ANON_KEY");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const signed = await client.auth.signInWithPassword({ email, password });
assert(!signed.error, signed.error?.message ?? "signed in");

// --- care_partners ---
const marker = `Pass2-${Date.now()}`;
{
  const { data, error } = await client
    .from("care_partners")
    .update({ first_name: marker })
    .eq("id", CT)
    .select("id, first_name, last_name")
    .maybeSingle();
  assert(!error && data?.first_name === marker, `care_partners write+read (${data?.first_name})`);
  await client
    .from("care_partners")
    .update({ first_name: "Talal", last_name: "Seed" })
    .eq("id", CT);
}

// --- elders (consent columns must not change) ---
{
  const before = await client
    .from("elders")
    .select("address, consent_confirmed_at, consent_attested_by_ct, consent_attested_at")
    .eq("id", EP)
    .single();
  assert(!before.error, "elders before read");
  const consentBefore = before.data.consent_confirmed_at;
  const attestedBefore = before.data.consent_attested_by_ct;
  const attestedAtBefore = before.data.consent_attested_at;

  const newAddress = `${before.data.address} · pass2`;
  const { data, error } = await client
    .from("elders")
    .update({ address: newAddress })
    .eq("id", EP)
    .select(
      "id, address, consent_confirmed_at, consent_attested_by_ct, consent_attested_at",
    )
    .maybeSingle();
  assert(!error && data?.address === newAddress, "elders address write+read");
  assert(
    data.consent_confirmed_at === consentBefore,
    "consent_confirmed_at unchanged",
  );
  assert(
    data.consent_attested_by_ct === attestedBefore &&
      data.consent_attested_at === attestedAtBefore,
    "consent_attested_* unchanged",
  );
  await client.from("elders").update({ address: before.data.address }).eq("id", EP);
}

// --- local_caregivers (action_plan is unused in product but still writable) ---
{
  const plan = `Pass2 plan ${Date.now()}`;
  const { data, error } = await client
    .from("local_caregivers")
    .update({ action_plan: plan })
    .eq("id", BUDDY)
    .select("id, action_plan, first_name, last_name")
    .maybeSingle();
  assert(!error && data?.action_plan === plan, "local_caregivers write+read");
  await client
    .from("local_caregivers")
    .update({ action_plan: "Knock, wait 2 min, call CT if no answer" })
    .eq("id", BUDDY);
}

// --- doctors ---
{
  const clinic = `Pass2 clinic ${Date.now()}`;
  const { data, error } = await client
    .from("doctors")
    .update({ clinic_name: clinic })
    .eq("id", DOC)
    .select("id, clinic_name")
    .maybeSingle();
  assert(!error && data?.clinic_name === clinic, "doctors clinic_name write+read");
  await client
    .from("doctors")
    .update({ clinic_name: "Apollo Clinic, Bengaluru" })
    .eq("id", DOC);
}

// --- medications upsert + soft-delete (no hard DELETE) + history preserved ---
const medId = randomUUID();
{
  const { data, error } = await client
    .from("medications")
    .insert({
      id: medId,
      elder_id: EP,
      enabled: true,
      name: "Pass2 Test Med 10mg",
      dosage: "1",
      dosage_unit: "TAB",
      times: ["09:00"],
      days_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      start_date: "2026-07-01",
      timing_preference: "before_food",
      notify_care_partner: "only_missed",
      escalation_minutes: 30,
      active: true,
    })
    .select("id, name, active")
    .maybeSingle();
  assert(!error && data?.id === medId, "medications insert+read");

  const soft = await client
    .from("medications")
    .update({ active: false, enabled: false })
    .eq("id", medId)
    .select("id, active, enabled")
    .maybeSingle();
  assert(
    !soft.error && soft.data?.active === false,
    "medications soft-delete (active=false)",
  );

  const hist = await client
    .from("checkin_medication_items")
    .select("id", { count: "exact" });
  assert(
    !hist.error && (hist.count ?? 0) >= 2,
    `checkin_medication_items history intact (count=${hist.count})`,
  );

  const { data: activeMeds } = await client
    .from("medications")
    .select("times, enabled, active")
    .eq("elder_id", EP)
    .eq("active", true)
    .eq("enabled", true);
  const times = [
    ...new Set((activeMeds ?? []).flatMap((r) => r.times ?? [])),
  ].sort();
  const { data: dc, error: dcErr } = await client
    .from("domain_configs")
    .update({
      enabled: (activeMeds ?? []).length > 0,
      frequency: { times },
    })
    .eq("elder_id", EP)
    .eq("domain", "medication")
    .select("id, frequency, enabled")
    .maybeSingle();
  assert(!dcErr && dc, "domain_configs medication sync write+read");
  assert(
    JSON.stringify(dc.frequency?.times ?? []) === JSON.stringify(times),
    `domain_configs.frequency derived times=${JSON.stringify(times)} (active+enabled only)`,
  );
}

// --- food_routines soft-disable ---
{
  const { data: food } = await client
    .from("food_routines")
    .select("id, enabled, meal_name")
    .eq("elder_id", EP)
    .limit(1)
    .maybeSingle();
  assert(food?.id, "food_routines seed row exists");
  const was = food.enabled;
  const { data, error } = await client
    .from("food_routines")
    .update({ enabled: false })
    .eq("id", food.id)
    .select("id, enabled")
    .maybeSingle();
  assert(!error && data?.enabled === false, "food_routines soft-disable write+read");
  await client.from("food_routines").update({ enabled: was }).eq("id", food.id);
}

// --- health_routines soft-disable ---
{
  const { data: health } = await client
    .from("health_routines")
    .select("id, enabled, name")
    .eq("elder_id", EP)
    .limit(1)
    .maybeSingle();
  assert(health?.id, "health_routines seed row exists");
  const was = health.enabled;
  const { data, error } = await client
    .from("health_routines")
    .update({ enabled: false })
    .eq("id", health.id)
    .select("id, enabled")
    .maybeSingle();
  assert(!error && data?.enabled === false, "health_routines soft-disable write+read");
  await client.from("health_routines").update({ enabled: was }).eq("id", health.id);
}

await client.auth.signOut();
console.log("PASS — Pass 2 write groups verified with read-back");
