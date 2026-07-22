"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format, subDays } from "date-fns";
import {
  ChevronDown,
  Download,
  FileBarChart,
  FileSpreadsheet,
  HeartPulse,
  Mic,
  Pill,
  Printer,
  Siren,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { Timeline } from "@/components/shared/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  REPORT_KIND_META,
  buildReportModel,
  type ReportKind,
} from "@/lib/report-analytics";
import { exportReportCsv, exportReportPdf, openPrintView } from "@/lib/report-export";
import { useElderWiseStore, useSelectedLovedOne } from "@/lib/store";
import { cn } from "@/lib/utils";

const kindIcons: Record<ReportKind, typeof Pill> = {
  medication: Pill,
  meals: Utensils,
  health: HeartPulse,
  voice_journal: Mic,
  sos: Siren,
  overall: FileBarChart,
};

/** Same accent colors as the dashboard metric cards */
const kindTone: Record<ReportKind, "medication" | "meals" | "health" | "sos" | "default"> = {
  medication: "medication",
  meals: "meals",
  health: "health",
  voice_journal: "default",
  sos: "sos",
  overall: "default",
};

const kindIconClass: Record<ReportKind, string> = {
  medication: "text-[#2F6FED] bg-[#2F6FED]/12",
  meals: "text-[#2F9E6B] bg-[#2F9E6B]/12",
  health: "text-[#D97706] bg-[#D97706]/12",
  voice_journal: "text-primary bg-secondary",
  sos: "text-sos bg-sos-soft",
  overall: "text-primary bg-secondary",
};

function metricTone(
  label: string,
  reportKind: ReportKind,
): "medication" | "meals" | "health" | "sos" | "success" | "default" {
  const key = label.toLowerCase();
  if (
    key.includes("medication") ||
    (key === "adherence" && reportKind === "medication")
  ) {
    return "medication";
  }
  if (key.includes("meal")) return "meals";
  if (key.includes("health")) return "health";
  if (key.includes("sos") || key === "active" || key === "events") {
    return reportKind === "sos" || key.includes("sos") ? "sos" : kindTone[reportKind];
  }
  if (reportKind !== "overall") return kindTone[reportKind];
  if (key.includes("overall") || key === "adherence") return "success";
  return "default";
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function weekAgoStr() {
  return format(subDays(new Date(), 6), "yyyy-MM-dd");
}

export default function ReportsPage() {
  const { store, setSelectedLovedOneId, hydrated } = useElderWiseStore();
  const selected = useSelectedLovedOne();
  const [kind, setKind] = useState<ReportKind>("overall");
  const [startDate, setStartDate] = useState(weekAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    timeline: false,
    table: false,
  });

  const lovedOne = selected;

  const model = useMemo(() => {
    if (!lovedOne || !startDate || !endDate) return null;
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T23:59:59`);
    const [customFrom, customTo] = from <= to ? [from, to] : [to, from];
    return buildReportModel(store, lovedOne, kind, "custom", customFrom, customTo);
  }, [store, lovedOne, kind, startDate, endDate]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  if (!lovedOne || !model) {
    return (
      <EmptyState
        title="No Loved One selected"
        description="Add or select a Loved One to generate wellbeing reports."
        actionLabel="Go to Loved Ones"
        onAction={() => {
          window.location.href = "/loved-ones";
        }}
      />
    );
  }

  const onCsv = () => {
    exportReportCsv(model);
    toast.success("CSV exported");
  };

  const onPdf = () => {
    exportReportPdf(model);
    toast.success("PDF downloaded");
  };

  const onPrint = () => {
    const ok = openPrintView(model);
    if (!ok) {
      toast.error("Pop-up blocked — allow pop-ups to use Print View");
      return;
    }
    toast.success("Print view opened — use Save as PDF if needed");
  };

  const Icon = kindIcons[kind];

  const togglePanel = (key: string) => {
    setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div>
          <p className="text-sm font-medium text-primary">Reports</p>
          <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">
            Wellbeing reports
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Choose a Loved One, report type, and date range — then export CSV, PDF, or print.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCsv}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={onPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print View
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Report type
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_KIND_META.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Loved One
            </Label>
            <Select
              value={lovedOne.id}
              onValueChange={(id) => setSelectedLovedOneId(id)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {store.lovedOnes.map((lo) => (
                  <SelectItem key={lo.id} value={lo.id}>
                    {lo.firstName} {lo.surname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="report-start-date"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Start date
            </Label>
            <Input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="report-end-date"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              End date
            </Label>
            <Input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Header summary */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  kindIconClass[kind],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle className="font-display text-2xl">{model.title}</CardTitle>
              <Badge variant="secondary">{model.rangeLabel}</Badge>
            </div>
            <CardDescription className="max-w-3xl text-base text-foreground/80">
              {model.summary}
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              {lovedOne.firstName} {lovedOne.surname} ·{" "}
              {format(model.from, "d MMM yyyy")} – {format(model.to, "d MMM yyyy")}
            </p>
          </div>
          {typeof model.adherencePercent === "number" ? (
            <div className="rounded-2xl bg-secondary px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Score
              </p>
              <p className="font-mono text-3xl font-semibold text-primary">
                {model.adherencePercent}%
              </p>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      {/* Metrics — same color accents as dashboard cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {model.metrics.slice(0, 4).map((m) => {
          const tone = metricTone(m.label, kind);
          const progress =
            typeof m.value === "string" && m.value.endsWith("%")
              ? Number.parseInt(m.value, 10)
              : typeof model.adherencePercent === "number" &&
                  m.label.toLowerCase().includes("adherence")
                ? model.adherencePercent
                : undefined;
          return (
            <MetricCard
              key={m.label}
              title={m.label}
              value={m.value}
              subtitle={m.hint}
              progress={progress}
              tone={tone}
              icon={
                tone === "medication"
                  ? Pill
                  : tone === "meals"
                    ? Utensils
                    : tone === "health"
                      ? HeartPulse
                      : tone === "sos"
                        ? Siren
                        : Icon
              }
            />
          );
        })}
      </div>

      {/* Expandable sections */}
      <div className="space-y-3">
        <ExpandableCard
          title="Timeline"
          description="Chronological activity for this report"
          open={openPanels.timeline}
          onToggle={() => togglePanel("timeline")}
        >
          {model.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events in this range.</p>
          ) : (
            <Timeline
              items={model.timeline.map((t) => ({
                id: t.id,
                title: t.title,
                time: t.time,
                description: t.description,
                status: t.status,
              }))}
            />
          )}
        </ExpandableCard>

        <ExpandableCard
          title="Detailed table"
          description="Source rows used for exports"
          badge={`${model.tableRows.length} rows`}
          open={openPanels.table}
          onToggle={() => togglePanel("table")}
        >
          {model.tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No detail rows in this range.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {model.csvHeaders.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.tableRows.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx}>
                        {model.csvHeaders.map((h) => (
                          <TableCell key={h} className="max-w-[220px] truncate text-sm">
                            {String(row[h] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {model.tableRows.length > 20 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing 20 of {model.tableRows.length} rows — full set included in CSV/PDF
                  export.
                </p>
              ) : null}
            </>
          )}
        </ExpandableCard>
      </div>
    </div>
  );
}

function ExpandableCard({
  title,
  description,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            {badge ? (
              <Badge variant="outline" className="font-mono">
                {badge}
              </Badge>
            ) : null}
          </div>
          {description && !open ? (
            <CardDescription className="mt-0.5">{description}</CardDescription>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <CardContent className="border-t pt-4">
          {description ? (
            <p className="mb-3 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
