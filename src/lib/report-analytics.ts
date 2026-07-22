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
  DateRangePreset,
  ElderWiseStore,
  LovedOne,
  ReportType,
  SOSEvent,
  VoiceJournalEntry,
} from "@/types";

export type ReportKind =
  | "medication"
  | "meals"
  | "health"
  | "voice_journal"
  | "sos"
  | "overall";

export const REPORT_KIND_META: {
  id: ReportKind;
  label: string;
  description: string;
  storeType: ReportType;
}[] = [
  {
    id: "medication",
    label: "Medication",
    description: "Dose adherence, delays, and missed check-ins",
    storeType: "medication",
  },
  {
    id: "meals",
    label: "Meals",
    description: "Meal confirmation patterns across the Care Circle day",
    storeType: "food",
  },
  {
    id: "health",
    label: "Health",
    description: "Wellness routines, sleep, and health responses",
    storeType: "health",
  },
  {
    id: "voice_journal",
    label: "Voice Journal",
    description: "Mood themes, summaries, and attention flags",
    storeType: "voice_journal",
  },
  {
    id: "sos",
    label: "SOS",
    description: "Alerts, response times, and resolution history",
    storeType: "sos",
  },
  {
    id: "overall",
    label: "Overall Wellbeing",
    description: "Combined routines, SOS, and journal signals",
    storeType: "combined_wellbeing",
  },
];

export function reportKindToStoreType(kind: ReportKind): ReportType {
  return REPORT_KIND_META.find((m) => m.id === kind)!.storeType;
}

export function getReportRangeBounds(
  preset: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
  now = new Date(),
) {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
    case "7d":
      return {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
        label: "Last 7 days",
      };
    case "30d":
      return {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
        label: "Last 30 days",
      };
    case "month":
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        label: format(now, "MMMM yyyy"),
      };
    case "year":
      return {
        from: startOfYear(now),
        to: endOfYear(now),
        label: format(now, "yyyy"),
      };
    case "custom": {
      const from = startOfDay(customFrom ?? subDays(now, 6));
      const to = endOfDay(customTo ?? now);
      return {
        from,
        to,
        label: `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`,
      };
    }
  }
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
  const counts: Record<"taken" | "missed" | "delayed" | "pending", number> = {
    taken: 0,
    missed: 0,
    delayed: 0,
    pending: 0,
  };
  items.forEach((item) => {
    if (item.status === "taken" || item.status === "missed" || item.status === "delayed") {
      counts[item.status] += 1;
    } else {
      counts.pending += 1;
    }
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
  const seed = hashSeed(`${lovedOneId}-${kind}-report`);
  const items: CheckInResponse[] = [];
  const statuses: CheckInStatus[] = ["taken", "taken", "taken", "delayed", "missed", "taken"];

  for (let d = 0; d < Math.min(days, 90); d++) {
    const day = addDays(from, d);
    const status = statuses[(seed + d) % statuses.length];
    const scheduled = new Date(day);
    scheduled.setHours(8 + (seed % 5), 0, 0, 0);
    const responded = new Date(day);
    responded.setHours(8 + (seed % 5), 12, 0, 0);
    items.push({
      id: `rep-syn-${kind}-${lovedOneId}-${d}`,
      lovedOneId,
      routineId: `rep-syn-${kind}`,
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
  const real = store.checkIns.filter(
    (c) =>
      c.lovedOneId === lovedOneId &&
      c.routineKind === kind &&
      inRange(c.scheduledAt, from, to),
  );
  if (real.length > 0) return real;
  return synthesizeCheckIns(lovedOneId, kind, from, to);
}

function buildTrendSeries(
  lovedOneId: string,
  med: CheckInResponse[],
  food: CheckInResponse[],
  health: CheckInResponse[],
  from: Date,
  to: Date,
) {
  const daySpan = differenceInCalendarDays(to, from) + 1;
  const useMonths = daySpan > 45;
  const points = useMonths
    ? Math.min(12, Math.max(1, Math.ceil(daySpan / 30)))
    : Math.min(14, Math.max(1, daySpan));

  return Array.from({ length: points }, (_, i) => {
    let dayFrom: Date;
    let dayTo: Date;
    let label: string;

    if (useMonths) {
      dayFrom = startOfMonth(addDays(from, i * 31));
      dayTo = endOfMonth(dayFrom);
      label = format(dayFrom, "MMM");
    } else if (daySpan > 14) {
      const step = Math.ceil(daySpan / points);
      dayFrom = startOfDay(addDays(from, i * step));
      dayTo = endOfDay(addDays(dayFrom, step - 1));
      label = format(dayFrom, "d MMM");
    } else {
      dayFrom = startOfDay(addDays(from, i));
      dayTo = endOfDay(dayFrom);
      label = format(dayFrom, daySpan === 1 ? "ha" : "EEE d");
    }

    const slice = (items: CheckInResponse[], kind: CheckInResponse["routineKind"]) => {
      const dayItems = items.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
      return adherence(
        dayItems.length ? dayItems : synthesizeCheckIns(lovedOneId, kind, dayFrom, dayTo),
      );
    };

    return {
      label,
      medication: slice(med, "medication"),
      meals: slice(food, "food"),
      health: slice(health, "health"),
    };
  });
}

function checkInTitle(item: CheckInResponse, store: ElderWiseStore) {
  if (item.routineKind === "medication") {
    const med = store.medications.find((m) => m.id === item.routineId);
    return med ? `${med.name} · ${med.dosage}${med.dosageUnit}` : "Medication check-in";
  }
  if (item.routineKind === "food") {
    const meal = store.foodRoutines.find((f) => f.id === item.routineId);
    return meal ? meal.mealName : "Meal check-in";
  }
  const health = store.healthRoutines.find((h) => h.id === item.routineId);
  return health ? health.name : "Health check-in";
}

function moodCounts(journals: VoiceJournalEntry[]) {
  const map: Record<string, number> = {};
  journals.forEach((j) => {
    map[j.mood] = (map[j.mood] ?? 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill:
      name === "positive" || name === "calm"
        ? "#5C8C6B"
        : name === "concerned" || name === "lonely"
          ? "#B8433A"
          : name === "tired"
            ? "#E3A23C"
            : "#4A6D7C",
  }));
}

function sosStatusSeries(events: SOSEvent[]) {
  const statuses = ["active", "acknowledged", "resolved", "cancelled"] as const;
  const colors = {
    active: "#B8433A",
    acknowledged: "#E3A23C",
    resolved: "#5C8C6B",
    cancelled: "#4A6D7C",
  };
  return statuses
    .map((status) => ({
      name: status,
      value: events.filter((e) => e.status === status).length,
      fill: colors[status],
    }))
    .filter((d) => d.value > 0);
}

export interface ReportMetric {
  label: string;
  value: string | number;
  hint?: string;
}

export interface ReportTimelineItem {
  id: string;
  title: string;
  time: string;
  description?: string;
  status?: CheckInStatus;
  kind: string;
}

export interface ReportModel {
  kind: ReportKind;
  title: string;
  summary: string;
  rangeLabel: string;
  from: Date;
  to: Date;
  lovedOne: LovedOne;
  metrics: ReportMetric[];
  adherencePercent?: number;
  trendSeries: { label: string; medication: number; meals: number; health: number }[];
  statusPie: { name: string; value: number; fill: string }[];
  barSeries: { label: string; value: number }[];
  moodPie: { name: string; value: number; fill: string }[];
  timeline: ReportTimelineItem[];
  tableRows: Record<string, string | number>[];
  csvHeaders: string[];
  snapshotMetrics: Record<string, string | number>;
}

export function buildReportModel(
  store: ElderWiseStore,
  lovedOne: LovedOne,
  kind: ReportKind,
  preset: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
): ReportModel {
  const bounds = getReportRangeBounds(preset, customFrom, customTo);
  const med = filterOrSynthesize(store, lovedOne.id, "medication", bounds.from, bounds.to);
  const food = filterOrSynthesize(store, lovedOne.id, "food", bounds.from, bounds.to);
  const health = filterOrSynthesize(store, lovedOne.id, "health", bounds.from, bounds.to);
  const trendSeries = buildTrendSeries(lovedOne.id, med, food, health, bounds.from, bounds.to);

  const journals = store.voiceJournals
    .filter((j) => j.lovedOneId === lovedOne.id && inRange(j.recordedAt, bounds.from, bounds.to))
    .sort((a, b) => +parseISO(b.recordedAt) - +parseISO(a.recordedAt));

  const sosEvents = store.sosEvents
    .filter((e) => e.lovedOneId === lovedOne.id && inRange(e.triggeredAt, bounds.from, bounds.to))
    .sort((a, b) => +parseISO(b.triggeredAt) - +parseISO(a.triggeredAt));

  const meta = REPORT_KIND_META.find((m) => m.id === kind)!;
  const name = `${lovedOne.firstName} ${lovedOne.surname}`;

  if (kind === "medication" || kind === "meals" || kind === "health") {
    const items = kind === "medication" ? med : kind === "meals" ? food : health;
    const breakdown = statusBreakdown(items);
    const pct = adherence(items);
    const seriesKey = kind === "medication" ? "medication" : kind === "meals" ? "meals" : "health";
    const title =
      kind === "medication"
        ? "Medication report"
        : kind === "meals"
          ? "Meals report"
          : "Health report";

    const summary =
      pct >= 90
        ? `${name}'s ${kind === "meals" ? "meal" : kind} routines look steady across ${bounds.label.toLowerCase()}.`
        : pct >= 75
          ? `${name} completed most ${kind === "meals" ? "meals" : "check-ins"}, with a few delays worth a gentle follow-up.`
          : `${name} needs closer attention on ${kind === "meals" ? "meals" : kind} — several missed responses in this range.`;

    const timeline: ReportTimelineItem[] = [...items]
      .sort((a, b) => +parseISO(b.scheduledAt) - +parseISO(a.scheduledAt))
      .slice(0, 12)
      .map((item) => ({
        id: item.id,
        title: checkInTitle(item, store),
        time: format(parseISO(item.scheduledAt), "d MMM · h:mm a"),
        description: item.notes || `Channel: ${item.channel}`,
        status: item.status,
        kind: item.routineKind,
      }));

    const tableRows = items.map((item) => ({
      Date: format(parseISO(item.scheduledAt), "yyyy-MM-dd HH:mm"),
      Routine: checkInTitle(item, store),
      Status: item.status,
      Response: String(item.response ?? ""),
      Channel: item.channel,
    }));

    return {
      kind,
      title,
      summary,
      rangeLabel: bounds.label,
      from: bounds.from,
      to: bounds.to,
      lovedOne,
      metrics: [
        { label: "Adherence", value: `${pct}%`, hint: bounds.label },
        { label: "Taken", value: breakdown.taken },
        { label: "Delayed", value: breakdown.delayed },
        { label: "Missed", value: breakdown.missed },
      ],
      adherencePercent: pct,
      trendSeries,
      statusPie: [
        { name: "Taken", value: breakdown.taken, fill: "#5C8C6B" },
        { name: "Delayed", value: breakdown.delayed, fill: "#E3A23C" },
        { name: "Missed", value: breakdown.missed, fill: "#B8433A" },
        { name: "Pending", value: breakdown.pending, fill: "#4A6D7C" },
      ].filter((p) => p.value > 0),
      barSeries: trendSeries.map((p) => ({ label: p.label, value: p[seriesKey] })),
      moodPie: [],
      timeline,
      tableRows,
      csvHeaders: ["Date", "Routine", "Status", "Response", "Channel"],
      snapshotMetrics: {
        taken: breakdown.taken,
        delayed: breakdown.delayed,
        missed: breakdown.missed,
        pending: breakdown.pending,
        adherence: pct,
      },
    };
  }

  if (kind === "voice_journal") {
    const attention = journals.filter((j) => j.attentionFlag).length;
    const avgDuration =
      journals.length > 0
        ? Math.round(journals.reduce((s, j) => s + j.durationSeconds, 0) / journals.length)
        : 0;
    const moods = moodCounts(journals);
    const summary =
      journals.length === 0
        ? `No Voice Journal entries for ${name} in ${bounds.label.toLowerCase()}.`
        : attention > 0
          ? `${journals.length} journal${journals.length === 1 ? "" : "s"} recorded; ${attention} flagged for attention.`
          : `${journals.length} calm journal entries for ${name} — themes look steady.`;

    const timeline: ReportTimelineItem[] = journals.slice(0, 12).map((j) => ({
      id: j.id,
      title: j.aiSummary.slice(0, 72) + (j.aiSummary.length > 72 ? "…" : ""),
      time: format(parseISO(j.recordedAt), "d MMM · h:mm a"),
      description: `${j.mood} · ${j.themes.join(", ") || "No themes"}`,
      kind: "voice_journal",
    }));

    const tableRows = journals.map((j) => ({
      Date: format(parseISO(j.recordedAt), "yyyy-MM-dd HH:mm"),
      Mood: j.mood,
      DurationSec: j.durationSeconds,
      Themes: j.themes.join("; "),
      Summary: j.aiSummary,
      Attention: j.attentionFlag ? "yes" : "no",
      Transcript: j.transcriptPreview,
    }));

    return {
      kind,
      title: "Voice Journal report",
      summary,
      rangeLabel: bounds.label,
      from: bounds.from,
      to: bounds.to,
      lovedOne,
      metrics: [
        { label: "Entries", value: journals.length },
        { label: "Avg length", value: `${avgDuration}s` },
        { label: "Attention flags", value: attention },
        { label: "Top mood", value: moods[0]?.name ?? "—" },
      ],
      trendSeries,
      statusPie: [],
      barSeries: moods.map((m) => ({ label: m.name, value: m.value })),
      moodPie: moods,
      timeline,
      tableRows,
      csvHeaders: ["Date", "Mood", "DurationSec", "Themes", "Summary", "Attention", "Transcript"],
      snapshotMetrics: {
        entries: journals.length,
        attentionFlags: attention,
        avgDurationSeconds: avgDuration,
      },
    };
  }

  if (kind === "sos") {
    const resolved = sosEvents.filter((e) => e.status === "resolved");
    const active = sosEvents.filter((e) => e.status === "active" || e.status === "acknowledged");
    const avgResponse =
      resolved.length > 0
        ? Math.round(
            resolved.reduce((sum, e) => sum + (e.averageResponseMinutes ?? 5), 0) / resolved.length,
          )
        : 0;
    const summary =
      sosEvents.length === 0
        ? `No SOS events for ${name} in ${bounds.label.toLowerCase()}.`
        : active.length > 0
          ? `${active.length} SOS still needs attention for ${name}.`
          : `${sosEvents.length} SOS event${sosEvents.length === 1 ? "" : "s"} in range; average response ${avgResponse} min.`;

    const timeline: ReportTimelineItem[] = sosEvents.slice(0, 12).map((e) => ({
      id: e.id,
      title: `SOS · ${e.status}`,
      time: format(parseISO(e.triggeredAt), "d MMM · h:mm a"),
      description:
        e.resolutionNotes ||
        `Responders: ${e.responders.join(", ") || "—"} · Channel: ${e.triggerChannel}`,
      kind: "sos",
    }));

    const byDay = trendSeries.map((p, i) => {
      const step = Math.max(1, Math.ceil((differenceInCalendarDays(bounds.to, bounds.from) + 1) / trendSeries.length));
      const dayFrom = startOfDay(addDays(bounds.from, i * (differenceInCalendarDays(bounds.to, bounds.from) + 1 > 45 ? 31 : step)));
      const dayTo = endOfDay(
        differenceInCalendarDays(bounds.to, bounds.from) + 1 > 45
          ? endOfMonth(dayFrom)
          : addDays(dayFrom, step - 1),
      );
      return {
        label: p.label,
        value: sosEvents.filter((e) => inRange(e.triggeredAt, dayFrom, dayTo)).length,
      };
    });

    const tableRows = sosEvents.map((e) => ({
      Triggered: format(parseISO(e.triggeredAt), "yyyy-MM-dd HH:mm"),
      Status: e.status,
      Channel: e.triggerChannel,
      Responders: e.responders.join("; "),
      ResponseMinutes: e.averageResponseMinutes ?? "",
      Resolved: e.resolvedAt ? format(parseISO(e.resolvedAt), "yyyy-MM-dd HH:mm") : "",
      Notes: e.resolutionNotes ?? "",
    }));

    return {
      kind,
      title: "SOS report",
      summary,
      rangeLabel: bounds.label,
      from: bounds.from,
      to: bounds.to,
      lovedOne,
      metrics: [
        { label: "Events", value: sosEvents.length },
        { label: "Active", value: active.length },
        { label: "Resolved", value: resolved.length },
        { label: "Avg response", value: avgResponse ? `${avgResponse} min` : "—" },
      ],
      trendSeries,
      statusPie: sosStatusSeries(sosEvents),
      barSeries: byDay,
      moodPie: [],
      timeline,
      tableRows,
      csvHeaders: [
        "Triggered",
        "Status",
        "Channel",
        "Responders",
        "ResponseMinutes",
        "Resolved",
        "Notes",
      ],
      snapshotMetrics: {
        events: sosEvents.length,
        active: active.length,
        resolved: resolved.length,
        avgResponseMinutes: avgResponse,
      },
    };
  }

  // overall wellbeing
  const medPct = adherence(med);
  const foodPct = adherence(food);
  const healthPct = adherence(health);
  const overallPct = Math.round((medPct + foodPct + healthPct) / 3);
  const all = [...med, ...food, ...health];
  const breakdown = statusBreakdown(all);
  const summary =
    sosEvents.some((e) => e.status === "active" || e.status === "acknowledged")
      ? `Overall routines for ${name} are mixed, and an SOS still needs attention.`
      : overallPct >= 85
        ? `${name}'s combined wellbeing looks calm and reassuring across ${bounds.label.toLowerCase()}.`
        : `${name}'s overall adherence is ${overallPct}% — worth a gentle check on weaker routines.`;

  const timeline: ReportTimelineItem[] = [
    ...all.map((item) => ({
      id: item.id,
      title: checkInTitle(item, store),
      time: format(parseISO(item.scheduledAt), "d MMM · h:mm a"),
      description: item.routineKind,
      status: item.status,
      kind: item.routineKind,
      sort: +parseISO(item.scheduledAt),
    })),
    ...sosEvents.map((e) => ({
      id: e.id,
      title: `SOS · ${e.status}`,
      time: format(parseISO(e.triggeredAt), "d MMM · h:mm a"),
      description: e.resolutionNotes || e.triggerChannel,
      kind: "sos",
      sort: +parseISO(e.triggeredAt),
    })),
    ...journals.map((j) => ({
      id: j.id,
      title: "Voice Journal",
      time: format(parseISO(j.recordedAt), "d MMM · h:mm a"),
      description: j.aiSummary.slice(0, 80),
      kind: "voice_journal",
      sort: +parseISO(j.recordedAt),
    })),
  ]
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 14)
    .map(({ sort, ...rest }) => {
      void sort;
      return rest;
    });

  const tableRows = [
    { Area: "Medication", Adherence: medPct, Taken: statusBreakdown(med).taken, Missed: statusBreakdown(med).missed },
    { Area: "Meals", Adherence: foodPct, Taken: statusBreakdown(food).taken, Missed: statusBreakdown(food).missed },
    { Area: "Health", Adherence: healthPct, Taken: statusBreakdown(health).taken, Missed: statusBreakdown(health).missed },
    { Area: "SOS events", Adherence: "", Taken: sosEvents.length, Missed: sosEvents.filter((e) => e.status === "active").length },
    { Area: "Voice journals", Adherence: "", Taken: journals.length, Missed: journals.filter((j) => j.attentionFlag).length },
  ];

  return {
    kind,
    title: meta.label + " report",
    summary,
    rangeLabel: bounds.label,
    from: bounds.from,
    to: bounds.to,
    lovedOne,
    metrics: [
      { label: "Overall", value: `${overallPct}%`, hint: "Combined adherence" },
      { label: "Medication", value: `${medPct}%` },
      { label: "Meals", value: `${foodPct}%` },
      { label: "Health", value: `${healthPct}%` },
      { label: "SOS", value: sosEvents.length },
      { label: "Journals", value: journals.length },
    ],
    adherencePercent: overallPct,
    trendSeries,
    statusPie: [
      { name: "Taken", value: breakdown.taken, fill: "#5C8C6B" },
      { name: "Delayed", value: breakdown.delayed, fill: "#E3A23C" },
      { name: "Missed", value: breakdown.missed, fill: "#B8433A" },
      { name: "Pending", value: breakdown.pending, fill: "#4A6D7C" },
    ].filter((p) => p.value > 0),
    barSeries: [
      { label: "Medication", value: medPct },
      { label: "Meals", value: foodPct },
      { label: "Health", value: healthPct },
    ],
    moodPie: moodCounts(journals),
    timeline,
    tableRows,
    csvHeaders: ["Area", "Adherence", "Taken", "Missed"],
    snapshotMetrics: {
      overall: overallPct,
      medication: medPct,
      meals: foodPct,
      health: healthPct,
      sos: sosEvents.length,
      journals: journals.length,
      checkIns: all.length,
    },
  };
}
