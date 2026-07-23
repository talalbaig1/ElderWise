"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createDemoStore } from "@/data/mock";
import { createClient } from "@/lib/supabase/client";
import { normalizeSettings } from "@/lib/settings";
import { readStorage, STORAGE_KEYS, writeStorage, removeStorage } from "@/lib/storage";
import type { ElderWiseStore, UserSettings } from "@/types";

interface StoreContextValue {
  store: ElderWiseStore;
  hydrated: boolean;
  setStore: (updater: ElderWiseStore | ((prev: ElderWiseStore) => ElderWiseStore)) => void;
  setSelectedLovedOneId: (id: string | null) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetDemoData: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  /** Mirror Supabase user into store for onboarding draft keys (not mock auth). */
  mirrorSupabaseUser: (input: { userId: string; email: string | null }) => void;
  clearLocalSession: () => void;
  signOut: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function clearSession(store: ElderWiseStore): ElderWiseStore {
  return {
    ...store,
    session: {
      isAuthenticated: false,
      carePartnerId: null,
      email: null,
    },
  };
}

function stripLegacySession(session: ElderWiseStore["session"] & { onboardingComplete?: boolean }) {
  return {
    isAuthenticated: Boolean(session?.isAuthenticated),
    carePartnerId: session?.carePartnerId ?? null,
    email: session?.email ?? null,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStoreState] = useState<ElderWiseStore>(() => createDemoStore());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readStorage<ElderWiseStore | null>(STORAGE_KEYS.store, null);
    if (saved?.version === 1) {
      const today = new Date().toISOString().slice(0, 10);
      setStoreState({
        ...saved,
        session: stripLegacySession(saved.session),
        settings: normalizeSettings(saved.settings),
        lovedOnes: (saved.lovedOnes ?? []).map((lo) => ({
          ...lo,
          address: lo.address ?? "",
          consentAttestedByCarePartner: lo.consentAttestedByCarePartner ?? false,
          consentAttestedAt: lo.consentAttestedAt ?? "",
          consentConfirmedAt: lo.consentConfirmedAt ?? null,
        })),
        foodRoutines: (saved.foodRoutines ?? []).map((item) => ({
          ...item,
          startDate: item.startDate || today,
          endDate: item.endDate || today,
        })),
        healthRoutines: (saved.healthRoutines ?? []).map((item) => ({
          ...item,
          startDate: item.startDate || today,
          endDate: item.endDate || today,
        })),
      });
    } else {
      const demo = createDemoStore();
      writeStorage(STORAGE_KEYS.store, demo);
      setStoreState(demo);
    }
    setHydrated(true);
  }, []);

  const setStore = useCallback(
    (updater: ElderWiseStore | ((prev: ElderWiseStore) => ElderWiseStore)) => {
      setStoreState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeStorage(STORAGE_KEYS.store, next);
        return next;
      });
    },
    [],
  );

  const setSelectedLovedOneId = useCallback(
    (id: string | null) => {
      setStore((prev) => ({ ...prev, selectedLovedOneId: id }));
    },
    [setStore],
  );

  const updateSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      setStore((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...partial },
      }));
    },
    [setStore],
  );

  const resetDemoData = useCallback(() => {
    setStoreState((prev) => {
      const demo = createDemoStore();
      const next: ElderWiseStore = {
        ...demo,
        session: prev.session,
        settings: normalizeSettings(prev.settings),
        carePartner: prev.carePartner,
        selectedLovedOneId: null,
      };
      writeStorage(STORAGE_KEYS.store, next);
      removeStorage(STORAGE_KEYS.onboardingDraft);
      return next;
    });
  }, []);

  const markNotificationRead = useCallback(
    (id: string) => {
      setStore((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      }));
    },
    [setStore],
  );

  const markAllNotificationsRead = useCallback(() => {
    setStore((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [setStore]);

  const mirrorSupabaseUser = useCallback(
    (input: { userId: string; email: string | null }) => {
      setStore((prev) => ({
        ...prev,
        session: {
          isAuthenticated: true,
          carePartnerId: input.userId,
          email: input.email,
        },
        carePartner: prev.carePartner
          ? {
              ...prev.carePartner,
              id: input.userId,
              email: input.email ?? prev.carePartner.email,
            }
          : prev.carePartner,
      }));
    },
    [setStore],
  );

  const clearLocalSession = useCallback(() => {
    setStore((prev) => clearSession(prev));
  }, [setStore]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Still clear local mirror
    }
    setStore((prev) => clearSession(prev));
  }, [setStore]);

  const value = useMemo(
    () => ({
      store,
      hydrated,
      setStore,
      setSelectedLovedOneId,
      updateSettings,
      resetDemoData,
      markNotificationRead,
      markAllNotificationsRead,
      mirrorSupabaseUser,
      clearLocalSession,
      signOut,
    }),
    [
      store,
      hydrated,
      setStore,
      setSelectedLovedOneId,
      updateSettings,
      resetDemoData,
      markNotificationRead,
      markAllNotificationsRead,
      mirrorSupabaseUser,
      clearLocalSession,
      signOut,
    ],
  );

  return createElement(StoreContext.Provider, { value }, children);
}

export function useElderWiseStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useElderWiseStore must be used within StoreProvider");
  }
  return ctx;
}

export function useSelectedLovedOne() {
  const { store } = useElderWiseStore();
  return (
    store.lovedOnes.find((lo) => lo.id === store.selectedLovedOneId) ??
    store.lovedOnes[0] ??
    null
  );
}

export function useUnreadNotificationCount() {
  const { store } = useElderWiseStore();
  return store.notifications.filter((n) => !n.read).length;
}

export function useAuth() {
  const { store, hydrated, signOut } = useElderWiseStore();
  return {
    hydrated,
    session: store.session,
    isAuthenticated: store.session.isAuthenticated,
    carePartner: store.carePartner,
    signOut,
  };
}
