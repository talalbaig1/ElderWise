"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DayChips,
  NotRequiredWarning,
  NOTIFY_SELECT_OPTIONS,
} from "@/components/onboarding/fields";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DOSAGE_UNITS, type NotifyCarePartnerMode } from "@/lib/onboarding";
import { createBlankFood, createBlankHealth, createBlankMedication } from "@/lib/loved-ones";
import { useDomainStore } from "@/components/data/app-data-provider";
import {
  setRoutineEnabled,
  softDeleteFoodRoutine,
  softDeleteHealthRoutine,
  softDeleteMedication,
  upsertFoodRoutine,
  upsertHealthRoutine,
  upsertMedication,
} from "@/lib/data/actions";
import { sortRoutineList } from "@/lib/routines/sort";
import { labelElderLocalTime } from "@/lib/time/display";
import type { FoodRoutine, HealthRoutine, Medication, MedicationTiming } from "@/types";
import { useRouter } from "next/navigation";

type RoutineDomain = "medication" | "food" | "health";

function useRoutineCardActions(
  lovedOneId: string,
  items: Array<{ id: string; enabled: boolean }>,
) {
  const router = useRouter();
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [enabledOverrides, setEnabledOverrides] = useState<Record<string, boolean>>({});
  const [dialogBusy, setDialogBusy] = useState(false);
  const serverKey = items.map((i) => `${i.id}:${i.enabled ? "1" : "0"}`).join("|");

  useEffect(() => {
    const byId = new Map(items.map((i) => [i.id, i.enabled]));
    setEnabledOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (byId.get(id) === next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // serverKey is the items fingerprint; items is read only to reconcile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const markBusy = (id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const displayEnabled = (id: string, serverEnabled: boolean) =>
    enabledOverrides[id] ?? serverEnabled;

  const toggle = async (domain: RoutineDomain, id: string, serverEnabled: boolean) => {
    const nextEnabled = !(enabledOverrides[id] ?? serverEnabled);
    setEnabledOverrides((prev) => ({ ...prev, [id]: nextEnabled }));
    markBusy(id, true);
    try {
      const result = await setRoutineEnabled(domain, id, lovedOneId, nextEnabled);
      if (!result.ok) {
        setEnabledOverrides((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
        toast.error(result.error);
        return;
      }
      if (result.notice) toast.message(result.notice);
      router.refresh();
    } finally {
      markBusy(id, false);
    }
  };

  const runCard = async (
    id: string,
    work: () => Promise<{ ok: true; notice?: string } | { ok: false; error: string }>,
    success: string,
  ) => {
    markBusy(id, true);
    try {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      toastRoutineSaved(success, result.notice);
      router.refresh();
      return true;
    } finally {
      markBusy(id, false);
    }
  };

  return { busyIds, dialogBusy, setDialogBusy, displayEnabled, toggle, runCard, router };
}

function toastRoutineSaved(fallback: string, notice?: string) {
  if (notice) {
    toast.success(fallback, { description: notice });
  } else {
    toast.success(fallback);
  }
}

/** Same control as onboarding Wellness Details — fits a 3-column row. */
function NotifySelect({
  value,
  onChange,
}: {
  value: NotifyCarePartnerMode;
  onChange: (value: NotifyCarePartnerMode) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as NotifyCarePartnerMode)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NOTIFY_SELECT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MedicationTab({
  lovedOneId,
}: {
  lovedOneId: string;
  lovedOneName: string;
}) {
  const { store } = useDomainStore();
  const elderTz =
    store.lovedOnes.find((lo) => lo.id === lovedOneId)?.timeZone ?? "UTC";
  const items = sortRoutineList(
    store.medications.filter((m) => m.lovedOneId === lovedOneId),
    (m) => ({ enabled: m.enabled, alertTime: m.times[0] ?? "", name: m.name }),
  );
  const [editing, setEditing] = useState<Medication | null>(null);
  const actions = useRoutineCardActions(lovedOneId, items);

  const save = async (med: Medication) => {
    if (!med.daysOfWeek?.length) {
      toast.error("Select at least one day");
      return;
    }
    actions.setDialogBusy(true);
    try {
      const normalized: Medication = {
        ...med,
        times: [med.times[0] || "08:00"],
      };
      const result = await upsertMedication(normalized);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toastRoutineSaved("Medication saved", result.notice);
      setEditing(null);
      actions.router.refresh();
    } finally {
      actions.setDialogBusy(false);
    }
  };

  return (
    <Section
      empty="No medications yet"
      addLabel="Add medication"
      onAdd={() => setEditing(createBlankMedication(lovedOneId, elderTz))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.name || "Untitled"}
              subtitle={`${item.dosage} ${item.dosageUnit} · ${labelElderLocalTime(item.times[0] ?? "", elderTz)} · ${item.startDate}${item.endDate ? ` → ${item.endDate}` : ""}`}
              enabled={actions.displayEnabled(item.id, item.enabled)}
              busy={actions.busyIds.has(item.id)}
              onToggle={() => void actions.toggle("medication", item.id, item.enabled)}
              onEdit={() =>
                setEditing({
                  ...item,
                  times: [item.times[0] || "08:00"],
                })
              }
              onDuplicate={async () => {
                const copy = {
                  ...item,
                  id: createBlankMedication(lovedOneId).id,
                  name: `${item.name} (copy)`,
                  times: [item.times[0] || "08:00"],
                };
                await actions.runCard(item.id, () => upsertMedication(copy), "Duplicated");
              }}
              onDelete={async () => {
                if (!window.confirm(`Remove ${item.name}? It leaves this list. History is kept.`))
                  return;
                await actions.runCard(
                  item.id,
                  () => softDeleteMedication(item.id, lovedOneId),
                  "Removed",
                );
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
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Medication name">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Metformin 500mg"
                  />
                </Field>
                <Field label="Dosage quantity">
                  <Input
                    value={editing.dosage}
                    placeholder="1"
                    onChange={(e) => setEditing({ ...editing, dosage: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Select
                    value={editing.dosageUnit}
                    onValueChange={(dosageUnit) => setEditing({ ...editing, dosageUnit })}
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
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TimePicker
                  label="Time"
                  value={editing.times[0] || "08:00"}
                  onChange={(next) => setEditing({ ...editing, times: [next] })}
                />
                <Field label="Start date">
                  <Input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) =>
                      setEditing({ ...editing, startDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="End date (optional)">
                  <Input
                    type="date"
                    value={editing.endDate || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, endDate: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Timing with meal">
                    <Select
                      value={
                        editing.timingPreference === "after_food"
                          ? "after_food"
                          : "before_food"
                      }
                      onValueChange={(value) =>
                        setEditing({
                          ...editing,
                          timingPreference: value as MedicationTiming,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before_food">Before meal</SelectItem>
                        <SelectItem value="after_food">After meal</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Notify Care Partner">
                    <NotifySelect
                      value={editing.notifyCarePartner}
                      onChange={(notifyCarePartner) =>
                        setEditing({ ...editing, notifyCarePartner })
                      }
                    />
                  </Field>
                  <div
                    className={cn(
                      "space-y-2 transition-opacity",
                      editing.notifyCarePartner === "not_required" && "opacity-50",
                    )}
                  >
                    <Label htmlFor={`esc-${editing.id}`}>
                      Missed-dose escalation (minutes)
                    </Label>
                    <Input
                      id={`esc-${editing.id}`}
                      type="number"
                      min={5}
                      max={240}
                      value={editing.escalationMinutes}
                      disabled={editing.notifyCarePartner === "not_required"}
                      aria-disabled={editing.notifyCarePartner === "not_required"}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          escalationMinutes: Number(e.target.value) || 30,
                        })
                      }
                    />
                  </div>
                </div>
                {editing.notifyCarePartner === "not_required" ? (
                  <NotRequiredWarning variant="medication" />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Repeats on</Label>
                <DayChips
                  value={editing.daysOfWeek}
                  onChange={(daysOfWeek) => setEditing({ ...editing, daysOfWeek })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => editing && save(editing)} disabled={actions.dialogBusy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function MealsTab({ lovedOneId }: { lovedOneId: string }) {
  const { store } = useDomainStore();
  const elderTz =
    store.lovedOnes.find((lo) => lo.id === lovedOneId)?.timeZone ?? "UTC";
  const items = sortRoutineList(
    store.foodRoutines.filter((f) => f.lovedOneId === lovedOneId),
    (f) => ({
      enabled: f.enabled,
      alertTime: f.checkInTime,
      name: f.mealName,
    }),
  );
  const [editing, setEditing] = useState<FoodRoutine | null>(null);
  const actions = useRoutineCardActions(lovedOneId, items);

  const save = async (item: FoodRoutine) => {
    if (!item.daysOfWeek?.length) {
      toast.error("Select at least one day");
      return;
    }
    actions.setDialogBusy(true);
    try {
      const result = await upsertFoodRoutine(item);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toastRoutineSaved("Meal routine saved", result.notice);
      setEditing(null);
      actions.router.refresh();
    } finally {
      actions.setDialogBusy(false);
    }
  };

  return (
    <Section
      empty="No meal check-ins yet"
      addLabel="Add meal"
      onAdd={() => setEditing(createBlankFood(lovedOneId, elderTz))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.mealName}
              subtitle={labelElderLocalTime(item.checkInTime, elderTz)}
              enabled={actions.displayEnabled(item.id, item.enabled)}
              busy={actions.busyIds.has(item.id)}
              onToggle={() => void actions.toggle("food", item.id, item.enabled)}
              onEdit={() => setEditing(item)}
              onDelete={async () => {
                if (!window.confirm(`Remove ${item.mealName}? It leaves this list. History is kept.`))
                  return;
                await actions.runCard(
                  item.id,
                  () => softDeleteFoodRoutine(item.id, lovedOneId),
                  "Removed",
                );
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
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Meal name">
                  <Input
                    value={editing.mealName}
                    onChange={(e) => setEditing({ ...editing, mealName: e.target.value })}
                  />
                </Field>
                <TimePicker
                  label="Check-in time"
                  value={editing.checkInTime}
                  onChange={(checkInTime) => setEditing({ ...editing, checkInTime })}
                />
                <Field label="Notify Care Partner">
                  <NotifySelect
                    value={editing.notifyCarePartner}
                    onChange={(notifyCarePartner) =>
                      setEditing({ ...editing, notifyCarePartner })
                    }
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Repeats on</Label>
                <DayChips
                  value={editing.daysOfWeek}
                  onChange={(daysOfWeek) => setEditing({ ...editing, daysOfWeek })}
                />
              </div>
              {editing.notifyCarePartner === "not_required" ? (
                <NotRequiredWarning variant="food" />
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => editing && save(editing)} disabled={actions.dialogBusy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function HealthTab({ lovedOneId }: { lovedOneId: string }) {
  const { store } = useDomainStore();
  const elderTz =
    store.lovedOnes.find((lo) => lo.id === lovedOneId)?.timeZone ?? "UTC";
  const items = sortRoutineList(
    store.healthRoutines.filter((h) => h.lovedOneId === lovedOneId),
    (h) => ({ enabled: h.enabled, alertTime: h.time, name: h.name }),
  );
  const [editing, setEditing] = useState<HealthRoutine | null>(null);
  const actions = useRoutineCardActions(lovedOneId, items);

  const save = async (item: HealthRoutine) => {
    if (!item.daysOfWeek?.length) {
      toast.error("Select at least one day");
      return;
    }
    actions.setDialogBusy(true);
    try {
      const result = await upsertHealthRoutine(item);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toastRoutineSaved("Health routine saved", result.notice);
      setEditing(null);
      actions.router.refresh();
    } finally {
      actions.setDialogBusy(false);
    }
  };

  return (
    <Section
      empty="No health routines yet"
      addLabel="Add routine"
      onAdd={() => setEditing(createBlankHealth(lovedOneId, elderTz))}
      count={items.length}
    >
      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoutineCard
              key={item.id}
              title={item.name}
              subtitle={`${labelElderLocalTime(item.time, elderTz)} · Answer: Yes/No`}
              enabled={actions.displayEnabled(item.id, item.enabled)}
              busy={actions.busyIds.has(item.id)}
              onToggle={() => void actions.toggle("health", item.id, item.enabled)}
              onEdit={() => setEditing(item)}
              onDelete={async () => {
                if (!window.confirm(`Remove ${item.name}? It leaves this list. History is kept.`))
                  return;
                await actions.runCard(
                  item.id,
                  () => softDeleteHealthRoutine(item.id, lovedOneId),
                  "Removed",
                );
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
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Routine name">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <TimePicker
                  label="Check-in time"
                  value={editing.time}
                  onChange={(time) => setEditing({ ...editing, time })}
                />
                <Field label="Notify Care Partner">
                  <NotifySelect
                    value={editing.notifyCarePartner}
                    onChange={(notifyCarePartner) =>
                      setEditing({ ...editing, notifyCarePartner })
                    }
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Repeats on</Label>
                <DayChips
                  value={editing.daysOfWeek}
                  onChange={(daysOfWeek) => setEditing({ ...editing, daysOfWeek })}
                />
              </div>
              {editing.notifyCarePartner === "not_required" ? (
                <NotRequiredWarning variant="health" />
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={actions.dialogBusy}
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
  busy,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onDuplicate?: () => void | Promise<void>;
}) {
  return (
    <Card className={cn(!enabled && "border-dashed bg-muted/40")}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold", !enabled && "text-muted-foreground")}>
              {title}
            </p>
            {!enabled ? <Badge variant="muted">Inactive</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={busy} />
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            disabled={busy}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {onDuplicate ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDuplicate}
              disabled={busy}
              aria-label="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
