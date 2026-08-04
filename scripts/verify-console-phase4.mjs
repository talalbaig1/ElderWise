/**
 * Phase 4 — §9 behavioural tests for verification console.
 * Usage:
 *   node --env-file=.env.local scripts/verify-console-phase4.mjs
 *
 * Env:
 *   VERIFY_PREVIEW_BASE — branch preview (flag ON), default branch alias
 *   VERIFY_PREVIEW_SHARE — optional _vercel_share query value for protected previews
 *   VERIFY_FLAG_OFF_BASE — production (flag OFF), default elder-wise-seven.vercel.app
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PREVIEW_BASE =
  process.env.VERIFY_PREVIEW_BASE ??
  "https://elder-wise-git-feat-verify-console-talalbaig.vercel.app";
const FLAG_OFF_BASE =
  process.env.VERIFY_FLAG_OFF_BASE ?? "https://elder-wise-seven.vercel.app";
const SHARE = process.env.VERIFY_PREVIEW_SHARE ?? "";
const FLAG_OFF_SHARE = process.env.VERIFY_FLAG_OFF_SHARE ?? SHARE;

const tenantA = {
  email: process.env.TENANT_A_EMAIL,
  password: process.env.TENANT_A_PASSWORD,
  elderId: process.env.TENANT_A_ELDER_ID,
};
const tenantB = {
  elderId: process.env.TENANT_B_ELDER_ID,
};

if (!url || !anonKey || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
for (const [k, v] of Object.entries(tenantA)) {
  if (!v) {
    console.error(`Missing TENANT_A_* (${k})`);
    process.exit(1);
  }
}
if (!tenantB.elderId) {
  console.error("Missing TENANT_B_ELDER_ID");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function withShare(path, base = PREVIEW_BASE, share = SHARE) {
  const u = new URL(path, base);
  if (share) u.searchParams.set("_vercel_share", share);
  return u.toString();
}

/** SSR cookie jar for Next.js route handlers. */
function makeSessionClient() {
  const jar = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return jar.map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          const i = jar.findIndex((c) => c.name === name);
          if (value) {
            if (i >= 0) jar[i].value = value;
            else jar.push({ name, value });
          } else if (i >= 0) jar.splice(i, 1);
        }
      },
    },
  });
  return {
    supabase,
    cookieHeader: () => jar.map((c) => `${c.name}=${c.value}`).join("; "),
    userClient: () =>
      createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
  };
}

async function http(method, targetUrl, { cookies, body, redirect = "manual" } = {}) {
  const res = await fetch(targetUrl, {
    method,
    redirect,
    headers: {
      ...(cookies ? { Cookie: cookies } : {}),
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text, location: res.headers.get("location") };
}

async function signInTenantA() {
  const session = makeSessionClient();
  const { error } = await session.supabase.auth.signInWithPassword({
    email: tenantA.email,
    password: tenantA.password,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const {
    data: { user },
  } = await session.supabase.auth.getUser();
  if (!user) throw new Error("no user after sign-in");
  return { ...session, userId: user.id };
}

async function setConsoleAccess(userId, { approved = false, revoked = false } = {}) {
  await admin.from("console_access").delete().eq("care_partner_id", userId);
  if (!approved && !revoked) return;
  const row = {
    care_partner_id: userId,
    approved_at: approved ? new Date().toISOString() : null,
    approved_by: approved ? userId : null,
    revoked_at: revoked ? new Date().toISOString() : null,
  };
  const { error } = await admin.from("console_access").insert(row);
  if (error) throw new Error(`console_access seed failed: ${error.message}`);
}

async function setPendingAccess(userId) {
  await admin.from("console_access").delete().eq("care_partner_id", userId);
  const { error } = await admin.from("console_access").insert({
    care_partner_id: userId,
    approved_at: null,
    approved_by: null,
    revoked_at: null,
  });
  if (error) throw new Error(`pending seed failed: ${error.message}`);
}

const results = [];

function record(n, label, status, note = "") {
  results.push({ n, label, status, note });
  console.log(`Test ${n}: ${status}${note ? ` — ${note}` : ""}`);
}

console.log("Preview (flag ON):", PREVIEW_BASE);
console.log("Flag OFF base:", FLAG_OFF_BASE);
console.log("---");

// 1 — flag off
{
  const getPage = await http("GET", withShare("/verify", FLAG_OFF_BASE, FLAG_OFF_SHARE));
  const postRun = await http("POST", withShare("/api/verify/run", FLAG_OFF_BASE, FLAG_OFF_SHARE), {
    body: { checkId: "consent_state", params: {} },
  });
  record(1, "Flag off GET /verify + POST /api/verify/run", `${getPage.status} / ${postRun.status}`);
}

// 2 — signed out
{
  const api = await http("POST", withShare("/api/verify/run"), {
    body: { checkId: "consent_state", params: {} },
  });
  const page = await http("GET", withShare("/verify"));
  record(
    2,
    "Signed out API + page",
    `${api.status} / ${page.status}`,
    page.location ? `redirect→${page.location}` : "",
  );
}

const signed = await signInTenantA();
const cookies = signed.cookieHeader();

// 3 — signed in, no console_access row
{
  await setConsoleAccess(signed.userId, {});
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: { checkId: "consent_state", params: {} },
  });
  const page = await http("GET", withShare("/verify"), { cookies });
  record(3, "No console_access row", `${api.status} / ${page.status}`);
}

// 4 — pending
{
  await setPendingAccess(signed.userId);
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: { checkId: "consent_state", params: {} },
  });
  record(4, "Pending approval", `${api.status}`);
}

// 5 — approved
{
  await setConsoleAccess(signed.userId, { approved: true });
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: { checkId: "consent_state", params: {} },
  });
  record(5, "Approved", `${api.status}`);
}

// 6 — revoke without re-login
{
  await setConsoleAccess(signed.userId, { approved: true, revoked: true });
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: { checkId: "consent_state", params: {} },
  });
  record(6, "Revoked (same session, no re-login)", `${api.status}`);
}

// restore approved for 7–9
await setConsoleAccess(signed.userId, { approved: true });

// 7 — injection-shaped checkId
{
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: {
      checkId: "consent_state'; drop table elders;--",
      params: {},
    },
  });
  record(7, "Injection-shaped checkId", `${api.status}`);
}

// 8 — extra strict key
{
  const api = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: {
      checkId: "consent_state",
      params: {},
      table: "care_partners",
    },
  });
  record(8, "Extra table key (.strict())", `${api.status}`);
}

// 9 — foreign elderId vs non-existent (byte-identical 403 body)
{
  const fakeId = randomUUID();
  const foreign = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: {
      checkId: "checkins_for_day",
      params: { elder: tenantB.elderId, day: "today" },
    },
  });
  const missing = await http("POST", withShare("/api/verify/run"), {
    cookies,
    body: {
      checkId: "checkins_for_day",
      params: { elder: fakeId, day: "today" },
    },
  });
  const identical =
    foreign.status === missing.status &&
    JSON.stringify(foreign.body) === JSON.stringify(missing.body);
  record(
    9,
    "Foreign vs missing elderId",
    `${foreign.status} / ${missing.status}`,
    identical ? "bodies identical" : "BODY MISMATCH",
  );
}

// 10 — self-approve INSERT rejected by RLS
{
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const login = await userClient.auth.signInWithPassword({
    email: tenantA.email,
    password: tenantA.password,
  });
  if (login.error) throw new Error(login.error.message);
  const { error } = await userClient.from("console_access").insert({
    care_partner_id: signed.userId,
    approved_at: new Date().toISOString(),
    approved_by: signed.userId,
  });
  record(
    10,
    "INSERT with approved_at (RLS)",
    error ? "rejected" : "ALLOWED",
    error ? error.code ?? error.message : "unexpected success",
  );
}

// cleanup — leave approved for Talal
await setConsoleAccess(signed.userId, { approved: true });

console.log("---");
console.log(JSON.stringify(results, null, 2));
