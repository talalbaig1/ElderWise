"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, parseISO, subDays } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  Clock3,
  HeartPulse,
  Mic,
  Pill,
  Siren,
  Utensils,
} from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { ConsentStatusBadge } from "@/components/shared/consent-status-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { AddLovedOneButton } from "@/components/loved-ones/add-loved-one-button";
import { StatusPieChart } from "@/components/dashboard/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  buildDashboardModel,
  getCustomRangeBounds,
  greetingForHour,
} from "@/lib/dashboard-analytics";
import {
  useDomainStore,
} from "@/components/data/app-data-provider";
import { formatInTimeZone } from "@/lib/time/display";
import { cn } from "@/lib/utils";

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function weekAgoStr() {
  return format(subDays(new Date(), 6), "yyyy-MM-dd");
}

export default function DashboardPage() {
  const router = useRouter();
  const { store, lovedOne, setSelectedLovedOneId, hydrated, viewerTimeZone } =
    useDomainStore();
  const unread = store.notifications.filter((n) => !n.read).length;
  const reduce = useReducedMotion();

  const [startDate, setStartDate] = useState(weekAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    timeline: false,
    notifications: false,
    reminders: false,
  });

  const model = useMemo(() => {
    if (!lovedOne || !startDate || !endDate) return null;
    let bounds = getCustomRangeBounds(
      startDate,
      endDate,
      startTime,
      endTime,
      viewerTimeZone,
    );
    if (bounds.to < bounds.from) {
      bounds = getCustomRangeBounds(
        endDate,
        startDate,
        endTime,
        startTime,
        viewerTimeZone,
      );
    }
    return buildDashboardModel(store, lovedOne, bounds, viewerTimeZone);
  }, [store, lovedOne, startDate, endDate, startTime, endTime, viewerTimeZone]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-secondary" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (!lovedOne) {
    return (
      <EmptyState
        title="No Loved One yet"
        description="Add someone you care for to see wellbeing, routines, and SOS on your dashboard."
        actionLabel="Add Loved One"
        onAction={() => router.push("/loved-ones")}
      />
    );
  }

  if (!model) {
    return (
      <EmptyState
        title="Choose a date range"
        description="Select a start and end date to load the dashboard."
      />
    );
  }

  const careName = store.carePartner?.firstName ?? "there";
  const greeting = greetingForHour(new Date(), viewerTimeZone);

  const togglePanel = (key: string) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      {/* Header — single Loved One dropdown next to greeting */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {formatInTimeZone(new Date(), viewerTimeZone, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {" · "}
            {viewerTimeZone}
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
            {greeting}, {careName}.
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Here is how{" "}
            <span className="font-semibold text-foreground">{lovedOne.firstName}</span> is
            doing · {model.wellbeingMessage}
          </p>
          <div className="mt-3">
            <ConsentStatusBadge lovedOne={lovedOne} viewerTimeZone={viewerTimeZone} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={lovedOne.id}
            onValueChange={(id) => setSelectedLovedOneId(id)}
          >
            <SelectTrigger className="w-[200px]" aria-label="Loved One">
              <SelectValue placeholder="Loved One" />
            </SelectTrigger>
            <SelectContent>
              {store.lovedOnes.map((lo) => (
                <SelectItem key={lo.id} value={lo.id}>
                  {lo.firstName} · {lo.relationshipToCarePartner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddLovedOneButton variant="outline" />
          <Button asChild>
            <Link href={`/loved-ones/${lovedOne.id}`}>Edit Care Plan</Link>
          </Button>
        </div>
      </div>

      {/* Custom date + time filter */}
      <div className="rounded-2xl border bg-card/70 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dash-start-date" className="text-xs text-muted-foreground">
              Start date
            </Label>
            <Input
              id="dash-start-date"
              type="date"
              className="w-[160px]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-start-time" className="text-xs text-muted-foreground">
              Start time
            </Label>
            <Input
              id="dash-start-time"
              type="time"
              className="w-[130px]"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-end-date" className="text-xs text-muted-foreground">
              End date
            </Label>
            <Input
              id="dash-end-date"
              type="date"
              className="w-[160px]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-end-time" className="text-xs text-muted-foreground">
              End time
            </Label>
            <Input
              id="dash-end-time"
              type="time"
              className="w-[130px]"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="ml-auto font-mono">
            {model.rangeLabel}
          </Badge>
        </div>
      </div>

      {/* SOS banner — unchanged */}
      {model.activeSos ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.5rem] border border-sos/30 bg-sos-soft p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sos">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sos opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sos" />
                </span>
                <p className="font-semibold">Active SOS · {lovedOne.firstName}</p>
              </div>
              <p className="text-sm text-foreground/80">
                Triggered{" "}
                {formatInTimeZone(model.activeSos.triggeredAt, viewerTimeZone)} ·{" "}
                {model.activeSos.locationPlaceholder || "Location unavailable"} · Status{" "}
                {model.activeSos.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="sos" size="sm" asChild>
                <Link href="/sos">Open SOS</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${lovedOne.whatsappNumber.replace(/\s/g, "")}`}>Call Loved One</a>
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="flex items-center gap-3 rounded-[1.5rem] border border-primary/15 bg-sage/50 px-5 py-4 text-primary">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <p className="text-sm font-semibold">No active emergency alerts</p>
        </div>
      )}

      {/* Overview cards — distinct colors per type */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Medication adherence"
          value={model.medPct == null ? "—" : `${model.medPct}%`}
          subtitle={
            model.medBreakdown.taken + model.medBreakdown.missed === 0
              ? "No data yet"
              : `${model.medBreakdown.taken} taken · ${model.medBreakdown.missed} missed`
          }
          icon={Pill}
          progress={model.medPct ?? undefined}
          tone="medication"
          trend={model.medTrend}
          onClick={() => router.push("/reports")}
        />
        <MetricCard
          title="Meal completion"
          value={model.foodPct == null ? "—" : `${model.foodPct}%`}
          subtitle={
            model.foodBreakdown.taken + model.foodBreakdown.missed === 0
              ? "No data yet"
              : `${model.foodBreakdown.taken} completed · ${model.foodBreakdown.missed} missed`
          }
          icon={Utensils}
          progress={model.foodPct ?? undefined}
          tone="meals"
          trend={model.foodTrend}
          onClick={() => router.push("/reports")}
        />
        <MetricCard
          title="Health check-ins"
          value={model.healthPct == null ? "—" : `${model.healthPct}%`}
          subtitle={
            model.healthBreakdown.taken +
              model.healthBreakdown.missed +
              model.healthBreakdown.pending ===
            0
              ? "No data yet"
              : `${model.healthBreakdown.taken} done · ${model.healthBreakdown.pending} pending`
          }
          icon={HeartPulse}
          progress={model.healthPct ?? undefined}
          tone="health"
          trend={model.healthTrend}
          onClick={() => router.push("/reports")}
        />
        <MetricCard
          title="SOS status"
          value={model.activeSos ? "Active" : "Calm"}
          subtitle={
            model.activeSos
              ? "Open emergency workflow"
              : `${model.sosInRangeCount} in range · ${model.sosTotal} total`
          }
          icon={Siren}
          tone={model.activeSos ? "sos" : "success"}
          onClick={() => router.push("/sos")}
        />
      </div>

      <StatusPieChart data={model.pie} excludedCaption={model.pieExcludedCaption} />

      {/* Voice journal + SOS summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-18px_rgba(31,75,69,0.45)] focus-within:ring-2 focus-within:ring-ring"
          role="link"
          tabIndex={0}
          onClick={() => router.push("/voice-journal")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push("/voice-journal");
            }
          }}
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Voice Journal</CardTitle>
                <CardDescription>Latest reflection · non-clinical summary</CardDescription>
              </div>
              <Mic className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {model.latestJournal ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {model.latestJournal.mood}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatInTimeZone(model.latestJournal.recordedAt, viewerTimeZone)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {model.latestJournal.aiSummary}
                </p>
                <p className="text-xs text-muted-foreground">
                  “{model.latestJournal.transcriptPreview}”
                </p>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/voice-journal");
                  }}
                >
                  View Voice Journal
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No journal entries for {lovedOne.firstName} yet.
                </p>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/voice-journal");
                  }}
                >
                  Open Voice Journal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-18px_rgba(31,75,69,0.45)] focus-within:ring-2 focus-within:ring-ring"
          role="link"
          tabIndex={0}
          onClick={() => router.push("/sos")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push("/sos");
            }
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">SOS summary</CardTitle>
            <CardDescription>Emergency history for this Loved One</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-secondary/60 p-3 text-center">
              <p className="font-mono text-xl font-semibold text-primary" data-metric>
                {model.sosTotal}
              </p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3 text-center">
              <StatusPill
                kind="sos"
                status={model.activeSos ? "active" : "resolved"}
                className="mx-auto"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">State</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expandable sections */}
      <div className="space-y-3">
        <ExpandableCard
          title="Daily timeline"
          description={`Check-ins and responses for ${lovedOne.firstName}`}
          open={openPanels.timeline}
          onToggle={() => togglePanel("timeline")}
        >
          <Timeline
            items={model.timeline.map((item) => ({
              id: item.id,
              title: item.title,
              time: item.time,
              status: item.status,
              responseLabel: item.responseLabel,
              description: item.description,
              icon:
                item.kind === "medication"
                  ? Pill
                  : item.kind === "food"
                    ? Utensils
                    : HeartPulse,
            }))}
          />
        </ExpandableCard>

        <ExpandableCard
          title="Notifications"
          badge={`${unread} unread`}
          open={openPanels.notifications}
          onToggle={() => togglePanel("notifications")}
        >
          <div className="space-y-2">
            {model.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              model.notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => router.push(n.href || "/notifications")}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary/50",
                    !n.read && "border-primary/25 bg-sage/40",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/notifications">Open notification centre</Link>
            </Button>
          </div>
        </ExpandableCard>

        <ExpandableCard
          title="Upcoming reminders"
          description={`Scheduled for ${lovedOne.firstName}`}
          open={openPanels.reminders}
          onToggle={() => togglePanel("reminders")}
        >
          <div className="space-y-2">
            {model.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming routines.</p>
            ) : (
              model.upcoming.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      item.kind === "medication"
                        ? "bg-[#2F6FED]/12 text-[#2F6FED]"
                        : item.kind === "food"
                          ? "bg-[#2F9E6B]/12 text-[#2F9E6B]"
                          : "bg-[#D97706]/12 text-[#D97706]",
                    )}
                  >
                    {item.kind === "medication" ? (
                      <Pill className="h-4 w-4" />
                    ) : item.kind === "food" ? (
                      <Utensils className="h-4 w-4" />
                    ) : (
                      <HeartPulse className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.time}</p>
                  </div>
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </ExpandableCard>
      </div>
    </div>
  );
}

function ExpandableCard({
  title,
  description,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
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
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            {badge ? (
              <Badge variant="muted" className="font-mono">
                {badge}
              </Badge>
            ) : null}
          </div>
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
