"use client";

import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Leaf, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  clearOnboardingLocalDraft,
  useOnboarding,
} from "@/components/onboarding/onboarding-context";
import {
  ONBOARDING_STEP_META,
  ONBOARDING_WIZARD_STEPS,
  wizardStepIndex,
} from "@/lib/onboarding";
import { useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void | Promise<void>;
  nextLabel?: string;
  backLabel?: string;
  hideNext?: boolean;
  hideBack?: boolean;
  nextDisabled?: boolean;
  secondaryAction?: ReactNode;
  busy?: boolean;
}

function draftHasProgress(input: {
  stepId: string;
  elderId: string | null | undefined;
  lastSavedAt: string | null;
  lovedOneFirstName: string;
  carePartnerWhatsapp: string;
}): boolean {
  if (input.lastSavedAt) return true;
  if (input.elderId) return true;
  if (input.stepId !== "care-circle") return true;
  if (input.lovedOneFirstName.trim()) return true;
  if (input.carePartnerWhatsapp.trim()) return true;
  return false;
}

export function WizardShell({
  children,
  onBack,
  onNext,
  nextLabel = "Next",
  backLabel = "Back",
  hideNext,
  hideBack,
  nextDisabled,
  secondaryAction,
  busy,
}: WizardShellProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { stepId, lastSavedAt, saveNow, draft } = useOnboarding();
  const [signingOut, setSigningOut] = useState(false);
  const reduce = useReducedMotion();
  const meta = ONBOARDING_STEP_META[stepId];
  const isCompletion = stepId === "completion";
  const totalSteps = ONBOARDING_WIZARD_STEPS.length;
  const stepIndex = wizardStepIndex(stepId);
  const progress = isCompletion ? 100 : ((stepIndex + 1) / totalSteps) * 100;
  const stepLabel = isCompletion ? "Done" : `Step ${stepIndex + 1} of ${totalSteps}`;
  const backDisabled = Boolean(busy) || stepId === "care-circle";

  const handleSignOut = async () => {
    const hasProgress = draftHasProgress({
      stepId,
      elderId: draft.elderId,
      lastSavedAt,
      lovedOneFirstName: draft.lovedOne.firstName,
      carePartnerWhatsapp: draft.carePartner.whatsappNumber,
    });
    if (hasProgress) {
      const proceed = window.confirm(
        "Sign out? Progress saved on this device will be cleared. You can start again after signing in.",
      );
      if (!proceed) return;
    }

    setSigningOut(true);
    try {
      // Session must be gone before /sign-in mounts RequireGuest.
      await signOut();
      clearOnboardingLocalDraft();
      toast.success("Signed out");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#DCE8E4_0%,transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,#24332f_0%,transparent_50%)]" />
      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-lg leading-none">SilaCare</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Onboarding
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right">
              <p className="font-mono text-[11px] text-muted-foreground">{stepLabel}</p>
              {lastSavedAt ? (
                <p className="flex items-center justify-end gap-1 text-[11px] text-success">
                  <Check className="h-3 w-3" />
                  Saved {formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true })}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="hidden gap-1 overflow-x-auto pb-1 sm:flex">
            {ONBOARDING_WIZARD_STEPS.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]",
                  !isCompletion && index === stepIndex
                    ? "bg-primary text-primary-foreground"
                    : isCompletion || index < stepIndex
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border/80 bg-card p-5 shadow-[0_24px_60px_-40px_rgba(31,75,69,0.4)] sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {meta.label}
          </p>
          <h1 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">{meta.title}</h1>

          <AnimatePresence mode="wait">
            <motion.div
              key={stepId}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="mt-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {!hideBack ? (
                <Button type="button" variant="outline" onClick={onBack} disabled={backDisabled}>
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" variant="ghost" size="sm" onClick={saveNow}>
                Save and continue later
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {secondaryAction}
              {!hideNext ? (
                <Button type="button" onClick={onNext} disabled={busy || nextDisabled}>
                  {busy ? "Saving…" : nextLabel}
                  {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
