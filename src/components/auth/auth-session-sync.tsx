"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useElderWiseStore } from "@/lib/store";

const AuthSyncContext = createContext(false);

export function useAuthSynced(): boolean {
  return useContext(AuthSyncContext);
}

/**
 * Reconcile localStorage session with Supabase cookies before route guards run.
 *
 * Without this, a stale isAuthenticated=true in localStorage (e.g. after
 * Production DevAutologin was enabled then removed) makes RequireGuest send
 * /sign-in → /dashboard while (app)/layout has no getUser() and redirects
 * back to /sign-in — an infinite loop.
 */
export function AuthSessionSync({ children }: { children: ReactNode }) {
  const { hydrated, store, applySupabaseSession, signOut } = useElderWiseStore();
  const router = useRouter();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          applySupabaseSession({
            userId: session.user.id,
            email: session.user.email ?? null,
          });
        } else if (store.session.isAuthenticated) {
          // Stale client session — clear so RequireGuest can show the form.
          signOut();
        }

        // Dev auto-login (404s on Production via VERCEL_ENV allowlist).
        if (!session?.user) {
          try {
            const res = await fetch("/api/dev-autologin", { method: "POST" });
            if (res.ok) {
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
            }
          } catch {
            // Local/preview convenience only
          }
        }
      } catch {
        if (!cancelled && store.session.isAuthenticated) {
          signOut();
        }
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally once after hydrate — do not re-run on every session tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return createElement(AuthSyncContext.Provider, { value: synced }, children);
}
