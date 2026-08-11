"use client";

import { useState, useTransition } from "react";
import {
  revealDoctorShareSummary,
} from "@/lib/data/share-link-actions";
import type {
  DoctorShareDomainSummary,
  DoctorShareSummary,
} from "@/lib/share/types";
import {
  formatCheckInStatus,
  formatSosEventStatus,
  formatSosResolveChannel,
} from "@/lib/check-in-status";
import { formatInTimeZone, labelElderLocalTime } from "@/lib/time/display";
import { Button } from "@/components/ui/button";

/** Cap detail list only — summary strip still uses the full window payload. */
const CHECKIN_LIST_CAP = 20;

/**
 * Neutral landing first (crawlers / link previews). Clinical data loads only
 * after a human click — never in the initial HTML response.
 */
export function ShareGate({ token }: { token: string }) {
  const [summary, setSummary] = useState<DoctorShareSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (summary) {
    return <ShareSummaryView summary={summary} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <p className="font-display text-2xl tracking-tight text-foreground">ElderWise</p>
      <h1 className="font-display text-3xl tracking-tight">Care summary</h1>
      <p className="text-muted-foreground">
        This private link is for the Family Doctor. Continue only if you were
        given this address by the Care Partner.
      </p>
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await revealDoctorShareSummary(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSummary(result.summary);
          });
        }}
      >
        {pending ? "Loading…" : "View care summary"}
      </Button>
      <p className="font-mono text-[11px] text-muted-foreground">
        Facts only · not a diagnosis · not emergency advice
      </p>
    </main>
  );
}

function breakdownLine(d: DoctorShareDomainSummary["breakdown"]): string {
  const parts = [
    d.taken ? `${d.taken} taken` : null,
    d.missed ? `${d.missed} missed` : null,
    d.delayed ? `${d.delayed} delayed` : null,
    d.pending ? `${d.pending} pending` : null,
    d.cancelled ? `${d.cancelled} cancelled` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No check-ins";
}

function ShareSummaryView({ summary }: { summary: DoctorShareSummary }) {
  const tz = summary.viewerTimeZone;
  const name = `${summary.elder.firstName} ${summary.elder.lastName}`.trim();
  const { overview } = summary;
  const o = overview.overall;

  return (
    <main className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <header className="space-y-2 border-b pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ElderWise · Doctor share · {tz}
        </p>
        <h1 className="font-display text-3xl tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{summary.elder.address}</p>
        <p className="font-mono text-xs text-muted-foreground">
          Elder schedule zone: {summary.elder.timeZone}
        </p>
      </header>

      <section className="space-y-4 rounded-xl border px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">Summary</h2>
          <p className="font-mono text-xs text-muted-foreground">{overview.windowLabel}</p>
        </div>
        <p className="text-sm">
          {overview.overallTotal === 0
            ? "No check-ins in this window."
            : `${overview.overallTotal} check-in${overview.overallTotal === 1 ? "" : "s"} · ${breakdownLine(o)}`}
          {overview.sosOpen + overview.sosResolved > 0
            ? ` · SOS ${overview.sosOpen} open / ${overview.sosResolved} resolved`
            : ""}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              overview.domains.medication,
              overview.domains.food,
              overview.domains.health,
            ] as DoctorShareDomainSummary[]
          ).map((domain) => (
            <div key={domain.domain} className="rounded-lg bg-secondary/40 px-3 py-2">
              <p className="text-sm font-semibold">{domain.label}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {domain.total === 0
                  ? "No check-ins"
                  : `${domain.total} · ${breakdownLine(domain.breakdown)}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Medications</h2>
        {summary.medications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medications on file.</p>
        ) : (
          <ul className="space-y-2">
            {summary.medications.map((m) => (
              <li key={`${m.name}-${m.dosage}`} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-semibold">
                  {m.name} · {m.dosage}
                  {m.dosageUnit}
                  {!m.enabled ? " · paused" : ""}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {m.times
                    .map((t) => labelElderLocalTime(t, summary.elder.timeZone))
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">Recent check-ins</h2>
          <p className="font-mono text-xs text-muted-foreground">{overview.windowLabel}</p>
        </div>
        {summary.checkIns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins in this window.</p>
        ) : (
          <>
            {summary.checkIns.length > CHECKIN_LIST_CAP ? (
              <p className="font-mono text-xs text-muted-foreground">
                Showing most recent {CHECKIN_LIST_CAP} of {summary.checkIns.length}
              </p>
            ) : null}
            <ul className="space-y-2">
              {summary.checkIns.slice(0, CHECKIN_LIST_CAP).map((c, i) => (
                <li
                  key={`${c.scheduledAt}-${c.domain}-${i}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <span>
                    {c.domain} · {formatCheckInStatus(c.status)}
                    {c.responseValue ? ` · ${c.responseValue}` : ""}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatInTimeZone(c.scheduledAt, tz)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">SOS events</h2>
          <p className="font-mono text-xs text-muted-foreground">{overview.windowLabel}</p>
        </div>
        {summary.sosEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SOS events in this window.</p>
        ) : (
          <ul className="space-y-3">
            {summary.sosEvents.map((e) => (
              <li key={e.triggeredAt} className="rounded-xl border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{formatSosEventStatus(e.status)}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatInTimeZone(e.triggeredAt, tz)}
                  </span>
                </div>
                {e.resolvedAt ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Resolved {formatInTimeZone(e.resolvedAt, tz)}
                    {e.resolvedByRole ? ` · ${e.resolvedByRole.replace(/_/g, " ")}` : ""}
                    {e.resolvedChannel
                      ? ` · ${formatSosResolveChannel(e.resolvedChannel)}`
                      : ""}
                    {e.responseMinutes != null
                      ? ` · ${e.responseMinutes} min response`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="border-t pt-6 font-mono text-[11px] text-muted-foreground">
        Read-only facts for clinical context. ElderWise does not diagnose or advise.
      </p>
    </main>
  );
}
