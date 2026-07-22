"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovedOneSchema } from "@/lib/onboarding";

export function LovedOneStep() {
  const { draft, patchDraft, setStep } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const value = draft.lovedOne;
  const displayName = value.firstName.trim() || "your Loved One";

  const onNext = () => {
    const parsed = lovedOneSchema.safeParse(value);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      toast.error("Please complete the Loved One details");
      return;
    }
    setErrors({});
    patchDraft({ lovedOne: parsed.data, currentStep: 1 });
  };

  return (
    <WizardShell onBack={() => setStep(0)} onNext={onNext}>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="lo-wa">WhatsApp number</Label>
          <Input
            id="lo-wa"
            value={value.whatsappNumber}
            placeholder="We'll send check-ins here"
            onChange={(e) => patchDraft({ lovedOne: { ...value, whatsappNumber: e.target.value } })}
          />
          <FieldError message={errors.whatsappNumber} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lo-first">First name</Label>
            <Input
              id="lo-first"
              value={value.firstName}
              onChange={(e) => patchDraft({ lovedOne: { ...value, firstName: e.target.value } })}
            />
            <FieldError message={errors.firstName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lo-surname">Surname</Label>
            <Input
              id="lo-surname"
              value={value.surname}
              onChange={(e) => patchDraft({ lovedOne: { ...value, surname: e.target.value } })}
            />
            <FieldError message={errors.surname} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lo-dob">Date of birth (optional)</Label>
          <Input
            id="lo-dob"
            type="date"
            value={value.dateOfBirth || ""}
            onChange={(e) => patchDraft({ lovedOne: { ...value, dateOfBirth: e.target.value } })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lo-tz">Time zone</Label>
            <Input
              id="lo-tz"
              value={value.timeZone}
              onChange={(e) => patchDraft({ lovedOne: { ...value, timeZone: e.target.value } })}
            />
            <FieldError message={errors.timeZone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lo-rel">Relationship to Care Partner</Label>
            <Input
              id="lo-rel"
              value={value.relationshipToCarePartner}
              placeholder="Father, Mother, Grandmother…"
              onChange={(e) =>
                patchDraft({
                  lovedOne: { ...value, relationshipToCarePartner: e.target.value },
                })
              }
            />
            <FieldError message={errors.relationshipToCarePartner} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lo-address">Address</Label>
          <Input
            id="lo-address"
            value={value.address}
            placeholder="Street, apartment, city"
            onChange={(e) => patchDraft({ lovedOne: { ...value, address: e.target.value } })}
          />
          <p className="text-xs text-muted-foreground">
            We only share this with your Local Buddy during an emergency.
          </p>
          <FieldError message={errors.address} />
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={value.consentAttestedByCarePartner}
              onCheckedChange={(checked) =>
                patchDraft({
                  lovedOne: {
                    ...value,
                    consentAttestedByCarePartner: checked === true,
                  },
                })
              }
              className="mt-0.5"
              aria-invalid={Boolean(errors.consentAttestedByCarePartner)}
            />
            <span className="leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                I confirm that {displayName} has agreed to receive daily ElderWise check-in
                messages on WhatsApp.
              </span>
              <span className="mt-1 block text-xs">
                Their number is used only for these check-ins and emergency alerts. They can stop
                at any time by replying STOP.
              </span>
            </span>
          </label>
          <FieldError message={errors.consentAttestedByCarePartner} />
        </div>
      </div>
    </WizardShell>
  );
}
