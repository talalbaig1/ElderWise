import { Suspense } from "react";
import { RequireOnboarding } from "@/components/auth/route-guards";

function OnboardingGateFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-sm text-muted-foreground">
      Preparing onboarding…
    </div>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<OnboardingGateFallback />}>
      <RequireOnboarding>{children}</RequireOnboarding>
    </Suspense>
  );
}
