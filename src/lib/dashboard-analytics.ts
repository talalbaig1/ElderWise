import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";
import type {
  CheckInResponse,
  CheckInStatus,
  ElderWiseStore,
  LovedOne,
} from "@/types";
import { formatInTimeZone, labelElderLocalTime } from "@/lib/time/display";
import { checkInStatusBreakdown } from "@/lib/check-in-status";

export type DashboardRange = "today" | "week" | "month" | "year" | "custom";

export function getRangeBounds(range: DashboardRange, now = new Date()) {
  switch (range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), priorFrom: startOfDay(subDays(now, 1)), priorTo: endOfDay(subDays(now, 1)) };
    case "week":
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        priorFrom: startOfDay(subDays(now, 13)),
        priorTo: endOfDay(subDays(now, 7)),
      };
    case "month":
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        priorFrom: startOfMonth(subDays(startOfMonth(now), 1)),
        priorTo: endOfDay(subDays(startOfMonth(now), 1)),
      };
    case "year":
      return {
        from: startOfYear(now),
        to: endOfYear(now),
        priorFrom: startOfYear(subDays(startOfYear(now), 1)),
        priorTo: endOfDay(subDays(startOfYear(now), 1)),
      };
    case "custom":
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        priorFrom: startOfDay(subDays(now, 1)),
        priorTo: endOfDay(subDays(now, 1)),
      };
  }
}

/** Build bounds from a custom date + time selection. */
export function getCustomRangeBounds(
  startDate: string,
  endDate: string,
  startTime = "00:00",
  endTime = "23:59",
) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const from = parseISO(`${startDate}T00:00:00`);
  from.setHours(sh || 0, sm || 0, 0, 0);
  const to = parseISO(`${endDate}T00:00:00`);
  to.setHours(eh ?? 23, em ?? 59, 59, 999);

  const durationMs = Math.max(to.getTime() - from.getTime(), 60_000);
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - durationMs);

  return { from, to, priorFrom, priorTo };
}

function inRange(iso: string, from: Date, to: Date) {
  try {
    return isWithinInterval(parseISO(iso), { start: from, end: to });
  } catch {
    return false;
  }
}

function adherence(items: CheckInResponse[]): number | null {
  const scored = items.filter(
    (i) =>
      i.status === "taken" ||
      i.status === "missed" ||
      i.status === "delayed",
  );
  const takenOrMissed = scored.filter(
    (i) => i.status === "taken" || i.status === "missed",
  );
  // No taken/missed ⇒ no % (C9 — never 100% on empty).
  if (takenOrMissed.length === 0) return null;
  const good = scored.filter((i) => i.status === "taken" || i.status === "delayed").length;
  return Math.round((good / scored.length) * 100);
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
      ? getRangeBounds(range)
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
  const trendSeries =
    allInRange.length === 0
      ? []
      : Array.from({ length: dayCount }, (_, i) => {
          const dayFrom = startOfDay(addDays(bounds.from, i * step));
          const dayTo = endOfDay(addDays(dayFrom, Math.max(0, step - 1)));
          const label = format(dayFrom, spanDays <= 2 ? "ha" : spanDays <= 14 ? "EEE" : "d MMM");
          const medDay = med.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
          const foodDay = food.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
          const healthDay = health.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
          return {
            label,
            medication: adherence(medDay) ?? 0,
            meals: adherence(foodDay) ?? 0,
            health: adherence(healthDay) ?? 0,
          };
        });

  const pie = [
    { name: "Taken", value: statusBreakdown(allInRange).taken, fill: "#5C8C6B" },
    { name: "Delayed", value: statusBreakdown(allInRange).delayed, fill: "#E3A23C" },
    { name: "Missed", value: statusBreakdown(allInRange).missed, fill: "#B8433A" },
    { name: "Pending", value: statusBreakdown(allInRange).pending, fill: "#4A6D7C" },
  ].filter((p) => p.value > 0);

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

  const todayFrom = startOfDay(new Date());
  const todayTo = endOfDay(new Date());
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
