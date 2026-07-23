"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useElderWiseStore } from "@/lib/store";

/**
 * POSTs to the server-only /api/dev-autologin route.
 * No credentials in client code. Route 404s unless DEV_AUTOLOGIN=true (server env).
 * On success, refreshes RSC so the (app) layout reloads under RLS.
 */
export function DevAutologin() {
  const { hydrated, applySupabaseSession } = useElderWiseStore();
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (!hydrated || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/dev-autologin", { method: "POST" });
        if (res.status === 404) return;
        if (!res.ok) return;
        const body = (await res.json()) as {
          ok?: boolean;
          userId?: string;
          email?: string;
        };
        if (body.ok && body.userId) {
          applySupabaseSession({
            userId: body.userId,
            email: body.email ?? null,
          });
          router.refresh();
        }
      } catch {
        // Dev convenience — silent if unreachable
      }
    })();
  }, [hydrated, applySupabaseSession, router]);

  return null;
}
