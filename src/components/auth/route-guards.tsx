"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!onboardingComplete && !pathname.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [hydrated, isAuthenticated, onboardingComplete, pathname, router]);

  if (!hydrated) return <AuthLoading />;
  if (!isAuthenticated) return <AuthLoading />;
  if (!onboardingComplete && !pathname.startsWith("/onboarding")) return <AuthLoading />;

  return <>{children}</>;
}

/** Keeps signed-in users out of auth forms. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated, onboardingComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    router.replace(onboardingComplete ? "/dashboard" : "/onboarding");
  }, [hydrated, isAuthenticated, onboardingComplete, router]);

  if (!hydrated) return <AuthLoading />;
  if (isAuthenticated) return <AuthLoading />;

  return <>{children}</>;
}

/** Allows authenticated users into onboarding; sends completed users to dashboard. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated, onboardingComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/sign-in?next=/onboarding");
      return;
    }
    if (onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, onboardingComplete, router]);

  if (!hydrated) return <AuthLoading />;
  if (!isAuthenticated) return <AuthLoading />;
  if (onboardingComplete) return <AuthLoading />;

  return <>{children}</>;
}
