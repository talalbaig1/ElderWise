"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSynced } from "@/components/auth/auth-session-sync";
import { useAuth } from "@/lib/store";
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

/** Protects authenticated app pages. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated, onboardingComplete } = useAuth();
  const authSynced = useAuthSynced();
  const router = useRouter();
  const pathname = usePathname();
  const ready = hydrated && authSynced;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!onboardingComplete && !pathname.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [ready, isAuthenticated, onboardingComplete, pathname, router]);

  if (!ready) return <AuthLoading />;
  if (!isAuthenticated) return <AuthLoading />;
  if (!onboardingComplete && !pathname.startsWith("/onboarding")) return <AuthLoading />;

  return <>{children}</>;
}

/** Keeps signed-in users out of auth forms. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated, onboardingComplete } = useAuth();
  const authSynced = useAuthSynced();
  const router = useRouter();
  const ready = hydrated && authSynced;

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    router.replace(onboardingComplete ? "/dashboard" : "/onboarding");
  }, [ready, isAuthenticated, onboardingComplete, router]);

  if (!ready) return <AuthLoading />;
  if (isAuthenticated) return <AuthLoading />;

  return <>{children}</>;
}

/** Allows authenticated users into onboarding; sends completed users to dashboard. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated, onboardingComplete } = useAuth();
  const authSynced = useAuthSynced();
  const router = useRouter();
  const ready = hydrated && authSynced;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace("/sign-in?next=/onboarding");
      return;
    }
    if (onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [ready, isAuthenticated, onboardingComplete, router]);

  if (!ready) return <AuthLoading />;
  if (!isAuthenticated) return <AuthLoading />;
  if (onboardingComplete) return <AuthLoading />;

  return <>{children}</>;
}
