/**
 * Display helpers — Rules D3–D5.
 * Viewer timezone = care partner IANA (e.g. Asia/Riyadh).
 * Elder wall-clock times stay labeled with the elder's IANA zone.
 */

export function formatInTimeZone(
  iso: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** Label an elder-local wall-clock time (not a timestamptz). */
export function labelElderLocalTime(wallClock: string, elderTimeZone: string): string {
  const t = wallClock.length >= 5 ? wallClock.slice(0, 5) : wallClock;
  return `${t} ${elderTimeZone}`;
}
