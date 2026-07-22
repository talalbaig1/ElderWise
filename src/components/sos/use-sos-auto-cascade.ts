"use client";

import { useEffect, useRef } from "react";
import {
  advanceSosCascade,
  applySosToStore,
  ensureSosShape,
} from "@/lib/sos";
import { useElderWiseStore } from "@/lib/store";

const STEP_DELAY_MS = 1600;

/**
 * Auto-advances cascade for demo SOS events with `autoCascade: true`.
 * Each step is persisted to localStorage via the store.
 */
export function useSosAutoCascade(activeEventId: string | null) {
  const { store, setStore, hydrated } = useElderWiseStore();
  const event = activeEventId
    ? store.sosEvents.find((e) => e.id === activeEventId)
    : undefined;

  const shaped = event ? ensureSosShape(event) : null;
  const pendingCount = shaped?.cascadeSteps.filter((s) => s.status === "pending").length ?? 0;
  const shouldRun =
    !!shaped &&
    !!shaped.autoCascade &&
    (shaped.status === "active" || shaped.status === "acknowledged") &&
    pendingCount > 0;

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated || !activeEventId || !shouldRun) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Clear autoCascade flag when nothing left to advance
      if (hydrated && activeEventId && shaped?.autoCascade && pendingCount === 0) {
        setStore((prev) => {
          const current = prev.sosEvents.find((e) => e.id === activeEventId);
          if (!current?.autoCascade) return prev;
          return applySosToStore(prev, { ...ensureSosShape(current), autoCascade: false });
        });
      }
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setStore((prev) => {
        const current = prev.sosEvents.find((e) => e.id === activeEventId);
        if (!current?.autoCascade) return prev;
        const next = advanceSosCascade(ensureSosShape(current));
        return applySosToStore(prev, next);
      });
      timerRef.current = null;
    }, STEP_DELAY_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    hydrated,
    activeEventId,
    shouldRun,
    pendingCount,
    shaped?.autoCascade,
    setStore,
  ]);
}
