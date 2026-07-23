"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SegmentedNotify } from "@/components/onboarding/fields";
import { TimePicker } from "@/components/shared/time-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createBlankFood, createBlankHealth, createBlankMedication } from "@/lib/loved-ones";
import { useDomainStore } from "@/components/data/app-data-provider";
import type { FoodRoutine, HealthRoutine, Medication } from "@/types";

const PASS1_WRITE = "Routine edits save in Pass 2 — A2.3 is reads only.";
function blockWrite() {
  toast.message(PASS1_WRITE);
}

export function MedicationTab({
  lovedOneId,
}: {
  lovedOneId: string;
  lovedOneName: string;
}) {
  const { store } = useDomainStore();
  const items = store.medications.filter((m) => m.lovedOneId === lovedOneId);
  const [editing, setEditing] = useState<Medication | null>(null);

  const save = (_med: Medication) => {
    blockWrite();
    setEditing(null);
  };

  return (
    <Section
      empty="No medications yet"
      addLabel="Add medication"
      onAdd={() => setEditing(createBlankMedication(lovedOneId))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.name || "Untitled"}
              subtitle={`${item.dosage} ${item.dosageUnit} · ${item.times.join(", ")} · ${item.startDate}${item.endDate ? ` → ${item.endDate}` : ""}`}
              enabled={item.enabled}
              onToggle={() => blockWrite()}
              onEdit={() => setEditing(item)}
              onDuplicate={() => blockWrite()}
              onDelete={() => {
                if (!window.confirm(`Remove ${item.name}?`)) return;
                blockWrite();
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Medication</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <Field label="Name">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dosage">
                  <Input
                    value={editing.dosage}
                    onChange={(e) => setEditing({ ...editing, dosage: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    value={editing.dosageUnit}
                    onChange={(e) => setEditing({ ...editing, dosageUnit: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Medication times">
                {editing.times.map((t, idx) => (
                  <div key={idx} className="mb-2 grid gap-2 sm:grid-cols-3 sm:items-end">
                    <TimePicker
                      value={t}
                      onChange={(next) => {
                        const times = [...editing.times];
                        times[idx] = next;
                        setEditing({ ...editing, times });
                      }}
                    />
                    {idx === 0 ? (
                      <>
                        <Field label="Start date">
                          <Input
                            type="date"
                            value={editing.startDate}
                            onChange={(e) =>
                              setEditing({ ...editing, startDate: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="End date">
                          <Input
                            type="date"
                            value={editing.endDate || ""}
                            onChange={(e) =>
                              setEditing({ ...editing, endDate: e.target.value })
                            }
                          />
                        </Field>
                      </>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  onClick={() =>
                    setEditing({ ...editing, times: [...editing.times, "20:00"] })
                  }
                >
                  Add time
                </Button>
              </Field>
              <Field label="Notify">
                <SegmentedNotify
                  value={editing.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    setEditing({ ...editing, notifyCarePartner })
                  }
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => editing && save(editing)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function MealsTab({ lovedOneId }: { lovedOneId: string }) {
  const { store } = useDomainStore();
  const items = store.foodRoutines.filter((f) => f.lovedOneId === lovedOneId);
  const [editing, setEditing] = useState<FoodRoutine | null>(null);

  const save = (_item: FoodRoutine) => {
    blockWrite();
    setEditing(null);
  };

  return (
    <Section
      empty="No meal check-ins yet"
      addLabel="Add meal"
      onAdd={() => setEditing(createBlankFood(lovedOneId))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.mealName}
              subtitle={`${item.checkInTime} · ${item.startDate}${item.endDate ? ` → ${item.endDate}` : ""}`}
              enabled={item.enabled}
              onToggle={() => blockWrite()}
              onEdit={() => setEditing(item)}
              onDelete={() => {
                if (!window.confirm(`Remove ${item.mealName}?`)) return;
                blockWrite();
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meal check-in</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <Field label="Meal name">
                <Input
                  value={editing.mealName}
                  onChange={(e) => setEditing({ ...editing, mealName: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <TimePicker
                  label="Check-in time"
                  value={editing.checkInTime}
                  onChange={(checkInTime) => setEditing({ ...editing, checkInTime })}
                />
                <Field label="Start date">
                  <Input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </Field>
                <Field label="End date">
                  <Input
                    type="date"
                    value={editing.endDate || ""}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notify Care Partner">
                <SegmentedNotify
                  value={editing.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    setEditing({ ...editing, notifyCarePartner })
                  }
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => editing && save(editing)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function HealthTab({ lovedOneId }: { lovedOneId: string }) {
  const { store } = useDomainStore();
  const items = store.healthRoutines.filter((h) => h.lovedOneId === lovedOneId);
  const [editing, setEditing] = useState<HealthRoutine | null>(null);

  const save = (_item: HealthRoutine) => {
    blockWrite();
    setEditing(null);
  };

  return (
    <Section
      empty="No health routines yet"
      addLabel="Add routine"
      onAdd={() => setEditing(createBlankHealth(lovedOneId))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.name}
              subtitle={`${item.time} · ${item.startDate}${item.endDate ? ` → ${item.endDate}` : ""} · Answer: ${item.answerType === "yes_no" ? "Yes/No" : `${item.answerType} (Coming soon)`}`}
              enabled={item.enabled}
              onToggle={() => blockWrite()}
              onEdit={() => setEditing(item)}
              onDelete={() => {
                if (!window.confirm(`Remove ${item.name}?`)) return;
                blockWrite();
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Health routine</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label>Routine enabled</Label>
                <Switch
                  checked={editing.enabled}
                  onCheckedChange={(enabled) => setEditing({ ...editing, enabled })}
                />
              </div>
              <Field label="Routine name">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <TimePicker
                  label="Check-in time"
                  value={editing.time}
                  onChange={(time) => setEditing({ ...editing, time })}
                />
                <Field label="Start date">
                  <Input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </Field>
                <Field label="End date">
                  <Input
                    type="date"
                    value={editing.endDate || ""}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notify Care Partner">
                <SegmentedNotify
                  value={editing.notifyCarePartner}
                  onChange={(notifyCarePartner) =>
                    setEditing({ ...editing, notifyCarePartner })
                  }
                />
              </Field>
              {/* TODO(v2): MVP health check-ins are Yes/No only — number / mood / short_text later. */}
              <Field label="Answer type">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <span>Yes / No</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    MVP
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Number, mood, and short text — Coming soon
                  </span>
                </div>
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editing && save({ ...editing, answerType: "yes_no" })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function Section({
  children,
  empty,
  onAdd,
  addLabel,
  count,
}: {
  children: React.ReactNode;
  empty: string;
  onAdd: () => void;
  addLabel: string;
  count: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      {children}
    </div>
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

function RoutineCard({
  title,
  subtitle,
  enabled,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            <Badge variant={enabled ? "success" : "muted"}>{enabled ? "On" : "Off"}</Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Enable ${title}`} />
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          {onDuplicate ? (
            <Button size="icon" variant="ghost" onClick={onDuplicate} aria-label="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            className="text-sos"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
