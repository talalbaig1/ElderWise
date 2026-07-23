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
  applyOnboardingDraft,
  clearOnboardingDraft,
  createDefaultDraft,
  loadOnboardingDraft,
  ONBOARDING_STEPS,
  saveOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding";
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
  persistToStore: () => void;
  finishAndGoToDashboard: () => void;
  lastSavedAt: string | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { store, hydrated: storeHydrated, setStore } = useElderWiseStore();
  const accountId = store.session.carePartnerId;
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storeHydrated || !accountId) return;
    const existing = loadOnboardingDraft(accountId);
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

  const persistToStore = useCallback(() => {
    if (!draft) return;
    setStore((prev) => applyOnboardingDraft(prev, draft));
    persist(draft);
  }, [draft, persist, setStore]);

  const finishAndGoToDashboard = useCallback(() => {
    if (!draft || !accountId) return;
    // Local draft only until A2.4 writes real elders — (app)/layout will bounce
    // back to /onboarding while elders.length === 0 (known interim on a3-auth).
    setStore((prev) => applyOnboardingDraft(prev, draft));
    clearOnboardingDraft();
  }, [accountId, draft, setStore]);

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
      persistToStore,
      finishAndGoToDashboard,
      lastSavedAt,
    };
  }, [
    draft,
    hydrated,
    setStep,
    updateDraft,
    patchDraft,
    saveNow,
    persistToStore,
    finishAndGoToDashboard,
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
