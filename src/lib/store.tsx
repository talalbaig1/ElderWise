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
import { createEmptyStore } from "@/data/mock";
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
  /** Clears local client shell only — does not touch Supabase. */
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

/**
 * Persist only session + settings + selection.
 * Domain rows (loved ones, check-ins, SOS, …) come from the server read model —
 * never revive old localStorage demo seed data.
 */
function clientShellFrom(
  saved: Partial<ElderWiseStore> | null,
  prevSession?: ElderWiseStore["session"],
  prevSettings?: UserSettings,
): ElderWiseStore {
  const empty = createEmptyStore();
  return {
    ...empty,
    session: stripLegacySession(saved?.session ?? prevSession ?? empty.session),
    settings: normalizeSettings(saved?.settings ?? prevSettings ?? empty.settings),
    selectedLovedOneId: saved?.selectedLovedOneId ?? null,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStoreState] = useState<ElderWiseStore>(() => createEmptyStore());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readStorage<ElderWiseStore | null>(STORAGE_KEYS.store, null);
    const next = clientShellFrom(saved?.version === 1 ? saved : null);
    writeStorage(STORAGE_KEYS.store, next);
    setStoreState(next);
    setHydrated(true);
  }, []);

  const setStore = useCallback(
    (updater: ElderWiseStore | ((prev: ElderWiseStore) => ElderWiseStore)) => {
      setStoreState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        // Persist shell only — drop any domain arrays callers may have written.
        const shell = clientShellFrom(next, next.session, next.settings);
        writeStorage(STORAGE_KEYS.store, shell);
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
      const next = clientShellFrom(null, prev.session, prev.settings);
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
