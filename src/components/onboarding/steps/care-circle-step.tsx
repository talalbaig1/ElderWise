"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/onboarding/fields";
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
import { clearOnboardingLocalDraft } from "@/components/onboarding/onboarding-context";

export function CareCircleStep() {
  const { draft, patchDraft, setStepId, updateDraft } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [draftDialog, setDraftDialog] = useState<{
    id: string;
    firstName: string;
  } | null>(null);

  const submitCareCircle = async () => {
    const cpParsed = carePartnerCircleSchema.safeParse(draft.carePartner);
    const loParsed = lovedOneCircleSchema.safeParse(draft.lovedOne);
    const nextErrors: Record<string, string> = {};
    if (!cpParsed.success) {
      cpParsed.error.issues.forEach((i) => {
        const k = `cp.${String(i.path[0] ?? "form")}`;
        if (!nextErrors[k]) nextErrors[k] = i.message;
      });
    }
    if (!loParsed.success) {
      loParsed.error.issues.forEach((i) => {
        const k = `lo.${String(i.path[0] ?? "form")}`;
        if (!nextErrors[k]) nextErrors[k] = i.message;
      });
    }

    let buddyPayload: {
      firstName: string;
      lastName: string;
      whatsappNumber: string;
    } | null = null;
    if (isLocalBuddyEngaged(draft.localBuddy)) {
      const b = localBuddyCircleSchema.safeParse(draft.localBuddy);
      if (!b.success) {
        b.error.issues.forEach((i) => {
          const k = `buddy.${String(i.path[0] ?? "form")}`;
          if (!nextErrors[k]) nextErrors[k] = i.message;
        });
      } else {
        buddyPayload = b.data;
      }
    }

    let doctorPayload: {
      firstName: string;
      lastName: string;
      clinicName: string;
      whatsappNumber?: string;
    } | null = null;
    if (isDoctorEngaged(draft.doctor)) {
      const d = doctorCircleSchema.safeParse(draft.doctor);
      if (!d.success) {
        d.error.issues.forEach((i) => {
          const k = `doc.${String(i.path[0] ?? "form")}`;
          if (!nextErrors[k]) nextErrors[k] = i.message;
        });
      } else {
        doctorPayload = {
          firstName: d.data.firstName,
          lastName: d.data.lastName,
          clinicName: d.data.clinicName,
          whatsappNumber: d.data.whatsappNumber || undefined,
        };
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Complete required Care Circle fields");
      return;
    }
    setErrors({});
    if (!cpParsed.success || !loParsed.success) return;

    setBusy(true);
    const result = await saveCareCircleDraft({
      carePartner: {
        whatsappNumber: cpParsed.data.whatsappNumber,
        timezone: cpParsed.data.timeZone,
        firstName: draft.carePartnerProfile.firstName || undefined,
        lastName: draft.carePartnerProfile.lastName || undefined,
        email: draft.carePartnerProfile.email || undefined,
      },
      elder: {
        id: draft.elderId,
        firstName: loParsed.data.firstName,
        lastName: loParsed.data.lastName,
        age: loParsed.data.age,
        relationshipToCarePartner: loParsed.data.relationshipToCarePartner,
        whatsappNumber: loParsed.data.whatsappNumber,
        timezone: loParsed.data.timeZone,
        address: loParsed.data.address,
      },
      localBuddy: buddyPayload,
      doctor: doctorPayload,
    });
    setBusy(false);

    if (!result.ok) {
      if (isUnfinishedDraftError(result.error)) {
        const own = await getOwnDraftElder();
        if (own.ok && own.draft) {
          setDraftDialog(own.draft);
          return;
        }
      }
      toast.error(result.error);
      return;
    }

    patchDraft({
      elderId: result.elderId,
      currentStepId: "wellness-details",
    });
  };

  const onResumeDraft = () => {
    if (!draftDialog) return;
    patchDraft({ elderId: draftDialog.id });
    setDraftDialog(null);
    toast.message("Resumed unfinished Loved One — review Care Circle and continue");
  };

  const onDiscardDraft = async () => {
    if (!draftDialog) return;
    setBusy(true);
    clearOnboardingLocalDraft();
    const result = await discardDraftElder(draftDialog.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDraftDialog(null);
    patchDraft({ elderId: null });
    toast.message("Unfinished draft discarded — you can save this Care Circle now");
  };

  return (
    <>
      <WizardShell onNext={() => void submitCareCircle()} busy={busy} hideBack>
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <h3 className="font-display text-xl">Care Partner</h3>
            <p className="text-sm text-muted-foreground">
              {draft.carePartnerProfile.firstName} {draft.carePartnerProfile.lastName}
              {draft.carePartnerProfile.email
                ? ` · ${draft.carePartnerProfile.email}`
                : ""}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cp-wa">WhatsApp number</Label>
                <Input
                  id="cp-wa"
                  value={draft.carePartner.whatsappNumber}
                  onChange={(e) =>
                    patchDraft({
                      carePartner: {
                        ...draft.carePartner,
                        whatsappNumber: e.target.value,
                      },
                    })
                  }
                />
                <FieldError message={errors["cp.whatsappNumber"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-tz">Timezone</Label>
                <Input
                  id="cp-tz"
                  placeholder="Asia/Kolkata"
                  value={draft.carePartner.timeZone}
                  onChange={(e) =>
                    patchDraft({
                      carePartner: { ...draft.carePartner, timeZone: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["cp.timeZone"]} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <h3 className="font-display text-xl">Loved One</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lo-first">First name</Label>
                <Input
                  id="lo-first"
                  value={draft.lovedOne.firstName}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: { ...draft.lovedOne, firstName: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["lo.firstName"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lo-last">Last name</Label>
                <Input
                  id="lo-last"
                  value={draft.lovedOne.lastName}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: { ...draft.lovedOne, lastName: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["lo.lastName"]} />
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
                  value={draft.lovedOne.age}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: {
                        ...draft.lovedOne,
                        age: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
                <FieldError message={errors["lo.age"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lo-rel">Relationship to you</Label>
                <Input
                  id="lo-rel"
                  value={draft.lovedOne.relationshipToCarePartner}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: {
                        ...draft.lovedOne,
                        relationshipToCarePartner: e.target.value,
                      },
                    })
                  }
                />
                <FieldError message={errors["lo.relationshipToCarePartner"]} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lo-wa">WhatsApp number</Label>
                <Input
                  id="lo-wa"
                  value={draft.lovedOne.whatsappNumber}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: {
                        ...draft.lovedOne,
                        whatsappNumber: e.target.value,
                      },
                    })
                  }
                />
                <FieldError message={errors["lo.whatsappNumber"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lo-tz">Timezone</Label>
                <Input
                  id="lo-tz"
                  placeholder="Asia/Kolkata"
                  value={draft.lovedOne.timeZone}
                  onChange={(e) =>
                    patchDraft({
                      lovedOne: { ...draft.lovedOne, timeZone: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["lo.timeZone"]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lo-addr">Address</Label>
              <Input
                id="lo-addr"
                value={draft.lovedOne.address}
                onChange={(e) =>
                  patchDraft({
                    lovedOne: { ...draft.lovedOne, address: e.target.value },
                  })
                }
              />
              <FieldError message={errors["lo.address"]} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl">Local Buddy</h3>
              <Button
                type="button"
                variant="soft"
                size="sm"
                disabled={busy}
                onClick={() => {
                  updateDraft((prev) => ({
                    ...prev,
                    localBuddy: emptyLocalBuddy(),
                  }));
                  toast.message("You can add a Local Buddy later in Care Circle");
                }}
              >
                Skip for now
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Someone nearby who can respond in person during an SOS. Optional.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buddy-first">First name</Label>
                <Input
                  id="buddy-first"
                  value={draft.localBuddy.firstName}
                  onChange={(e) =>
                    patchDraft({
                      localBuddy: {
                        ...draft.localBuddy,
                        firstName: e.target.value,
                      },
                    })
                  }
                />
                <FieldError message={errors["buddy.firstName"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buddy-last">Last name</Label>
                <Input
                  id="buddy-last"
                  value={draft.localBuddy.lastName}
                  onChange={(e) =>
                    patchDraft({
                      localBuddy: {
                        ...draft.localBuddy,
                        lastName: e.target.value,
                      },
                    })
                  }
                />
                <FieldError message={errors["buddy.lastName"]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buddy-wa">WhatsApp number</Label>
              <Input
                id="buddy-wa"
                value={draft.localBuddy.whatsappNumber}
                onChange={(e) =>
                  patchDraft({
                    localBuddy: {
                      ...draft.localBuddy,
                      whatsappNumber: e.target.value,
                    },
                  })
                }
              />
              <FieldError message={errors["buddy.whatsappNumber"]} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl">Family Doctor</h3>
              <Button
                type="button"
                variant="soft"
                size="sm"
                disabled={busy}
                onClick={() => {
                  updateDraft((prev) => ({ ...prev, doctor: emptyDoctor() }));
                  toast.message("You can add a Family Doctor later");
                }}
              >
                Skip for now
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Optional. WhatsApp may be left blank — SOS then skips the doctor nudge.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="doc-first">First name</Label>
                <Input
                  id="doc-first"
                  value={draft.doctor.firstName}
                  onChange={(e) =>
                    patchDraft({
                      doctor: { ...draft.doctor, firstName: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["doc.firstName"]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-last">Last name</Label>
                <Input
                  id="doc-last"
                  value={draft.doctor.lastName}
                  onChange={(e) =>
                    patchDraft({
                      doctor: { ...draft.doctor, lastName: e.target.value },
                    })
                  }
                />
                <FieldError message={errors["doc.lastName"]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-clinic">Clinic or hospital</Label>
              <Input
                id="doc-clinic"
                value={draft.doctor.clinicName}
                onChange={(e) =>
                  patchDraft({
                    doctor: { ...draft.doctor, clinicName: e.target.value },
                  })
                }
              />
              <FieldError message={errors["doc.clinicName"]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-wa">WhatsApp number (optional)</Label>
              <Input
                id="doc-wa"
                value={draft.doctor.whatsappNumber}
                onChange={(e) =>
                  patchDraft({
                    doctor: { ...draft.doctor, whatsappNumber: e.target.value },
                  })
                }
              />
              <FieldError message={errors["doc.whatsappNumber"]} />
            </div>
          </section>
        </div>
      </WizardShell>

      <Dialog
        open={!!draftDialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDraftDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Resume unfinished setup for {draftDialog?.firstName ?? "your Loved One"}?
            </DialogTitle>
            <DialogDescription>
              You already started adding {draftDialog?.firstName ?? "this Loved One"}.
              Resume to continue that draft, or discard it to save this Care Circle.
              Discard permanently deletes the unfinished draft (D11).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={busy} onClick={onResumeDraft}>
              Resume unfinished setup
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void onDiscardDraft()}
            >
              {busy ? "Discarding…" : "Discard and continue"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDraftDialog(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
