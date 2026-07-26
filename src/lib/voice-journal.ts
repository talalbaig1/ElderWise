import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import type { ElderWiseStore, MoodTag, VoiceJournalEntry } from "@/types";

export const MOOD_META: Record<
  MoodTag,
  { label: string; score: number; color: string; description: string }
> = {
  positive: {
    label: "Positive",
    score: 5,
    color: "#5C8C6B",
    description: "Warm, upbeat tone",
  },
  calm: {
    label: "Calm",
    score: 4,
    color: "#1F4B45",
    description: "Steady and settled",
  },
  neutral: {
    label: "Neutral",
    score: 3,
    color: "#4A6D7C",
    description: "Even, matter-of-fact",
  },
  tired: {
    label: "Tired",
    score: 2,
    color: "#E3A23C",
    description: "Low energy or fatigue",
  },
  lonely: {
    label: "Lonely",
    score: 2,
    color: "#8B6B9E",
    description: "Missing company or connection",
  },
  concerned: {
    label: "Concerned",
    score: 1,
    color: "#B8433A",
    description: "Worry or unease worth a check-in",
  },
};

export const ALL_MOODS = Object.keys(MOOD_META) as MoodTag[];

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.round(seconds % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fullTranscript(entry: VoiceJournalEntry) {
  return entry.transcript?.trim() || entry.transcriptPreview;
}

export function filterJournals(
  entries: VoiceJournalEntry[],
  opts: {
    lovedOneId?: string | "all";
    mood?: MoodTag | "all";
    query?: string;
    attentionOnly?: boolean;
    from?: Date;
    to?: Date;
  },
) {
  const q = opts.query?.trim().toLowerCase() ?? "";
  return entries
    .filter((e) => {
      if (opts.lovedOneId && opts.lovedOneId !== "all" && e.lovedOneId !== opts.lovedOneId) {
        return false;
      }
      if (opts.mood && opts.mood !== "all" && e.mood !== opts.mood) return false;
      if (opts.attentionOnly && !e.attentionFlag) return false;
      if (opts.from || opts.to) {
        const at = parseISO(e.recordedAt);
        if (opts.from && at < opts.from) return false;
        if (opts.to && at > opts.to) return false;
      }
      if (!q) return true;
      const hay = [
        e.aiSummary,
        e.transcriptPreview,
        e.transcript ?? "",
        e.mood,
        ...e.themes,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => +parseISO(b.recordedAt) - +parseISO(a.recordedAt));
}

export function buildMoodTrend(entries: VoiceJournalEntry[], days = 30) {
  const from = subDays(new Date(), days - 1);
  const map = new Map<string, { scores: number[]; count: number }>();

  for (let i = 0; i < days; i++) {
    const d = format(addDays(from, i), "yyyy-MM-dd");
    map.set(d, { scores: [], count: 0 });
  }

  entries.forEach((e) => {
    const key = format(parseISO(e.recordedAt), "yyyy-MM-dd");
    const bucket = map.get(key);
    if (!bucket) return;
    bucket.scores.push(MOOD_META[e.mood].score);
    bucket.count += 1;
  });

  return Array.from(map.entries()).map(([date, bucket]) => {
    const avg =
      bucket.scores.length > 0
        ? Number(
            (bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length).toFixed(2),
          )
        : null;
    return {
      date,
      label: format(parseISO(date), days > 14 ? "d MMM" : "EEE"),
      score: avg,
      entries: bucket.count,
    };
  });
}

export function buildWeeklySummary(entries: VoiceJournalEntry[], weeks = 8) {
  const result: { label: string; entries: number; avgScore: number; attention: number }[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const ref = subDays(now, i * 7);
    const from = startOfWeek(ref, { weekStartsOn: 1 });
    const to = endOfWeek(ref, { weekStartsOn: 1 });
    const inWeek = entries.filter((e) => {
      const at = parseISO(e.recordedAt);
      return at >= from && at <= to;
    });
    const avg =
      inWeek.length > 0
        ? inWeek.reduce((s, e) => s + MOOD_META[e.mood].score, 0) / inWeek.length
        : 0;
    result.push({
      label: format(from, "d MMM"),
      entries: inWeek.length,
      avgScore: Number(avg.toFixed(2)),
      attention: inWeek.filter((e) => e.attentionFlag).length,
    });
  }
  return result;
}

export function buildMonthlySummary(entries: VoiceJournalEntry[], months = 6) {
  const result: { label: string; entries: number; avgScore: number; attention: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    const inMonth = entries.filter((e) => {
      const at = parseISO(e.recordedAt);
      return at >= from && at <= to;
    });
    const avg =
      inMonth.length > 0
        ? inMonth.reduce((s, e) => s + MOOD_META[e.mood].score, 0) / inMonth.length
        : 0;
    result.push({
      label: format(from, "MMM"),
      entries: inMonth.length,
      avgScore: Number(avg.toFixed(2)),
      attention: inMonth.filter((e) => e.attentionFlag).length,
    });
  }
  return result;
}

export function moodDistribution(entries: VoiceJournalEntry[]) {
  const counts: Record<MoodTag, number> = {
    positive: 0,
    calm: 0,
    neutral: 0,
    tired: 0,
    lonely: 0,
    concerned: 0,
  };
  entries.forEach((e) => {
    counts[e.mood] += 1;
  });
  return ALL_MOODS.filter((m) => counts[m] > 0).map((mood) => ({
    name: MOOD_META[mood].label,
    mood,
    value: counts[mood],
    fill: MOOD_META[mood].color,
  }));
}

export function journalStats(entries: VoiceJournalEntry[]) {
  if (entries.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      attention: 0,
      topMood: null as MoodTag | null,
      avgScore: 0,
    };
  }
  const avgDuration = Math.round(
    entries.reduce((s, e) => s + e.durationSeconds, 0) / entries.length,
  );
  const attention = entries.filter((e) => e.attentionFlag).length;
  const dist = moodDistribution(entries);
  const topMood = dist.sort((a, b) => b.value - a.value)[0]?.mood ?? null;
  const avgScore =
    entries.reduce((s, e) => s + MOOD_META[e.mood].score, 0) / entries.length;
  return {
    count: entries.length,
    avgDuration,
    attention,
    topMood,
    avgScore: Number(avgScore.toFixed(2)),
  };
}

export function applyJournalToStore(
  store: ElderWiseStore,
  entry: VoiceJournalEntry,
  isNew: boolean,
): ElderWiseStore {
  const voiceJournals = isNew
    ? [entry, ...store.voiceJournals]
    : store.voiceJournals.map((j) => (j.id === entry.id ? entry : j));

  const notifications = isNew
    ? [
        {
          id: uid("n"),
          lovedOneId: entry.lovedOneId,
          category: "routine" as const,
          title: entry.attentionFlag ? "Voice Journal needs attention" : "New Voice Journal",
          body: entry.aiSummary.slice(0, 120),
          createdAt: entry.recordedAt,
          read: false,
          href: "/voice-journal",
        },
        ...store.notifications,
      ]
    : store.notifications;

  return {
    ...store,
    voiceJournals,
    notifications,
    selectedLovedOneId: entry.lovedOneId,
  };
}
