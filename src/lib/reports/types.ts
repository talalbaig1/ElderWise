import type { CheckInStatus } from "@/types";

export const PDF_REPORT_KINDS = [
  "medication",
  "food",
  "wellness",
  "sos",
] as const;

export type PdfReportKind = (typeof PDF_REPORT_KINDS)[number];

export function isPdfReportKind(value: string): value is PdfReportKind {
  return (PDF_REPORT_KINDS as readonly string[]).includes(value);
}

export const PDF_REPORT_KIND_LABEL: Record<PdfReportKind, string> = {
  medication: "Medication",
  food: "Food",
  wellness: "Wellness",
  sos: "SOS",
};

/** Domain filter for checkins.domain */
export function checkinDomainForKind(
  kind: Exclude<PdfReportKind, "sos">,
): "medication" | "food" | "health" {
  if (kind === "wellness") return "health";
  return kind;
}

export type ReportCheckInRow = {
  scheduledFor: string;
  /** UI-mapped check-in status */
  status: CheckInStatus;
  responseValue: string | null;
  respondedAt: string | null;
  responseChannel: string | null;
};

export type ReportSosRow = {
  triggeredAt: string;
  status: string;
  resolvedAt: string | null;
  resolvedByRole: string | null;
  resolvedChannel: string | null;
};

export type ReportPayload = {
  kind: PdfReportKind;
  kindLabel: string;
  elderFirstName: string;
  elderLastName: string;
  elderTimeZone: string;
  consentConfirmedAt: string | null;
  carePartnerFirstName: string;
  carePartnerTimeZone: string;
  rangeFrom: string;
  rangeTo: string;
  generatedAt: string;
  checkIns: ReportCheckInRow[];
  sosEvents: ReportSosRow[];
  /** Responded count / (responded + missed); null when denominator is 0. */
  respondedPct: number | null;
  respondedCount: number;
  missedCount: number;
};
