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
import {
  accountToCarePartner,
  createAccount,
  markAccountOnboardingComplete,
  verifyAccount,
  type StoredAccount,
} from "@/lib/auth";
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
  signUp: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
  completeOnboarding: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function applySession(store: ElderWiseStore, account: StoredAccount): ElderWiseStore {
  return {
    ...store,
    session: {
      isAuthenticated: true,
      carePartnerId: account.id,
      email: account.email,
      onboardingComplete: account.onboardingComplete,
    },
    carePartner: {
      ...accountToCarePartner(account),
      // Preserve richer demo profile details when signing into the seed account email
      ...(store.carePartner?.email === account.email
        ? {
            whatsappNumber: store.carePartner.whatsappNumber,
            directContactNumber: store.carePartner.directContactNumber,
            address: store.carePartner.address,
            relationshipToLovedOne: store.carePartner.relationshipToLovedOne,
            preferredNotificationMethod: store.carePartner.preferredNotificationMethod,
            timeZone: store.carePartner.timeZone || accountToCarePartner(account).timeZone,
          }
        : {}),
    },
  };
}

function clearSession(store: ElderWiseStore): ElderWiseStore {
  return {
    ...store,
    session: {
      isAuthenticated: false,
      carePartnerId: null,
      email: null,
      onboardingComplete: false,
    },
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
        settings: normalizeSettings(saved.settings),
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
        carePartner: prev.carePartner
          ? {
              ...demo.carePartner!,
              ...prev.carePartner,
              // Keep demo contact richness when emails match seed profile
              whatsappNumber:
                prev.carePartner.whatsappNumber || demo.carePartner?.whatsappNumber || "",
            }
          : demo.carePartner,
        selectedLovedOneId:
          prev.selectedLovedOneId &&
          demo.lovedOnes.some((lo) => lo.id === prev.selectedLovedOneId)
            ? prev.selectedLovedOneId
            : demo.selectedLovedOneId,
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

  const signUp = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result = createAccount(input);
      if (!result.ok) return result;

      setStore((prev) => applySession(prev, result.account));
      return { ok: true as const };
    },
    [setStore],
  );

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result = verifyAccount(input.email, input.password);
      if (!result.ok) return result;

      setStore((prev) => applySession(prev, result.account));
      return { ok: true as const };
    },
    [setStore],
  );

  const signOut = useCallback(() => {
    setStore((prev) => clearSession(prev));
  }, [setStore]);

  const completeOnboarding = useCallback(() => {
    setStore((prev) => {
      if (!prev.session.carePartnerId) return prev;
      markAccountOnboardingComplete(prev.session.carePartnerId);
      return {
        ...prev,
        session: { ...prev.session, onboardingComplete: true },
      };
    });
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
      signUp,
      signIn,
      signOut,
      completeOnboarding,
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
      signUp,
      signIn,
      signOut,
      completeOnboarding,
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
  const { store, hydrated, signIn, signUp, signOut, completeOnboarding } = useElderWiseStore();
  return {
    hydrated,
    session: store.session,
    isAuthenticated: store.session.isAuthenticated,
    onboardingComplete: store.session.onboardingComplete,
    carePartner: store.carePartner,
    signIn,
    signUp,
    signOut,
    completeOnboarding,
  };
}
