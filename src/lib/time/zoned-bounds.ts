/**
 * Calendar-day bounds in an IANA timezone (Care Partner / viewer TZ).
 * Mirrors Postgres `(local_date + wall_time) AT TIME ZONE zone`.
 */

function normalizeWall(wall: string): string {
  const t = wall.trim();
  if (t.includes(".")) {
    // drop ms for the iterative convert; clamp at end of day separately
    const [hms] = t.split(".");
    return normalizeWall(hms);
  }
  if (t.length >= 8) return t.slice(0, 8);
  if (t.length >= 5) return `${t.slice(0, 5)}:00`;
  return t;
}

/** YYYY-MM-DD in the given IANA zone. */
export function calendarDateInTimeZone(
  timeZone: string,
  now = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Shift a YYYY-MM-DD by N calendar days (noon-UTC anchor). */
export function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Convert elder-/viewer-local calendar date + wall clock → UTC Date.
 * Same algorithm as routine-checkin-sync slot expression.
 */
export function zonedWallTimeToUtc(
  timeZone: string,
  dateStr: string,
  wallClock: string,
): Date {
  const time = normalizeWall(wallClock);
  let utc = new Date(`${dateStr}T${time}.000Z`);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(utc)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asLocal = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const want = Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      Number(time.slice(0, 2)),
      Number(time.slice(3, 5)),
      Number(time.slice(6, 8)),
    );
    utc = new Date(utc.getTime() + (want - asLocal));
  }
  return utc;
}

/** Inclusive start of calendar day in `timeZone`. */
export function zonedStartOfDay(timeZone: string, now = new Date()): Date {
  return zonedWallTimeToUtc(
    timeZone,
    calendarDateInTimeZone(timeZone, now),
    "00:00:00",
  );
}

/** Inclusive end of calendar day in `timeZone` (23:59:59.999 local). */
export function zonedEndOfDay(timeZone: string, now = new Date()): Date {
  const startNext = zonedWallTimeToUtc(
    timeZone,
    addCalendarDays(calendarDateInTimeZone(timeZone, now), 1),
    "00:00:00",
  );
  return new Date(startNext.getTime() - 1);
}

/** Start/end of a specific YYYY-MM-DD in `timeZone`. */
export function zonedDayBoundsForDate(
  timeZone: string,
  dateStr: string,
): { from: Date; to: Date } {
  const from = zonedWallTimeToUtc(timeZone, dateStr, "00:00:00");
  const to = new Date(
    zonedWallTimeToUtc(
      timeZone,
      addCalendarDays(dateStr, 1),
      "00:00:00",
    ).getTime() - 1,
  );
  return { from, to };
}
