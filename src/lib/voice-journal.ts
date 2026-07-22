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

const DEMO_SCRIPTS: {
  mood: MoodTag;
  themes: string[];
  preview: string;
  transcript: string;
  summary: (name: string) => string;
  attention?: boolean;
  duration: number;
}[] = [
  {
    mood: "calm",
    themes: ["garden", "evening", "tea"],
    preview: "I sat with my tea and watched the light change in the garden…",
    transcript:
      "I sat with my tea and watched the light change in the garden. The air felt cooler today. I am a little tired, but it is a peaceful tired. Tomorrow I will water the plants again.",
    summary: (name) =>
      `${name} sounded settled and reflective. Evening tea and the garden came up — a calm, grounded check-in.`,
    duration: 88,
  },
  {
    mood: "positive",
    themes: ["family", "call", "lunch"],
    preview: "My daughter called after lunch and we laughed about old stories…",
    transcript:
      "My daughter called after lunch and we laughed about old stories from when the children were small. It made the afternoon feel warmer. I ate properly today and feel content.",
    summary: (name) =>
      `${name} shared a warm family call after lunch. Tone was bright and socially connected.`,
    duration: 76,
  },
  {
    mood: "tired",
    themes: ["sleep", "night", "rest"],
    preview: "Sleep was lighter than usual. I woke twice before morning…",
    transcript:
      "Sleep was lighter than usual. I woke twice before morning and found it hard to settle again. I will rest a little after breakfast if I can.",
    summary: (name) =>
      `${name} described lighter sleep with two night wakings. Tone stayed thoughtful — worth a gentle follow-up on rest.`,
    attention: true,
    duration: 102,
  },
  {
    mood: "lonely",
    themes: ["quiet", "afternoon", "neighbours"],
    preview: "The house felt quiet this afternoon. The neighbours were out…",
    transcript:
      "The house felt quiet this afternoon. The neighbours were out and the television did not interest me. I would like someone to visit for a short while.",
    summary: (name) =>
      `${name} mentioned a quiet afternoon and a wish for company. Soft loneliness signal — a call or Local Buddy visit may help.`,
    attention: true,
    duration: 95,
  },
  {
    mood: "concerned",
    themes: ["medication", "dizziness", "morning"],
    preview: "After my morning tablet I felt a little dizzy for a few minutes…",
    transcript:
      "After my morning tablet I felt a little dizzy for a few minutes. It passed when I sat down. I am not sure if it is the medicine or if I stood up too quickly.",
    summary: (name) =>
      `${name} reported brief dizziness after morning medication. Not clinical advice — Care Partner may want to note it for the Family Doctor.`,
    attention: true,
    duration: 110,
  },
  {
    mood: "neutral",
    themes: ["routine", "walk", "market"],
    preview: "I went to the market as usual and came back without much to report…",
    transcript:
      "I went to the market as usual and came back without much to report. The walk was fine. Nothing special happened today, which is also alright.",
    summary: (name) =>
      `${name} shared a straightforward routine day — market walk, nothing notable. Steady neutral tone.`,
    duration: 64,
  },
  {
    mood: "positive",
    themes: ["music", "memory", "radio"],
    preview: "An old song came on the radio and I remembered dancing in the kitchen…",
    transcript:
      "An old song came on the radio and I remembered dancing in the kitchen years ago. It made me smile. I hummed along while folding the laundry.",
    summary: (name) =>
      `${name} lit up remembering music and kitchen dancing. Positive, nostalgic mood with good energy.`,
    duration: 81,
  },
  {
    mood: "calm",
    themes: ["prayer", "morning", "gratitude"],
    preview: "This morning felt gentle. I said a quiet prayer and felt thankful…",
    transcript:
      "This morning felt gentle. I said a quiet prayer and felt thankful for a safe night. Breakfast was simple and the light through the window was soft.",
    summary: (name) =>
      `${name} opened with gratitude and a gentle morning. Calm spiritual tone — reassuring for the Care Circle.`,
    duration: 70,
  },
];

export function createDemoJournalEntry(
  store: ElderWiseStore,
  lovedOneId: string,
): VoiceJournalEntry {
  const lovedOne = store.lovedOnes.find((lo) => lo.id === lovedOneId);
  const name = lovedOne?.firstName ?? "Loved One";
  const script = DEMO_SCRIPTS[Math.floor(Math.random() * DEMO_SCRIPTS.length)];
  const now = new Date().toISOString();

  return {
    id: uid("vj"),
    lovedOneId,
    recordedAt: now,
    durationSeconds: script.duration + Math.floor(Math.random() * 20),
    transcriptPreview: script.preview,
    transcript: script.transcript,
    aiSummary: script.summary(name),
    mood: script.mood,
    themes: [...script.themes],
    attentionFlag: script.attention,
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
