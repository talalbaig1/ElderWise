"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/components/data/app-data-provider";
import { useElderWiseStore } from "@/lib/store";

/**
 * Mirror server care_partner into the client store for onboarding draft keys / chrome.
 */
export function SessionBridge() {
  const data = useAppData();
  const { store, mirrorSupabaseUser, hydrated } = useElderWiseStore();
  const done = useRef(false);

  useEffect(() => {
    if (!hydrated || done.current) return;
    if (store.session.isAuthenticated && store.session.carePartnerId) {
      done.current = true;
      return;
    }
    if (data.carePartner) {
      mirrorSupabaseUser({
        userId: data.carePartner.id,
        email: data.carePartner.email,
      });
      done.current = true;
    }
  }, [
    hydrated,
    store.session.isAuthenticated,
    store.session.carePartnerId,
    data.carePartner,
    mirrorSupabaseUser,
  ]);

  return null;
}
