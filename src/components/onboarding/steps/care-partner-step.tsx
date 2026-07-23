"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingCarePartner } from "@/lib/data/onboarding-actions";
import { carePartnerSchema } from "@/lib/onboarding";

export function CarePartnerStep() {
  const { draft, patchDraft, setStep } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const value = draft.carePartner;

  const onNext = async () => {
    const parsed = carePartnerSchema.safeParse(value);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      toast.error("Please complete your Care Partner details");
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await saveOnboardingCarePartner(parsed.data);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    patchDraft({ carePartner: parsed.data, currentStep: 2 });
  };

  return (
    <WizardShell onBack={() => setStep(0)} onNext={onNext} busy={busy}>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cp-first">First name</Label>
          <Input
            id="cp-first"
            value={value.firstName}
            onChange={(e) => patchDraft({ carePartner: { ...value, firstName: e.target.value } })}
          />
          <FieldError message={errors.firstName} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cp-phone">Phone number</Label>
            <Input
              id="cp-phone"
              value={value.phoneNumber}
              onChange={(e) =>
                patchDraft({ carePartner: { ...value, phoneNumber: e.target.value } })
              }
            />
            <FieldError message={errors.phoneNumber} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-wa">WhatsApp number (optional)</Label>
            <Input
              id="cp-wa"
              value={value.whatsappNumber || ""}
              onChange={(e) =>
                patchDraft({ carePartner: { ...value, whatsappNumber: e.target.value } })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-email">Email (optional)</Label>
          <Input
            id="cp-email"
            type="email"
            value={value.email}
            onChange={(e) => patchDraft({ carePartner: { ...value, email: e.target.value } })}
          />
          <FieldError message={errors.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-rel">Relationship to Loved One</Label>
          <Input
            id="cp-rel"
            value={value.relationshipToLovedOne}
            onChange={(e) =>
              patchDraft({ carePartner: { ...value, relationshipToLovedOne: e.target.value } })
            }
          />
          <FieldError message={errors.relationshipToLovedOne} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-tz">Time zone</Label>
          <Input
            id="cp-tz"
            value={value.timeZone}
            onChange={(e) => patchDraft({ carePartner: { ...value, timeZone: e.target.value } })}
          />
          <FieldError message={errors.timeZone} />
        </div>
      </div>
    </WizardShell>
  );
}
