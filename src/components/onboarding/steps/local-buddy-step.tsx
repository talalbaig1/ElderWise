"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localBuddySchema } from "@/lib/onboarding";

export function LocalBuddyStep() {
  const { draft, patchDraft, setStep } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const value = draft.localBuddy;

  const onNext = () => {
    if (draft.skipLocalBuddy) {
      patchDraft({ currentStep: 3 });
      return;
    }
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
    patchDraft({ localBuddy: parsed.data, skipLocalBuddy: false, currentStep: 3 });
  };

  return (
    <WizardShell
      onBack={() => setStep(1)}
      onNext={onNext}
      secondaryAction={
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            patchDraft({ skipLocalBuddy: true, currentStep: 3 });
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
