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
  setStep: (step: number) => void;
  updateDraft: (updater: (prev: OnboardingDraft) => OnboardingDraft) => void;
  patchDraft: (partial: Partial<OnboardingDraft>) => void;
  saveNow: () => void;
  lastSavedAt: string | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { store, hydrated: storeHydrated } = useElderWiseStore();
  const accountId = store.session.carePartnerId;
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storeHydrated || !accountId) return;
    let cancelled = false;

    void (async () => {
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
        const next: OnboardingDraft = {
          ...base,
          elderId: r.elderId,
          currentStep: r.currentStep,
          lovedOne: r.lovedOne,
          carePartner: {
            ...base.carePartner,
            ...r.carePartner,
          },
          localBuddy: r.localBuddy,
          skipLocalBuddy: r.skipLocalBuddy,
          doctor: r.doctor,
          skipDoctor: r.skipDoctor,
          foodRoutines:
            r.foodRoutines.length > 0 ? r.foodRoutines : [createEmptyFood()],
          medications:
            r.medications.length > 0 ? r.medications : [createEmptyMedication()],
          healthRoutines:
            r.healthRoutines.length > 0
              ? r.healthRoutines
              : [createEmptyHealth()],
        };
        // Prefer localStorage field values if present but missing elderId (rare).
        if (existing) {
          next.lovedOne = existing.lovedOne.firstName
            ? existing.lovedOne
            : next.lovedOne;
          next.carePartner = existing.carePartner.firstName
            ? existing.carePartner
            : next.carePartner;
          if (existing.currentStep > next.currentStep) {
            next.currentStep = existing.currentStep;
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
  }, [storeHydrated, accountId, store.carePartner, store.session.email]);

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
      updateDraft((prev) => ({
        ...prev,
        currentStep: Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, step)),
      }));
    },
    [updateDraft],
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
      setStep,
      updateDraft,
      patchDraft,
      saveNow,
      lastSavedAt,
    };
  }, [
    draft,
    hydrated,
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
