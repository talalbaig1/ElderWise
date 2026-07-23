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

function adherence(items: CheckInResponse[]) {
  const relevant = items.filter((i) => i.status !== "upcoming" && i.status !== "pending");
  if (relevant.length === 0) return 0;
  const good = relevant.filter((i) => i.status === "taken" || i.status === "delayed").length;
  return Math.round((good / relevant.length) * 100);
}

function statusBreakdown(items: CheckInResponse[]) {
  const counts: Record<string, number> = {
    taken: 0,
    missed: 0,
    delayed: 0,
    pending: 0,
  };
  items.forEach((item) => {
    if (item.status in counts) counts[item.status] += 1;
    else if (item.status === "upcoming") counts.pending += 1;
  });
  return counts;
}

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function synthesizeCheckIns(
  lovedOneId: string,
  kind: CheckInResponse["routineKind"],
  from: Date,
  to: Date,
): CheckInResponse[] {
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const seed = hashSeed(`${lovedOneId}-${kind}`);
  const items: CheckInResponse[] = [];
  const statuses: CheckInStatus[] = ["taken", "taken", "taken", "delayed", "missed", "taken"];

  for (let d = 0; d < Math.min(days, 60); d++) {
    const day = addDays(from, d);
    const status = statuses[(seed + d) % statuses.length];
    const scheduled = new Date(day);
    scheduled.setHours(8 + (seed % 5), 0, 0, 0);
    const responded = new Date(day);
    responded.setHours(8 + (seed % 5), 12, 0, 0);
    items.push({
      id: `syn-${kind}-${lovedOneId}-${d}`,
      lovedOneId,
      routineId: `syn-${kind}`,
      routineKind: kind,
      scheduledAt: scheduled.toISOString(),
      respondedAt: status === "pending" ? undefined : responded.toISOString(),
      status,
      response: status === "taken" ? "yes" : status === "missed" ? "no" : "remind_later",
      channel: "simulated",
    });
  }
  return items;
}

function filterOrSynthesize(
  store: ElderWiseStore,
  lovedOneId: string,
  kind: CheckInResponse["routineKind"],
  from: Date,
  to: Date,
) {
  const forLovedOne = store.checkIns.filter((c) => c.lovedOneId === lovedOneId);
  // When real Supabase check-ins exist, never synthesize demo rows (A2.3).
  if (forLovedOne.length > 0) {
    return forLovedOne.filter(
      (c) => c.routineKind === kind && inRange(c.scheduledAt, from, to),
    );
  }
  const real = forLovedOne.filter(
    (c) => c.routineKind === kind && inRange(c.scheduledAt, from, to),
  );
  if (real.length > 0) return real;
  return synthesizeCheckIns(lovedOneId, kind, from, to);
}

export function greetingForHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function buildDashboardModel(
  store: ElderWiseStore,
  lovedOne: LovedOne,
  range: DashboardRange | { from: Date; to: Date; priorFrom: Date; priorTo: Date; label?: string },
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
        `${format(bounds.from, "d MMM h:mm a")} – ${format(bounds.to, "d MMM h:mm a")}`;

  const med = filterOrSynthesize(store, lovedOne.id, "medication", bounds.from, bounds.to);
  const food = filterOrSynthesize(store, lovedOne.id, "food", bounds.from, bounds.to);
  const health = filterOrSynthesize(store, lovedOne.id, "health", bounds.from, bounds.to);

  const medPrior = filterOrSynthesize(store, lovedOne.id, "medication", bounds.priorFrom, bounds.priorTo);
  const foodPrior = filterOrSynthesize(store, lovedOne.id, "food", bounds.priorFrom, bounds.priorTo);
  const healthPrior = filterOrSynthesize(store, lovedOne.id, "health", bounds.priorFrom, bounds.priorTo);

  const medPct = adherence(med);
  const foodPct = adherence(food);
  const healthPct = adherence(health);

  const trend = (now: number, prior: number) => now - prior;

  const spanDays = Math.max(1, differenceInCalendarDays(bounds.to, bounds.from) + 1);
  const dayCount = Math.min(spanDays, 14);
  const step = Math.max(1, Math.floor(spanDays / dayCount));
  const trendSeries = Array.from({ length: dayCount }, (_, i) => {
    const dayFrom = startOfDay(addDays(bounds.from, i * step));
    const dayTo = endOfDay(addDays(dayFrom, Math.max(0, step - 1)));
    const label = format(dayFrom, spanDays <= 2 ? "ha" : spanDays <= 14 ? "EEE" : "d MMM");

    const dayMed = med.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
    const dayFood = food.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
    const dayHealth = health.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
    return {
      label,
      medication: adherence(
        dayMed.length ? dayMed : synthesizeCheckIns(lovedOne.id, "medication", dayFrom, dayTo),
      ),
      meals: adherence(
        dayFood.length ? dayFood : synthesizeCheckIns(lovedOne.id, "food", dayFrom, dayTo),
      ),
      health: adherence(
        dayHealth.length ? dayHealth : synthesizeCheckIns(lovedOne.id, "health", dayFrom, dayTo),
      ),
    };
  });

  const pie = [
    { name: "Taken", value: statusBreakdown([...med, ...food, ...health]).taken, fill: "#5C8C6B" },
    { name: "Delayed", value: statusBreakdown([...med, ...food, ...health]).delayed, fill: "#E3A23C" },
    { name: "Missed", value: statusBreakdown([...med, ...food, ...health]).missed, fill: "#B8433A" },
    { name: "Pending", value: statusBreakdown([...med, ...food, ...health]).pending, fill: "#4A6D7C" },
  ].filter((p) => p.value > 0);

  const sosEvents = store.sosEvents.filter((e) => e.lovedOneId === lovedOne.id);
  const activeSos = sosEvents.find((e) => e.status === "active" || e.status === "acknowledged");
  const sosInRange = sosEvents.filter((e) => inRange(e.triggeredAt, bounds.from, bounds.to));
  const resolved = sosEvents.filter((e) => e.status === "resolved");
  const avgResponse =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, e) => sum + (e.averageResponseMinutes ?? 5), 0) / resolved.length,
        )
      : 0;

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
  const todayItems = [...med, ...food, ...health]
    .filter((c) => inRange(c.scheduledAt, todayFrom, todayTo))
    .sort((a, b) => +parseISO(a.scheduledAt) - +parseISO(b.scheduledAt));

  const timeline = (todayItems.length > 0 ? todayItems : [...med, ...food, ...health].slice(0, 6))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title:
        item.routineKind === "medication"
          ? "Medication check-in"
          : item.routineKind === "food"
            ? "Meal check-in"
            : "Health check-in",
      time: format(parseISO(item.scheduledAt), "h:mm a"),
      status: item.status,
      kind: item.routineKind,
    }));

  const upcoming = [
    ...store.medications
      .filter((m) => m.lovedOneId === lovedOne.id && m.enabled)
      .flatMap((m) =>
        m.times.map((t) => ({
          id: `${m.id}-${t}`,
          title: `${m.name} · ${m.dosage}${m.dosageUnit}`,
          time: t,
          kind: "medication" as const,
        })),
      ),
    ...store.foodRoutines
      .filter((f) => f.lovedOneId === lovedOne.id && f.enabled)
      .map((f) => ({
        id: f.id,
        title: f.mealName,
        time: f.checkInTime,
        kind: "food" as const,
      })),
    ...store.healthRoutines
      .filter((h) => h.lovedOneId === lovedOne.id && h.enabled)
      .map((h) => ({
        id: h.id,
        title: h.name,
        time: h.time,
        kind: "health" as const,
      })),
  ]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 6);

  const wellbeingMessage =
    activeSos
      ? "An SOS needs your attention right now."
      : medPct >= 85 && foodPct >= 85
        ? "Today looks steady and reassuring."
        : medPct < 70 || foodPct < 70
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
    avgResponse,
    latestJournal,
    notifications,
    timeline,
    upcoming,
    wellbeingMessage,
    rangeLabel,
  };
}

export type DashboardModel = ReturnType<typeof buildDashboardModel>;
