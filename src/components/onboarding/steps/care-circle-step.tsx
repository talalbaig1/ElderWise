"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FieldError, WhatsAppNumberInput } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  discardDraftElder,
  getOwnDraftElder,
  saveCareCircleDraft,
} from "@/lib/data/onboarding-actions";
import {
  carePartnerCircleSchema,
  doctorCircleSchema,
  emptyDoctor,
  emptyLocalBuddy,
  isDoctorEngaged,
  isLocalBuddyEngaged,
  isUnfinishedDraftError,
  localBuddyCircleSchema,
  lovedOneCircleSchema,
} from "@/lib/onboarding";
import {
  validateOptionalWhatsAppNumber,
  validateRequiredWhatsAppNumber,
} from "@/lib/whatsapp-e164";

function issuesToErrors(prefix: string, issues: { path: PropertyKey[]; message: string }[]) {
  const next: Record<string, string> = {};
  for (const issue of issues) {
    const key = `${prefix}.${String(issue.path[0] ?? "form")}`;
    if (!next[key]) next[key] = issue.message;
  }
  return next;
}

export function CareCircleStep() {
  const { draft, patchDraft, setStepId } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  const carePartner = draft.carePartner;
  const lovedOne = draft.lovedOne;
  const localBuddy = draft.localBuddy;
  const doctor = draft.doctor;
  const buddyEngaged = isLocalBuddyEngaged(localBuddy);
  const doctorEngaged = isDoctorEngaged(doctor);

  const canProceed = useMemo(() => {
    const cpWa = validateRequiredWhatsAppNumber(carePartner.whatsappNumber);
    if (!cpWa.ok || !carePartner.timeZone.trim()) return false;

    const loWa = validateRequiredWhatsAppNumber(lovedOne.whatsappNumber);
    if (
      !loWa.ok ||
      !lovedOne.firstName.trim() ||
      !lovedOne.lastName.trim() ||
      !lovedOne.timeZone.trim() ||
      !lovedOne.relationshipToCarePartner.trim() ||
      !lovedOne.address.trim() ||
      !Number.isInteger(lovedOne.age) ||
      lovedOne.age < 1 ||
      lovedOne.age > 120
    ) {
      return false;
    }

    if (buddyEngaged) {
      const buddyWa = validateRequiredWhatsAppNumber(localBuddy.whatsappNumber);
      if (
        !buddyWa.ok ||
        !localBuddy.firstName.trim() ||
        !localBuddy.lastName.trim()
      ) {
        return false;
      }
    }

    if (doctorEngaged) {
      const doctorWa = validateOptionalWhatsAppNumber(doctor.whatsappNumber);
      if (
        !doctorWa.ok ||
        !doctor.firstName.trim() ||
        !doctor.lastName.trim() ||
        !doctor.clinicName.trim()
      ) {
        return false;
      }
    }

    return true;
  }, [buddyEngaged, carePartner, doctor, doctorEngaged, localBuddy, lovedOne]);

  const runSave = async (): Promise<boolean> => {
    const cpParsed = carePartnerCircleSchema.safeParse(carePartner);
    const loParsed = lovedOneCircleSchema.safeParse(lovedOne);
    const buddyParsed = buddyEngaged ? localBuddyCircleSchema.safeParse(localBuddy) : null;
    const doctorParsed = doctorEngaged ? doctorCircleSchema.safeParse(doctor) : null;

    const nextErrors: Record<string, string> = {
      ...(!cpParsed.success ? issuesToErrors("carePartner", cpParsed.error.issues) : {}),
      ...(!loParsed.success ? issuesToErrors("lovedOne", loParsed.error.issues) : {}),
      ...(buddyParsed && !buddyParsed.success
        ? issuesToErrors("localBuddy", buddyParsed.error.issues)
        : {}),
      ...(doctorParsed && !doctorParsed.success
        ? issuesToErrors("doctor", doctorParsed.error.issues)
        : {}),
    };

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please complete the required fields");
      return false;
    }
    setErrors({});

    const cpWa = validateRequiredWhatsAppNumber(carePartner.whatsappNumber);
    const loWa = validateRequiredWhatsAppNumber(lovedOne.whatsappNumber);
    if (!cpWa.ok || !loWa.ok) {
      setErrors({
        ...(cpWa.ok ? {} : { "carePartner.whatsappNumber": cpWa.error }),
        ...(loWa.ok ? {} : { "lovedOne.whatsappNumber": loWa.error }),
      });
      toast.error("Please complete the required fields");
      return false;
    }

    const buddyWa =
      buddyEngaged ? validateRequiredWhatsAppNumber(localBuddy.whatsappNumber) : null;
    const doctorWa =
      doctorEngaged ? validateOptionalWhatsAppNumber(doctor.whatsappNumber) : null;
    if (buddyWa && !buddyWa.ok) {
      setErrors({ "localBuddy.whatsappNumber": buddyWa.error });
      toast.error("Please complete the required fields");
      return false;
    }
    if (doctorWa && !doctorWa.ok) {
      setErrors({ "doctor.whatsappNumber": doctorWa.error });
      toast.error("Please complete the required fields");
      return false;
    }

    setBusy(true);
    const result = await saveCareCircleDraft({
      carePartner: {
        whatsappNumber: cpWa.value,
        timezone: carePartner.timeZone,
        firstName: draft.carePartnerProfile.firstName,
        lastName: draft.carePartnerProfile.lastName,
        email: draft.carePartnerProfile.email,
      },
      elder: {
        id: draft.elderId,
        firstName: lovedOne.firstName,
        lastName: lovedOne.lastName,
        age: lovedOne.age,
        relationshipToCarePartner: lovedOne.relationshipToCarePartner,
        whatsappNumber: loWa.value,
        timezone: lovedOne.timeZone,
        address: lovedOne.address,
      },
      localBuddy: buddyEngaged && buddyWa?.ok
        ? {
            ...localBuddy,
            whatsappNumber: buddyWa.value,
          }
        : null,
      doctor: doctorEngaged && doctorWa?.ok
        ? {
            ...doctor,
            whatsappNumber: doctorWa.value ?? "",
          }
        : null,
    });
    setBusy(false);

    if (!result.ok) {
      if (isUnfinishedDraftError(result.error)) {
        setConflictOpen(true);
        return false;
      }
      toast.error(result.error);
      return false;
    }

    patchDraft({ elderId: result.elderId });
    setStepId("wellness-details");
    return true;
  };

  const onNext = async () => {
    await runSave();
  };

  const onResumeOtherDraft = async () => {
    setBusy(true);
    const res = await getOwnDraftElder();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!res.draft) {
      toast.error("No unfinished draft found");
      setConflictOpen(false);
      return;
    }
    patchDraft({ elderId: res.draft.id });
    setConflictOpen(false);
    toast.message(`Resuming ${res.draft.firstName}'s setup — press Next to save these details.`);
  };

  const onDiscardOtherDraft = async () => {
    setBusy(true);
    const res = await getOwnDraftElder();
    if (!res.ok || !res.draft) {
      setBusy(false);
      toast.error(res.ok ? "No unfinished draft found" : res.error);
      setConflictOpen(false);
      return;
    }
    const discardRes = await discardDraftElder(res.draft.id);
    setBusy(false);
    if (!discardRes.ok) {
      toast.error(discardRes.error);
      return;
    }
    setConflictOpen(false);
    toast.message("Discarded the previous unfinished setup");
    await runSave();
  };

  return (
    <WizardShell onNext={onNext} busy={busy} nextDisabled={!canProceed}>
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <h3 className="font-display text-xl">Care Partner (you)</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {draft.carePartnerProfile.firstName} {draft.carePartnerProfile.lastName}
            </p>
            {draft.carePartnerProfile.email ? <p>{draft.carePartnerProfile.email}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cp-wa">WhatsApp number</Label>
              <WhatsAppNumberInput
                id="cp-wa"
                value={carePartner.whatsappNumber}
                onChange={(whatsappNumber) =>
                  patchDraft({ carePartner: { ...carePartner, whatsappNumber } })
                }
                onBlurError={(message) =>
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (message) next["carePartner.whatsappNumber"] = message;
                    else delete next["carePartner.whatsappNumber"];
                    return next;
                  })
                }
                error={errors["carePartner.whatsappNumber"]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-tz">Time zone</Label>
              <Input
                id="cp-tz"
                placeholder="Asia/Kolkata"
                value={carePartner.timeZone}
                onChange={(e) =>
                  patchDraft({ carePartner: { ...carePartner, timeZone: e.target.value } })
                }
              />
              <FieldError message={errors["carePartner.timeZone"]} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <h3 className="font-display text-xl">Loved One</h3>
          <div className="space-y-2">
            <Label htmlFor="lo-wa">WhatsApp number</Label>
            <WhatsAppNumberInput
              id="lo-wa"
              placeholder="We'll send check-ins here — e.g. +966 5XX XXX XXX"
              value={lovedOne.whatsappNumber}
              onChange={(whatsappNumber) =>
                patchDraft({ lovedOne: { ...lovedOne, whatsappNumber } })
              }
              onBlurError={(message) =>
                setErrors((prev) => {
                  const next = { ...prev };
                  if (message) next["lovedOne.whatsappNumber"] = message;
                  else delete next["lovedOne.whatsappNumber"];
                  return next;
                })
              }
              error={errors["lovedOne.whatsappNumber"]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lo-first">First name</Label>
              <Input
                id="lo-first"
                value={lovedOne.firstName}
                onChange={(e) => patchDraft({ lovedOne: { ...lovedOne, firstName: e.target.value } })}
              />
              <FieldError message={errors["lovedOne.firstName"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lo-last">Last name</Label>
              <Input
                id="lo-last"
                value={lovedOne.lastName}
                onChange={(e) => patchDraft({ lovedOne: { ...lovedOne, lastName: e.target.value } })}
              />
              <FieldError message={errors["lovedOne.lastName"]} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lo-age">Age</Label>
              <Input
                id="lo-age"
                type="number"
                min={1}
                max={120}
                value={lovedOne.age}
                onChange={(e) =>
                  patchDraft({ lovedOne: { ...lovedOne, age: Number(e.target.value) || 0 } })
                }
              />
              <FieldError message={errors["lovedOne.age"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lo-tz">Time zone</Label>
              <Input
                id="lo-tz"
                placeholder="Asia/Kolkata"
                value={lovedOne.timeZone}
                onChange={(e) => patchDraft({ lovedOne: { ...lovedOne, timeZone: e.target.value } })}
              />
              <FieldError message={errors["lovedOne.timeZone"]} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lo-rel">Relationship to Care Partner</Label>
            <Input
              id="lo-rel"
              placeholder="Father, Mother, Grandmother…"
              value={lovedOne.relationshipToCarePartner}
              onChange={(e) =>
                patchDraft({
                  lovedOne: { ...lovedOne, relationshipToCarePartner: e.target.value },
                })
              }
            />
            <FieldError message={errors["lovedOne.relationshipToCarePartner"]} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lo-address">Address</Label>
            <Input
              id="lo-address"
              placeholder="Street, apartment, city"
              value={lovedOne.address}
              onChange={(e) => patchDraft({ lovedOne: { ...lovedOne, address: e.target.value } })}
            />
            <p className="text-xs text-muted-foreground">
              We only share this with your Local Buddy during an emergency.
            </p>
            <FieldError message={errors["lovedOne.address"]} />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl">Local Buddy</h3>
            {buddyEngaged ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patchDraft({ localBuddy: emptyLocalBuddy() })}
              >
                Skip for now
              </Button>
            ) : null}
          </div>
          <p className="rounded-2xl bg-sage/60 px-4 py-3 text-sm text-primary">
            Someone nearby who can respond in person during an SOS. Highly recommended, but you
            can add them later.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="buddy-first">First name</Label>
              <Input
                id="buddy-first"
                value={localBuddy.firstName}
                onChange={(e) => patchDraft({ localBuddy: { ...localBuddy, firstName: e.target.value } })}
              />
              <FieldError message={errors["localBuddy.firstName"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buddy-last">Last name</Label>
              <Input
                id="buddy-last"
                value={localBuddy.lastName}
                onChange={(e) => patchDraft({ localBuddy: { ...localBuddy, lastName: e.target.value } })}
              />
              <FieldError message={errors["localBuddy.lastName"]} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buddy-wa">WhatsApp number</Label>
            <WhatsAppNumberInput
              id="buddy-wa"
              value={localBuddy.whatsappNumber}
              onChange={(whatsappNumber) =>
                patchDraft({ localBuddy: { ...localBuddy, whatsappNumber } })
              }
              onBlurError={(message) =>
                setErrors((prev) => {
                  const next = { ...prev };
                  if (message) next["localBuddy.whatsappNumber"] = message;
                  else delete next["localBuddy.whatsappNumber"];
                  return next;
                })
              }
              error={errors["localBuddy.whatsappNumber"]}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl">Family Doctor</h3>
            {doctorEngaged ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patchDraft({ doctor: emptyDoctor() })}
              >
                Skip for now
              </Button>
            ) : null}
          </div>
          <p className="rounded-2xl bg-sage/60 px-4 py-3 text-sm text-primary">
            Family Doctors are notified for urgent situations — not day-to-day check-ins.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-first">First name</Label>
              <Input
                id="doc-first"
                value={doctor.firstName}
                onChange={(e) => patchDraft({ doctor: { ...doctor, firstName: e.target.value } })}
              />
              <FieldError message={errors["doctor.firstName"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-last">Last name</Label>
              <Input
                id="doc-last"
                value={doctor.lastName}
                onChange={(e) => patchDraft({ doctor: { ...doctor, lastName: e.target.value } })}
              />
              <FieldError message={errors["doctor.lastName"]} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-clinic">Clinic or hospital</Label>
            <Input
              id="doc-clinic"
              value={doctor.clinicName}
              onChange={(e) => patchDraft({ doctor: { ...doctor, clinicName: e.target.value } })}
            />
            <FieldError message={errors["doctor.clinicName"]} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-wa">WhatsApp number (optional)</Label>
            <WhatsAppNumberInput
              id="doc-wa"
              optional
              value={doctor.whatsappNumber}
              onChange={(whatsappNumber) =>
                patchDraft({ doctor: { ...doctor, whatsappNumber } })
              }
              onBlurError={(message) =>
                setErrors((prev) => {
                  const next = { ...prev };
                  if (message) next["doctor.whatsappNumber"] = message;
                  else delete next["doctor.whatsappNumber"];
                  return next;
                })
              }
              error={errors["doctor.whatsappNumber"]}
            />
          </div>
        </section>
      </div>

      <Dialog
        open={conflictOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setConflictOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You have an unfinished Loved One setup</DialogTitle>
            <DialogDescription>
              Resume to continue that setup where you left off, or discard it permanently
              (including its WhatsApp number) to save the details you just entered. Cancel makes
              no changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={busy} onClick={() => void onResumeOtherDraft()}>
              Resume unfinished setup
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onDiscardOtherDraft()}>
              {busy ? "Discarding…" : "Discard and use these details"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConflictOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardShell>
  );
}
