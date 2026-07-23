/**
 * One-shot: create the A2.2 seeded Auth user via Admin API.
 * Usage:
 *   node --env-file=.env.local scripts/create-seed-user.mjs
 * Never log key values.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEV_SEED_EMAIL ?? "ct.seed@elderwise.dev";
const password = process.env.DEV_SEED_PASSWORD ?? "ElderWise-Seed-Dev-2026!";
const id = "a0000000-0000-4000-8000-000000000001";

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  id,
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Talal Seed" },
});

if (error) {
  // Idempotent re-run: update password if user already exists
  if (error.message.toLowerCase().includes("already")) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listed.data.users.find((u) => u.id === id || u.email === email);
    if (!existing) {
      console.error(error);
      process.exit(1);
    }
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      console.error(updated.error);
      process.exit(1);
    }
    console.log("Updated existing seed user", existing.id);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
}

console.log("Created seed user", data.user?.id);
