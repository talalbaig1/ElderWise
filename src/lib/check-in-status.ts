import type { CheckInStatus } from "@/types";

/** Counts used by dashboard and report analytics. */
export type CheckInStatusBreakdown = {
  taken: number;
  answered_no: number;
  missed: number;
  delayed: number;
  pending: number;
  cancelled: number;
};

const CHECK_IN_STATUS_LABELS: Record<CheckInStatus, string> = {
  taken: "Taken",
  answered_no: "Answered no",
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

/** Humanise `response_value` for display beside the status (underscores → spaces). */
export function formatResponseValueLabel(
  responseValue: string | null | undefined,
): string | undefined {
  const raw = responseValue?.trim();
  if (!raw) return undefined;
  return raw.replace(/_/g, " ").toLowerCase();
}

/**
 * Status label with response text when present — e.g. "Answered no · some of them".
 * Status drives adherence maths; response text keeps the sentence true for the CT.
 */
export function formatCheckInStatusWithResponse(
  status: CheckInStatus,
  responseValue?: string | null,
): string {
  const base = formatCheckInStatus(status);
  const detail = formatResponseValueLabel(responseValue);
  return detail ? `${base} · ${detail}` : base;
}

/**
 * Shared breakdown for dashboard + reports.
 * Counts `cancelled` and `answered_no` explicitly. Unrecognised statuses go to
 * `pending` (never silently dropped). `upcoming` and `skipped` count as pending.
 */
export function checkInStatusBreakdown(
  items: ReadonlyArray<{ status: CheckInStatus }>,
): CheckInStatusBreakdown {
  const counts: CheckInStatusBreakdown = {
    taken: 0,
    answered_no: 0,
    missed: 0,
    delayed: 0,
    pending: 0,
    cancelled: 0,
  };
  for (const item of items) {
    if (
      item.status === "taken" ||
      item.status === "answered_no" ||
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

/**
 * Adherence composition pie — Taken / Answered no / Delayed / Missed.
 * Matches `adherence()`: cancelled and pending stay out of the slices.
 * Answered-no colour is distinct from Missed (#B8433A) and Delayed (#E3A23C).
 */
export function adherenceCompositionPie(
  breakdown: CheckInStatusBreakdown,
): { name: string; value: number; fill: string }[] {
  return [
    { name: "Taken", value: breakdown.taken, fill: "#5C8C6B" },
    { name: "Answered no", value: breakdown.answered_no, fill: "#4A6D7C" },
    { name: "Delayed", value: breakdown.delayed, fill: "#E3A23C" },
    { name: "Missed", value: breakdown.missed, fill: "#B8433A" },
  ].filter((p) => p.value > 0);
}

/**
 * Caption naming counts excluded from the adherence composition pie.
 * Answered-no is a pie slice (scored) — only cancelled / pending stay excluded.
 */
export function adherencePieExcludedCaption(
  breakdown: CheckInStatusBreakdown,
): string | undefined {
  const total =
    breakdown.taken +
    breakdown.answered_no +
    breakdown.missed +
    breakdown.delayed +
    breakdown.pending +
    breakdown.cancelled;
  if (total === 0) return undefined;
  const pending =
    breakdown.pending > 0 ? `, ${breakdown.pending} pending` : "";
  return `Excluded from this chart: ${breakdown.cancelled} cancelled${pending}.`;
}

/**
 * Shared adherence % — Case 118: cancelled/pending excluded.
 * `answered_no` is in the denominator with no credit (same weight as a miss).
 */
export function adherencePercent(
  items: ReadonlyArray<{ status: CheckInStatus }>,
): number | null {
  const scored = items.filter(
    (i) =>
      i.status === "taken" ||
      i.status === "answered_no" ||
      i.status === "missed" ||
      i.status === "delayed",
  );
  const hasTerminal = scored.some(
    (i) =>
      i.status === "taken" ||
      i.status === "answered_no" ||
      i.status === "missed",
  );
  // Only delayed (or empty) ⇒ no % (C9 — never 100% on empty).
  if (!hasTerminal) return null;
  const good = scored.filter(
    (i) => i.status === "taken" || i.status === "delayed",
  ).length;
  return Math.round((good / scored.length) * 100);
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
