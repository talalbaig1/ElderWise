/**
 * UI-side routine → today's check-in lifecycle.
 * Slot expression matches WF-1 / WF-1b / WF-1c materialisers:
 *   ((now() AT TIME ZONE elder.timezone)::date + wall_time) AT TIME ZONE elder.timezone
 * No n8n changes. Never touch rows with sent_at set.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncNotice = string | undefined;

export type RoutineSchedulable = {
  enabled: boolean;
  /** medications also require active=true at the call site */
  startDate: string;
  endDate?: string | null;
  daysOfWeek: string[];
  /** Wall-clock HH:MM or HH:MM:SS in the elder's timezone */
  wallTimes: string[];
};

function normalizeWall(wall: string): string {
  const t = wall.trim();
  if (t.length >= 8) return t.slice(0, 8);
  if (t.length >= 5) return `${t.slice(0, 5)}:00`;
  return t;
}

/** YYYY-MM-DD in the elder's IANA zone (matches Postgres ::date cast). */
export function elderTodayDateString(
  elderTimeZone: string,
  now = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: elderTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Lowercase weekday name in elder TZ (matches WF-1 DOW array). */
export function elderDayOfWeekName(
  elderTimeZone: string,
  now = new Date(),
): string {
  const raw = new Intl.DateTimeFormat("en-US", {
    timeZone: elderTimeZone,
    weekday: "long",
  }).format(now);
  return raw.toLowerCase();
}

/**
 * Convert elder-local calendar date + wall clock → UTC ISO.
 * Mirrors `(date + time) AT TIME ZONE zone`.
 */
export function elderLocalSlotToUtcIso(
  elderTimeZone: string,
  dateStr: string,
  wallClock: string,
): string {
  const time = normalizeWall(wallClock);
  let utc = new Date(`${dateStr}T${time}.000Z`);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: elderTimeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(utc)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asLocal = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const want = Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      Number(time.slice(0, 2)),
      Number(time.slice(3, 5)),
      Number(time.slice(6, 8)),
    );
    utc = new Date(utc.getTime() + (want - asLocal));
  }
  return utc.toISOString();
}

export function routineDueToday(
  routine: RoutineSchedulable,
  elderTimeZone: string,
  now = new Date(),
): boolean {
  if (!routine.enabled) return false;
  const today = elderTodayDateString(elderTimeZone, now);
  if (routine.startDate > today) return false;
  if (routine.endDate && routine.endDate < today) return false;
  if (routine.daysOfWeek.length === 0) return true;
  const dow = elderDayOfWeekName(elderTimeZone, now);
  return routine.daysOfWeek.map((d) => d.toLowerCase()).includes(dow);
}

type FoodOrHealthDomain = "food" | "health";

type CheckinRow = {
  id: string;
  status: string;
  sent_at: string | null;
  scheduled_for: string;
};

async function failIfNoRow(
  data: unknown,
  error: { message: string } | null,
  label: string,
): Promise<string | null> {
  if (error) return `${label}: ${error.message}`;
  if (!data) return `${label}: no row returned (check RLS)`;
  return null;
}

/**
 * Food / health — 1:1 with routine FK.
 * `oldWallTime` / `oldSchedulable` describe the row before the upsert (null on create).
 */
export async function syncFoodOrHealthCheckinToday(
  supabase: SupabaseClient,
  input: {
    domain: FoodOrHealthDomain;
    elderId: string;
    routineId: string;
    elderTimeZone: string;
    consentConfirmed: boolean;
    elderActive: boolean;
    routine: RoutineSchedulable;
    /** Previous wall clock before update; omit on create */
    previousWallTime?: string | null;
  },
): Promise<{ error?: string; notice?: SyncNotice }> {
  const fk =
    input.domain === "food" ? "food_routine_id" : "health_routine_id";
  const today = elderTodayDateString(input.elderTimeZone);
  const wall = input.routine.wallTimes[0];
  if (!wall) return {};

  const newSlot = elderLocalSlotToUtcIso(input.elderTimeZone, today, wall);
  const due = routineDueToday(input.routine, input.elderTimeZone);

  // Load today's rows for this routine (any status) around today's slots.
  const { data: existingRows, error: listErr } = await supabase
    .from("checkins")
    .select("id, status, sent_at, scheduled_for")
    .eq("elder_id", input.elderId)
    .eq("domain", input.domain)
    .eq(fk, input.routineId)
    .gte("scheduled_for", elderLocalSlotToUtcIso(input.elderTimeZone, today, "00:00:00"))
    .lte("scheduled_for", elderLocalSlotToUtcIso(input.elderTimeZone, today, "23:59:59"));

  if (listErr) return { error: `checkins read: ${listErr.message}` };
  const rows = (existingRows ?? []) as CheckinRow[];

  const unsentToday = rows.filter(
    (r) => r.status === "scheduled" && r.sent_at == null,
  );
  const sentishToday = rows.filter(
    (r) => !(r.status === "scheduled" && r.sent_at == null),
  );

  // Pause (enabled=false, active=true) or day no longer matches: drop
  // today's unsent scheduled only. Never touch sent_at. Soft-delete uses
  // deleteUnsentFutureForRoutine (today onward) after setting both flags.
  if (!due) {
    for (const r of unsentToday) {
      const { data, error } = await supabase
        .from("checkins")
        .delete()
        .eq("id", r.id)
        .is("sent_at", null)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();
      if (error) return { error: `checkins delete (not due): ${error.message}` };
      // Race / already gone: !data with no error is OK (C14 — only fail on error).
      void data;
    }
    return {};
  }

  if (!input.elderActive || !input.consentConfirmed) {
    // Match materialiser gates — do not invent rows for unconsented elders.
    return {};
  }

  const prevWall = input.previousWallTime
    ? normalizeWall(input.previousWallTime)
    : null;
  const newWall = normalizeWall(wall);
  const timeChanged = prevWall != null && prevWall !== newWall;

  // Prefer the unsent row that matches the previous slot when the time moved.
  let targetUnsent: CheckinRow | undefined;
  if (timeChanged && prevWall) {
    const oldSlot = elderLocalSlotToUtcIso(input.elderTimeZone, today, prevWall);
    targetUnsent = unsentToday.find(
      (r) => new Date(r.scheduled_for).getTime() === new Date(oldSlot).getTime(),
    );
  }
  if (!targetUnsent) targetUnsent = unsentToday[0];

  if (targetUnsent) {
    if (
      new Date(targetUnsent.scheduled_for).getTime() ===
      new Date(newSlot).getTime()
    ) {
      return {};
    }
    const { data, error } = await supabase
      .from("checkins")
      .update({ scheduled_for: newSlot })
      .eq("id", targetUnsent.id)
      .eq("status", "scheduled")
      .is("sent_at", null)
      .select("id, scheduled_for")
      .maybeSingle();
    const err = await failIfNoRow(data, error, "checkins reschedule");
    if (err) return { error: err };
    return {};
  }

  // Already sent/responded/missed/cancelled today at some slot.
  if (sentishToday.length > 0 && timeChanged) {
    const { data: conflict } = await supabase
      .from("checkins")
      .select("id")
      .eq("elder_id", input.elderId)
      .eq("domain", input.domain)
      .eq(fk, input.routineId)
      .eq("scheduled_for", newSlot)
      .maybeSingle();
    if (!conflict) {
      const { data, error } = await supabase
        .from("checkins")
        .insert({
          elder_id: input.elderId,
          domain: input.domain,
          [fk]: input.routineId,
          scheduled_for: newSlot,
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      const err = await failIfNoRow(data, error, "checkins cancel-slot insert");
      if (err) return { error: err };
    }
    return {
      notice:
        "Today's check-in was already sent — this change applies from tomorrow.",
    };
  }

  // Create path / due with no row yet: insert scheduled if absent.
  const { data: atNew } = await supabase
    .from("checkins")
    .select("id")
    .eq("elder_id", input.elderId)
    .eq("domain", input.domain)
    .eq(fk, input.routineId)
    .eq("scheduled_for", newSlot)
    .maybeSingle();
  if (atNew) return {};

  const insertPayload: Record<string, unknown> = {
    elder_id: input.elderId,
    domain: input.domain,
    [fk]: input.routineId,
    scheduled_for: newSlot,
    status: "scheduled",
  };
  const { data, error } = await supabase
    .from("checkins")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();
  const err = await failIfNoRow(data, error, "checkins insert");
  if (err) return { error: err };
  return {};
}

/** Soft-delete / disable: drop unsent scheduled rows from today onward for this routine. */
export async function deleteUnsentFutureForRoutine(
  supabase: SupabaseClient,
  input: {
    domain: FoodOrHealthDomain;
    elderId: string;
    routineId: string;
    elderTimeZone: string;
  },
): Promise<{ error?: string }> {
  const fk =
    input.domain === "food" ? "food_routine_id" : "health_routine_id";
  const todayStart = elderLocalSlotToUtcIso(
    input.elderTimeZone,
    elderTodayDateString(input.elderTimeZone),
    "00:00:00",
  );

  const { data: rows, error: listErr } = await supabase
    .from("checkins")
    .select("id, sent_at, status")
    .eq("elder_id", input.elderId)
    .eq("domain", input.domain)
    .eq(fk, input.routineId)
    .eq("status", "scheduled")
    .is("sent_at", null)
    .gte("scheduled_for", todayStart);

  if (listErr) return { error: `checkins read: ${listErr.message}` };

  for (const r of rows ?? []) {
    const { data, error } = await supabase
      .from("checkins")
      .delete()
      .eq("id", r.id)
      .eq("status", "scheduled")
      .is("sent_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { error: `checkins delete: ${error.message}` };
    if (!data) {
      // Race: already gone — acceptable
      continue;
    }
  }
  return {};
}

/**
 * Medication slots are shared across medicines (UNIQUE elder_id + scheduled_for).
 * Never move/delete a slot still required by another active enabled medication.
 */
export async function syncMedicationCheckinToday(
  supabase: SupabaseClient,
  input: {
    elderId: string;
    medicationId: string;
    elderTimeZone: string;
    consentConfirmed: boolean;
    elderActive: boolean;
    routine: RoutineSchedulable & { active: boolean };
    previousWallTimes?: string[] | null;
  },
): Promise<{ error?: string; notice?: SyncNotice }> {
  const today = elderTodayDateString(input.elderTimeZone);
  const enabled = input.routine.enabled && input.routine.active;
  const due =
    enabled &&
    routineDueToday(
      { ...input.routine, enabled: true },
      input.elderTimeZone,
    );

  const newTimes = input.routine.wallTimes.map(normalizeWall);
  const oldTimes = (input.previousWallTimes ?? []).map(normalizeWall);

  // Other live meds' times (exclude this id).
  const { data: otherMeds, error: medErr } = await supabase
    .from("medications")
    .select("id, times, enabled, active, start_date, end_date, days_of_week")
    .eq("elder_id", input.elderId)
    .eq("active", true)
    .eq("enabled", true)
    .neq("id", input.medicationId);

  if (medErr) return { error: `medications read: ${medErr.message}` };

  const otherDueTimes = new Set<string>();
  for (const m of otherMeds ?? []) {
    const sched: RoutineSchedulable = {
      enabled: true,
      startDate: m.start_date as string,
      endDate: m.end_date as string | null,
      daysOfWeek: (m.days_of_week as string[]) ?? [],
      wallTimes: (m.times as string[]) ?? [],
    };
    if (!routineDueToday(sched, input.elderTimeZone)) continue;
    for (const t of sched.wallTimes) {
      otherDueTimes.add(
        elderLocalSlotToUtcIso(input.elderTimeZone, today, t),
      );
    }
  }

  if (!due) {
    // Drop unsent today slots that only this med owned.
    for (const t of oldTimes.length ? oldTimes : newTimes) {
      const slot = elderLocalSlotToUtcIso(input.elderTimeZone, today, t);
      if (otherDueTimes.has(slot)) continue;
      const { data: row } = await supabase
        .from("checkins")
        .select("id, status, sent_at")
        .eq("elder_id", input.elderId)
        .eq("domain", "medication")
        .eq("scheduled_for", slot)
        .eq("status", "scheduled")
        .is("sent_at", null)
        .maybeSingle();
      if (!row) continue;
      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("id", row.id)
        .eq("status", "scheduled")
        .is("sent_at", null);
      if (error) return { error: `checkins delete: ${error.message}` };
    }
    return {};
  }

  if (!input.elderActive || !input.consentConfirmed) return {};

  let notice: SyncNotice;
  const oldSet = new Set(oldTimes);
  const newSet = new Set(newTimes);

  // Reschedule unsent old→new when the only change is a moved time and slot is exclusive.
  for (const ot of oldTimes) {
    if (newSet.has(ot)) continue;
    const oldSlot = elderLocalSlotToUtcIso(input.elderTimeZone, today, ot);
    if (otherDueTimes.has(oldSlot)) continue;

    const { data: row } = await supabase
      .from("checkins")
      .select("id, status, sent_at, scheduled_for")
      .eq("elder_id", input.elderId)
      .eq("domain", "medication")
      .eq("scheduled_for", oldSlot)
      .maybeSingle();

    if (!row) continue;

    if (row.status === "scheduled" && row.sent_at == null) {
      // Move to first new time not already covered, if any.
      const destWall = newTimes.find((t) => !oldSet.has(t)) ?? newTimes[0];
      if (!destWall) {
        const { error } = await supabase
          .from("checkins")
          .delete()
          .eq("id", row.id)
          .is("sent_at", null);
        if (error) return { error: `checkins delete: ${error.message}` };
        continue;
      }
      const newSlot = elderLocalSlotToUtcIso(
        input.elderTimeZone,
        today,
        destWall,
      );
      const { data: clash } = await supabase
        .from("checkins")
        .select("id")
        .eq("elder_id", input.elderId)
        .eq("domain", "medication")
        .eq("scheduled_for", newSlot)
        .maybeSingle();
      if (clash) {
        const { error } = await supabase
          .from("checkins")
          .delete()
          .eq("id", row.id)
          .is("sent_at", null);
        if (error) return { error: `checkins delete: ${error.message}` };
      } else {
        const { data, error } = await supabase
          .from("checkins")
          .update({ scheduled_for: newSlot })
          .eq("id", row.id)
          .is("sent_at", null)
          .select("id")
          .maybeSingle();
        const err = await failIfNoRow(data, error, "checkins reschedule");
        if (err) return { error: err };
      }
      continue;
    }

    // Already sent at old slot — plant cancelled at each new exclusive slot.
    for (const nt of newTimes) {
      if (oldSet.has(nt)) continue;
      const newSlot = elderLocalSlotToUtcIso(input.elderTimeZone, today, nt);
      const { data: exists } = await supabase
        .from("checkins")
        .select("id")
        .eq("elder_id", input.elderId)
        .eq("domain", "medication")
        .eq("scheduled_for", newSlot)
        .maybeSingle();
      if (exists) continue;
      const { data, error } = await supabase
        .from("checkins")
        .insert({
          elder_id: input.elderId,
          domain: "medication",
          scheduled_for: newSlot,
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      const err = await failIfNoRow(data, error, "checkins cancel-slot insert");
      if (err) return { error: err };
      notice =
        "Today's check-in was already sent — this change applies from tomorrow.";
    }
  }

  // Ensure scheduled rows exist for new due times.
  for (const nt of newTimes) {
    const newSlot = elderLocalSlotToUtcIso(input.elderTimeZone, today, nt);
    const { data: exists } = await supabase
      .from("checkins")
      .select("id")
      .eq("elder_id", input.elderId)
      .eq("domain", "medication")
      .eq("scheduled_for", newSlot)
      .maybeSingle();
    if (exists) continue;
    const { data, error } = await supabase
      .from("checkins")
      .insert({
        elder_id: input.elderId,
        domain: "medication",
        scheduled_for: newSlot,
        status: "scheduled",
      })
      .select("id")
      .maybeSingle();
    const err = await failIfNoRow(data, error, "checkins insert");
    if (err) return { error: err };
  }

  return { notice };
}

export async function deleteUnsentFutureMedicationSlots(
  supabase: SupabaseClient,
  input: {
    elderId: string;
    medicationId: string;
    elderTimeZone: string;
    wallTimes: string[];
  },
): Promise<{ error?: string }> {
  const today = elderTodayDateString(input.elderTimeZone);
  const todayStart = elderLocalSlotToUtcIso(input.elderTimeZone, today, "00:00:00");

  const { data: otherMeds, error: medErr } = await supabase
    .from("medications")
    .select("id, times, enabled, active, start_date, end_date, days_of_week")
    .eq("elder_id", input.elderId)
    .eq("active", true)
    .eq("enabled", true)
    .neq("id", input.medicationId);

  if (medErr) return { error: `medications read: ${medErr.message}` };

  const otherSlots = new Set<string>();
  for (const m of otherMeds ?? []) {
    for (const t of (m.times as string[]) ?? []) {
      otherSlots.add(normalizeWall(t));
    }
  }

  const exclusiveWalls = new Set(
    input.wallTimes.map(normalizeWall).filter((w) => !otherSlots.has(w)),
  );
  if (exclusiveWalls.size === 0) return {};

  const { data: rows, error } = await supabase
    .from("checkins")
    .select("id, scheduled_for")
    .eq("elder_id", input.elderId)
    .eq("domain", "medication")
    .eq("status", "scheduled")
    .is("sent_at", null)
    .gte("scheduled_for", todayStart);

  if (error) return { error: `checkins read: ${error.message}` };

  for (const r of rows ?? []) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: input.elderTimeZone,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(r.scheduled_for as string))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const wall = normalizeWall(
      `${parts.hour}:${parts.minute}:${parts.second}`,
    );
    if (!exclusiveWalls.has(wall)) continue;
    const { error: delErr } = await supabase
      .from("checkins")
      .delete()
      .eq("id", r.id)
      .is("sent_at", null);
    if (delErr) return { error: `checkins delete: ${delErr.message}` };
  }
  return {};
}

export async function loadElderScheduleContext(
  supabase: SupabaseClient,
  elderId: string,
): Promise<
  | {
      ok: true;
      timezone: string;
      consentConfirmed: boolean;
      active: boolean;
    }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("elders")
    .select("timezone, consent_confirmed_at, active")
    .eq("id", elderId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Loved One not found (check RLS)" };
  return {
    ok: true,
    timezone: (data.timezone as string) || "UTC",
    consentConfirmed: data.consent_confirmed_at != null,
    active: data.active === true,
  };
}
