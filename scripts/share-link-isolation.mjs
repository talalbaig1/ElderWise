/**
 * A2.6 — Doctor share-link isolation.
 * Service-role only for token lookup + elder-scoped reads (mirrors the share route).
 *
 * Asserts:
 *  - Valid token loads elder A summary
 *  - SOS rows in the summary all belong to elder A (zero foreign sos_events)
 *  - Token for elder A never surfaces elder B checkins / sos
 *  - Revoked / wrong hash fail closed
 *
 * Cleanup: deletes every fixture it creates (share links, extra elder, SOS)
 * on ALL exit paths so doctor_share_links stays at a meaningful baseline.
 *
 * Usage: node --env-file=.env.local scripts/share-link-isolation.mjs
 */
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_CT = "a0000000-0000-4000-8000-000000000001";
const SEED_ELDER = "a0000000-0000-4000-8000-000000000002";

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** @type {string[]} */
const createdShareLinkIds = [];
/** @type {string | null} */
let fixtureElderId = null;
/** @type {string | null} */
let fixtureSosId = null;

let failed = false;

function hashToken(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function record(test, ok, detail) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${test} — ${detail}`);
  if (!ok) failed = true;
}

async function cleanup() {
  console.log("--- cleanup ---");
  for (const id of [...createdShareLinkIds].reverse()) {
    const { error } = await admin.from("doctor_share_links").delete().eq("id", id);
    if (error) console.error("cleanup share link", id, error.message);
    else console.log("deleted share link", id.slice(0, 8));
  }
  if (fixtureSosId) {
    const { error } = await admin.from("sos_events").delete().eq("id", fixtureSosId);
    if (error) console.error("cleanup sos", error.message);
    else console.log("deleted fixture sos");
  }
  if (fixtureElderId) {
    const { error } = await admin.from("elders").delete().eq("id", fixtureElderId);
    if (error) console.error("cleanup elder", error.message);
    else console.log("deleted fixture elder");
  }
}

process.on("exit", () => {
  // sync marker only — async cleanup runs in finally
});

async function loadSummary(rawToken) {
  const tokenHash = hashToken(rawToken);
  const { data: link } = await admin
    .from("doctor_share_links")
    .select("id, elder_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!link || link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return null;

  const elderId = link.elder_id;
  const { data: sos } = await admin
    .from("sos_events")
    .select("id, elder_id, triggered_at, status")
    .eq("elder_id", elderId);
  const { data: checkins } = await admin
    .from("checkins")
    .select("id, elder_id")
    .eq("elder_id", elderId);
  const { data: elder } = await admin
    .from("elders")
    .select("timezone")
    .eq("id", elderId)
    .maybeSingle();

  return {
    elderId,
    sos: sos ?? [],
    checkins: checkins ?? [],
    // Architecture §10 — share page uses elder TZ (never doctors.timezone).
    viewerTimeZone: elder?.timezone || "UTC",
  };
}

async function main() {
  try {
    const rawA = randomBytes(32).toString("base64url");
    const { data: linkA, error: linkAErr } = await admin
      .from("doctor_share_links")
      .insert({
        elder_id: SEED_ELDER,
        token_hash: hashToken(rawA),
        created_by: SEED_CT,
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (linkAErr || !linkA) throw new Error(linkAErr?.message ?? "insert link A failed");
    createdShareLinkIds.push(linkA.id);

    const summaryA = await loadSummary(rawA);
    record("valid token loads", !!summaryA, summaryA ? `elder=${summaryA.elderId.slice(0, 8)}` : "null");
    record(
      "viewer TZ is elder IANA (Architecture §10)",
      summaryA?.viewerTimeZone === "Asia/Kolkata",
      `got ${summaryA?.viewerTimeZone}`,
    );

    const foreignSos = (summaryA?.sos ?? []).filter((s) => s.elder_id !== SEED_ELDER);
    record(
      "token elder A → zero foreign sos_events",
      foreignSos.length === 0,
      `foreign=${foreignSos.length} totalSos=${summaryA?.sos.length ?? 0}`,
    );

    // Fixture elder B + SOS under same CT
    fixtureElderId = crypto.randomUUID();
    const { error: elderErr } = await admin.from("elders").insert({
      id: fixtureElderId,
      care_partner_id: SEED_CT,
      first_name: "Isolation",
      last_name: "Fixture",
      age: 72,
      relationship_to_care_partner: "Test fixture",
      gender: "prefer_not_to_say",
      whatsapp_number: `+9199${String(Date.now()).slice(-8)}`,
      timezone: "UTC",
      address: "Fixture address for isolation test",
      consent_attested_by_ct: true,
      consent_attested_at: new Date().toISOString(),
      consent_confirmed_at: new Date().toISOString(),
      active: true,
    });
    if (elderErr) throw new Error(`fixture elder: ${elderErr.message}`);

    fixtureSosId = crypto.randomUUID();
    const { error: sosErr } = await admin.from("sos_events").insert({
      id: fixtureSosId,
      elder_id: fixtureElderId,
      triggered_at: new Date().toISOString(),
      status: "open",
      nudges_sent: 0,
    });
    if (sosErr) throw new Error(`fixture sos: ${sosErr.message}`);

    const summaryA2 = await loadSummary(rawA);
    const leaked = (summaryA2?.sos ?? []).some((s) => s.elder_id === fixtureElderId);
    record(
      "elder A token does not include elder B SOS",
      !leaked,
      `sosCount=${summaryA2?.sos.length ?? 0}`,
    );
    const leakedCheckin = (summaryA2?.checkins ?? []).some(
      (c) => c.elder_id === fixtureElderId,
    );
    record("elder A token does not include elder B checkins", !leakedCheckin, "ok");

    // Wrong token
    const bad = await loadSummary(randomBytes(32).toString("base64url"));
    record("unknown token fails closed", bad === null, bad ? "leaked" : "null");

    // Revoke
    const { error: revErr } = await admin
      .from("doctor_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkA.id);
    if (revErr) throw new Error(revErr.message);
    const afterRevoke = await loadSummary(rawA);
    record("revoked token fails closed", afterRevoke === null, afterRevoke ? "still open" : "null");

    const { count } = await admin
      .from("doctor_share_links")
      .select("id", { count: "exact", head: true });
    record(
      "share links table countable",
      typeof count === "number",
      `count=${count}`,
    );
  } catch (e) {
    failed = true;
    console.error("ABORT", e instanceof Error ? e.message : e);
  } finally {
    await cleanup();
    const { count: remaining } = await admin
      .from("doctor_share_links")
      .select("id", { count: "exact", head: true });
    console.log(`doctor_share_links remaining rows: ${remaining}`);
  }

  process.exit(failed ? 1 : 0);
}

main();
