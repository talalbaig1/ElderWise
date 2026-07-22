"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { doctorSchema } from "@/lib/onboarding";

export function DoctorStep() {
  const { draft, patchDraft, setStep } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const value = draft.doctor;

  const onNext = () => {
    if (draft.skipDoctor) {
      patchDraft({ currentStep: 4 });
      return;
    }
    const parsed = doctorSchema.safeParse(value);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      toast.error("Complete doctor details or skip for now");
      return;
    }
    setErrors({});
    patchDraft({ doctor: parsed.data, skipDoctor: false, currentStep: 4 });
  };

  return (
    <WizardShell
      onBack={() => setStep(2)}
      onNext={onNext}
      secondaryAction={
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            patchDraft({ skipDoctor: true, currentStep: 4 });
            toast.message("You can add a Family Doctor later");
          }}
        >
          Skip for now
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="rounded-2xl bg-sage/60 px-4 py-3 text-sm text-primary">
          Family Doctors are notified for urgent situations — not day-to-day check-ins.
        </p>
        <div className="space-y-2">
          <Label htmlFor="doc-name">Doctor name</Label>
          <Input
            id="doc-name"
            value={value.name}
            placeholder="Dr. Mehta"
            onChange={(e) => patchDraft({ doctor: { ...value, name: e.target.value } })}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="doc-wa">WhatsApp number</Label>
            <Input
              id="doc-wa"
              value={value.whatsappNumber}
              onChange={(e) => patchDraft({ doctor: { ...value, whatsappNumber: e.target.value } })}
            />
            <FieldError message={errors.whatsappNumber} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-phone">Direct contact number</Label>
            <Input
              id="doc-phone"
              value={value.directContactNumber || ""}
              onChange={(e) =>
                patchDraft({ doctor: { ...value, directContactNumber: e.target.value } })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-clinic">Clinic or hospital</Label>
          <Input
            id="doc-clinic"
            value={value.clinicOrHospitalName || ""}
            onChange={(e) =>
              patchDraft({ doctor: { ...value, clinicOrHospitalName: e.target.value } })
            }
          />
        </div>
      </div>
    </WizardShell>
  );
}
