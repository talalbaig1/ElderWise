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
import { formatInTimeZone } from "@/lib/time/display";
import {
  checkInStatusBreakdown,
  formatCheckInStatus,
  adherenceCompositionPie,
  adherencePieExcludedCaption,
} from "@/lib/check-in-status";

function fmtEvent(iso: string, viewerTimeZone: string) {
  return formatInTimeZone(iso, viewerTimeZone, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtTable(iso: string, viewerTimeZone: string) {
  return formatInTimeZone(iso, viewerTimeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

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
    description: "Scheduled doses and responses",
    storeType: "medication",
  },
  {
    id: "meals",
    label: "Food",
    description: "Meal check-ins and responses",
    storeType: "food",
  },
  {
    id: "health",
    label: "Wellness",
    description: "Health and wellness check-ins",
    storeType: "health",
  },
  {
    id: "sos",
    label: "SOS",
    description: "SOS events and resolutions",
    storeType: "sos",
  },
];

/** PDF API kinds — maps UI ReportKind to /api/reports/pdf kind. */
export function reportKindToPdfKind(
  kind: ReportKind,
): "medication" | "food" | "wellness" | "sos" | null {
  switch (kind) {
    case "medication":
      return "medication";
    case "meals":
      return "food";
    case "health":
      return "wellness";
    case "sos":
      return "sos";
    default:
      return null;
  }
}

export function reportKindToStoreType(kind: ReportKind): ReportType {
  return (
    REPORT_KIND_META.find((m) => m.id === kind)?.storeType ?? "medication"
  );
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
  if (takenOrMissed.length === 0) return null;
  const good = scored.filter((i) => i.status === "taken" || i.status === "delayed").length;
  return Math.round((good / scored.length) * 100);
}

function statusBreakdown(items: CheckInResponse[]) {
  return checkInStatusBreakdown(items);
}

function filterCheckIns(
  store: ElderWiseStore,
  lovedOneId: string,
  kind: CheckInResponse["routineKind"],
  from: Date,
  to: Date,
) {
  // Facts only — never invent check-ins for empty ranges (same defect as 100% on no data).
  return store.checkIns.filter(
    (c) =>
      c.lovedOneId === lovedOneId &&
      c.routineKind === kind &&
      inRange(c.scheduledAt, from, to),
  );
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

  // No check-ins in range → empty series (do not plot flat 0% as if it were data).
  if (med.length + food.length + health.length === 0) return [];

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

    const slice = (items: CheckInResponse[]) => {
      const dayItems = items.filter((c) => inRange(c.scheduledAt, dayFrom, dayTo));
      return adherence(dayItems);
    };

    return {
      label,
      medication: slice(med) ?? 0,
      meals: slice(food) ?? 0,
      health: slice(health) ?? 0,
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
  /** Present when statusPie is adherence composition (not SOS / mood). */
  statusPieExcludedCaption?: string;
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
  viewerTimeZone = "UTC",
): ReportModel {
  const bounds = getReportRangeBounds(preset, customFrom, customTo);
  const med = filterCheckIns(store, lovedOne.id, "medication", bounds.from, bounds.to);
  const food = filterCheckIns(store, lovedOne.id, "food", bounds.from, bounds.to);
  const health = filterCheckIns(store, lovedOne.id, "health", bounds.from, bounds.to);
  const trendSeries = buildTrendSeries(lovedOne.id, med, food, health, bounds.from, bounds.to);

  const journals = store.voiceJournals
    .filter((j) => j.lovedOneId === lovedOne.id && inRange(j.recordedAt, bounds.from, bounds.to))
    .sort((a, b) => +parseISO(b.recordedAt) - +parseISO(a.recordedAt));

  const sosEvents = store.sosEvents
    .filter((e) => e.lovedOneId === lovedOne.id && inRange(e.triggeredAt, bounds.from, bounds.to))
    .sort((a, b) => +parseISO(b.triggeredAt) - +parseISO(a.triggeredAt));

  const meta = REPORT_KIND_META.find((m) => m.id === kind)!;
  const name = `${lovedOne.firstName} ${lovedOne.lastName}`;

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
      pct == null
        ? `No completed ${kind === "meals" ? "meal" : kind} check-ins for ${name} in ${bounds.label.toLowerCase()}.`
        : pct >= 90
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
        time: fmtEvent(item.scheduledAt, viewerTimeZone),
        description: item.notes || `Channel: ${item.channel}`,
        status: item.status,
        kind: item.routineKind,
      }));

    const tableRows = items.map((item) => ({
      Date: fmtTable(item.scheduledAt, viewerTimeZone),
      Routine: checkInTitle(item, store),
      Status: formatCheckInStatus(item.status),
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
        { label: "Adherence", value: pct == null ? "—" : `${pct}%`, hint: bounds.label },
        { label: "Taken", value: breakdown.taken },
        { label: "Delayed", value: breakdown.delayed },
        { label: "Missed", value: breakdown.missed },
      ],
      adherencePercent: pct ?? undefined,
      trendSeries,
      statusPie: adherenceCompositionPie(breakdown),
      statusPieExcludedCaption: adherencePieExcludedCaption(breakdown),
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
        adherence: pct ?? "—",
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
      time: fmtEvent(j.recordedAt, viewerTimeZone),
      description: `${j.mood} · ${j.themes.join(", ") || "No themes"}`,
      kind: "voice_journal",
    }));

    const tableRows = journals.map((j) => ({
      Date: fmtTable(j.recordedAt, viewerTimeZone),
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
    const summary =
      sosEvents.length === 0
        ? `No SOS events for ${name} in ${bounds.label.toLowerCase()}.`
        : active.length > 0
          ? `${active.length} SOS still needs attention for ${name}.`
          : `${sosEvents.length} SOS event${sosEvents.length === 1 ? "" : "s"} in range; ${resolved.length} resolved.`;

    const timeline: ReportTimelineItem[] = sosEvents.slice(0, 12).map((e) => ({
      id: e.id,
      title: `SOS · ${e.status}`,
      time: fmtEvent(e.triggeredAt, viewerTimeZone),
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
      Triggered: fmtTable(e.triggeredAt, viewerTimeZone),
      Status: e.status,
      Channel: e.triggerChannel,
      Responders: e.responders.join("; "),
      Resolved: e.resolvedAt ? fmtTable(e.resolvedAt, viewerTimeZone) : "",
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
        "Resolved",
        "Notes",
      ],
      snapshotMetrics: {
        events: sosEvents.length,
        active: active.length,
        resolved: resolved.length,
      },
    };
  }

  // overall wellbeing
  const medPct = adherence(med);
  const foodPct = adherence(food);
  const healthPct = adherence(health);
  const scored = [medPct, foodPct, healthPct].filter((n): n is number => n != null);
  const overallPct =
    scored.length > 0
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;
  const all = [...med, ...food, ...health];
  const breakdown = statusBreakdown(all);
  const summary =
    sosEvents.some((e) => e.status === "active" || e.status === "acknowledged")
      ? `Overall routines for ${name} are mixed, and an SOS still needs attention.`
      : overallPct == null
        ? `No scored check-ins for ${name} in ${bounds.label.toLowerCase()}.`
        : overallPct >= 85
          ? `${name}'s combined wellbeing looks calm and reassuring across ${bounds.label.toLowerCase()}.`
          : `${name}'s overall adherence is ${overallPct}% — worth a gentle check on weaker routines.`;

  const timeline: ReportTimelineItem[] = [
    ...all.map((item) => ({
      id: item.id,
      title: checkInTitle(item, store),
      time: fmtEvent(item.scheduledAt, viewerTimeZone),
      description: item.routineKind,
      status: item.status,
      kind: item.routineKind,
      sort: +parseISO(item.scheduledAt),
    })),
    ...sosEvents.map((e) => ({
      id: e.id,
      title: `SOS · ${e.status}`,
      time: fmtEvent(e.triggeredAt, viewerTimeZone),
      description: e.resolutionNotes || e.triggerChannel,
      kind: "sos",
      sort: +parseISO(e.triggeredAt),
    })),
    ...journals.map((j) => ({
      id: j.id,
      title: "Voice Journal",
      time: fmtEvent(j.recordedAt, viewerTimeZone),
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
    { Area: "Medication", Adherence: medPct ?? "—", Taken: statusBreakdown(med).taken, Missed: statusBreakdown(med).missed },
    { Area: "Meals", Adherence: foodPct ?? "—", Taken: statusBreakdown(food).taken, Missed: statusBreakdown(food).missed },
    { Area: "Health", Adherence: healthPct ?? "—", Taken: statusBreakdown(health).taken, Missed: statusBreakdown(health).missed },
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
      { label: "Overall", value: overallPct == null ? "—" : `${overallPct}%`, hint: "Combined adherence" },
      { label: "Medication", value: medPct == null ? "—" : `${medPct}%` },
      { label: "Meals", value: foodPct == null ? "—" : `${foodPct}%` },
      { label: "Health", value: healthPct == null ? "—" : `${healthPct}%` },
      { label: "SOS", value: sosEvents.length },
      { label: "Journals", value: journals.length },
    ],
    adherencePercent: overallPct ?? undefined,
    trendSeries,
    statusPie: adherenceCompositionPie(breakdown),
    statusPieExcludedCaption: adherencePieExcludedCaption(breakdown),
    barSeries: [
      { label: "Medication", value: medPct ?? 0 },
      { label: "Meals", value: foodPct ?? 0 },
      { label: "Health", value: healthPct ?? 0 },
    ],
    moodPie: moodCounts(journals),
    timeline,
    tableRows,
    csvHeaders: ["Area", "Adherence", "Taken", "Missed"],
    snapshotMetrics: {
      overall: overallPct ?? "—",
      medication: medPct ?? "—",
      meals: foodPct ?? "—",
      health: healthPct ?? "—",
      sos: sosEvents.length,
      journals: journals.length,
      checkIns: all.length,
    },
  };
}
