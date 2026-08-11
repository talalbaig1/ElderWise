import type { CheckInStatus } from "@/types";

/** Counts used by dashboard and report analytics. */
export type CheckInStatusBreakdown = {
  taken: number;
  missed: number;
  delayed: number;
  pending: number;
  cancelled: number;
};

const CHECK_IN_STATUS_LABELS: Record<CheckInStatus, string> = {
  taken: "Taken",
  missed: "Missed",
  delayed: "Delayed",
  upcoming: "Upcoming",
  pending: "Pending",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

/** Title Case label for a UI check-in status. Never pass a raw DB enum here. */
export function formatCheckInStatus(status: CheckInStatus): string {
  return CHECK_IN_STATUS_LABELS[status] ?? status;
}

/**
 * Shared breakdown for dashboard + reports.
 * Counts `cancelled` explicitly. Unrecognised statuses go to `pending`
 * (never silently dropped). `upcoming` and `skipped` count as pending.
 */
export function checkInStatusBreakdown(
  items: ReadonlyArray<{ status: CheckInStatus }>,
): CheckInStatusBreakdown {
  const counts: CheckInStatusBreakdown = {
    taken: 0,
    missed: 0,
    delayed: 0,
    pending: 0,
    cancelled: 0,
  };
  for (const item of items) {
    if (
      item.status === "taken" ||
      item.status === "missed" ||
      item.status === "delayed"
    ) {
      counts[item.status] += 1;
    } else if (item.status === "cancelled") {
      counts.cancelled += 1;
    } else {
      // pending | upcoming | skipped | any future value
      counts.pending += 1;
    }
  }
  return counts;
}

/** SOS resolve channel enum → human wording for doctor / PDF. */
export function formatSosResolveChannel(channel: string | null | undefined): string {
  if (!channel) return "—";
  if (channel === "dashboard") return "Care Partner dashboard";
  if (channel === "whatsapp") return "WhatsApp";
  return channel.replace(/_/g, " ");
}

export function formatSosEventStatus(status: string): string {
  if (status === "open") return "Open";
  if (status === "resolved") return "Resolved";
  return status.replace(/_/g, " ");
}
