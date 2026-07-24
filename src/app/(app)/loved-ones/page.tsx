"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Grid2X2,
  HeartHandshake,
  List,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { ConsentStatusBadge } from "@/components/shared/consent-status-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { AddLovedOneButton } from "@/components/loved-ones/add-loved-one-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ageFromDob } from "@/lib/loved-ones";
import { useDomainStore } from "@/components/data/app-data-provider";
import { cn, initials } from "@/lib/utils";
import type { WellbeingStatus } from "@/types";

export default function LovedOnesPage() {
  const { store, setSelectedLovedOneId, hydrated, viewerTimeZone } = useDomainStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WellbeingStatus>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return store.lovedOnes.filter((lo) => {
      const hay = `${lo.firstName} ${lo.surname} ${lo.relationshipToCarePartner}`.toLowerCase();
      const matchesQuery = hay.includes(query.trim().toLowerCase());
      const matchesStatus = statusFilter === "all" || lo.wellbeingStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [store.lovedOnes, query, statusFilter]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  const confirmDelete = () => {
    toast.message("Deletes save in a later pass", {
      description: "Use Care Plan edits for now.",
    });
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Family profiles
          </p>
          <h1 className="mt-1 font-display text-3xl">Loved Ones</h1>
          <p className="mt-2 text-muted-foreground">
            Manage everyone you care for — switch profiles, edit routines, and keep their care
            circle up to date.
          </p>
        </div>
        <AddLovedOneButton />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or relationship…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search Loved Ones"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | WellbeingStatus)}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by wellbeing">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="green">Doing well</SelectItem>
            <SelectItem value="amber">Needs attention</SelectItem>
            <SelectItem value="red">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 rounded-xl border p-1">
          <Button
            type="button"
            size="sm"
            variant={view === "grid" ? "soft" : "ghost"}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "soft" : "ghost"}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={store.lovedOnes.length === 0 ? "No Loved Ones yet" : "No matches"}
          description={
            store.lovedOnes.length === 0
              ? "Add someone you care for to start building their routines."
              : "Try a different search or status filter."
          }
          action={store.lovedOnes.length === 0 ? <AddLovedOneButton /> : undefined}
        />
      ) : (
        <div
          className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3",
          )}
        >
          {filtered.map((lo) => {
            const age = ageFromDob(lo.dateOfBirth);
            const meds = store.medications.filter((m) => m.lovedOneId === lo.id && m.enabled);
            const meals = store.foodRoutines.filter((f) => f.lovedOneId === lo.id && f.enabled);
            const activeSos = store.sosEvents.some(
              (e) => e.lovedOneId === lo.id && (e.status === "active" || e.status === "acknowledged"),
            );
            const lastCheck = store.checkIns
              .filter((c) => c.lovedOneId === lo.id && c.respondedAt)
              .sort((a, b) => +(b.respondedAt ?? 0) - +(a.respondedAt ?? 0))[0];
            const selected = store.selectedLovedOneId === lo.id;

            return (
              <Card
                key={lo.id}
                className={cn(
                  "overflow-hidden transition-shadow hover:shadow-[0_12px_36px_-18px_rgba(31,75,69,0.45)]",
                  selected && "ring-2 ring-primary/30",
                )}
              >
                <CardContent className={cn("p-5", view === "list" && "flex items-center gap-4")}>
                  <div className={cn("flex items-start gap-3", view === "list" && "flex-1")}>
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {initials(`${lo.firstName} ${lo.surname}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl">
                          {lo.firstName} {lo.surname}
                        </h2>
                        {selected ? <Badge variant="secondary">Selected</Badge> : null}
                        {activeSos ? <Badge variant="destructive">SOS</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {lo.relationshipToCarePartner}
                        {age != null ? ` · Age ${age}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill kind="wellbeing" status={lo.wellbeingStatus} />
                        <ConsentStatusBadge lovedOne={lo} viewerTimeZone={viewerTimeZone} />
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2",
                      view === "list" && "mt-0 hidden md:grid",
                    )}
                  >
                    <p>
                      Medication ·{" "}
                      <span className="font-mono text-foreground">{meds.length} active</span>
                    </p>
                    <p>
                      Meals ·{" "}
                      <span className="font-mono text-foreground">{meals.length} active</span>
                    </p>
                    <p className="sm:col-span-2">
                      Last response ·{" "}
                      {lastCheck?.respondedAt
                        ? formatDistanceToNow(parseISO(lastCheck.respondedAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "mt-4 flex flex-wrap gap-2",
                      view === "list" && "mt-0 shrink-0",
                    )}
                  >
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedLovedOneId(lo.id);
                        toast.success(`Switched to ${lo.firstName}`);
                      }}
                      variant={selected ? "soft" : "outline"}
                    >
                      {selected ? "Selected" : "Switch to"}
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={`/loved-ones/${lo.id}`}>Open Profile</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-sos"
                      onClick={() => setDeleteId(lo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Loved One?</DialogTitle>
            <DialogDescription>
              This removes their routines, care circle links, and related history from this demo
              device. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
