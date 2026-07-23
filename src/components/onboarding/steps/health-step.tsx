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
import { saveOnboardingHealthRoutines } from "@/lib/data/onboarding-actions";
import {
  createEmptyHealth,
  healthRoutineSchema,
  type HealthRoutineDraft,
} from "@/lib/onboarding";

export function HealthStep() {
  const { draft, updateDraft, setStep } = useOnboarding();
  const [busy, setBusy] = useState(false);

  const updateItem = (id: string, partial: Partial<HealthRoutineDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      healthRoutines: prev.healthRoutines.map((item) =>
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
    for (const item of draft.healthRoutines) {
      const parsed = healthRoutineSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check health routine “${item.name || "Untitled"}”`);
        return;
      }
    }
    setBusy(true);
    const result = await saveOnboardingHealthRoutines({
      elderId: draft.elderId,
      items: draft.healthRoutines,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setStep(7);
  };

  return (
    <WizardShell onBack={() => setStep(5)} onNext={onNext} busy={busy}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Simple wellness questions to help you notice patterns that matter.
        </p>

        {draft.healthRoutines.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(enabled) => updateItem(item.id, { enabled })}
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
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TimePicker
                label="Check-in time"
                value={item.time}
                onChange={(time) => updateItem(item.id, { time })}
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
              healthRoutines: [...prev.healthRoutines, createEmptyHealth()],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add health routine
        </Button>
      </div>
    </WizardShell>
  );
}
