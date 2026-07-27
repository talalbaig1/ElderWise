import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken } from "@/lib/share/token";
import type { DoctorShareSummary } from "@/lib/share/types";

/**
 * Validate token → load one elder's clinical summary (service-role).
 * Every query is scoped to the resolved elder_id. Never returns other elders' rows.
 */
export async function loadDoctorShareSummary(
  rawToken: string,
): Promise<DoctorShareSummary | null> {
  const admin = createAdminClient();
  const tokenHash = hashShareToken(rawToken);

  const { data: link, error: linkErr } = await admin
    .from("doctor_share_links")
    .select("id, elder_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkErr || !link) return null;
  if (link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return null;
  }

  // Best-effort telemetry — only after token validation. Never block the summary.
  void admin
    .from("doctor_share_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", link.id)
    .then(({ error }) => {
      if (error) {
        console.warn("[share] last_accessed_at update failed:", error.message);
      }
    });

  const elderId = link.elder_id as string;

  const [elderRes, medRes, checkinRes, sosRes] = await Promise.all([
    admin
      .from("elders")
      .select("first_name, last_name, timezone, address")
      .eq("id", elderId)
      .maybeSingle(),
    admin
      .from("medications")
      .select("name, dosage, dosage_unit, times, enabled")
      .eq("elder_id", elderId)
      .eq("active", true)
      .order("name", { ascending: true }),
    admin
      .from("checkins")
      .select("scheduled_for, domain, status, response_value, responded_at")
      .eq("elder_id", elderId)
      .order("scheduled_for", { ascending: false })
      .limit(40),
    admin
      .from("sos_events")
      .select(
        "triggered_at, status, resolved_at, resolved_by_role, resolved_channel",
      )
      .eq("elder_id", elderId)
      .order("triggered_at", { ascending: false })
      .limit(20),
  ]);

  if (elderRes.error || !elderRes.data) return null;

  const elder = elderRes.data;
  // Architecture §10 — share page renders in the elder's timezone (never doctors.timezone).
  const viewerTimeZone = (elder.timezone as string)?.trim() || "UTC";

  // Isolation proof helper for scripts: re-query sos without elder filter must never
  // be used here — we only select eq elder_id.

  const sosEvents = (sosRes.data ?? []).map((row) => {
    const triggeredAt = row.triggered_at as string;
    const resolvedAt = (row.resolved_at as string | null) ?? null;
    let responseMinutes: number | null = null;
    if (resolvedAt) {
      responseMinutes = Math.round(
        (new Date(resolvedAt).getTime() - new Date(triggeredAt).getTime()) /
          60_000,
      );
    }
    return {
      triggeredAt,
      status: row.status as "open" | "resolved",
      resolvedAt,
      resolvedByRole: (row.resolved_by_role as string | null) ?? null,
      resolvedChannel: (row.resolved_channel as string | null) ?? null,
      responseMinutes,
    };
  });

  return {
    linkId: link.id as string,
    viewerTimeZone,
    elder: {
      firstName: elder.first_name as string,
      lastName: elder.last_name as string,
      timeZone: elder.timezone as string,
      address: elder.address as string,
    },
    medications: (medRes.data ?? []).map((m) => ({
      name: m.name as string,
      dosage: String(m.dosage),
      dosageUnit: m.dosage_unit as string,
      times: (m.times as string[]) ?? [],
      enabled: Boolean(m.enabled),
    })),
    checkIns: (checkinRes.data ?? []).map((c) => ({
      scheduledAt: c.scheduled_for as string,
      domain: c.domain as string,
      status: c.status as string,
      responseValue: (c.response_value as string | null) ?? null,
      respondedAt: (c.responded_at as string | null) ?? null,
    })),
    sosEvents,
  };
}
