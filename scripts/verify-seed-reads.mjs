/**
 * A2.3 — confirm seed CT can read fixtures (including consent_confirmed_at).
 * Usage: node --env-file=.env.local scripts/verify-seed-reads.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.DEV_SEED_EMAIL ?? "ct.seed@elderwise.dev";
const password = process.env.DEV_SEED_PASSWORD ?? "ElderWise-Seed-Dev-2026!";

if (!url || !anonKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and ANON_KEY");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const signed = await client.auth.signInWithPassword({ email, password });
if (signed.error) {
  console.error("Sign-in failed:", signed.error.message);
  process.exit(1);
}

const tables = [
  "care_partners",
  "elders",
  "checkins",
  "sos_events",
  "ct_notifications",
  "medications",
  "food_routines",
  "health_routines",
  "local_caregivers",
  "doctors",
];

for (const table of tables) {
  const { data, error, count } = await client
    .from(table)
    .select("*", { count: "exact" });
  if (error) {
    console.error(`${table}: ERROR ${error.message}`);
    process.exit(1);
  }
  console.log(`${table}: ${count ?? data?.length ?? 0}`);
}

const { data: elders, error: eErr } = await client
  .from("elders")
  .select("id, first_name, last_name, age, relationship_to_care_partner, consent_confirmed_at");
if (eErr) {
  console.error(eErr.message);
  process.exit(1);
}

for (const e of elders ?? []) {
  console.log(
    `elder ${e.first_name} ${e.last_name} (age ${e.age}, ${e.relationship_to_care_partner}): consent_confirmed_at=${e.consent_confirmed_at ?? "NULL"}`,
  );
}

await client.auth.signOut();
console.log("PASS — seed CT reads fixtures");
