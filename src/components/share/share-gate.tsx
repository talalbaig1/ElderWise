"use client";

import { useState, useTransition } from "react";
import {
  revealDoctorShareSummary,
} from "@/lib/data/share-link-actions";
import type { DoctorShareSummary } from "@/lib/share/types";
import { formatInTimeZone, labelElderLocalTime } from "@/lib/time/display";
import { Button } from "@/components/ui/button";

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

function ShareSummaryView({ summary }: { summary: DoctorShareSummary }) {
  const tz = summary.viewerTimeZone;
  const name = `${summary.elder.firstName} ${summary.elder.lastName}`.trim();

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
        <h2 className="font-display text-xl">Recent check-ins</h2>
        {summary.checkIns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins yet.</p>
        ) : (
          <ul className="space-y-2">
            {summary.checkIns.slice(0, 20).map((c, i) => (
              <li
                key={`${c.scheduledAt}-${c.domain}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="capitalize">
                  {c.domain} · {c.status}
                  {c.responseValue ? ` · ${c.responseValue}` : ""}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatInTimeZone(c.scheduledAt, tz)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">SOS events</h2>
        {summary.sosEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SOS events.</p>
        ) : (
          <ul className="space-y-3">
            {summary.sosEvents.map((e) => (
              <li key={e.triggeredAt} className="rounded-xl border px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{e.status}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatInTimeZone(e.triggeredAt, tz)}
                  </span>
                </div>
                {e.resolvedAt ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Resolved {formatInTimeZone(e.resolvedAt, tz)}
                    {e.resolvedByRole ? ` · ${e.resolvedByRole}` : ""}
                    {e.resolvedChannel ? ` · ${e.resolvedChannel}` : ""}
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
