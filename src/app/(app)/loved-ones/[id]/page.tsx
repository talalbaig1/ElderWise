"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowLeft,
  FileBarChart,
  Mic,
  Pill,
  Siren,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { CareCircleTab } from "@/components/loved-ones/care-circle-tab";
import {
  HealthTab,
  MealsTab,
  MedicationTab,
} from "@/components/loved-ones/routine-tabs";
import { ChoiceChips, WhatsAppNumberInput } from "@/components/onboarding/fields";
import { EmptyState } from "@/components/shared/empty-state";
import { ConsentStatusBadge } from "@/components/shared/consent-status-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeZoneSelect } from "@/components/shared/timezone-select";
import { useDomainStore } from "@/components/data/app-data-provider";
import { updateElder } from "@/lib/data/actions";
import { formatViewerDateTime } from "@/lib/time/display";
import { initials } from "@/lib/utils";
import type { Gender, LovedOne } from "@/types";
import { validateRequiredWhatsAppNumber } from "@/lib/whatsapp-e164";

export default function LovedOneProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { store, setSelectedLovedOneId, hydrated, viewerTimeZone } = useDomainStore();
  const lovedOne = store.lovedOnes.find((lo) => lo.id === params.id);
  const [editingOverview, setEditingOverview] = useState(false);
  const [draft, setDraft] = useState<LovedOne | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | undefined>();

  const related = useMemo(() => {
    if (!lovedOne) return null;
    return {
      meds: store.medications.filter(
        (m) => m.lovedOneId === lovedOne.id && m.enabled,
      ),
      meals: store.foodRoutines.filter(
        (f) => f.lovedOneId === lovedOne.id && f.enabled,
      ),
      health: store.healthRoutines.filter(
        (h) => h.lovedOneId === lovedOne.id && h.enabled,
      ),
      journals: store.voiceJournals
        .filter((j) => j.lovedOneId === lovedOne.id)
        .sort((a, b) => +parseISO(b.recordedAt) - +parseISO(a.recordedAt)),
      sos: store.sosEvents
        .filter((e) => e.lovedOneId === lovedOne.id)
        .sort((a, b) => +parseISO(b.triggeredAt) - +parseISO(a.triggeredAt)),
      reports: store.reports.filter((r) => r.lovedOneId === lovedOne.id),
      buddy: store.localBuddies.find((b) => b.lovedOneId === lovedOne.id),
      doctor: store.doctors.find((d) => d.lovedOneId === lovedOne.id),
    };
  }, [lovedOne, store]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  if (!lovedOne || !related) {
    return (
      <EmptyState
        title="Loved One not found"
        description="This profile may have been removed."
        actionLabel="Back to Loved Ones"
        onAction={() => router.push("/loved-ones")}
      />
    );
  }

  const selected = store.selectedLovedOneId === lovedOne.id;

  const startEdit = () => {
    setDraft({ ...lovedOne });
    setEditingOverview(true);
  };

  const saveOverview = async () => {
    if (!draft) return;

    const whatsapp = validateRequiredWhatsAppNumber(draft.whatsappNumber);
    if (!whatsapp.ok) {
      setWhatsappError(whatsapp.error);
      toast.error(whatsapp.error);
      return;
    }

    setSaving(true);
    try {
      const result = await updateElder({
        id: draft.id,
        firstName: draft.firstName,
        lastName: draft.lastName,
        age: draft.age,
        relationshipToCarePartner: draft.relationshipToCarePartner,
        whatsappNumber: whatsapp.value,
        timeZone: draft.timeZone,
        address: draft.address,
        gender: draft.gender,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved");
      setWhatsappError(undefined);
      setEditingOverview(false);
      setDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/loved-ones" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-base">
              {initials(`${lovedOne.firstName} ${lovedOne.lastName}`)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl">
                {lovedOne.firstName} {lovedOne.lastName}
              </h1>
              {selected ? <Badge variant="secondary">Selected</Badge> : null}
            </div>
            <p className="text-muted-foreground">
              {lovedOne.relationshipToCarePartner}
              {lovedOne.age ? ` · Age ${lovedOne.age}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill kind="wellbeing" status={lovedOne.wellbeingStatus} />
              <ConsentStatusBadge lovedOne={lovedOne} viewerTimeZone={viewerTimeZone} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selected ? "soft" : "outline"}
            onClick={() => {
              setSelectedLovedOneId(lovedOne.id);
              toast.success(`Switched to ${lovedOne.firstName}`);
            }}
          >
            {selected ? "Currently selected" : "Switch to this Loved One"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
          {[
            ["overview", "Overview"],
            ["medication", "Medication"],
            ["meals", "Meals"],
            ["health", "Health"],
            ["voice", "Voice Journal"],
            ["sos", "SOS"],
            ["reports", "Reports"],
            ["circle", "Care Circle"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="rounded-xl">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Pill}
              label="Medications"
              value={`${related.meds.filter((m) => m.enabled).length} active`}
            />
            <StatCard
              icon={Utensils}
              label="Meal routines"
              value={`${related.meals.filter((m) => m.enabled).length} active`}
            />
            <StatCard
              icon={Mic}
              label="Voice journals"
              value={`${related.journals.length}`}
            />
            <StatCard icon={Siren} label="SOS events" value={`${related.sos.length}`} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personal details</CardTitle>
                <CardDescription>Editable profile information from onboarding</CardDescription>
              </div>
              {!editingOverview ? (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Edit
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {editingOverview && draft ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name">
                    <Input
                      value={draft.firstName}
                      onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Last name">
                    <Input
                      value={draft.lastName}
                      onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                    />
                  </Field>
                  <Field label="Age">
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={draft.age}
                      onChange={(e) =>
                        setDraft({ ...draft, age: Number(e.target.value) || draft.age })
                      }
                    />
                  </Field>
                  <Field label="Relationship to Care Partner">
                    <Input
                      value={draft.relationshipToCarePartner}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          relationshipToCarePartner: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <WhatsAppNumberInput
                      value={draft.whatsappNumber}
                      onChange={(whatsappNumber) =>
                        setDraft({ ...draft, whatsappNumber })
                      }
                      onBlurError={setWhatsappError}
                      error={whatsappError}
                    />
                  </Field>
                  <Field label="Time zone (IANA)">
                    <TimeZoneSelect
                      value={draft.timeZone}
                      onChange={(timeZone) => setDraft({ ...draft, timeZone })}
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={draft.address || ""}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    />
                  </Field>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Gender</Label>
                    <ChoiceChips<Gender>
                      value={draft.gender}
                      onChange={(gender) => setDraft({ ...draft, gender })}
                      options={[
                        { value: "female", label: "Female" },
                        { value: "male", label: "Male" },
                        { value: "other", label: "Other" },
                        { value: "prefer_not_to_say", label: "Prefer not to say" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                    <p>
                      Consent attestation (onboarding) and in-channel confirmation are
                      read-only — not editable here.
                    </p>
                    <p className="font-mono text-xs">
                      Attested by CT: {lovedOne.consentAttestedByCarePartner ? "yes" : "no"}
                      {lovedOne.consentAttestedAt
                        ? ` · ${lovedOne.consentAttestedAt.slice(0, 10)}`
                        : ""}
                    </p>
                    <ConsentStatusBadge
                      lovedOne={lovedOne}
                      viewerTimeZone={viewerTimeZone}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      onClick={saveOverview}
                      disabled={
                        saving ||
                        Boolean(whatsappError) ||
                        !validateRequiredWhatsAppNumber(draft.whatsappNumber).ok
                      }
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={saving}
                      onClick={() => {
                        setEditingOverview(false);
                        setDraft(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Item label="Age" value={String(lovedOne.age)} />
                  <Item
                    label="Relationship to Care Partner"
                    value={lovedOne.relationshipToCarePartner || "—"}
                  />
                  <Item label="WhatsApp" value={lovedOne.whatsappNumber} />
                  <Item label="Language" value={lovedOne.preferredLanguage} />
                  <Item label="Time zone" value={lovedOne.timeZone} />
                  <Item label="Address" value={lovedOne.address || "—"} />
                  <Item
                    label="Care circle"
                    value={[
                      store.carePartner ? "Care Partner" : null,
                      related.buddy ? "Local Buddy" : null,
                      related.doctor ? "Family Doctor" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Incomplete"}
                  />
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medication">
          <MedicationTab lovedOneId={lovedOne.id} lovedOneName={lovedOne.firstName} />
        </TabsContent>
        <TabsContent value="meals">
          <MealsTab lovedOneId={lovedOne.id} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab lovedOneId={lovedOne.id} />
        </TabsContent>

        <TabsContent value="voice" className="space-y-3">
          {related.journals.length === 0 ? (
            <EmptyState
              title="No Voice Journal entries"
              description="Entries will appear here when available."
            />
          ) : (
            related.journals.map((j) => (
              <Card key={j.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {j.mood}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatViewerDateTime(j.recordedAt, viewerTimeZone)}
                    </span>
                    {j.attentionFlag ? <Badge variant="warning">Needs attention</Badge> : null}
                  </div>
                  <p className="text-sm">{j.aiSummary}</p>
                  <p className="text-xs text-muted-foreground">“{j.transcriptPreview}”</p>
                </CardContent>
              </Card>
            ))
          )}
          <Button variant="outline" asChild>
            <Link href="/voice-journal">Open Voice Journal</Link>
          </Button>
        </TabsContent>

        <TabsContent value="sos" className="space-y-3">
          {related.sos.length === 0 ? (
            <EmptyState title="No SOS events" description="Emergency history will show here." />
          ) : (
            related.sos.map((event) => (
              <Card key={event.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <StatusPill kind="sos" status={event.status} />
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {formatViewerDateTime(event.triggeredAt, viewerTimeZone)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {event.locationPlaceholder || "Location unavailable"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/sos">View SOS history</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          {related.reports.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="No reports yet"
              description="Generated wellbeing reports for this Loved One will appear here."
            />
          ) : (
            related.reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold capitalize">
                      {report.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">{report.summary}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {report.rangeLabel} ·{" "}
                      {formatDistanceToNow(parseISO(report.generatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/reports">Open reports</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="circle">
          <CareCircleTab lovedOneId={lovedOne.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-mono text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
