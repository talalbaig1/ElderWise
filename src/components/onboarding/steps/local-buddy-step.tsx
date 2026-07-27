"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingLocalBuddy } from "@/lib/data/onboarding-actions";
import { emptyLocalBuddy, localBuddySchema } from "@/lib/onboarding";

export function LocalBuddyStep() {
  const { draft, patchDraft, setStep, additionalMode } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const value = draft.localBuddy;

  const requireElderId = () => {
    if (!draft.elderId) {
      toast.error("Save Loved One details first");
      setStep(0);
      return null;
    }
    return draft.elderId;
  };

  const onNext = async () => {
    const elderId = requireElderId();
    if (!elderId) return;

    const parsed = localBuddySchema.safeParse(value);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      toast.error("Complete Local Buddy details or skip for now");
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await saveOnboardingLocalBuddy({
      elderId,
      skip: false,
      buddy: parsed.data,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    patchDraft({ localBuddy: parsed.data, currentStep: 3 });
  };

  return (
    <WizardShell
      onBack={() => setStep(additionalMode ? 0 : 1)}
      onNext={onNext}
      busy={busy}
      secondaryAction={
        <Button
          type="button"
          variant="soft"
          disabled={busy}
          onClick={async () => {
            const elderId = requireElderId();
            if (!elderId) return;
            setBusy(true);
            const result = await saveOnboardingLocalBuddy({ elderId, skip: true });
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            patchDraft({ localBuddy: emptyLocalBuddy(), currentStep: 3 });
            toast.message("You can add a Local Buddy later in Care Circle");
          }}
        >
          Skip for now
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="rounded-2xl bg-sage/60 px-4 py-3 text-sm text-primary">
          A Local Buddy is someone nearby who can respond in person during an SOS. Highly
          recommended, but you can add them later.
        </p>
        <p className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          We&apos;ll send {value.name.trim() || "them"} a one-time WhatsApp message letting them
          know you&apos;ve added them as an emergency contact, so they&apos;re expecting alerts if
          there&apos;s ever an emergency.
        </p>
        <div className="space-y-2">
          <Label htmlFor="buddy-name">Name</Label>
          <Input
            id="buddy-name"
            value={value.name}
            onChange={(e) => patchDraft({ localBuddy: { ...value, name: e.target.value } })}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="buddy-wa">WhatsApp contact number</Label>
            <Input
              id="buddy-wa"
              value={value.whatsappNumber}
              onChange={(e) =>
                patchDraft({ localBuddy: { ...value, whatsappNumber: e.target.value } })
              }
            />
            <FieldError message={errors.whatsappNumber} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buddy-phone">Direct contact number</Label>
            <Input
              id="buddy-phone"
              value={value.directContactNumber || ""}
              onChange={(e) =>
                patchDraft({ localBuddy: { ...value, directContactNumber: e.target.value } })
              }
            />
            <FieldError message={errors.directContactNumber} />
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
