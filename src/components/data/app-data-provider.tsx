"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  EMPTY_APP_READ_MODEL,
  toAnalyticsStore,
  type AppReadModel,
} from "@/lib/data/load-app-data";
import { useElderWiseStore } from "@/lib/store";
import type { ElderWiseStore, LovedOne } from "@/types";

const AppDataContext = createContext<AppReadModel>(EMPTY_APP_READ_MODEL);

export function AppDataProvider({
  data,
  children,
}: {
  data: AppReadModel;
  children: ReactNode;
}) {
  return createElement(AppDataContext.Provider, { value: data }, children);
}

export function useAppData(): AppReadModel {
  return useContext(AppDataContext);
}

/**
 * Domain data from the server read model + session/settings from the client store.
 * Never persists DB rows into localStorage.
 */
export function useDomainStore(): {
  store: ElderWiseStore;
  data: AppReadModel;
  lovedOne: LovedOne | null;
  setSelectedLovedOneId: (id: string | null) => void;
  hydrated: boolean;
  viewerTimeZone: string;
} {
  const { store: clientStore, setSelectedLovedOneId, hydrated } =
    useElderWiseStore();
  const data = useAppData();

  const store = useMemo(
    () =>
      toAnalyticsStore(
        data,
        clientStore.session,
        clientStore.settings,
        clientStore.selectedLovedOneId,
      ),
    [data, clientStore.session, clientStore.settings, clientStore.selectedLovedOneId],
  );

  // Heal dangling selectedLovedOneId (elder deleted / not in loaded list).
  useEffect(() => {
    if (!hydrated || data.lovedOnes.length === 0) return;
    const resolved = store.selectedLovedOneId;
    if (resolved && clientStore.selectedLovedOneId !== resolved) {
      setSelectedLovedOneId(resolved);
    }
  }, [
    hydrated,
    data.lovedOnes.length,
    store.selectedLovedOneId,
    clientStore.selectedLovedOneId,
    setSelectedLovedOneId,
  ]);

  const lovedOne =
    store.lovedOnes.find((lo) => lo.id === store.selectedLovedOneId) ??
    store.lovedOnes[0] ??
    null;

  return {
    store,
    data,
    lovedOne,
    setSelectedLovedOneId,
    hydrated,
    viewerTimeZone: data.viewerTimeZone,
  };
}
