"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppNumberInput } from "@/components/onboarding/fields";
import { createBlankBuddy, createBlankDoctor } from "@/lib/loved-ones";
import { useDomainStore } from "@/components/data/app-data-provider";
import {
  deleteDoctor,
  deleteLocalCaregiver,
  upsertDoctor,
  upsertLocalCaregiver,
} from "@/lib/data/actions";
import {
  issueDoctorShareLink,
  revokeActiveDoctorShareLinks,
  revokeDoctorShareLink,
} from "@/lib/data/share-link-actions";
import { formatViewerDateTime } from "@/lib/time/display";
import type { DoctorShareLink, FamilyDoctor, LocalBuddy } from "@/types";
import { useRouter } from "next/navigation";
import {
  validateOptionalWhatsAppNumber,
  validateRequiredWhatsAppNumber,
} from "@/lib/whatsapp-e164";

/** Working link: not revoked and not past expires_at. */
function isActiveShareLink(link: DoctorShareLink, nowMs = Date.now()): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= nowMs) return false;
  return true;
}

export function CareCircleTab({ lovedOneId }: { lovedOneId: string }) {
  const router = useRouter();
  const { store, data, viewerTimeZone } = useDomainStore();
  const buddy = store.localBuddies.find((b) => b.lovedOneId === lovedOneId) ?? null;
  const doctor = store.doctors.find((d) => d.lovedOneId === lovedOneId) ?? null;
  const carePartner = store.carePartner;
  const shareLinks = data.doctorShareLinks.filter((l) => l.lovedOneId === lovedOneId);
  const unrevokedLinks = shareLinks
    .filter((l) => !l.revokedAt)
    .slice()
    .sort((a, b) => {
      // Dashboard-issued (sosEventId null) first, then by expires_at desc.
      const aDash = a.sosEventId ? 1 : 0;
      const bDash = b.sosEventId ? 1 : 0;
      if (aDash !== bDash) return aDash - bDash;
      const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
      const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
      return bExp - aExp;
    });
  const activeLinks = unrevokedLinks.filter((l) => isActiveShareLink(l));
  // Matches partial unique index (revoked_at IS NULL AND sos_event_id IS NULL) —
  // expired dashboard links still occupy the slot until revoked.
  const hasUnrevokedDashboardLink = unrevokedLinks.some((l) => !l.sosEventId);

  const [buddyDraft, setBuddyDraft] = useState<LocalBuddy | null>(null);
  const [doctorDraft, setDoctorDraft] = useState<FamilyDoctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [buddyWhatsappError, setBuddyWhatsappError] = useState<string | undefined>();
  const [doctorWhatsappError, setDoctorWhatsappError] = useState<string | undefined>();

  const saveBuddy = async (value: LocalBuddy) => {
    const whatsapp = validateRequiredWhatsAppNumber(value.whatsappNumber);
    if (!whatsapp.ok) {
      setBuddyWhatsappError(whatsapp.error);
      toast.error(whatsapp.error);
      return;
    }

    setSaving(true);
    try {
      const result = await upsertLocalCaregiver({ ...value, whatsappNumber: whatsapp.value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Local Buddy saved");
      setBuddyWhatsappError(undefined);
      setBuddyDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const removeBuddy = async () => {
    if (!buddy) return;
    if (
      !window.confirm(
        "Delete this Local Buddy? They will no longer receive SOS alerts.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await deleteLocalCaregiver(buddy.id, lovedOneId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Local Buddy deleted");
      setBuddyDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const saveDoctor = async (value: FamilyDoctor) => {
    const whatsapp = validateOptionalWhatsAppNumber(value.whatsappNumber);
    if (!whatsapp.ok) {
      setDoctorWhatsappError(whatsapp.error);
      toast.error(whatsapp.error);
      return;
    }

    setSaving(true);
    try {
      const result = await upsertDoctor({
        ...value,
        whatsappNumber: whatsapp.value ?? "",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Family Doctor saved");
      setDoctorWhatsappError(undefined);
      setDoctorDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const removeDoctor = async () => {
    if (!doctor) return;
    const n = activeLinks.length;
    const linkNote =
      n === 0
        ? "No active share links will be affected."
        : n === 1
          ? "1 active share link will also be revoked."
          : `${n} active share links will also be revoked.`;
    if (
      !window.confirm(
        `Delete this Family Doctor? ${linkNote} You will need to add a doctor again before issuing a new dashboard share link.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await deleteDoctor(doctor.id, lovedOneId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Family Doctor deleted");
      setDoctorDraft(null);
      setIssuedUrl(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const issueLink = async () => {
    setSaving(true);
    setIssuedUrl(null);
    try {
      const result = await issueDoctorShareLink(lovedOneId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const absolute =
        typeof window !== "undefined"
          ? `${window.location.origin}${result.urlPath}`
          : result.urlPath;
      setIssuedUrl(absolute);
      try {
        await navigator.clipboard.writeText(absolute);
        toast.success("Share link issued and copied — shown once");
      } catch {
        toast.success("Share link issued — copy it now; it is shown once");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    if (!window.confirm("Revoke this doctor share link? It will stop working immediately.")) {
      return;
    }
    setSaving(true);
    try {
      const result = await revokeDoctorShareLink(linkId, lovedOneId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Share link revoked");
      setIssuedUrl(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const revokeAllActive = async () => {
    const n = activeLinks.length;
    if (n === 0) return;
    if (
      !window.confirm(
        n === 1
          ? "Revoke 1 active share link? It will stop working immediately."
          : `Revoke ${n} active share links? They will stop working immediately.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await revokeActiveDoctorShareLinks(lovedOneId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.revokedCount === 1
          ? "1 share link revoked"
          : `${result.revokedCount} share links revoked`,
      );
      setIssuedUrl(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Care Partner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-semibold">
            {carePartner?.firstName} {carePartner?.lastName}
          </p>
          {carePartner?.email ? (
            <p className="text-muted-foreground">{carePartner.email}</p>
          ) : null}
          <p className="text-muted-foreground">
            {carePartner?.whatsappNumber || "No WhatsApp yet"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">You</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Local Buddy</CardTitle>
          <div className="flex gap-2">
            {buddy ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={saving || Boolean(buddyDraft)}
                onClick={removeBuddy}
              >
                Delete
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setBuddyDraft(buddy ?? createBlankBuddy(lovedOneId))}
            >
              {buddy ? "Edit" : "Add"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {buddyDraft ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input
                    value={buddyDraft.firstName}
                    onChange={(e) =>
                      setBuddyDraft({ ...buddyDraft, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input
                    value={buddyDraft.lastName}
                    onChange={(e) =>
                      setBuddyDraft({ ...buddyDraft, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <WhatsAppNumberInput
                  value={buddyDraft.whatsappNumber}
                  onChange={(whatsappNumber) =>
                    setBuddyDraft({ ...buddyDraft, whatsappNumber })
                  }
                  onBlurError={setBuddyWhatsappError}
                  error={buddyWhatsappError}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={
                    saving ||
                    Boolean(buddyWhatsappError) ||
                    !validateRequiredWhatsAppNumber(buddyDraft.whatsappNumber).ok
                  }
                  onClick={() => saveBuddy(buddyDraft)}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBuddyDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : buddy ? (
            <>
              <p className="font-semibold">
                {buddy.firstName} {buddy.lastName}
              </p>
              <p className="text-muted-foreground">{buddy.whatsappNumber}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Not added yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Family Doctor</CardTitle>
          <div className="flex gap-2">
            {doctor ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={saving || Boolean(doctorDraft)}
                onClick={removeDoctor}
              >
                Delete
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setDoctorDraft(doctor ?? createBlankDoctor(lovedOneId))}
            >
              {doctor ? "Edit" : "Add"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {doctorDraft ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input
                    value={doctorDraft.firstName}
                    onChange={(e) =>
                      setDoctorDraft({ ...doctorDraft, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input
                    value={doctorDraft.lastName}
                    onChange={(e) =>
                      setDoctorDraft({ ...doctorDraft, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp (optional)</Label>
                <WhatsAppNumberInput
                  optional
                  value={doctorDraft.whatsappNumber}
                  onChange={(whatsappNumber) =>
                    setDoctorDraft({ ...doctorDraft, whatsappNumber })
                  }
                  onBlurError={setDoctorWhatsappError}
                  error={doctorWhatsappError}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Clinic or hospital</Label>
                <Input
                  value={doctorDraft.clinicName}
                  onChange={(e) =>
                    setDoctorDraft({ ...doctorDraft, clinicName: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={
                    saving ||
                    Boolean(doctorWhatsappError) ||
                    !validateOptionalWhatsAppNumber(doctorDraft.whatsappNumber).ok
                  }
                  onClick={() => saveDoctor(doctorDraft)}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDoctorDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : doctor ? (
            <>
              <p className="font-semibold">
                {doctor.firstName} {doctor.lastName}
              </p>
              <p className="text-muted-foreground">
                {doctor.whatsappNumber || "No WhatsApp on file"}
              </p>
              <p className="text-muted-foreground">{doctor.clinicName}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Not added yet</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">Doctor share links</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={saving || activeLinks.length === 0}
              onClick={revokeAllActive}
            >
              Revoke share link
            </Button>
            <Button
              size="sm"
              disabled={saving || !doctor || hasUnrevokedDashboardLink}
              onClick={issueLink}
            >
              Issue share link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!doctor ? (
            <p className="text-sm text-muted-foreground">
              Add a Family Doctor before issuing a read-only share link.
            </p>
          ) : hasUnrevokedDashboardLink ? (
            <p className="text-sm text-muted-foreground">
              A dashboard share link already exists (including expired-but-unrevoked).
              Revoke it before issuing a new one. The raw URL is shown only once at
              issue time and cannot be recovered.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              The raw URL is shown only once when you issue a link. Only a hash is
              stored — it cannot be displayed again later.
            </p>
          )}
          {issuedUrl ? (
            <div className="rounded-xl border border-primary/30 bg-secondary/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Copy now — raw token is not stored
              </p>
              <p className="mt-1 break-all font-mono text-xs">{issuedUrl}</p>
            </div>
          ) : null}
          {unrevokedLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active share links.</p>
          ) : (
            <ul className="space-y-2">
              {unrevokedLinks.map((link) => {
                const working = isActiveShareLink(link);
                return (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {link.sosEventId
                          ? "Created by SOS alert"
                          : "Issued from dashboard"}
                        {!working ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (expired)
                          </span>
                        ) : null}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Expires{" "}
                        {link.expiresAt
                          ? formatViewerDateTime(link.expiresAt, viewerTimeZone)
                          : "never"}
                      </p>
                      {link.lastAccessedAt ? (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Last opened{" "}
                          {formatViewerDateTime(link.lastAccessedAt, viewerTimeZone)}
                        </p>
                      ) : (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Not opened yet
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={saving}
                      onClick={() => revokeLink(link.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
