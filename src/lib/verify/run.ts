import type { createClient } from "@/lib/supabase/server";
import { dayRangeBounds, type DayRangeKey } from "@/lib/verify/dates";
import {
  getCheckDefinition,
  MEDICINE_ITEMS_EMBED_SELECT,
  type CheckId,
  type ParamKey,
} from "@/lib/verify/registry";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type VerifyParams = Partial<{
  elder: string;
  checkin: string;
  sosEvent: string;
  day: DayRangeKey;
}>;

export type VerifyRunResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  ranAt: string;
};

function selectColumns(defColumns: readonly string[]): string {
  return defColumns.join(",");
}

function assertRequiredParams(
  required: readonly ParamKey[],
  params: VerifyParams,
): boolean {
  for (const key of required) {
    if (params[key] === undefined) return false;
  }
  return true;
}

async function runSelectCheck(
  supabase: Supabase,
  table: string,
  columns: readonly string[],
  orderBy: { column: string; ascending: boolean },
  limit: number,
  applyFilters: (
    query: ReturnType<ReturnType<Supabase["from"]>["select"]>,
  ) => ReturnType<ReturnType<Supabase["from"]>["select"]>,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await applyFilters(
    supabase.from(table).select(selectColumns(columns)),
  )
    .order(orderBy.column, { ascending: orderBy.ascending })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Record<string, unknown>[];
}

function flattenMedicineEmbedRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const meds = row.medications as Record<string, unknown> | null;
    return {
      taken: row.taken,
      name: meds?.name ?? null,
      dosage: meds?.dosage ?? null,
      dosage_unit: meds?.dosage_unit ?? null,
    };
  });
}

function computeDuplicateSlots(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const groups = new Map<
    string,
    { ids: string[]; domain: unknown; scheduled_for: unknown }
  >();

  for (const row of rows) {
    const domain = row.domain;
    const scheduledFor = row.scheduled_for;
    const key = `${String(domain)}|${String(scheduledFor)}`;
    const existing = groups.get(key);
    const id = String(row.id);
    if (existing) {
      existing.ids.push(id);
    } else {
      groups.set(key, {
        ids: [id],
        domain,
        scheduled_for: scheduledFor,
      });
    }
  }

  const out: Record<string, unknown>[] = [];
  for (const group of groups.values()) {
    if (group.ids.length > 1) {
      out.push({
        domain: group.domain,
        scheduled_for: group.scheduled_for,
        duplicate_count: group.ids.length,
        checkin_ids: group.ids.join(","),
      });
    }
  }

  return out;
}

function computeNotificationOwnershipMismatches(
  notifications: Record<string, unknown>[],
  elderCarePartnerId: string,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const row of notifications) {
    const notificationCp = row.care_partner_id;
    if (String(notificationCp) !== String(elderCarePartnerId)) {
      out.push({
        notification_id: row.id,
        notification_care_partner_id: notificationCp,
        elder_care_partner_id: elderCarePartnerId,
        type: row.type,
        sent_at: row.sent_at,
      });
    }
  }

  return out;
}

async function runSimpleSelect(
  supabase: Supabase,
  checkId: CheckId,
  params: VerifyParams,
  resolveTimezone: (elderId: string) => Promise<string | null>,
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const def = getCheckDefinition(checkId);
  if (def.kind !== "select") {
    throw new Error("Expected select check");
  }

  const columns = [...def.columns];

  if (checkId === "consent_state") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) => query,
    );
    return { columns, rows };
  }

  if (checkId === "checkin_detail") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) => query.eq("id", params.checkin!),
    );
    return { columns, rows };
  }

  if (checkId === "sos_events_for_elder") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) => query.eq("elder_id", params.elder!),
    );
    return { columns, rows };
  }

  if (checkId === "sos_dispatch_log") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) => query.eq("sos_event_id", params.sosEvent!),
    );
    return { columns, rows };
  }

  if (checkId === "share_links_for_elder") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) => query.eq("elder_id", params.elder!),
    );
    return { columns, rows };
  }

  const tz = (await resolveTimezone(params.elder!)) ?? "UTC";
  const { startIso, endIso } = dayRangeBounds(params.day!, tz);

  if (checkId === "checkins_for_day") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) =>
        query
          .eq("elder_id", params.elder!)
          .gte("scheduled_for", startIso)
          .lte("scheduled_for", endIso),
    );
    return { columns, rows };
  }

  if (checkId === "ct_notifications_for_day") {
    const rows = await runSelectCheck(
      supabase,
      def.table,
      def.columns,
      def.orderBy,
      def.limit,
      (query) =>
        query
          .eq("elder_id", params.elder!)
          .gte("sent_at", startIso)
          .lte("sent_at", endIso),
    );
    return { columns, rows };
  }

  if (checkId === "voice_replies_for_day") {
    const { data, error } = await supabase
      .from("voice_replies")
      .select(selectColumns(def.columns))
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order(def.orderBy.column, { ascending: def.orderBy.ascending })
      .limit(def.limit);

    if (error) throw new Error(error.message);

    const { data: elderCheckins, error: checkinError } = await supabase
      .from("checkins")
      .select("id")
      .eq("elder_id", params.elder!);

    if (checkinError) throw new Error(checkinError.message);

    const allowed = new Set((elderCheckins ?? []).map((r) => r.id as string));
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).filter(
      (row) => allowed.has(String(row.checkin_id)),
    );
    return { columns, rows };
  }

  throw new Error(`Unhandled select check: ${checkId}`);
}

export async function executeVerifyCheck(
  supabase: Supabase,
  checkId: CheckId,
  params: VerifyParams,
  resolveTimezone: (elderId: string) => Promise<string | null>,
): Promise<VerifyRunResult> {
  const def = getCheckDefinition(checkId);

  if (!assertRequiredParams(def.params, params)) {
    throw new Error("Missing required parameters");
  }

  const ranAt = new Date().toISOString();
  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (def.kind === "select") {
    ({ columns, rows } = await runSimpleSelect(
      supabase,
      checkId,
      params,
      resolveTimezone,
    ));
  } else if (def.kind === "embed") {
    columns = ["taken", "name", "dosage", "dosage_unit"];
    const { data, error } = await supabase
      .from(def.table)
      .select(MEDICINE_ITEMS_EMBED_SELECT)
      .eq("checkin_id", params.checkin!)
      .order(def.orderBy.column, { ascending: def.orderBy.ascending })
      .limit(def.limit);

    if (error) throw new Error(error.message);
    rows = flattenMedicineEmbedRows(
      (data ?? []) as unknown as Record<string, unknown>[],
    );
  } else if (def.kind === "multi_select") {
    rows = [];
    for (const tableDef of def.tables) {
      const tableRows = await runSelectCheck(
        supabase,
        tableDef.table,
        tableDef.columns,
        tableDef.orderBy,
        def.limit,
        (query) => query.eq("elder_id", params.elder!),
      );
      for (const row of tableRows) {
        rows.push({ _source_table: tableDef.table, ...row });
      }
    }
    columns = [
      "_source_table",
      ...Array.from(new Set(def.tables.flatMap((t) => [...t.columns]))),
    ];
  } else if (def.kind === "computed") {
    columns = [...def.columns];
    const tz = (await resolveTimezone(params.elder!)) ?? "UTC";
    const { startIso, endIso } = dayRangeBounds(params.day!, tz);

    if (def.compute === "duplicate_slots") {
      const raw = await runSelectCheck(
        supabase,
        "checkins",
        ["id", "domain", "scheduled_for"],
        def.orderBy,
        def.limit,
        (query) =>
          query
            .eq("elder_id", params.elder!)
            .gte("scheduled_for", startIso)
            .lte("scheduled_for", endIso),
      );
      rows = computeDuplicateSlots(raw);
    } else {
      const notifications = await runSelectCheck(
        supabase,
        "ct_notifications",
        ["id", "type", "care_partner_id", "sent_at"],
        def.orderBy,
        def.limit,
        (query) =>
          query
            .eq("elder_id", params.elder!)
            .gte("sent_at", startIso)
            .lte("sent_at", endIso),
      );

      const { data: elderRow, error: elderError } = await supabase
        .from("elders")
        .select("care_partner_id")
        .eq("id", params.elder!)
        .maybeSingle();

      if (elderError || !elderRow) {
        rows = [];
      } else {
        rows = computeNotificationOwnershipMismatches(
          notifications,
          String(elderRow.care_partner_id),
        );
      }
    }
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    ranAt,
  };
}
