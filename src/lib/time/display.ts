/**
 * Display helpers — Rules D3–D5 / Architecture §10.
 * Viewer timezone = care partner IANA on the dashboard (e.g. Asia/Riyadh).
 * Elder wall-clock schedule times stay labeled with the elder's IANA zone
 * (e.g. 08:00 Asia/Kolkata) — never convert them to the viewer clock.
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

/** Absolute clock for SOS cascade (viewer TZ). */
export function formatViewerClock(iso: string | Date, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** Absolute date+time for event timestamps (viewer TZ). */
export function formatViewerDateTime(iso: string | Date, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Date-only in viewer TZ (consent badges, header). */
export function formatViewerDate(iso: string | Date, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Label an elder-local wall-clock time (not a timestamptz). */
export function labelElderLocalTime(wallClock: string, elderTimeZone: string): string {
  const t = wallClock.length >= 5 ? wallClock.slice(0, 5) : wallClock;
  return `${t} ${elderTimeZone}`;
}
