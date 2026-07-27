"use client";

import { Suspense } from "react";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";
import { CareCircleStep } from "@/components/onboarding/steps/care-circle-step";
import { CompletionStep } from "@/components/onboarding/steps/completion-step";
import { ReviewStep } from "@/components/onboarding/steps/review-step";
import { WellnessDetailsStep } from "@/components/onboarding/steps/wellness-details-step";

function OnboardingWizard() {
  const { hydrated, stepId } = useOnboarding();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your saved progress…
      </div>
    );
  }

  switch (stepId) {
    case "care-circle":
      return <CareCircleStep />;
    case "wellness-details":
      return <WellnessDetailsStep />;
    case "review":
      return <ReviewStep />;
    case "completion":
      return <CompletionStep />;
    default:
      return <CareCircleStep />;
  }
}

function OnboardingPageInner() {
  return (
    <OnboardingProvider>
      <OnboardingWizard />
    </OnboardingProvider>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Preparing your onboarding…
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}
