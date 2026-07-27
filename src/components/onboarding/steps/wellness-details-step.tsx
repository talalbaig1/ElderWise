"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ChoiceChips,
  FieldError,
  NotRequiredWarning,
  SegmentedNotify,
} from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { TimePicker } from "@/components/shared/time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const tz = draft.lovedOne.timeZone;

  const updateMed = (id: string, partial: Partial<MedicationDraft>) => {
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

  const onNext = async () => {
    if (!draft.elderId) {
      toast.error("Save Care Circle first");
      setStepId("care-circle");
      return;
    }
    for (const item of draft.medications) {
      if (!medicationDraftSchema.safeParse(item).success) {
        toast.error(`Check medication “${item.name || "Untitled"}”`);
        return;
      }
    }
    for (const item of draft.foodRoutines) {
      if (!foodRoutineDraftSchema.safeParse(item).success) {
        toast.error(`Check meal “${item.mealName || "Untitled"}”`);
        return;
      }
    }
    for (const item of draft.healthRoutines) {
      if (!healthRoutineDraftSchema.safeParse(item).success) {
        toast.error(`Check health routine “${item.name || "Untitled"}”`);
        return;
      }
    }

    setBusy(true);
    const med = await saveOnboardingMedications({
      elderId: draft.elderId,
      items: draft.medications,
    });
    if (!med.ok) {
      setBusy(false);
      toast.error(med.error);
      return;
    }
    const food = await saveOnboardingFoodRoutines({
      elderId: draft.elderId,
      elderTimeZone: tz,
      items: draft.foodRoutines,
    });
    if (!food.ok) {
      setBusy(false);
      toast.error(food.error);
      return;
    }
    const health = await saveOnboardingHealthRoutines({
      elderId: draft.elderId,
      elderTimeZone: tz,
      items: draft.healthRoutines,
    });
    setBusy(false);
    if (!health.ok) {
      toast.error(health.error);
      return;
    }
    setStepId("review");
  };

  return (
    <WizardShell
      onBack={() => setStepId("care-circle")}
      onNext={() => void onNext()}
      busy={busy}
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="font-display text-xl">Medication</h3>
          {draft.medications.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(enabled) => updateMed(item.id, { enabled })}
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
                            id: createEmptyMedication(tz).id,
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
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          medications: prev.medications.filter((m) => m.id !== item.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Medication name</Label>
                <Input
                  value={item.name}
                  placeholder='Include strength, e.g. "Metformin 500mg"'
                  onChange={(e) => updateMed(item.id, { name: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Include strength in the name (e.g. Metformin 500mg).
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Dosage (quantity)</Label>
                  <Input
                    value={item.dosage}
                    placeholder="1"
                    onChange={(e) => updateMed(item.id, { dosage: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={item.dosageUnit}
                    onChange={(e) =>
                      updateMed(item.id, {
                        dosageUnit: e.target.value as MedicationDraft["dosageUnit"],
                      })
                    }
                  >
                    {DOSAGE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <TimePicker
                    value={item.time}
                    onChange={(time) => updateMed(item.id, { time })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={item.startDate}
                    onChange={(e) => updateMed(item.id, { startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date (optional)</Label>
                  <Input
                    type="date"
                    value={item.endDate || ""}
                    onChange={(e) => updateMed(item.id, { endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meal selection</Label>
                <ChoiceChips
                  value={item.mealTiming}
                  onChange={(mealTiming) => updateMed(item.id, { mealTiming })}
                  options={[
                    { value: "before_food", label: "Before meal" },
                    { value: "after_food", label: "After meal" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    updateMed(item.id, { notifyCarePartner })
                  }
                />
                {item.notifyCarePartner === "not_required" ? (
                  <NotRequiredWarning variant="medication" />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Alert Care Partner if not taken within (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={item.escalationMinutes}
                  onChange={(e) =>
                    updateMed(item.id, {
                      escalationMinutes: Number(e.target.value) || 30,
                    })
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
                medications: [...prev.medications, createEmptyMedication(tz)],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Add medication
          </Button>
        </section>

        <section className="space-y-4">
          <h3 className="font-display text-xl">Food</h3>
          {draft.foodRoutines.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        foodRoutines: prev.foodRoutines.filter((f) => f.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Meal name</Label>
                  <Input
                    value={item.mealName}
                    onChange={(e) => updateFood(item.id, { mealName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Check-in time</Label>
                  <TimePicker
                    value={item.checkInTime}
                    onChange={(checkInTime) => updateFood(item.id, { checkInTime })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    updateFood(item.id, { notifyCarePartner })
                  }
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

        <section className="space-y-4">
          <h3 className="font-display text-xl">Health</h3>
          {draft.healthRoutines.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        healthRoutines: prev.healthRoutines.filter(
                          (h) => h.id !== item.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Routine name</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => updateHealth(item.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Check-in time</Label>
                  <TimePicker
                    value={item.time}
                    onChange={(time) => updateHealth(item.id, { time })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notify Care Partner</Label>
                <SegmentedNotify
                  value={item.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    updateHealth(item.id, { notifyCarePartner })
                  }
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
        <FieldError message={undefined} />
      </div>
    </WizardShell>
  );
}
