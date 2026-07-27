"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlankBuddy, createBlankDoctor } from "@/lib/loved-ones";
import { useDomainStore } from "@/components/data/app-data-provider";
import { upsertDoctor, upsertLocalCaregiver } from "@/lib/data/actions";
import {
  issueDoctorShareLink,
  revokeDoctorShareLink,
} from "@/lib/data/share-link-actions";
import { formatViewerDateTime } from "@/lib/time/display";
import type { FamilyDoctor, LocalBuddy } from "@/types";
import { useRouter } from "next/navigation";

export function CareCircleTab({ lovedOneId }: { lovedOneId: string }) {
  const router = useRouter();
  const { store, data, viewerTimeZone } = useDomainStore();
  const buddy = store.localBuddies.find((b) => b.lovedOneId === lovedOneId) ?? null;
  const doctor = store.doctors.find((d) => d.lovedOneId === lovedOneId) ?? null;
  const carePartner = store.carePartner;
  const shareLinks = data.doctorShareLinks.filter((l) => l.lovedOneId === lovedOneId);
  const activeLinks = shareLinks.filter((l) => !l.revokedAt);

  const [buddyDraft, setBuddyDraft] = useState<LocalBuddy | null>(null);
  const [doctorDraft, setDoctorDraft] = useState<FamilyDoctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const saveBuddy = async (value: LocalBuddy) => {
    setSaving(true);
    try {
      const result = await upsertLocalCaregiver(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Local Buddy saved");
      setBuddyDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const saveDoctor = async (value: FamilyDoctor) => {
    setSaving(true);
    try {
      const result = await upsertDoctor(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Family Doctor saved");
      setDoctorDraft(null);
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
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => setBuddyDraft(buddy ?? createBlankBuddy(lovedOneId))}
          >
            {buddy ? "Edit" : "Add"}
          </Button>
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
                <Input
                  value={buddyDraft.whatsappNumber}
                  onChange={(e) =>
                    setBuddyDraft({ ...buddyDraft, whatsappNumber: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={saving} onClick={() => saveBuddy(buddyDraft)}>
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
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => setDoctorDraft(doctor ?? createBlankDoctor(lovedOneId))}
          >
            {doctor ? "Edit" : "Add"}
          </Button>
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
                <Input
                  value={doctorDraft.whatsappNumber}
                  onChange={(e) =>
                    setDoctorDraft({ ...doctorDraft, whatsappNumber: e.target.value })
                  }
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
                <Button size="sm" disabled={saving} onClick={() => saveDoctor(doctorDraft)}>
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
          <Button size="sm" disabled={saving || !doctor} onClick={issueLink}>
            Issue share link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!doctor ? (
            <p className="text-sm text-muted-foreground">
              Add a Family Doctor before issuing a read-only share link.
            </p>
          ) : null}
          {issuedUrl ? (
            <div className="rounded-xl border border-primary/30 bg-secondary/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Copy now — raw token is not stored
              </p>
              <p className="mt-1 break-all font-mono text-xs">{issuedUrl}</p>
            </div>
          ) : null}
          {activeLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active share links.</p>
          ) : (
            <ul className="space-y-2">
              {activeLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      Expires{" "}
                      {link.expiresAt
                        ? formatViewerDateTime(link.expiresAt, viewerTimeZone)
                        : "never"}
                    </p>
                    {link.lastAccessedAt ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Last opened {formatViewerDateTime(link.lastAccessedAt, viewerTimeZone)}
                      </p>
                    ) : (
                      <p className="font-mono text-[11px] text-muted-foreground">Not opened yet</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => revokeLink(link.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
