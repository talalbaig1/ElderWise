"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SegmentedNotify } from "@/components/onboarding/fields";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/shared/time-picker";
import {
  createEmptyMedication,
  medicationSchema,
  type MedicationDraft,
} from "@/lib/onboarding";

export function MedicationStep() {
  const { draft, updateDraft, setStep } = useOnboarding();
  const name = draft.lovedOne.firstName || "your Loved One";

  const updateItem = (id: string, partial: Partial<MedicationDraft>) => {
    updateDraft((prev) => ({
      ...prev,
      medications: prev.medications.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const onNext = () => {
    if (draft.medications.length === 0) {
      toast.error("Add at least one medication");
      return;
    }
    for (const item of draft.medications) {
      const parsed = medicationSchema.safeParse(item);
      if (!parsed.success) {
        toast.error(`Check medication “${item.name || "Untitled"}”`);
        return;
      }
    }
    setStep(6);
  };

  return (
    <WizardShell onBack={() => setStep(4)} onNext={onNext}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add each medicine {name} needs. You can duplicate entries for similar schedules.
        </p>

        {draft.medications.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(enabled) => updateItem(item.id, { enabled })}
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
                          id: createEmptyMedication().id,
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
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input
                  value={item.dosage}
                  onChange={(e) => updateItem(item.id, { dosage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={item.dosageUnit}
                  placeholder="mg"
                  onChange={(e) => updateItem(item.id, { dosageUnit: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Medication times</Label>
              <div className="space-y-2">
                {item.times.map((time, timeIndex) => (
                  <div
                    key={`${item.id}-time-${timeIndex}`}
                    className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                  >
                    <TimePicker
                      className="min-w-0"
                      value={time}
                      onChange={(next) => {
                        const times = [...item.times];
                        times[timeIndex] = next;
                        updateItem(item.id, { times });
                      }}
                    />
                    {timeIndex === 0 ? (
                      <>
                        <div className="space-y-2">
                          <Label>Start date</Label>
                          <Input
                            type="date"
                            value={item.startDate}
                            onChange={(e) =>
                              updateItem(item.id, { startDate: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End date (optional)</Label>
                          <Input
                            type="date"
                            value={item.endDate || ""}
                            onChange={(e) => updateItem(item.id, { endDate: e.target.value })}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="hidden sm:block" />
                        <div className="hidden sm:block" />
                      </>
                    )}
                    {item.times.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          updateItem(item.id, {
                            times: item.times.filter((_, i) => i !== timeIndex),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() => updateItem(item.id, { times: [...item.times, "20:00"] })}
                >
                  <Plus className="h-4 w-4" />
                  Add time
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notify Care Partner</Label>
              <SegmentedNotify
                value={item.notifyCarePartner}
                onChange={(notifyCarePartner) => updateItem(item.id, { notifyCarePartner })}
              />
            </div>

            <div className="space-y-2">
              <Label>Missed-dose escalation (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={240}
                value={item.escalationMinutes}
                onChange={(e) =>
                  updateItem(item.id, { escalationMinutes: Number(e.target.value) || 30 })
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
              medications: [...prev.medications, createEmptyMedication()],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add medication
        </Button>
      </div>
    </WizardShell>
  );
}
