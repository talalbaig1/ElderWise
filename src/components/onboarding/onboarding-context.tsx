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
  emptyDoctor,
  emptyLocalBuddy,
  loadOnboardingDraft,
  ONBOARDING_WIZARD_STEPS,
  saveOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStepId,
} from "@/lib/onboarding";
import {
  loadCarePartnerOnboardingDefaults,
  loadOnboardingResume,
  ownElderRowExists,
} from "@/lib/data/onboarding-actions";
import { useElderWiseStore } from "@/lib/store";

interface OnboardingContextValue {
  draft: OnboardingDraft;
  hydrated: boolean;
  stepId: OnboardingStepId;
  totalSteps: number;
  /** True when adding another Loved One after the CT already has product elders. */
  additionalMode: boolean;
  setStepId: (id: OnboardingStepId) => void;
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
      // Name/email from session. WhatsApp + TZ from care_partners when that row exists
      // (re-onboard after last Loved One delete, and ?mode=additional). First-time
      // sign-up has no row yet — those two fields stay empty for the CT to enter.
      let seed: {
        firstName?: string;
        lastName?: string;
        email?: string;
        whatsappNumber?: string;
        timeZone?: string;
      } = {
        firstName: store.carePartner?.firstName,
        lastName: store.carePartner?.lastName,
        email: store.session.email ?? store.carePartner?.email,
      };

      const cp = await loadCarePartnerOnboardingDefaults();
      if (cancelled) return;
      if (cp.ok) {
        seed = {
          firstName: cp.firstName || seed.firstName,
          lastName: cp.lastName || seed.lastName,
          email: cp.email || seed.email,
          whatsappNumber: cp.whatsappNumber,
          timeZone: cp.timeZone,
        };
      }

      if (forceFresh) {
        clearOnboardingDraft();
        const next = createDefaultDraft(accountId, seed);
        if (cancelled) return;
        saveOnboardingDraft(next);
        setDraft(next);
        setLastSavedAt(next.updatedAt);
        setHydrated(true);
        return;
      }

      let existing = loadOnboardingDraft(accountId);
      if (existing?.elderId) {
        const held = await ownElderRowExists(existing.elderId);
        if (cancelled) return;
        if (held.ok && !held.exists) {
          // Hard-deleted Loved One — keep typed fields, drop the dead id.
          existing = {
            ...existing,
            elderId: null,
            updatedAt: new Date().toISOString(),
          };
          saveOnboardingDraft(existing);
        }
      }

      if (existing?.elderId) {
        if (cancelled) return;
        const next = withSeededCarePartner(existing, seed);
        if (next !== existing) saveOnboardingDraft(next);
        setDraft(next);
        setLastSavedAt(next.updatedAt);
        setHydrated(true);
        return;
      }

      // No usable local draft (or no elderId) — try DB resume from inactive elder.
      const resumeRes = await loadOnboardingResume();
      if (cancelled) return;

      if (resumeRes.ok && resumeRes.resume) {
        const r = resumeRes.resume;
        const base = createDefaultDraft(accountId, seed);
        const next: OnboardingDraft = {
          ...base,
          elderId: r.elderId,
          currentStepId: r.currentStepId,
          carePartnerProfile: { ...base.carePartnerProfile, ...r.carePartnerProfile },
          carePartner: { ...base.carePartner, ...r.carePartner },
          lovedOne: { ...base.lovedOne, ...r.lovedOne },
          localBuddy: r.localBuddy ?? emptyLocalBuddy(),
          doctor: r.doctor ?? emptyDoctor(),
          foodRoutines: r.foodRoutines?.length ? r.foodRoutines : [createEmptyFood(r.lovedOne?.timeZone ?? base.lovedOne.timeZone)],
          medications: r.medications?.length
            ? r.medications
            : [createEmptyMedication(r.lovedOne?.timeZone ?? base.lovedOne.timeZone)],
          healthRoutines: r.healthRoutines?.length ? r.healthRoutines : [createEmptyHealth(r.lovedOne?.timeZone ?? base.lovedOne.timeZone)],
        };
        if (existing) {
          next.lovedOne = existing.lovedOne.firstName ? existing.lovedOne : next.lovedOne;
          next.carePartner = existing.carePartner.whatsappNumber
            ? existing.carePartner
            : next.carePartner;
          if (wizardStepAhead(existing.currentStepId, next.currentStepId)) {
            next.currentStepId = existing.currentStepId;
          }
        }
        const seeded = withSeededCarePartner(next, seed);
        saveOnboardingDraft(seeded);
        setDraft(seeded);
        setLastSavedAt(seeded.updatedAt);
        setHydrated(true);
        return;
      }

      const next = withSeededCarePartner(
        existing ?? createDefaultDraft(accountId, seed),
        seed,
      );
      if (existing && next !== existing) saveOnboardingDraft(next);
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

  const setStepId = useCallback(
    (id: OnboardingStepId) => {
      updateDraft((prev) => ({ ...prev, currentStepId: id }));
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
      stepId: draft.currentStepId,
      totalSteps: ONBOARDING_WIZARD_STEPS.length,
      additionalMode,
      setStepId,
      updateDraft,
      patchDraft,
      saveNow,
      lastSavedAt,
    };
  }, [
    draft,
    hydrated,
    additionalMode,
    setStepId,
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

/** Draft value wins, then care_partners row, then empty. */
function withSeededCarePartner(
  draft: OnboardingDraft,
  seed: { whatsappNumber?: string; timeZone?: string },
): OnboardingDraft {
  const whatsappNumber =
    draft.carePartner.whatsappNumber.trim() || seed.whatsappNumber?.trim() || "";
  const timeZone = draft.carePartner.timeZone.trim() || seed.timeZone?.trim() || "";
  if (
    whatsappNumber === draft.carePartner.whatsappNumber &&
    timeZone === draft.carePartner.timeZone
  ) {
    return draft;
  }
  return {
    ...draft,
    carePartner: { whatsappNumber, timeZone },
    updatedAt: new Date().toISOString(),
  };
}

/** True when `a` is further along the 3-step wizard (or completion) than `b`. */
function wizardStepAhead(a: OnboardingStepId, b: OnboardingStepId): boolean {
  const rank = (id: OnboardingStepId) =>
    id === "completion" ? ONBOARDING_WIZARD_STEPS.length : ONBOARDING_WIZARD_STEPS.findIndex((s) => s.id === id);
  return rank(a) > rank(b);
}

/** Call after successful activation — clears local draft only. */
export function clearOnboardingLocalDraft() {
  clearOnboardingDraft();
}
