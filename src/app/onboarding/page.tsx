"use client";

import { Suspense } from "react";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-context";
import { CarePartnerStep } from "@/components/onboarding/steps/care-partner-step";
import { CompletionStep } from "@/components/onboarding/steps/completion-step";
import { DoctorStep } from "@/components/onboarding/steps/doctor-step";
import { FoodStep } from "@/components/onboarding/steps/food-step";
import { HealthStep } from "@/components/onboarding/steps/health-step";
import { LocalBuddyStep } from "@/components/onboarding/steps/local-buddy-step";
import { LovedOneStep } from "@/components/onboarding/steps/loved-one-step";
import { MedicationStep } from "@/components/onboarding/steps/medication-step";
import { ReviewStep } from "@/components/onboarding/steps/review-step";

function OnboardingWizard() {
  const { hydrated, step, additionalMode } = useOnboarding();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your saved progress…
      </div>
    );
  }

  // Additional-elder mode never shows Care Partner — skip if somehow landed here.
  if (additionalMode && step === 1) {
    return <LocalBuddyStep />;
  }

  switch (step) {
    case 0:
      return <LovedOneStep />;
    case 1:
      return <CarePartnerStep />;
    case 2:
      return <LocalBuddyStep />;
    case 3:
      return <DoctorStep />;
    case 4:
      return <FoodStep />;
    case 5:
      return <MedicationStep />;
    case 6:
      return <HealthStep />;
    case 7:
      return <ReviewStep />;
    case 8:
      return <CompletionStep />;
    default:
      return <LovedOneStep />;
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
