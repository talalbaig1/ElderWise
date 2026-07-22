"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlankBuddy, createBlankDoctor } from "@/lib/loved-ones";
import { useElderWiseStore } from "@/lib/store";
import type { FamilyDoctor, LocalBuddy } from "@/types";

export function CareCircleTab({ lovedOneId }: { lovedOneId: string }) {
  const { store, setStore } = useElderWiseStore();
  const buddy = store.localBuddies.find((b) => b.lovedOneId === lovedOneId) ?? null;
  const doctor = store.doctors.find((d) => d.lovedOneId === lovedOneId) ?? null;
  const carePartner = store.carePartner;

  const [buddyDraft, setBuddyDraft] = useState<LocalBuddy | null>(null);
  const [doctorDraft, setDoctorDraft] = useState<FamilyDoctor | null>(null);

  const saveBuddy = (value: LocalBuddy) => {
    if (
      !value.name.trim() ||
      !value.whatsappNumber.trim() ||
      !value.directContactNumber?.trim()
    ) {
      toast.error("Name, WhatsApp, and direct contact number are required");
      return;
    }
    setStore((prev) => {
      const exists = prev.localBuddies.some((b) => b.id === value.id);
      const next = {
        ...value,
        relationship: value.relationship || "Local Buddy",
        preferredContactMethod: value.preferredContactMethod || "whatsapp",
        updatedAt: new Date().toISOString(),
      };
      const localBuddies = exists
        ? prev.localBuddies.map((b) => (b.id === value.id ? next : b))
        : [...prev.localBuddies, next];
      return {
        ...prev,
        localBuddies,
        lovedOnes: prev.lovedOnes.map((lo) =>
          lo.id === lovedOneId ? { ...lo, localBuddyId: next.id } : lo,
        ),
      };
    });
    setBuddyDraft(null);
    toast.success("Local Buddy saved");
  };

  const saveDoctor = (value: FamilyDoctor) => {
    if (!value.name.trim() || !value.whatsappNumber.trim()) {
      toast.error("Doctor name and WhatsApp are required");
      return;
    }
    setStore((prev) => {
      const exists = prev.doctors.some((d) => d.id === value.id);
      const next = { ...value, updatedAt: new Date().toISOString() };
      const doctors = exists
        ? prev.doctors.map((d) => (d.id === value.id ? next : d))
        : [...prev.doctors, next];
      return {
        ...prev,
        doctors,
        lovedOnes: prev.lovedOnes.map((lo) =>
          lo.id === lovedOneId ? { ...lo, doctorId: next.id } : lo,
        ),
      };
    });
    setDoctorDraft(null);
    toast.success("Family Doctor saved");
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
            {carePartner?.directContactNumber || carePartner?.whatsappNumber || "No phone yet"}
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
            onClick={() => setBuddyDraft(buddy ?? createBlankBuddy(lovedOneId))}
          >
            {buddy ? "Edit" : "Add"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {buddyDraft ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={buddyDraft.name}
                  onChange={(e) => setBuddyDraft({ ...buddyDraft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp contact number</Label>
                <Input
                  value={buddyDraft.whatsappNumber}
                  onChange={(e) =>
                    setBuddyDraft({ ...buddyDraft, whatsappNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Direct contact number</Label>
                <Input
                  value={buddyDraft.directContactNumber || ""}
                  onChange={(e) =>
                    setBuddyDraft({ ...buddyDraft, directContactNumber: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveBuddy(buddyDraft)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBuddyDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : buddy ? (
            <>
              <p className="font-semibold">{buddy.name}</p>
              <p className="text-muted-foreground">WhatsApp · {buddy.whatsappNumber}</p>
              <p className="text-muted-foreground">
                Direct · {buddy.directContactNumber || "—"}
              </p>
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
            onClick={() => setDoctorDraft(doctor ?? createBlankDoctor(lovedOneId))}
          >
            {doctor ? "Edit" : "Add"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {doctorDraft ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={doctorDraft.name}
                  onChange={(e) => setDoctorDraft({ ...doctorDraft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp number</Label>
                <Input
                  value={doctorDraft.whatsappNumber}
                  onChange={(e) =>
                    setDoctorDraft({ ...doctorDraft, whatsappNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Direct contact number</Label>
                <Input
                  value={doctorDraft.directContactNumber || ""}
                  onChange={(e) =>
                    setDoctorDraft({ ...doctorDraft, directContactNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Clinic or hospital</Label>
                <Input
                  value={doctorDraft.clinicOrHospitalName || ""}
                  onChange={(e) =>
                    setDoctorDraft({ ...doctorDraft, clinicOrHospitalName: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveDoctor(doctorDraft)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDoctorDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : doctor ? (
            <>
              <p className="font-semibold">{doctor.name}</p>
              <p className="text-muted-foreground">{doctor.whatsappNumber}</p>
              <p className="text-muted-foreground">{doctor.clinicOrHospitalName}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Not added yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
