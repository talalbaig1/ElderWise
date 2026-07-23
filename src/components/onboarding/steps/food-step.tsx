"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SegmentedNotify } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/shared/time-picker";
import { saveOnboardingFoodRoutines } from "@/lib/data/onboarding-actions";
import {
  createEmptyFood,
  foodRoutineSchema,
  type FoodRoutineDraft,
} from "@/lib/onboarding";

export function FoodStep() {
  const { draft, updateDraft, setStep } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const name = draft.lovedOne.firstName || "your Loved One";

  const updateItem = (id: string, partial: Partial<FoodRoutineDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      foodRoutines: prev.foodRoutines.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const onNext = async () => {
    if (!draft.elderId) {
      toast.error("Save Loved One details first");
      setStep(0);
      return;
    }
    if (draft.foodRoutines.length === 0) {
      toast.error("Add at least one meal check-in");
      return;
    }
    for (const item of draft.foodRoutines) {
      const parsed = foodRoutineSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check meal “${item.mealName || "Untitled"}” — some fields need attention`);
        return;
      }
    }
    setBusy(true);
    const result = await saveOnboardingFoodRoutines({
      elderId: draft.elderId,
      items: draft.foodRoutines,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setStep(5);
  };

  return (
    <WizardShell onBack={() => setStep(3)} onNext={onNext} nextLabel="Next" busy={busy}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose the meal, check-in time, and date range for {name}.
        </p>

        {draft.foodRoutines.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(enabled) => updateItem(item.id, { enabled })}
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
                onChange={(e) => updateItem(item.id, { mealName: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TimePicker
                label="Check-in time"
                value={item.checkInTime}
                onChange={(checkInTime) => updateItem(item.id, { checkInTime })}
              />
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={item.startDate}
                  onChange={(e) => updateItem(item.id, { startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={item.endDate}
                  onChange={(e) => updateItem(item.id, { endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notify Care Partner</Label>
              <SegmentedNotify
                value={item.notifyCarePartner}
                onChange={(notifyCarePartner) => updateItem(item.id, { notifyCarePartner })}
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
              foodRoutines: [...prev.foodRoutines, createEmptyFood()],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add another meal
        </Button>
      </div>
    </WizardShell>
  );
}
