"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChoiceChips, NotRequiredWarning, SegmentedNotify } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/shared/time-picker";
import {
  saveOnboardingFoodRoutines,
  saveOnboardingHealthRoutines,
  saveOnboardingMedications,
} from "@/lib/data/onboarding-actions";
import {
  createEmptyFood,
  createEmptyHealth,
  createEmptyMedication,
  DOSAGE_UNITS,
  foodRoutineDraftSchema,
  healthRoutineDraftSchema,
  medicationDraftSchema,
  type FoodRoutineDraft,
  type HealthRoutineDraft,
  type MedicationDraft,
} from "@/lib/onboarding";

export function WellnessDetailsStep() {
  const { draft, updateDraft, setStepId } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const elderName = draft.lovedOne.firstName || "your Loved One";
  const elderTimeZone = draft.lovedOne.timeZone;

  const updateMedication = (id: string, partial: Partial<MedicationDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      medications: prev.medications.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const updateFood = (id: string, partial: Partial<FoodRoutineDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      foodRoutines: prev.foodRoutines.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const updateHealth = (id: string, partial: Partial<HealthRoutineDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      healthRoutines: prev.healthRoutines.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const onBack = () => setStepId("care-circle");

  const onNext = async () => {
    if (!draft.elderId) {
      toast.error("Save the Care Circle first");
      setStepId("care-circle");
      return;
    }
    if (draft.medications.length === 0) {
      toast.error("Add at least one medication");
      return;
    }
    for (const item of draft.medications) {
      const parsed = medicationDraftSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check medication “${item.name || "Untitled"}”`);
        return;
      }
    }
    if (draft.foodRoutines.length === 0) {
      toast.error("Add at least one meal check-in");
      return;
    }
    for (const item of draft.foodRoutines) {
      const parsed = foodRoutineDraftSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check meal “${item.mealName || "Untitled"}”`);
        return;
      }
    }
    for (const item of draft.healthRoutines) {
      const parsed = healthRoutineDraftSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check health routine “${item.name || "Untitled"}”`);
        return;
      }
    }

    setBusy(true);
    const medRes = await saveOnboardingMedications({
      elderId: draft.elderId,
      items: draft.medications,
    });
    if (!medRes.ok) {
      setBusy(false);
      toast.error(medRes.error);
      return;
    }
    const foodRes = await saveOnboardingFoodRoutines({
      elderId: draft.elderId,
      elderTimeZone,
      items: draft.foodRoutines,
    });
    if (!foodRes.ok) {
      setBusy(false);
      toast.error(foodRes.error);
      return;
    }
    const healthRes = await saveOnboardingHealthRoutines({
      elderId: draft.elderId,
      elderTimeZone,
      items: draft.healthRoutines,
    });
    setBusy(false);
    if (!healthRes.ok) {
      toast.error(healthRes.error);
      return;
    }
    setStepId("review");
  };

  return (
    <WizardShell onBack={onBack} onNext={onNext} busy={busy}>
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div>
            <h3 className="font-display text-xl">Medication</h3>
            <p className="text-sm text-muted-foreground">
              Add each medicine {elderName} needs, including strength (e.g. “Metformin 500mg”).
            </p>
          </div>

          {draft.medications.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(enabled) => updateMedication(item.id, { enabled })}
                  />
                  <p className="font-semibold">Medication {index + 1}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        medications: [
                          ...prev.medications,
                          {
                            ...item,
                            id: createEmptyMedication(elderTimeZone).id,
                            name: `${item.name} (copy)`,
                          },
                        ],
                      }))
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  {draft.medications.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-sos"
                      onClick={() => {
                        if (!window.confirm(`Remove ${item.name || "this medication"}?`)) return;
                        updateDraft((prev) => ({
                          ...prev,
                          medications: prev.medications.filter((m) => m.id !== item.id),
                        }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Medication name</Label>
                  <Input
                    value={item.name}
                    placeholder="Metformin 500mg"
                    onChange={(e) => updateMedication(item.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dosage quantity</Label>
                  <Input
                    value={item.dosage}
                    placeholder="1"
                    onChange={(e) => updateMedication(item.id, { dosage: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={item.dosageUnit}
                    onValueChange={(value) =>
                      updateMedication(item.id, {
                        dosageUnit: value as MedicationDraft["dosageUnit"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOSAGE_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <TimePicker
                  label="Time"
                  value={item.time}
                  onChange={(time) => updateMedication(item.id, { time })}
                />
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={item.startDate}
                    onChange={(e) => updateMedication(item.id, { startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date (optional)</Label>
                  <Input
                    type="date"
                    value={item.endDate || ""}
                    onChange={(e) => updateMedication(item.id, { endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timing with meal</Label>
                <ChoiceChips
                  options={[
                    { value: "before_food", label: "Before meal" },
                    { value: "after_food", label: "After meal" },
                  ]}
                  value={item.mealTiming}
                  onChange={(mealTiming) => updateMedication(item.id, { mealTiming })}
                />
              </div>

              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) => updateMedication(item.id, { notifyCarePartner })}
                />
                {item.notifyCarePartner === "not_required" ? (
                  <NotRequiredWarning variant="medication" />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Missed-dose escalation (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={item.escalationMinutes}
                  onChange={(e) =>
                    updateMedication(item.id, { escalationMinutes: Number(e.target.value) || 30 })
                  }
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateDraft((prev) => ({
                ...prev,
                medications: [...prev.medications, createEmptyMedication(elderTimeZone)],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add medication
          </Button>
        </section>

        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div>
            <h3 className="font-display text-xl">Food</h3>
            <p className="text-sm text-muted-foreground">
              Choose the meal and check-in time for {elderName}.
            </p>
          </div>

          {draft.foodRoutines.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(enabled) => updateFood(item.id, { enabled })}
                  />
                  <p className="font-semibold">Meal {index + 1}</p>
                </div>
                {draft.foodRoutines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sos"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        foodRoutines: prev.foodRoutines.filter((f) => f.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Meal name</Label>
                <Input
                  value={item.mealName}
                  onChange={(e) => updateFood(item.id, { mealName: e.target.value })}
                />
              </div>

              <TimePicker
                label="Check-in time"
                value={item.checkInTime}
                onChange={(checkInTime) => updateFood(item.id, { checkInTime })}
              />

              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) => updateFood(item.id, { notifyCarePartner })}
                />
                {item.notifyCarePartner === "not_required" ? (
                  <NotRequiredWarning variant="routine" />
                ) : null}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateDraft((prev) => ({
                ...prev,
                foodRoutines: [...prev.foodRoutines, createEmptyFood()],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add another meal
          </Button>
        </section>

        <section className="space-y-4 rounded-2xl border bg-background/70 p-4">
          <div>
            <h3 className="font-display text-xl">Health</h3>
            <p className="text-sm text-muted-foreground">
              Simple wellness questions to help you notice patterns that matter.
            </p>
          </div>

          {draft.healthRoutines.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(enabled) => updateHealth(item.id, { enabled })}
                  />
                  <p className="font-semibold">Routine {index + 1}</p>
                </div>
                {draft.healthRoutines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sos"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        healthRoutines: prev.healthRoutines.filter((h) => h.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Routine name</Label>
                <Input
                  value={item.name}
                  onChange={(e) => updateHealth(item.id, { name: e.target.value })}
                />
              </div>

              <TimePicker
                label="Check-in time"
                value={item.time}
                onChange={(time) => updateHealth(item.id, { time })}
              />

              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) => updateHealth(item.id, { notifyCarePartner })}
                />
                {item.notifyCarePartner === "not_required" ? (
                  <NotRequiredWarning variant="routine" />
                ) : null}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateDraft((prev) => ({
                ...prev,
                healthRoutines: [...prev.healthRoutines, createEmptyHealth()],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add health routine
          </Button>
        </section>
      </div>
    </WizardShell>
  );
}
