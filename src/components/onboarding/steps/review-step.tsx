"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { saveReviewConsents } from "@/lib/data/onboarding-actions";
import { CONSENT_TERMS_VERSION } from "@/lib/consent-terms-version";
import { isDoctorEngaged, isLocalBuddyEngaged, type OnboardingStepId } from "@/lib/onboarding";

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
  const { draft, setStepId } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [consentMedAccuracy, setConsentMedAccuracy] = useState(false);
  const [consentDataSharing, setConsentDataSharing] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);

  const lo = draft.lovedOne;
  const buddyEngaged = isLocalBuddyEngaged(draft.localBuddy);
  const doctorEngaged = isDoctorEngaged(draft.doctor);
  const hasShareTarget = buddyEngaged || doctorEngaged;
  const elderName = lo.firstName || "your Loved One";

  const editStep = (id: OnboardingStepId) => () => setStepId(id);

  const canSubmit =
    consentWhatsapp && consentMedAccuracy && consentTerms && (!hasShareTarget || consentDataSharing);

  const onNext = async () => {
    if (!draft.elderId) {
      toast.error("Save the Care Circle first");
      setStepId("care-circle");
      return;
    }
    if (!canSubmit) {
      toast.error("Please confirm all required consents");
      return;
    }
    setBusy(true);
    const result = await saveReviewConsents({
      elderId: draft.elderId,
      consentMedAccuracy,
      consentDataSharing: hasShareTarget ? consentDataSharing : false,
      consentTerms,
      consentTermsVersion: CONSENT_TERMS_VERSION,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setStepId("completion");
  };

  return (
    <WizardShell
      onBack={() => setStepId("wellness-details")}
      onNext={onNext}
      nextLabel="Finish setup"
      busy={busy}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review everything below. You can edit any section before finishing.
        </p>

        <Section title="Care Partner" onEdit={editStep("care-circle")}>
          <p className="font-medium text-foreground">
            {draft.carePartnerProfile.firstName} {draft.carePartnerProfile.lastName}
          </p>
          {draft.carePartnerProfile.email ? <p>{draft.carePartnerProfile.email}</p> : null}
          <p>WhatsApp · {draft.carePartner.whatsappNumber}</p>
          <p>{draft.carePartner.timeZone}</p>
        </Section>

        <Section title="Loved One" onEdit={editStep("care-circle")}>
          <p className="font-medium text-foreground">
            {lo.firstName} {lo.lastName}
          </p>
          <p>
            {lo.relationshipToCarePartner} · Age {lo.age}
          </p>
          <p>WhatsApp · {lo.whatsappNumber}</p>
          <p>{lo.timeZone}</p>
          <p>{lo.address}</p>
        </Section>

        <Section title="Local Buddy" onEdit={editStep("care-circle")}>
          {!buddyEngaged ? (
            <p>Skipped — can add later</p>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {draft.localBuddy.firstName} {draft.localBuddy.lastName}
              </p>
              <p>WhatsApp · {draft.localBuddy.whatsappNumber}</p>
            </>
          )}
        </Section>

        <Section title="Family Doctor" onEdit={editStep("care-circle")}>
          {!doctorEngaged ? (
            <p>Skipped — can add later</p>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {draft.doctor.firstName} {draft.doctor.lastName}
              </p>
              <p>{draft.doctor.clinicName}</p>
              {draft.doctor.whatsappNumber ? <p>WhatsApp · {draft.doctor.whatsappNumber}</p> : null}
            </>
          )}
        </Section>

        <Section title="Medication" onEdit={editStep("wellness-details")}>
          {draft.medications.map((item) => (
            <p key={item.id}>
              <span className="font-medium text-foreground">{item.name}</span>
              {" · "}
              {item.dosage} {item.dosageUnit}
              {" · "}
              {item.time}
              {" · "}
              {item.enabled ? "On" : "Off"}
            </p>
          ))}
        </Section>

        <Section title="Food routines" onEdit={editStep("wellness-details")}>
          {draft.foodRoutines.map((item) => (
            <p key={item.id}>
              <span className="font-medium text-foreground">{item.mealName}</span>
              {" · "}
              {item.checkInTime}
              {" · "}
              {item.enabled ? "On" : "Off"}
            </p>
          ))}
        </Section>

        <Section title="Health routines" onEdit={editStep("wellness-details")}>
          {draft.healthRoutines.length === 0 ? (
            <p>None added</p>
          ) : (
            draft.healthRoutines.map((item) => (
              <p key={item.id}>
                <span className="font-medium text-foreground">{item.name}</span>
                {" · "}
                {item.time}
                {" · "}
                {item.enabled ? "On" : "Off"}
              </p>
            ))
          )}
        </Section>

        <Separator />

        <div className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <h3 className="font-display text-xl">Confirm before finishing</h3>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentWhatsapp}
              onCheckedChange={(checked) => setConsentWhatsapp(checked === true)}
              className="mt-0.5"
            />
            <span className="leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                I confirm {elderName} has agreed to receive SilaCare check-in messages on
                WhatsApp.
              </span>
              <span className="mt-1 block text-xs">
                Silence is not consent — {elderName} must actively agree, and can stop at any time
                by replying STOP.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentMedAccuracy}
              onCheckedChange={(checked) => setConsentMedAccuracy(checked === true)}
              className="mt-0.5"
            />
            <span className="leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                The medication details above are accurate to the best of my knowledge.
              </span>
              <span className="mt-1 block text-xs">
                SilaCare does not provide medical advice or diagnosis — always consult a doctor.
              </span>
            </span>
          </label>

          {hasShareTarget ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={consentDataSharing}
                onCheckedChange={(checked) => setConsentDataSharing(checked === true)}
                className="mt-0.5"
              />
              <span className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  I agree to share {elderName}&apos;s check-in and wellbeing information with the
                  Local Buddy and/or Family Doctor named above.
                </span>
              </span>
            </label>
          ) : null}

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentTerms}
              onCheckedChange={(checked) => setConsentTerms(checked === true)}
              className="mt-0.5"
            />
            <span className="leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                I accept the{" "}
                <Link href="/terms" className="font-semibold text-primary hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-semibold text-primary hover:underline">
                  Privacy
                </Link>{" "}
                policy (version {CONSENT_TERMS_VERSION}).
              </span>
            </span>
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          SilaCare supports family communication and routine monitoring. It is not a substitute
          for professional medical advice or emergency services.
        </p>
      </div>
    </WizardShell>
  );
}
