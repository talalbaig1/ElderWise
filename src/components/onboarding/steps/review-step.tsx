"use client";

import { Pencil } from "lucide-react";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function ReviewStep() {
  const { draft, setStep, saveNow, additionalMode } = useOnboarding();
  const lo = draft.lovedOne;

  const onNext = () => {
    saveNow();
    setStep(8);
  };

  return (
    <WizardShell onBack={() => setStep(6)} onNext={onNext} nextLabel="Finish setup">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review everything below. You can edit any section before finishing.
        </p>

        <Section title="Loved One" onEdit={() => setStep(0)}>
          <p className="font-medium text-foreground">
            {lo.firstName} {lo.surname}
          </p>
          <p>{lo.relationshipToCarePartner}</p>
          <p>WhatsApp · {lo.whatsappNumber}</p>
          <p>{lo.timeZone}</p>
        </Section>

        {!additionalMode ? (
          <Section title="Care Partner" onEdit={() => setStep(1)}>
            <p className="font-medium text-foreground">{draft.carePartner.firstName}</p>
            {draft.carePartner.email ? <p>{draft.carePartner.email}</p> : null}
            <p>Phone · {draft.carePartner.phoneNumber}</p>
            {draft.carePartner.whatsappNumber ? (
              <p>WhatsApp · {draft.carePartner.whatsappNumber}</p>
            ) : null}
          </Section>
        ) : null}

        <Section title="Local Buddy" onEdit={() => setStep(2)}>
          {!draft.localBuddy.name.trim() && !draft.localBuddy.whatsappNumber.trim() ? (
            <p>Skipped — can add later</p>
          ) : (
            <>
              <p className="font-medium text-foreground">{draft.localBuddy.name}</p>
              <p>WhatsApp · {draft.localBuddy.whatsappNumber}</p>
              <p>Direct · {draft.localBuddy.directContactNumber}</p>
            </>
          )}
        </Section>

        <Section title="Family Doctor" onEdit={() => setStep(3)}>
          {!draft.doctor.name.trim() && !draft.doctor.whatsappNumber.trim() ? (
            <p>Skipped — can add later</p>
          ) : (
            <>
              <p className="font-medium text-foreground">{draft.doctor.name}</p>
              <p>{draft.doctor.whatsappNumber}</p>
              <p>{draft.doctor.clinicOrHospitalName}</p>
            </>
          )}
        </Section>

        <Section title="Food routines" onEdit={() => setStep(4)}>
          {draft.foodRoutines.map((item) => (
            <p key={item.id}>
              <span className="font-medium text-foreground">{item.mealName}</span>
              {" · "}
              {item.checkInTime}
              {" · "}
              {item.startDate} → {item.endDate}
              {" · "}
              {item.enabled ? "On" : "Off"}
            </p>
          ))}
        </Section>

        <Section title="Medication" onEdit={() => setStep(5)}>
          {draft.medications.map((item) => (
            <p key={item.id}>
              <span className="font-medium text-foreground">{item.name}</span>
              {" · "}
              {item.dosage} {item.dosageUnit}
              {" · "}
              {item.times.join(", ")}
              {" · "}
              {item.startDate}
              {item.endDate ? ` → ${item.endDate}` : ""}
              {" · "}
              {item.enabled ? "On" : "Off"}
            </p>
          ))}
        </Section>

        <Section title="Health routines" onEdit={() => setStep(6)}>
          {draft.healthRoutines.length === 0 ? (
            <p>None added</p>
          ) : (
            draft.healthRoutines.map((item) => (
              <p key={item.id}>
                <span className="font-medium text-foreground">{item.name}</span>
                {" · "}
                {item.time}
                {" · "}
                {item.startDate} → {item.endDate}
                {" · "}
                {item.enabled ? "On" : "Off"}
              </p>
            ))
          )}
        </Section>

        <Separator />
        <p className="text-xs text-muted-foreground">
          ElderWise supports family communication and routine monitoring. It is not a substitute
          for professional medical advice or emergency services.
        </p>
      </div>
    </WizardShell>
  );
}
