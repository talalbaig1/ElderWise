/**
 * A2.3 X1 — prove RLS isolates tenant data.
 * Creates a second Auth user (no care_partners row), signs in as them,
 * asserts elders / checkins / sos_events / ct_notifications are empty,
 * then deletes the user.
 *
 * Usage: node --env-file=.env.local scripts/rls-proof.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROOF_ID = "a0000000-0000-4000-8000-000000000099";
const PROOF_EMAIL = "ct.rls-proof@elderwise.dev";
const PROOF_PASSWORD = "ElderWise-Rls-Proof-2026!";

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

async function cleanup() {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed.data.users.find(
    (u) => u.id === PROOF_ID || u.email === PROOF_EMAIL,
  );
  if (existing) {
    const del = await admin.auth.admin.deleteUser(existing.id);
    if (del.error) {
      console.error("Cleanup delete failed:", del.error.message);
      process.exit(1);
    }
    console.log("Deleted proof user", existing.id);
  }
}

await cleanup();

const created = await admin.auth.admin.createUser({
  id: PROOF_ID,
  email: PROOF_EMAIL,
  password: PROOF_PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "RLS Proof CT" },
});

if (created.error) {
  console.error("Create failed:", created.error.message);
  process.exit(1);
}
console.log("Created proof user", created.data.user?.id);

const signed = await anon.auth.signInWithPassword({
  email: PROOF_EMAIL,
  password: PROOF_PASSWORD,
});
if (signed.error || !signed.data.session) {
  console.error("Sign-in failed:", signed.error?.message ?? "no session");
  await cleanup();
  process.exit(1);
}
console.log("Signed in as proof user");

const tables = ["elders", "checkins", "sos_events", "ct_notifications", "care_partners"];
const counts = {};

for (const table of tables) {
  const { data, error, count } = await anon
    .from(table)
    .select("*", { count: "exact" });
  if (error) {
    console.error(`Query ${table} failed:`, error.message);
    await cleanup();
    process.exit(1);
  }
  counts[table] = count ?? data?.length ?? 0;
  console.log(`${table}: ${counts[table]} row(s)`);
}

const ok =
  counts.elders === 0 &&
  counts.checkins === 0 &&
  counts.sos_events === 0 &&
  counts.ct_notifications === 0 &&
  counts.care_partners === 0;

await anon.auth.signOut();
await cleanup();

if (!ok) {
  console.error("FAIL — proof user saw seeded tenant data (RLS broken)");
  process.exit(1);
}

console.log("PASS — proof user saw zero elders / check-ins / SOS / notifications / care_partners");
