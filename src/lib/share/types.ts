import type { CheckInStatus } from "@/types";
import type { CheckInStatusBreakdown } from "@/lib/check-in-status";

/** Serializable doctor share payload — facts only (N1). */

export interface DoctorShareSosEvent {
  triggeredAt: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedByRole: string | null;
  resolvedChannel: string | null;
  /** Minutes; null if still open */
  responseMinutes: number | null;
}

export interface DoctorShareCheckIn {
  scheduledAt: string;
  domain: string;
  /** UI status — always mapped via checkInStatusToUi at load time. */
  status: CheckInStatus;
  responseValue: string | null;
  respondedAt: string | null;
}

export interface DoctorShareMedication {
  name: string;
  dosage: string;
  dosageUnit: string;
  times: string[];
  enabled: boolean;
}

export type DoctorShareDomainKey = "medication" | "food" | "health";

export interface DoctorShareDomainSummary {
  domain: DoctorShareDomainKey;
  label: string;
  breakdown: CheckInStatusBreakdown;
  total: number;
}

export interface DoctorShareOverview {
  /** Human scope, e.g. "Last 30 days" */
  windowLabel: string;
  windowStartIso: string;
  windowEndIso: string;
  overall: CheckInStatusBreakdown;
  overallTotal: number;
  domains: Record<DoctorShareDomainKey, DoctorShareDomainSummary>;
  sosOpen: number;
  sosResolved: number;
}

export interface DoctorShareSummary {
  linkId: string;
  viewerTimeZone: string;
  elder: {
    firstName: string;
    lastName: string;
    timeZone: string;
    address: string;
  };
  overview: DoctorShareOverview;
  medications: DoctorShareMedication[];
  checkIns: DoctorShareCheckIn[];
  sosEvents: DoctorShareSosEvent[];
}
