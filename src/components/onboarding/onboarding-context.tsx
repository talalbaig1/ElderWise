"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  clearOnboardingDraft,
  createDefaultDraft,
  createEmptyFood,
  createEmptyHealth,
  createEmptyMedication,
  loadOnboardingDraft,
  ONBOARDING_STEPS,
  saveOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding";
import { loadOnboardingResume } from "@/lib/data/onboarding-actions";
import { useElderWiseStore } from "@/lib/store";

interface OnboardingContextValue {
  draft: OnboardingDraft;
  hydrated: boolean;
  step: number;
  totalSteps: number;
  /** True when adding another Loved One after the CT already has product elders. */
  additionalMode: boolean;
  setStep: (step: number) => void;
  updateDraft: (updater: (prev: OnboardingDraft) => OnboardingDraft) => void;
  patchDraft: (partial: Partial<OnboardingDraft>) => void;
  saveNow: () => void;
  lastSavedAt: string | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { store, hydrated: storeHydrated } = useElderWiseStore();
  const searchParams = useSearchParams();
  const additionalMode = searchParams.get("mode") === "additional";
  const forceFresh = searchParams.get("fresh") === "1";
  const accountId = store.session.carePartnerId;
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storeHydrated || !accountId) return;
    let cancelled = false;

    void (async () => {
      if (forceFresh) {
        clearOnboardingDraft();
        const next = createDefaultDraft(accountId, {
          firstName: store.carePartner?.firstName,
          lastName: store.carePartner?.lastName,
          email: store.session.email ?? store.carePartner?.email,
        });
        if (cancelled) return;
        saveOnboardingDraft(next);
        setDraft(next);
        setLastSavedAt(next.updatedAt);
        setHydrated(true);
        return;
      }

      const existing = loadOnboardingDraft(accountId);
      if (existing?.elderId) {
        if (cancelled) return;
        setDraft(existing);
        setLastSavedAt(existing.updatedAt);
        setHydrated(true);
        return;
      }

      // No usable local draft (or no elderId) — try DB resume from inactive elder.
      const resumeRes = await loadOnboardingResume();
      if (cancelled) return;

      if (resumeRes.ok && resumeRes.resume) {
        const r = resumeRes.resume;
        const base = createDefaultDraft(accountId, {
          firstName: store.carePartner?.firstName,
          lastName: store.carePartner?.lastName,
          email: store.session.email ?? store.carePartner?.email,
        });
        let currentStep = r.currentStep;
        // Additional-elder mode never shows Care Partner (step 1).
        if (additionalMode && currentStep === 1) currentStep = 2;
        const next: OnboardingDraft = {
          ...base,
          elderId: r.elderId,
          currentStep,
          lovedOne: r.lovedOne,
          carePartner: {
            ...base.carePartner,
            ...r.carePartner,
          },
          localBuddy: r.localBuddy,
          doctor: r.doctor,
          foodRoutines:
            r.foodRoutines.length > 0 ? r.foodRoutines : [createEmptyFood()],
          medications:
            r.medications.length > 0 ? r.medications : [createEmptyMedication()],
          healthRoutines:
            r.healthRoutines.length > 0
              ? r.healthRoutines
              : [createEmptyHealth()],
        };
        if (existing) {
          next.lovedOne = existing.lovedOne.firstName
            ? existing.lovedOne
            : next.lovedOne;
          next.carePartner = existing.carePartner.firstName
            ? existing.carePartner
            : next.carePartner;
          if (existing.currentStep > next.currentStep) {
            next.currentStep = existing.currentStep;
            if (additionalMode && next.currentStep === 1) next.currentStep = 2;
          }
        }
        saveOnboardingDraft(next);
        setDraft(next);
        setLastSavedAt(next.updatedAt);
        setHydrated(true);
        return;
      }

      const next =
        existing ??
        createDefaultDraft(accountId, {
          firstName: store.carePartner?.firstName,
          lastName: store.carePartner?.lastName,
          email: store.session.email ?? store.carePartner?.email,
        });
      setDraft(next);
      setLastSavedAt(next.updatedAt);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    storeHydrated,
    accountId,
    store.carePartner,
    store.session.email,
    forceFresh,
    additionalMode,
  ]);

  const persist = useCallback((next: OnboardingDraft) => {
    saveOnboardingDraft(next);
    setLastSavedAt(new Date().toISOString());
  }, []);

  const updateDraft = useCallback(
    (updater: (prev: OnboardingDraft) => OnboardingDraft) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(next), 350);
        return next;
      });
    },
    [persist],
  );

  const patchDraft = useCallback(
    (partial: Partial<OnboardingDraft>) => {
      updateDraft((prev) => ({ ...prev, ...partial }));
    },
    [updateDraft],
  );

  const setStep = useCallback(
    (step: number) => {
      updateDraft((prev) => {
        let next = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, step));
        if (additionalMode && next === 1) next = 2;
        return { ...prev, currentStep: next };
      });
    },
    [updateDraft, additionalMode],
  );

  const saveNow = useCallback(() => {
    if (!draft) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist(draft);
  }, [draft, persist]);

  const value = useMemo(() => {
    if (!draft) return null;
    return {
      draft,
      hydrated,
      step: draft.currentStep,
      totalSteps: ONBOARDING_STEPS.length,
      additionalMode,
      setStep,
      updateDraft,
      patchDraft,
      saveNow,
      lastSavedAt,
    };
  }, [
    draft,
    hydrated,
    additionalMode,
    setStep,
    updateDraft,
    patchDraft,
    saveNow,
    lastSavedAt,
  ]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Preparing your onboarding…
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

/** Call after successful activation — clears local draft only. */
export function clearOnboardingLocalDraft() {
  clearOnboardingDraft();
}
