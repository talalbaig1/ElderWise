import {
  differenceInCalendarDays,
  isWithinInterval,
  parseISO,
} from "date-fns";
import type {
  CheckInResponse,
  CheckInStatus,
  ElderWiseStore,
  LovedOne,
} from "@/types";
import { formatInTimeZone, labelElderLocalTime } from "@/lib/time/display";
import {
  addCalendarDays,
  calendarDateInTimeZone,
  zonedDayBoundsForDate,
  zonedEndOfDay,
  zonedStartOfDay,
  zonedWallTimeToUtc,
} from "@/lib/time/zoned-bounds";
import {
  checkInStatusBreakdown,
  adherenceCompositionPie,
  adherencePieExcludedCaption,
  adherencePercent,
  formatResponseValueLabel,
} from "@/lib/check-in-status";

export type DashboardRange = "today" | "week" | "month" | "year" | "custom";

/**
 * Range bounds in the Care Partner's IANA timezone (not the browser host).
 * Check-ins are materialised in the elder's timezone — a CT/elder zone split
 * can put the same row on different calendar days; that divergence is accepted.
 */
export function getRangeBounds(
  range: DashboardRange,
  now = new Date(),
  timeZone = "UTC",
) {
  const today = calendarDateInTimeZone(timeZone, now);
  switch (range) {
    case "today": {
      const { from, to } = zonedDayBoundsForDate(timeZone, today);
      const priorDay = addCalendarDays(today, -1);
      const prior = zonedDayBoundsForDate(timeZone, priorDay);
      return { from, to, priorFrom: prior.from, priorTo: prior.to };
    }
    case "week": {
      const from = zonedWallTimeToUtc(
        timeZone,
        addCalendarDays(today, -6),
        "00:00:00",
      );
      const to = zonedEndOfDay(timeZone, now);
      const priorTo = new Date(from.getTime() - 1);
      const priorFrom = zonedWallTimeToUtc(
        timeZone,
        addCalendarDays(today, -13),
        "00:00:00",
      );
      return { from, to, priorFrom, priorTo };
    }
    case "month": {
      const ym = today.slice(0, 7);
      const from = zonedWallTimeToUtc(timeZone, `${ym}-01`, "00:00:00");
      const nextMonth = addCalendarDays(`${ym}-01`, 32).slice(0, 7) + "-01";
      const to = new Date(
        zonedWallTimeToUtc(timeZone, nextMonth, "00:00:00").getTime() - 1,
      );
      const priorMonthEnd = new Date(from.getTime() - 1);
      const priorYm = calendarDateInTimeZone(timeZone, priorMonthEnd).slice(0, 7);
      const priorFrom = zonedWallTimeToUtc(
        timeZone,
        `${priorYm}-01`,
        "00:00:00",
      );
      return { from, to, priorFrom, priorTo: priorMonthEnd };
    }
    case "year": {
      const y = today.slice(0, 4);
      const from = zonedWallTimeToUtc(timeZone, `${y}-01-01`, "00:00:00");
      const to = new Date(
        zonedWallTimeToUtc(timeZone, `${Number(y) + 1}-01-01`, "00:00:00").getTime() -
          1,
      );
      const priorFrom = zonedWallTimeToUtc(
        timeZone,
        `${Number(y) - 1}-01-01`,
        "00:00:00",
      );
      const priorTo = new Date(from.getTime() - 1);
      return { from, to, priorFrom, priorTo };
    }
    case "custom": {
      const { from, to } = zonedDayBoundsForDate(timeZone, today);
      const prior = zonedDayBoundsForDate(timeZone, addCalendarDays(today, -1));
      return { from, to, priorFrom: prior.from, priorTo: prior.to };
    }
  }
}

/** Build bounds from a custom date + time selection in the CT timezone. */
export function getCustomRangeBounds(
  startDate: string,
  endDate: string,
  startTime = "00:00",
  endTime = "23:59",
  timeZone = "UTC",
) {
  const from = zonedWallTimeToUtc(timeZone, startDate, normalizeCustomTime(startTime));
  let to = zonedWallTimeToUtc(timeZone, endDate, normalizeCustomTime(endTime));
  // Inclusive end-of-minute when only HH:MM was provided.
  if (endTime.length <= 5) {
    to = new Date(to.getTime() + 59_999);
  }

  const durationMs = Math.max(to.getTime() - from.getTime(), 60_000);
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - durationMs);

  return { from, to, priorFrom, priorTo };
}

function normalizeCustomTime(t: string): string {
  const s = t.trim();
  if (s.length >= 8) return s.slice(0, 8);
  if (s.length >= 5) return `${s.slice(0, 5)}:00`;
  return "00:00:00";
}

function inRange(iso: string, from: Date, to: Date) {
  try {
    return isWithinInterval(parseISO(iso), { start: from, end: to });
  } catch {
    return false;
  }
}

function adherence(items: CheckInResponse[]): number | null {
  return adherencePercent(items);
}

function statusBreakdown(items: CheckInResponse[]) {
  return checkInStatusBreakdown(items);
}

/** Facts only — never invent check-ins when the DB/store is empty. */
function filterCheckIns(
  store: ElderWiseStore,
  lovedOneId: string,
  kind: CheckInResponse["routineKind"],
  from: Date,
  to: Date,
) {
  return store.checkIns.filter(
    (c) =>
      c.lovedOneId === lovedOneId &&
      c.routineKind === kind &&
      inRange(c.scheduledAt, from, to),
  );
}

export function greetingForHour(date = new Date(), viewerTimeZone = "UTC") {
  let h = 0;
  try {
    const hourPart = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: viewerTimeZone,
    })
      .formatToParts(date)
      .find((p) => p.type === "hour")?.value;
    h = Number(hourPart ?? "0");
  } catch {
    h = date.getUTCHours();
  }
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function buildDashboardModel(
  store: ElderWiseStore,
  lovedOne: LovedOne,
  range: DashboardRange | { from: Date; to: Date; priorFrom: Date; priorTo: Date; label?: string },
  viewerTimeZone = "UTC",
) {
  const bounds =
    typeof range === "string"
      ? getRangeBounds(range, new Date(), viewerTimeZone)
      : range;
  const rangeLabel =
    typeof range === "string"
      ? range === "today"
        ? "Today"
        : range === "week"
          ? "Last 7 days"
          : range === "month"
            ? "This month"
            : range === "year"
              ? "This year"
              : "Custom range"
      : range.label ||
        `${formatInTimeZone(bounds.from, viewerTimeZone, {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })} – ${formatInTimeZone(bounds.to, viewerTimeZone, {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}`;

  const med = filterCheckIns(store, lovedOne.id, "medication", bounds.from, bounds.to);
  const food = filterCheckIns(store, lovedOne.id, "food", bounds.from, bounds.to);
  const health = filterCheckIns(store, lovedOne.id, "health", bounds.from, bounds.to);

  const medPrior = filterCheckIns(store, lovedOne.id, "medication", bounds.priorFrom, bounds.priorTo);
  const foodPrior = filterCheckIns(store, lovedOne.id, "food", bounds.priorFrom, bounds.priorTo);
  const healthPrior = filterCheckIns(store, lovedOne.id, "health", bounds.priorFrom, bounds.priorTo);

  const medPct = adherence(med);
  const foodPct = adherence(food);
  const healthPct = adherence(health);

  const trend = (now: number | null, prior: number | null) =>
    now == null || prior == null ? undefined : now - prior;

  const allInRange = [...med, ...food, ...health];
  const spanDays = Math.max(1, differenceInCalendarDays(bounds.to, bounds.from) + 1);
  const dayCount = Math.min(spanDays, 14);
  const step = Math.max(1, Math.floor(spanDays / dayCount));

  // Empty range → empty series (do not plot a flat 0% line as if it were data).
  // Bucket edges are Care Partner calendar days (same TZ as bounds), not host-local.
  const rangeStartDate = calendarDateInTimeZone(viewerTimeZone, bounds.from);
  const trendSeries =
    allInRange.length === 0
      ? []
      : Array.from({ length: dayCount }, (_, i) => {
          const bucketStart = addCalendarDays(rangeStartDate, i * step);
          const bucketEnd = addCalendarDays(
            bucketStart,
            Math.max(0, step - 1),
          );
          const dayFrom = zonedWallTimeToUtc(
            viewerTimeZone,
            bucketStart,
            "00:00:00",
          );
          const dayTo = zonedDayBoundsForDate(viewerTimeZone, bucketEnd).to;
          const label = formatInTimeZone(dayFrom, viewerTimeZone, {
            ...(spanDays <= 2
              ? { hour: "numeric", hour12: true }
              : spanDays <= 14
                ? { weekday: "short" }
                : { day: "numeric", month: "short" }),
          } as Intl.DateTimeFormatOptions);
          const medDay = med.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
          const foodDay = food.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
          const healthDay = health.filter((c) =>
            inRange(c.scheduledAt, dayFrom, dayTo),
          );
          return {
            label,
            medication: adherence(medDay) ?? 0,
            meals: adherence(foodDay) ?? 0,
            health: adherence(healthDay) ?? 0,
          };
        });

  const overallBreakdown = statusBreakdown(allInRange);
  const pie = adherenceCompositionPie(overallBreakdown);
  const pieExcludedCaption = adherencePieExcludedCaption(overallBreakdown);

  const sosEvents = store.sosEvents.filter((e) => e.lovedOneId === lovedOne.id);
  const activeSos = sosEvents.find((e) => e.status === "active" || e.status === "acknowledged");
  const sosInRange = sosEvents.filter((e) => inRange(e.triggeredAt, bounds.from, bounds.to));

  const journals = store.voiceJournals
    .filter((j) => j.lovedOneId === lovedOne.id)
    .sort((a, b) => +parseISO(b.recordedAt) - +parseISO(a.recordedAt));
  const latestJournal = journals[0] ?? null;

  const notifications = store.notifications
    .filter((n) => !n.lovedOneId || n.lovedOneId === lovedOne.id)
    .sort((a, b) => +parseISO(b.createdAt) - +parseISO(a.createdAt))
    .slice(0, 5);

  // "Today" for the daily timeline = Care Partner timezone (viewerTimeZone),
  // not the browser host and not the elder's zone. Materialisation stays elder-local.
  const todayFrom = zonedStartOfDay(viewerTimeZone);
  const todayTo = zonedEndOfDay(viewerTimeZone);
  const todayItems = allInRange
    .filter((c) => inRange(c.scheduledAt, todayFrom, todayTo))
    .filter((c) => c.status !== "cancelled")
    .sort((a, b) => +parseISO(a.scheduledAt) - +parseISO(b.scheduledAt));

  const timeline = todayItems
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title:
        item.routineKind === "medication"
          ? "Medication check-in"
          : item.routineKind === "food"
            ? "Meal check-in"
            : "Health check-in",
      time: formatInTimeZone(item.scheduledAt, viewerTimeZone, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      status: item.status as CheckInStatus,
      responseLabel: formatResponseValueLabel(
        item.response != null ? String(item.response) : undefined,
      ),
      kind: item.routineKind,
    }));

  const upcoming = [
    ...store.medications
      .filter((m) => m.lovedOneId === lovedOne.id && m.enabled)
      .flatMap((m) =>
        m.times.map((t) => ({
          id: `${m.id}-${t}`,
          title: `${m.name} · ${m.dosage}${m.dosageUnit}`,
          time: labelElderLocalTime(t, lovedOne.timeZone),
          kind: "medication" as const,
        })),
      ),
    ...store.foodRoutines
      .filter((f) => f.lovedOneId === lovedOne.id && f.enabled)
      .map((f) => ({
        id: f.id,
        title: f.mealName,
        time: labelElderLocalTime(f.checkInTime, lovedOne.timeZone),
        kind: "food" as const,
      })),
    ...store.healthRoutines
      .filter((h) => h.lovedOneId === lovedOne.id && h.enabled)
      .map((h) => ({
        id: h.id,
        title: h.name,
        time: labelElderLocalTime(h.time, lovedOne.timeZone),
        kind: "health" as const,
      })),
  ]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 6);

  const noCheckInData = medPct == null && foodPct == null && healthPct == null;

  const wellbeingMessage = activeSos
    ? "An SOS needs your attention right now."
    : noCheckInData
      ? "No check-in data in this range yet."
      : (medPct ?? 0) >= 85 && (foodPct ?? 0) >= 85
        ? "Today looks steady and reassuring."
        : (medPct != null && medPct < 70) || (foodPct != null && foodPct < 70)
          ? "A few routines need a gentle follow-up."
          : "A calm day with room to stay close.";

  return {
    medPct,
    foodPct,
    healthPct,
    medTrend: trend(medPct, adherence(medPrior)),
    foodTrend: trend(foodPct, adherence(foodPrior)),
    healthTrend: trend(healthPct, adherence(healthPrior)),
    medBreakdown: statusBreakdown(med),
    foodBreakdown: statusBreakdown(food),
    healthBreakdown: statusBreakdown(health),
    trendSeries,
    pie,
    pieExcludedCaption,
    activeSos,
    sosInRangeCount: sosInRange.length,
    sosTotal: sosEvents.length,
    latestJournal,
    notifications,
    timeline,
    upcoming,
    wellbeingMessage,
    rangeLabel,
  };
}

export type DashboardModel = ReturnType<typeof buildDashboardModel>;
