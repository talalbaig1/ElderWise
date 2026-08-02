"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { differenceInSeconds, formatDistanceToNow, parseISO } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  FileBarChart,
  MapPin,
  MessageCircle,
  Phone,
  Siren,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SosCascadeFlow } from "@/components/sos/sos-cascade-flow";
import { SosEmergencyTimeline } from "@/components/sos/sos-emergency-timeline";
import { useSosAutoCascade } from "@/components/sos/use-sos-auto-cascade";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cascadeProgress,
  ensureSosShape,
  formatSosDateTime,
  hydrateLegacySos,
} from "@/lib/sos";
import { useDomainStore } from "@/components/data/app-data-provider";
import { cn } from "@/lib/utils";
import type { SOSEvent, SOSStatus } from "@/types";

function elapsedLabel(fromIso: string) {
  const secs = Math.max(0, differenceInSeconds(new Date(), parseISO(fromIso)));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useElapsedTick(enabled: boolean, setTick: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [enabled, setTick]);
}

export default function SosPage() {
  const router = useRouter();
  const {
    store,
    setSelectedLovedOneId,
    hydrated,
    lovedOne: selectedLovedOne,
    viewerTimeZone,
  } = useDomainStore();
  const reduceMotion = useReducedMotion();

  const events = useMemo(
    () =>
      store.sosEvents
        .map((e) => hydrateLegacySos(ensureSosShape(e), store))
        .sort((a, b) => +parseISO(b.triggeredAt) - +parseISO(a.triggeredAt)),
    [store],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | SOSStatus>("all");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [tick, setTick] = useState(0);

  const activeForLovedOne = useMemo(
    () =>
      events.find(
        (e) =>
          e.lovedOneId === selectedLovedOne?.id &&
          (e.status === "active" || e.status === "acknowledged"),
      ),
    [events, selectedLovedOne?.id],
  );

  const selected =
    events.find((e) => e.id === selectedId) ??
    activeForLovedOne ??
    events[0] ??
    null;

  const isOpen = selected?.status === "active" || selected?.status === "acknowledged";

  useSosAutoCascade(
    selected?.autoCascade && isOpen ? selected.id : null,
  );

  useElapsedTick(!!isOpen && !!selected, setTick);

  const filtered = useMemo(() => {
    return events.filter((e) => statusFilter === "all" || e.status === statusFilter);
  }, [events, statusFilter]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  const lovedOneForSelected = selected
    ? store.lovedOnes.find((lo) => lo.id === selected.lovedOneId)
    : null;

  const openCount = events.filter(
    (e) => e.status === "active" || e.status === "acknowledged",
  ).length;

  const walkthroughOnlyMessage =
    "Acknowledge and Cancel are part of the walkthrough. To close this alert, use Resolve.";

  const triggerSos = async () => {
    if (!selectedLovedOne?.id || triggering) return;

    setTriggering(true);
    try {
      const response = await fetch("/api/sos/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elder_id: selectedLovedOne.id }),
      });

      let payload: { error?: string; sos_event_id?: string } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // non-JSON body
      }

      if (!response.ok) {
        toast.error(payload.error || "Could not start demo SOS");
        return;
      }

      toast.success("Demo SOS started");
      router.refresh();
    } finally {
      setTriggering(false);
    }
  };

  const onAcknowledge = () => {
    toast.message(walkthroughOnlyMessage);
  };

  const onBuddyAck = () => {
    toast.message(walkthroughOnlyMessage);
  };

  const onDoctorAck = () => {
    toast.message(walkthroughOnlyMessage);
  };

  const onResolve = async () => {
    if (!selected || resolving) return;

    setResolving(true);
    try {
      const response = await fetch("/api/sos/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sos_event_id: selected.id }),
      });

      let payload: { error?: string; already_resolved?: boolean } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // non-JSON body
      }

      if (!response.ok) {
        toast.error(payload.error || "Could not resolve SOS");
        return;
      }

      toast.success(
        payload.already_resolved
          ? "This SOS was already resolved"
          : "SOS marked resolved",
      );
      setResolveOpen(false);
      setResolveNotes("");
      router.refresh();
    } finally {
      setResolving(false);
    }
  };

  const onCancel = () => {
    toast.message(walkthroughOnlyMessage);
  };

  const progress = selected ? cascadeProgress(selected.cascadeSteps) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-sos">Emergency</p>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">SOS</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cascade alerts from Loved One to Care Partner, Local Buddy, and Family Doctor —
            with a live emergency timeline stored locally.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports?kind=sos">
              <FileBarChart className="h-4 w-4" />
              Get Report
            </Link>
          </Button>
          <Select
            value={selectedLovedOne?.id}
            onValueChange={(id) => setSelectedLovedOneId(id)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Loved One" />
            </SelectTrigger>
            <SelectContent>
              {store.lovedOnes.map((lo) => (
                <SelectItem key={lo.id} value={lo.id}>
                  {lo.firstName} {lo.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="sos"
            onClick={() => void triggerSos()}
            disabled={triggering || !selectedLovedOne?.id}
            className="gap-2"
          >
            <Siren className="h-4 w-4" />
            {triggering ? "Starting…" : "Start demo SOS"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className={cn(openCount > 0 && "border-sos/30 bg-sos-soft/40")}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-sos text-white">
              {openCount > 0 && !reduceMotion ? (
                <span className="absolute inset-0 animate-ping rounded-xl bg-sos opacity-30" />
              ) : null}
              <Siren className="relative h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Open alerts
              </p>
              <p className="font-mono text-2xl font-semibold">{openCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                History
              </p>
              <p className="font-mono text-2xl font-semibold">{events.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cascade progress
            </p>
            <p className="font-mono text-2xl font-semibold">{progress}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-sos"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Siren}
          title="No SOS events yet"
          description="Use Start demo SOS to create a practice alert for the selected Loved One. This does not send WhatsApp messages."
          actionLabel="Start demo SOS"
          onAction={() => void triggerSos()}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit xl:sticky xl:top-24">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">SOS History</CardTitle>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as "all" | SOSStatus)}
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>Tap an event to inspect the emergency timeline</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No events match this filter.
                </p>
              ) : (
                filtered.map((event) => {
                  const lo = store.lovedOnes.find((l) => l.id === event.lovedOneId);
                  const active = selected?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(event.id);
                        setSelectedLovedOneId(event.lovedOneId);
                      }}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition-colors",
                        active
                          ? "border-sos/40 bg-sos-soft/50"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {lo ? `${lo.firstName} ${lo.lastName}` : "Loved One"}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {formatSosDateTime(event.triggeredAt, viewerTimeZone)}
                          </p>
                        </div>
                        <StatusPill kind="sos" status={event.status} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {event.locationPlaceholder || event.triggerChannel}
                        {event.resolutionNotes ? ` · ${event.resolutionNotes}` : ""}
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {selected && lovedOneForSelected ? (
            <div className="space-y-6">
              <Card
                className={cn(
                  "overflow-hidden",
                  isOpen && "border-sos/35 bg-gradient-to-br from-sos-soft/80 via-card to-card",
                )}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill kind="sos" status={selected.status} />
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {selected.triggerChannel}
                        </Badge>
                        {selected.autoCascade ? (
                          <Badge variant="secondary" className="gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sos opacity-60" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sos" />
                            </span>
                            Auto cascade
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="font-display text-2xl">
                        {lovedOneForSelected.firstName} {lovedOneForSelected.lastName}
                      </h2>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {selected.locationPlaceholder || "Location unavailable"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          Started{" "}
                          {formatDistanceToNow(parseISO(selected.triggeredAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {isOpen ? (
                          <span className="font-mono text-sos" data-tick={tick}>
                            Elapsed {elapsedLabel(selected.triggeredAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="flex flex-wrap gap-2">
                        {selected.status === "active" ? (
                          <Button onClick={onAcknowledge}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Acknowledge
                          </Button>
                        ) : null}
                        <Button variant="outline" onClick={() => setResolveOpen(true)}>
                          Resolve
                        </Button>
                        <Button variant="ghost" onClick={onCancel}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <StatusChip
                      label="Care Partner"
                      ok={selected.carePartnerNotified}
                      extra={
                        selected.acknowledgedBy
                          ? `Ack · ${selected.acknowledgedBy}`
                          : selected.carePartnerNotified
                            ? "Notified"
                            : "Pending"
                      }
                    />
                    <StatusChip
                      label="Local Buddy"
                      ok={selected.localBuddyNotified}
                      extra={selected.localBuddyNotified ? "Notified" : "Pending"}
                    />
                    <StatusChip
                      label="Family Doctor"
                      ok={selected.doctorNotified}
                      extra={selected.doctorNotified ? "Notified" : "Pending"}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Emergency flow</CardTitle>
                    <CardDescription>
                      Loved One → Care Partner → Local Buddy → Family Doctor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SosCascadeFlow
                      steps={selected.cascadeSteps}
                      viewerTimeZone={viewerTimeZone}
                    />
                    {isOpen ? (
                      <div className="mt-2 flex flex-wrap gap-2 border-t pt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !["notified", "acknowledged", "completed"].includes(
                              selected.cascadeSteps.find((s) => s.role === "local_buddy")
                                ?.status ?? "",
                            )
                          }
                          onClick={onBuddyAck}
                        >
                          Local Buddy ack
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !["notified", "acknowledged", "completed"].includes(
                              selected.cascadeSteps.find((s) => s.role === "family_doctor")
                                ?.status ?? "",
                            )
                          }
                          onClick={onDoctorAck}
                        >
                          Doctor ack
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Emergency timeline</CardTitle>
                    <CardDescription>
                      Updates automatically as the cascade advances
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[520px] overflow-y-auto pr-1">
                    <SosEmergencyTimeline
                      entries={selected.timeline}
                      live={!!isOpen && !!selected.autoCascade}
                      viewerTimeZone={viewerTimeZone}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Acknowledgements</CardTitle>
                    <CardDescription>Who has confirmed they are responding</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selected.acknowledgedAt ? (
                      <AckRow
                        title={selected.acknowledgedBy || "Care Partner"}
                        detail={`Acknowledged ${formatSosDateTime(selected.acknowledgedAt, viewerTimeZone)}`}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No acknowledgement yet — Care Partner should confirm first.
                      </p>
                    )}
                    {selected.responders.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Responders
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selected.responders.map((r) => (
                            <Badge key={r} variant="secondary">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selected.callsMade.length > 0 ? (
                      <div className="space-y-1.5">
                        {selected.callsMade.map((c) => (
                          <p
                            key={c}
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {c}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {selected.whatsappActions.length > 0 ? (
                      <div className="space-y-1.5 border-t pt-3">
                        {selected.whatsappActions.slice(-6).map((w, i) => (
                          <p
                            key={`${w}-${i}`}
                            className="inline-flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resolution</CardTitle>
                    <CardDescription>Closing notes and response metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selected.status === "resolved" || selected.status === "cancelled" ? (
                      <>
                        <StatusPill kind="sos" status={selected.status} />
                        <p className="text-sm leading-relaxed">
                          {selected.resolutionNotes || "No notes recorded."}
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="rounded-xl bg-secondary/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Resolved
                            </p>
                            <p className="mt-1 font-mono text-xs">
                              {selected.resolvedAt
                                ? formatSosDateTime(selected.resolvedAt, viewerTimeZone)
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-secondary/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Response
                            </p>
                            <p className="mt-1 font-mono text-xs">
                              {selected.averageResponseMinutes != null
                                ? `${selected.averageResponseMinutes} min`
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          This SOS is still open. Acknowledge the alert, follow the cascade, then
                          resolve with a short note for the Care Circle.
                        </p>
                        <Button onClick={() => setResolveOpen(true)}>Add resolution</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve SOS</DialogTitle>
            <DialogDescription>
              This marks the SOS resolved in the database so WhatsApp nudges stop.
              Optional notes stay on this device only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-notes">Resolution notes (optional)</Label>
            <textarea
              id="resolve-notes"
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Local Buddy visited; Loved One is safe at home."
              className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={resolving} onClick={() => setResolveOpen(false)}>
              Back
            </Button>
            <Button onClick={() => void onResolve()} disabled={resolving}>
              {resolving ? "Resolving…" : "Mark resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusChip({
  label,
  ok,
  extra,
}: {
  label: string;
  ok: boolean;
  extra: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        ok ? "border-success/30 bg-success/10" : "border-border bg-card",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-medium", ok ? "text-success" : "text-muted-foreground")}>
        {extra}
      </p>
    </div>
  );
}

function AckRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
