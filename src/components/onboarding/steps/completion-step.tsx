"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearOnboardingLocalDraft,
  useOnboarding,
} from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { activateOnboardingElder } from "@/lib/data/onboarding-actions";
import { useElderWiseStore } from "@/lib/store";

export function CompletionStep() {
  const router = useRouter();
  const { draft, setStepId } = useOnboarding();
  const { setSelectedLovedOneId } = useElderWiseStore();
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const name = draft.lovedOne.firstName || "your Loved One";

  const goToDashboard = async () => {
    if (!draft.elderId) {
      toast.error("Save Care Circle first");
      setStepId("care-circle");
      return;
    }
    setBusy(true);
    const result = await activateOnboardingElder(draft.elderId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSelectedLovedOneId(result.elderId);
    clearOnboardingLocalDraft();
    router.replace("/dashboard");
    router.refresh();
  };

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
          You are all set. SilaCare will help you stay connected to {name}&apos;s everyday
          wellbeing.
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          Your care circle and wellness check-ins are ready. Head to the dashboard to
          follow along. Check-ins start only after {name} confirms on WhatsApp.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void goToDashboard()}>
            {busy ? "Activating…" : "Go to Dashboard"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setStepId("review")}
          >
            Back to review
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
