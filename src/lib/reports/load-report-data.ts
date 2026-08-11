import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkinDomainForKind,
  PDF_REPORT_KIND_LABEL,
  type PdfReportKind,
  type ReportPayload,
} from "@/lib/reports/types";
import {
  checkInStatusToUi,
  type DbCheckInStatus,
} from "@/lib/supabase/mappers";

export type LoadReportResult =
  | { ok: true; data: ReportPayload }
  | { ok: false; status: 401 | 403 | 404 | 400; error: string };

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Calendar YYYY-MM-DD in the given IANA zone (en-CA → ISO-like). */
function localYmd(iso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through */
  }
  return iso.slice(0, 10);
}

function inLocalDateRange(
  iso: string,
  timeZone: string,
  from: string,
  to: string,
): boolean {
  const key = localYmd(iso, timeZone);
  return key >= from && key <= to;
}

/**
 * Load report data with the caller's anon+session client (RLS).
 * Ownership is enforced by selecting the elder under care_partner_id = user.id.
 */
export async function loadReportData(
  supabase: SupabaseClient,
  userId: string,
  input: {
    elderId: string;
    kind: PdfReportKind;
    from: string;
    to: string;
  },
): Promise<LoadReportResult> {
  if (!input.elderId?.trim()) {
    return { ok: false, status: 400, error: "elderId is required" };
  }
  if (!isIsoDate(input.from) || !isIsoDate(input.to)) {
    return { ok: false, status: 400, error: "from and to must be YYYY-MM-DD" };
  }

  const rangeFrom = input.from <= input.to ? input.from : input.to;
  const rangeTo = input.from <= input.to ? input.to : input.from;

  // Wide UTC window so elder-local midnights near zone edges are included; then filter by elder-local YMD.
  const padFrom = new Date(`${rangeFrom}T00:00:00.000Z`);
  padFrom.setUTCDate(padFrom.getUTCDate() - 1);
  const padTo = new Date(`${rangeTo}T23:59:59.999Z`);
  padTo.setUTCDate(padTo.getUTCDate() + 1);

  const { data: elder, error: elderErr } = await supabase
    .from("elders")
    .select("id, first_name, last_name, timezone, consent_confirmed_at, active")
    .eq("id", input.elderId)
    .eq("care_partner_id", userId)
    .maybeSingle();

  if (elderErr) {
    return { ok: false, status: 400, error: elderErr.message };
  }
  // Owned-but-missing vs foreign id both look like no row under RLS + ownership filter.
  if (!elder) {
    return { ok: false, status: 404, error: "Loved One not found" };
  }
  if (elder.active !== true) {
    return { ok: false, status: 404, error: "Loved One not found" };
  }

  const elderTimeZone = ((elder.timezone as string) || "").trim() || "UTC";

  const { data: carePartner, error: cpErr } = await supabase
    .from("care_partners")
    .select("first_name, last_name, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (cpErr || !carePartner) {
    return {
      ok: false,
      status: 400,
      error: cpErr?.message ?? "Care Partner profile missing",
    };
  }

  const carePartnerFirstName =
    ((carePartner.first_name as string) || "").trim() || "Care Partner";
  const carePartnerTimeZone =
    ((carePartner.timezone as string) || "").trim() || "UTC";

  let checkIns: ReportPayload["checkIns"] = [];
  let sosEvents: ReportPayload["sosEvents"] = [];
  let respondedCount = 0;
  let missedCount = 0;

  if (input.kind === "sos") {
    const { data, error } = await supabase
      .from("sos_events")
      .select(
        "triggered_at, status, resolved_at, resolved_by_role, resolved_channel",
      )
      .eq("elder_id", elder.id)
      .gte("triggered_at", padFrom.toISOString())
      .lte("triggered_at", padTo.toISOString())
      .order("triggered_at", { ascending: true });

    if (error) return { ok: false, status: 400, error: error.message };

    sosEvents = (data ?? [])
      .filter((row) =>
        inLocalDateRange(
          row.triggered_at as string,
          elderTimeZone,
          rangeFrom,
          rangeTo,
        ),
      )
      .map((row) => ({
        triggeredAt: row.triggered_at as string,
        status: row.status as string,
        resolvedAt: (row.resolved_at as string | null) ?? null,
        resolvedByRole: (row.resolved_by_role as string | null) ?? null,
        resolvedChannel: (row.resolved_channel as string | null) ?? null,
      }));
  } else {
    const domain = checkinDomainForKind(input.kind);
    const { data, error } = await supabase
      .from("checkins")
      .select(
        "scheduled_for, status, response_value, responded_at, response_channel",
      )
      .eq("elder_id", elder.id)
      .eq("domain", domain)
      .gte("scheduled_for", padFrom.toISOString())
      .lte("scheduled_for", padTo.toISOString())
      .order("scheduled_for", { ascending: true });

    if (error) return { ok: false, status: 400, error: error.message };

    checkIns = (data ?? [])
      .filter((row) =>
        inLocalDateRange(
          row.scheduled_for as string,
          elderTimeZone,
          rangeFrom,
          rangeTo,
        ),
      )
      .map((row) => {
        const dbStatus = row.status as DbCheckInStatus;
        if (dbStatus === "responded") respondedCount += 1;
        if (dbStatus === "missed") missedCount += 1;
        return {
          scheduledFor: row.scheduled_for as string,
          status: checkInStatusToUi(dbStatus),
          responseValue: (row.response_value as string | null) ?? null,
          respondedAt: (row.responded_at as string | null) ?? null,
          responseChannel: (row.response_channel as string | null) ?? null,
        };
      });
  }

  const denom = respondedCount + missedCount;
  const respondedPct =
    denom === 0 ? null : Math.round((respondedCount / denom) * 100);

  return {
    ok: true,
    data: {
      kind: input.kind,
      kindLabel: PDF_REPORT_KIND_LABEL[input.kind],
      elderFirstName: (elder.first_name as string) || "",
      elderLastName: (elder.last_name as string) || "",
      elderTimeZone,
      consentConfirmedAt: (elder.consent_confirmed_at as string | null) ?? null,
      carePartnerFirstName,
      carePartnerTimeZone,
      rangeFrom,
      rangeTo,
      generatedAt: new Date().toISOString(),
      checkIns,
      sosEvents,
      respondedPct,
      respondedCount,
      missedCount,
    },
  };
}
