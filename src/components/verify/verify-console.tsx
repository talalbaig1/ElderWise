"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VerifyResultsTable } from "@/components/verify/results-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CheckId, ParamKey } from "@/lib/verify/registry";

type ElderOption = {
  id: string;
  first_name: string;
  timezone: string | null;
};

type CheckOption = {
  id: CheckId;
  label: string;
  params: readonly ParamKey[];
};

type CheckinOption = {
  id: string;
  domain: string;
  scheduled_for: string;
  status: string;
};

type SosEventOption = {
  id: string;
  triggered_at: string;
  status: string;
};

type OptionsResponse = {
  checks: CheckOption[];
  elders: ElderOption[];
  checkins?: CheckinOption[];
  sosEvents?: SosEventOption[];
};

type RunResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  ranAt: string;
};

const DAY_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
] as const;

const PARAM_LABELS: Record<ParamKey, string> = {
  elder: "Loved one",
  checkin: "Check-in",
  sosEvent: "SOS event",
  day: "Day range",
};

function checkinLabel(c: CheckinOption): string {
  return `${c.domain} · ${c.scheduled_for} · ${c.status}`;
}

function sosEventLabel(e: SosEventOption): string {
  return `${e.triggered_at} · ${e.status}`;
}

export function VerifyConsole() {
  const [checks, setChecks] = useState<CheckOption[]>([]);
  const [elders, setElders] = useState<ElderOption[]>([]);
  const [checkins, setCheckins] = useState<CheckinOption[]>([]);
  const [sosEvents, setSosEvents] = useState<SosEventOption[]>([]);

  const [checkId, setCheckId] = useState<CheckId | "">("");
  const [elderId, setElderId] = useState("");
  const [checkinId, setCheckinId] = useState("");
  const [sosEventId, setSosEventId] = useState("");
  const [day, setDay] = useState<(typeof DAY_OPTIONS)[number]["value"] | "">("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingScoped, setLoadingScoped] = useState(false);
  const [running, setRunning] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const selectedCheck = useMemo(
    () => checks.find((c) => c.id === checkId),
    [checks, checkId],
  );

  const elderTimezone = useMemo(() => {
    const elder = elders.find((e) => e.id === elderId);
    return elder?.timezone ?? null;
  }, [elders, elderId]);

  const loadBaseOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const res = await fetch("/api/verify/options");
      if (!res.ok) {
        setOptionsError("Could not load console options.");
        return;
      }
      const data = (await res.json()) as OptionsResponse;
      setChecks(data.checks);
      setElders(data.elders ?? []);
    } catch {
      setOptionsError("Could not load console options.");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadBaseOptions();
  }, [loadBaseOptions]);

  useEffect(() => {
    if (!elderId) {
      setCheckins([]);
      setSosEvents([]);
      setCheckinId("");
      setSosEventId("");
      return;
    }

    let cancelled = false;
    async function loadScoped() {
      setLoadingScoped(true);
      try {
        const res = await fetch(
          `/api/verify/options?elderId=${encodeURIComponent(elderId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as OptionsResponse;
        if (cancelled) return;
        setCheckins(data.checkins ?? []);
        setSosEvents(data.sosEvents ?? []);
      } finally {
        if (!cancelled) setLoadingScoped(false);
      }
    }
    void loadScoped();
    return () => {
      cancelled = true;
    };
  }, [elderId]);

  useEffect(() => {
    setCheckinId("");
    setSosEventId("");
    setDay("");
    setResult(null);
    setRunError(null);
  }, [checkId]);

  const needsElderParam = selectedCheck?.params.includes("elder") ?? false;
  const needsCheckin = selectedCheck?.params.includes("checkin") ?? false;
  const needsSosEvent = selectedCheck?.params.includes("sosEvent") ?? false;
  const needsDay = selectedCheck?.params.includes("day") ?? false;
  /** Elder picker scopes check-in / SOS lists even when elder is not a run param. */
  const needsElderPicker =
    needsElderParam || needsCheckin || needsSosEvent;

  const canRun = useMemo(() => {
    if (!selectedCheck) return false;
    for (const key of selectedCheck.params) {
      if (key === "elder" && !elderId) return false;
      if (key === "checkin" && !checkinId) return false;
      if (key === "sosEvent" && !sosEventId) return false;
      if (key === "day" && !day) return false;
    }
    return true;
  }, [selectedCheck, elderId, checkinId, sosEventId, day]);

  async function handleRun() {
    if (!selectedCheck) return;
    setRunning(true);
    setRunError(null);
    setResult(null);

    const params: Record<string, string> = {};
    if (needsElderParam) params.elder = elderId;
    if (needsCheckin) params.checkin = checkinId;
    if (needsSosEvent) params.sosEvent = sosEventId;
    if (needsDay) params.day = day;

    try {
      const res = await fetch("/api/verify/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId: selectedCheck.id, params }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          setRunError("Access denied. Your console approval may have been revoked.");
        } else if (res.status === 401) {
          setRunError("Session expired. Sign in again.");
        } else {
          setRunError("Run failed. Check parameters and try again.");
        }
        return;
      }

      const data = (await res.json()) as RunResponse;
      setResult(data);
    } catch {
      setRunError("Run failed. Check parameters and try again.");
    } finally {
      setRunning(false);
    }
  }

  if (loadingOptions) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading console…
        </CardContent>
      </Card>
    );
  }

  if (optionsError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10">
          <p className="text-sm text-destructive">{optionsError}</p>
          <Button variant="outline" size="sm" onClick={() => void loadBaseOptions()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run a check</CardTitle>
          <CardDescription>
            Pick a check and parameters from the lists below — no free-text input.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Check</label>
              <Select
                value={checkId}
                onValueChange={(v) => setCheckId(v as CheckId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select check" />
                </SelectTrigger>
                <SelectContent>
                  {checks.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsElderPicker ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {needsElderParam ? PARAM_LABELS.elder : "Loved one (to load options)"}
                </label>
                <Select value={elderId} onValueChange={setElderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loved one" />
                  </SelectTrigger>
                  <SelectContent>
                    {elders.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsDay ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {PARAM_LABELS.day}
                </label>
                <Select
                  value={day}
                  onValueChange={(v) =>
                    setDay(v as (typeof DAY_OPTIONS)[number]["value"])
                  }
                  disabled={needsElderPicker && !elderId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsCheckin ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {PARAM_LABELS.checkin}
                </label>
                <Select
                  value={checkinId}
                  onValueChange={setCheckinId}
                  disabled={needsElderPicker && !elderId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingScoped ? "Loading check-ins…" : "Select check-in"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {checkins.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {checkinLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsSosEvent ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {PARAM_LABELS.sosEvent}
                </label>
                <Select
                  value={sosEventId}
                  onValueChange={setSosEventId}
                  disabled={needsElderPicker && !elderId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingScoped ? "Loading SOS events…" : "Select SOS event"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sosEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {sosEventLabel(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {runError ? (
            <p className="text-sm text-destructive">{runError}</p>
          ) : null}

          <Button
            type="button"
            disabled={!canRun || running}
            onClick={() => void handleRun()}
          >
            {running ? "Running…" : "Run"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Raw column names and values from the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <VerifyResultsTable
              columns={result.columns}
              rows={result.rows}
              rowCount={result.rowCount}
              ranAt={result.ranAt}
              elderTimezone={elderTimezone}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
