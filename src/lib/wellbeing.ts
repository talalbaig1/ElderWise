import type { CheckInStatus, SOSStatus, WellbeingStatus } from "@/types";

/** Recent window for missed check-ins (R-5 / D-5). */
const RECENT_MISSED_MS = 7 * 24 * 60 * 60 * 1000;

export type WellbeingDerivationInput = {
  sosStatuses: readonly SOSStatus[];
  checkIns: readonly { status: CheckInStatus; scheduledAt: string }[];
  now?: Date;
};

/**
 * Single wellbeing derivation (D-5 / F-4).
 * Extracted from the SOS store path and extended for check-ins:
 * open SOS (active|acknowledged) → urgent;
 * recent missed check-in → attention;
 * otherwise → stable;
 * nothing recorded yet → unknown.
 */
export function deriveWellbeingStatus(
  input: WellbeingDerivationInput,
): WellbeingStatus {
  if (
    input.sosStatuses.some((s) => s === "active" || s === "acknowledged")
  ) {
    return "urgent";
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const cutoff = nowMs - RECENT_MISSED_MS;
  const hasRecentMiss = input.checkIns.some(
    (c) =>
      c.status === "missed" &&
      !Number.isNaN(Date.parse(c.scheduledAt)) &&
      Date.parse(c.scheduledAt) >= cutoff,
  );
  if (hasRecentMiss) return "attention";

  if (input.sosStatuses.length === 0 && input.checkIns.length === 0) {
    return "unknown";
  }

  return "stable";
}
