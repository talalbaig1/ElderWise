/**
 * A3 Pass 1 — verify seed CT can sign in and care_partners upsert is idempotent.
 * Usage: node --env-file=.env.local scripts/verify-a3-auth.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.DEV_SEED_EMAIL ?? "ct.seed@elderwise.dev";
const password = process.env.DEV_SEED_PASSWORD ?? "ElderWise-Seed-Dev-2026!";
const CT = "a0000000-0000-4000-8000-000000000001";

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
assert(!signed.error && signed.data.user?.id === CT, "seed CT sign-in");

const tz = "Asia/Riyadh";
const upsert1 = await client
  .from("care_partners")
  .upsert(
    {
      id: CT,
      full_name: "Talal Seed",
      email,
      timezone: tz,
    },
    { onConflict: "id" },
  )
  .select("id, timezone, email")
  .maybeSingle();
assert(!upsert1.error && upsert1.data?.id === CT, "care_partners upsert #1");

const upsert2 = await client
  .from("care_partners")
  .upsert(
    {
      id: CT,
      full_name: "Talal Seed",
      email,
      timezone: tz,
    },
    { onConflict: "id" },
  )
  .select("id, timezone")
  .maybeSingle();
assert(!upsert2.error && upsert2.data?.id === CT, "care_partners upsert #2 idempotent");

const { count, error } = await client
  .from("elders")
  .select("id", { count: "exact", head: true });
assert(!error && (count ?? 0) >= 1, `seed CT elders count=${count}`);

await client.auth.signOut();
const after = await client.auth.getSession();
assert(!after.data.session, "sign-out clears session");

console.log("PASS — A3 auth seed path verified");
