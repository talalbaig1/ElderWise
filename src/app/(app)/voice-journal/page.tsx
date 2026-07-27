"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format, formatDistanceToNow, parseISO, subDays } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronDown, Mic, Sparkles } from "lucide-react";
import { VoiceAudioPlayer } from "@/components/voice-journal/audio-player";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  filterJournals,
  formatDuration,
  fullTranscript,
  journalStats,
} from "@/lib/voice-journal";
import { useDomainStore } from "@/components/data/app-data-provider";
import { formatInTimeZone, formatViewerDateTime } from "@/lib/time/display";
import { cn } from "@/lib/utils";

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function monthAgoStr() {
  return format(subDays(new Date(), 30), "yyyy-MM-dd");
}

export default function VoiceJournalPage() {
  const { store, lovedOne: selectedLovedOne, setSelectedLovedOneId, hydrated, viewerTimeZone } =
    useDomainStore();
  const reduceMotion = useReducedMotion();

  const [lovedOneFilter, setLovedOneFilter] = useState<string>("selected");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [startDate, setStartDate] = useState(monthAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const scopeLovedOneId =
    lovedOneFilter === "all"
      ? "all"
      : lovedOneFilter === "selected"
        ? selectedLovedOne?.id
        : lovedOneFilter;

  const dateBounds = useMemo(() => {
    if (!startDate || !endDate) return { from: undefined, to: undefined };
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T23:59:59`);
    return from <= to ? { from, to } : { from: to, to: from };
  }, [startDate, endDate]);

  const filtered = useMemo(
    () =>
      filterJournals(store.voiceJournals, {
        lovedOneId: scopeLovedOneId,
        attentionOnly,
        from: dateBounds.from,
        to: dateBounds.to,
      }),
    [store.voiceJournals, scopeLovedOneId, attentionOnly, dateBounds],
  );

  const selected =
    filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const stats = useMemo(() => journalStats(filtered), [filtered]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  const lovedOneName = (id: string) => {
    const lo = store.lovedOnes.find((l) => l.id === id);
    return lo ? `${lo.firstName} ${lo.lastName}` : "Loved One";
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-primary">Voice Journal</p>
          {/* TODO(v2 / Could-have C2): live journaling is out of MVP — table exists; message path does not populate it yet (FR-DB-6). */}
          <Badge variant="secondary" className="font-mono">
            Preview
          </Badge>
        </div>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">
          Recordings & summaries
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Listen to recordings, read AI summaries and transcripts when voice journals are available.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Loved One</Label>
            <Select
              value={lovedOneFilter}
              onValueChange={(value) => {
                setLovedOneFilter(value);
                if (value !== "all" && value !== "selected") {
                  setSelectedLovedOneId(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">
                  Selected · {selectedLovedOne ? selectedLovedOne.firstName : "—"}
                </SelectItem>
                <SelectItem value="all">All Loved Ones</SelectItem>
                {store.lovedOnes.map((lo) => (
                  <SelectItem key={lo.id} value={lo.id}>
                    {lo.firstName} {lo.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vj-start-date">Start date</Label>
            <Input
              id="vj-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vj-end-date">End date</Label>
            <Input
              id="vj-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Attention flags</p>
              <p className="text-xs text-muted-foreground">Show flagged entries only</p>
            </div>
            <Switch checked={attentionOnly} onCheckedChange={setAttentionOnly} />
          </div>
        </CardContent>
      </Card>

      {/* Stats — entries + attention only */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Entries" value={stats.count} />
        <StatCard
          label="Attention flags"
          value={stats.attention}
          warn={stats.attention > 0}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No journal entries"
          description="Voice journals will appear here when the message path records them. Nothing is seeded for demo."
        />
      ) : (
        <div className="space-y-4">
          {/* Entry detail first — recordings, summaries, transcripts */}
          {selected ? (
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.attentionFlag ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Needs attention
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {formatDuration(selected.durationSeconds)}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 font-display text-2xl">
                      {lovedOneName(selected.lovedOneId)}
                    </CardTitle>
                    <CardDescription>
                      {formatInTimeZone(selected.recordedAt, viewerTimeZone, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      ·{" "}
                      {formatDistanceToNow(parseISO(selected.recordedAt), { addSuffix: true })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <VoiceAudioPlayer
                  entryId={selected.id}
                  durationSeconds={selected.durationSeconds}
                  audioUrl={selected.audioUrl}
                />

                <section className="rounded-2xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI summary
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {selected.aiSummary}
                  </p>
                </section>

                <section className="rounded-2xl border bg-secondary/30 p-4">
                  <p className="mb-2 text-sm font-semibold">Transcript</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {fullTranscript(selected)}
                  </p>
                </section>
              </CardContent>
            </Card>
          ) : null}

          {/* Expandable timeline */}
          <ExpandableCard
            title="Timeline"
            description={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} · newest first`}
            open={timelineOpen}
            onToggle={() => setTimelineOpen((o) => !o)}
          >
            <div className="relative max-h-[70vh] space-y-0 overflow-y-auto pr-1">
              <div className="absolute bottom-4 left-[27px] top-2 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
              <ol>
                {filtered.map((entry, index) => {
                  const active = selected?.id === entry.id;
                  return (
                    <motion.li
                      key={entry.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                      className="relative flex gap-3 pb-3"
                    >
                      <span
                        className={cn(
                          "relative z-10 mt-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-background",
                          entry.attentionFlag ? "bg-sos" : "bg-primary",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(entry.id);
                          setSelectedLovedOneId(entry.lovedOneId);
                        }}
                        className={cn(
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-primary/40 bg-secondary/80"
                            : "border-border bg-card hover:border-primary/25",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {lovedOneName(entry.lovedOneId)}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {formatViewerDateTime(entry.recordedAt, viewerTimeZone)}
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {formatDuration(entry.durationSeconds)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {entry.aiSummary}
                        </p>
                        {entry.attentionFlag ? (
                          <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-sos">
                            <AlertTriangle className="h-3 w-3" />
                            Attention
                          </span>
                        ) : null}
                      </button>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          </ExpandableCard>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <Card className={cn(warn && "border-sos/30 bg-sos-soft/30")}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ExpandableCard({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && !open ? (
            <CardDescription className="mt-0.5">{description}</CardDescription>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <CardContent className="border-t pt-4">
          {description ? (
            <p className="mb-3 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
