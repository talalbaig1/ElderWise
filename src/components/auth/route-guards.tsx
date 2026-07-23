"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppData } from "@/components/data/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { countOwnElders, postAuthPath } from "@/lib/auth-routing";
import { useElderWiseStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

type Gate = "loading" | "allow" | "deny";

/** Protects authenticated app pages. Elder count comes from AppDataProvider (server load). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const data = useAppData();
  const { hydrated, mirrorSupabaseUser } = useElderWiseStore();
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        setGate("deny");
        router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }

      mirrorSupabaseUser({
        userId: session.user.id,
        email: session.user.email ?? null,
      });

      if (data.lovedOnes.length === 0 && !pathname.startsWith("/onboarding")) {
        setGate("deny");
        router.replace("/onboarding");
        return;
      }

      setGate("allow");
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, data.lovedOnes.length, pathname, router, mirrorSupabaseUser]);

  if (!hydrated || gate === "loading") return <AuthLoading />;
  if (gate === "deny") return <AuthLoading />;
  return <>{children}</>;
}

/** Keeps signed-in users out of auth forms. Own elders check (no AppDataProvider). */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { hydrated, mirrorSupabaseUser, clearLocalSession } = useElderWiseStore();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        clearLocalSession();
        setGate("allow");
        return;
      }

      mirrorSupabaseUser({
        userId: session.user.id,
        email: session.user.email ?? null,
      });
      const elders = await countOwnElders(supabase);
      if (cancelled) return;
      setGate("deny");
      router.replace(postAuthPath(elders));
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, router, mirrorSupabaseUser, clearLocalSession]);

  if (!hydrated || gate === "loading") return <AuthLoading />;
  if (gate === "deny") return <AuthLoading />;
  return <>{children}</>;
}

/** Onboarding: need session; bounce to dashboard when elders already exist. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { hydrated, mirrorSupabaseUser, clearLocalSession } = useElderWiseStore();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        clearLocalSession();
        setGate("deny");
        router.replace("/sign-in?next=/onboarding");
        return;
      }

      mirrorSupabaseUser({
        userId: session.user.id,
        email: session.user.email ?? null,
      });
      const elders = await countOwnElders(supabase);
      if (cancelled) return;

      if (elders > 0) {
        setGate("deny");
        router.replace("/dashboard");
        return;
      }

      setGate("allow");
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, router, mirrorSupabaseUser, clearLocalSession]);

  if (!hydrated || gate === "loading") return <AuthLoading />;
  if (gate === "deny") return <AuthLoading />;
  return <>{children}</>;
}
