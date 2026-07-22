"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";

export function CompletionStep() {
  const router = useRouter();
  const { draft, finishAndGoToDashboard, setStep } = useOnboarding();
  const reduce = useReducedMotion();
  const name = draft.lovedOne.firstName || "your Loved One";

  return (
    <WizardShell hideBack hideNext>
      <div className="flex flex-col items-center py-6 text-center">
        <motion.div
          initial={reduce ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-sage text-primary"
        >
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        <h2 className="font-display text-3xl leading-tight">
          You are all set. ElderWise will help you stay connected to {name}&apos;s everyday
          wellbeing.
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          Your care circle, meals, medications, and wellness check-ins are ready. Head to the
          dashboard to follow along.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              finishAndGoToDashboard();
              router.replace("/dashboard");
            }}
          >
            Go to Dashboard
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep(7)}>
            Back to review
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
