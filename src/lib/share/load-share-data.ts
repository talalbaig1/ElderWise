import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken } from "@/lib/share/token";
import type {
  DoctorShareDomainKey,
  DoctorShareDomainSummary,
  DoctorShareOverview,
  DoctorShareSummary,
} from "@/lib/share/types";
import {
  checkInStatusBreakdown,
} from "@/lib/check-in-status";
import {
  checkInStatusToUi,
  type DbCheckInStatus,
} from "@/lib/supabase/mappers";
import type { CheckInStatus } from "@/types";

/** Calendar-anchored doctor view — avoids one domain starving others under a global row limit. */
export const SHARE_CHECKIN_WINDOW_DAYS = 30;
export const SHARE_WINDOW_LABEL = "Last 30 days";

const DOMAIN_LABELS: Record<DoctorShareDomainKey, string> = {
  medication: "Medication",
  food: "Food",
  health: "Health",
};

function domainSummary(
  domain: DoctorShareDomainKey,
  items: ReadonlyArray<{ status: CheckInStatus }>,
): DoctorShareDomainSummary {
  const breakdown = checkInStatusBreakdown(items);
  return {
    domain,
    label: DOMAIN_LABELS[domain],
    breakdown,
    total: items.length,
  };
}

function buildOverview(input: {
  windowStartIso: string;
  windowEndIso: string;
  checkIns: ReadonlyArray<{ domain: string; status: CheckInStatus }>;
  sosEvents: ReadonlyArray<{ status: "open" | "resolved" }>;
}): DoctorShareOverview {
  const byDomain = {
    medication: input.checkIns.filter((c) => c.domain === "medication"),
    food: input.checkIns.filter((c) => c.domain === "food"),
    health: input.checkIns.filter((c) => c.domain === "health"),
  };
  const overall = checkInStatusBreakdown(input.checkIns);
  const domains = {
    medication: domainSummary("medication", byDomain.medication),
    food: domainSummary("food", byDomain.food),
    health: domainSummary("health", byDomain.health),
  };
  return {
    windowLabel: SHARE_WINDOW_LABEL,
    windowStartIso: input.windowStartIso,
    windowEndIso: input.windowEndIso,
    overall,
    overallTotal: input.checkIns.length,
    domains,
    sosOpen: input.sosEvents.filter((e) => e.status === "open").length,
    sosResolved: input.sosEvents.filter((e) => e.status === "resolved").length,
  };
}

/**
 * Validate token → load one elder's clinical summary (service-role).
 * Every query is scoped to the resolved elder_id. Never returns other elders' rows.
 * Query failures throw (C14) — never pretend empty data is a healthy summary.
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

  if (linkErr) {
    console.error("[share] doctor_share_links read failed:", linkErr.message);
    throw new Error("Unable to load care summary. Please try again.");
  }
  if (!link) return null;
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
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - SHARE_CHECKIN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

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
      .gte("scheduled_for", windowStartIso)
      .lte("scheduled_for", windowEndIso)
      .order("scheduled_for", { ascending: false }),
    admin
      .from("sos_events")
      .select(
        "triggered_at, status, resolved_at, resolved_by_role, resolved_channel",
      )
      .eq("elder_id", elderId)
      .gte("triggered_at", windowStartIso)
      .lte("triggered_at", windowEndIso)
      .order("triggered_at", { ascending: false }),
  ]);

  if (elderRes.error) {
    console.error("[share] elders read failed:", elderRes.error.message);
    throw new Error("Unable to load care summary. Please try again.");
  }
  if (medRes.error) {
    console.error("[share] medications read failed:", medRes.error.message);
    throw new Error("Unable to load care summary. Please try again.");
  }
  if (checkinRes.error) {
    console.error("[share] checkins read failed:", checkinRes.error.message);
    throw new Error("Unable to load care summary. Please try again.");
  }
  if (sosRes.error) {
    console.error("[share] sos_events read failed:", sosRes.error.message);
    throw new Error("Unable to load care summary. Please try again.");
  }
  if (!elderRes.data) return null;

  const elder = elderRes.data;
  // Architecture §10 — share page renders in the elder's timezone (never doctors.timezone).
  const viewerTimeZone = (elder.timezone as string)?.trim() || "UTC";

  const checkIns = (checkinRes.data ?? []).map((c) => ({
    scheduledAt: c.scheduled_for as string,
    domain: c.domain as string,
    status: checkInStatusToUi(
      c.status as DbCheckInStatus,
      (c.response_value as string | null) ?? null,
    ),
    responseValue: (c.response_value as string | null) ?? null,
    respondedAt: (c.responded_at as string | null) ?? null,
  }));

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

  const overview = buildOverview({
    windowStartIso,
    windowEndIso,
    checkIns,
    sosEvents,
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
    overview,
    medications: (medRes.data ?? []).map((m) => ({
      name: m.name as string,
      dosage: String(m.dosage),
      dosageUnit: m.dosage_unit as string,
      times: (m.times as string[]) ?? [],
      enabled: Boolean(m.enabled),
    })),
    checkIns,
    sosEvents,
  };
}
