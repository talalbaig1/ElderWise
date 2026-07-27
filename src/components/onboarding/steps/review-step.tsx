"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CONSENT_TERMS_VERSION } from "@/lib/consent-terms-version";
import { saveReviewConsents } from "@/lib/data/onboarding-actions";
import { isDoctorEngaged, isLocalBuddyEngaged } from "@/lib/onboarding";

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
  const [consentWhatsApp, setConsentWhatsApp] = useState(false);
  const [consentMed, setConsentMed] = useState(false);
  const [consentShare, setConsentShare] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);

  const hasShareTarget =
    isLocalBuddyEngaged(draft.localBuddy) || isDoctorEngaged(draft.doctor);
  const lo = draft.lovedOne;

  const onNext = async () => {
    if (!draft.elderId) {
      toast.error("Save Care Circle first");
      setStepId("care-circle");
      return;
    }
    if (!consentWhatsApp) {
      toast.error("Confirm that your Loved One agreed to ElderWise WhatsApp messages");
      return;
    }
    if (!consentMed) {
      toast.error("Confirm medication details accuracy and the no-medical-advice notice");
      return;
    }
    if (hasShareTarget && !consentShare) {
      toast.error("Confirm data-sharing with the Local Buddy and/or Doctor you added");
      return;
    }
    if (!consentTerms) {
      toast.error("Confirm Terms & Privacy");
      return;
    }

    setBusy(true);
    const result = await saveReviewConsents({
      elderId: draft.elderId,
      consentMedAccuracy: true,
      consentDataSharing: hasShareTarget,
      consentTerms: true,
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
      onNext={() => void onNext()}
      nextLabel="Finish setup"
      busy={busy}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Review everything below, then confirm the consents to continue.
        </p>

        <Section title="Loved One" onEdit={() => setStepId("care-circle")}>
          <p className="font-medium text-foreground">
            {lo.firstName} {lo.lastName} · age {lo.age}
          </p>
          <p>{lo.relationshipToCarePartner}</p>
          <p>WhatsApp · {lo.whatsappNumber}</p>
          <p>{lo.timeZone}</p>
        </Section>

        <Section title="Care Partner" onEdit={() => setStepId("care-circle")}>
          <p className="font-medium text-foreground">
            {draft.carePartnerProfile.firstName} {draft.carePartnerProfile.lastName}
          </p>
          <p>WhatsApp · {draft.carePartner.whatsappNumber}</p>
          <p>{draft.carePartner.timeZone}</p>
        </Section>

        <Section title="Local Buddy" onEdit={() => setStepId("care-circle")}>
          {!isLocalBuddyEngaged(draft.localBuddy) ? (
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

        <Section title="Family Doctor" onEdit={() => setStepId("care-circle")}>
          {!isDoctorEngaged(draft.doctor) ? (
            <p>Skipped — can add later</p>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {draft.doctor.firstName} {draft.doctor.lastName}
              </p>
              <p>{draft.doctor.clinicName}</p>
              <p>
                WhatsApp · {draft.doctor.whatsappNumber.trim() || "Not provided"}
              </p>
            </>
          )}
        </Section>

        <Section title="Wellness Details" onEdit={() => setStepId("wellness-details")}>
          <p>
            {draft.medications.length} medication
            {draft.medications.length === 1 ? "" : "s"} · {draft.foodRoutines.length}{" "}
            meal
            {draft.foodRoutines.length === 1 ? "" : "s"} · {draft.healthRoutines.length}{" "}
            health routine
            {draft.healthRoutines.length === 1 ? "" : "s"}
          </p>
        </Section>

        <Separator />

        <div className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <h3 className="font-display text-xl">Consents</h3>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentWhatsApp}
              onCheckedChange={(v) => setConsentWhatsApp(v === true)}
              className="mt-0.5"
            />
            <span>
              I confirm that {lo.firstName || "my Loved One"} has agreed to receive
              ElderWise WhatsApp messages. Silence is not consent (N5).
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentMed}
              onCheckedChange={(v) => setConsentMed(v === true)}
              className="mt-0.5"
            />
            <span>
              I confirm the medication details are accurate, and I understand ElderWise
              does not give medical advice.
            </span>
          </label>

          {hasShareTarget ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={consentShare}
                onCheckedChange={(v) => setConsentShare(v === true)}
                className="mt-0.5"
              />
              <span>
                I consent to sharing health summaries with the Local Buddy and/or Family
                Doctor named above. This also records my explicit approval of the Doctor
                contact when one was added.
              </span>
            </label>
          ) : null}

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consentTerms}
              onCheckedChange={(v) => setConsentTerms(v === true)}
              className="mt-0.5"
            />
            <span>
              I re-confirm the{" "}
              <Link href="/terms" className="font-semibold text-primary underline" target="_blank">
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-primary underline"
                target="_blank"
              >
                Privacy Policy
              </Link>{" "}
              (version {CONSENT_TERMS_VERSION}).
            </span>
          </label>
          <Label className="sr-only">Consent checklist</Label>
        </div>
      </div>
    </WizardShell>
  );
}
