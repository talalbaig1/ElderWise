"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/components/data/app-data-provider";
import { useElderWiseStore } from "@/lib/store";

/**
 * When the server layout already has an authenticated RLS session (cookies),
 * mirror it into the client store so RequireAuth does not bounce to sign-in.
 */
export function SessionBridge() {
  const data = useAppData();
  const { store, applySupabaseSession, hydrated } = useElderWiseStore();
  const done = useRef(false);

  useEffect(() => {
    if (!hydrated || done.current) return;
    if (store.session.isAuthenticated) {
      done.current = true;
      return;
    }
    if (data.carePartner) {
      applySupabaseSession({
        userId: data.carePartner.id,
        email: data.carePartner.email,
      });
      done.current = true;
    }
  }, [hydrated, store.session.isAuthenticated, data.carePartner, applySupabaseSession]);

  return null;
}
