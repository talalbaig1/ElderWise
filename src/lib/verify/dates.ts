export type DayRangeKey = "today" | "yesterday" | "last7";

type DayBounds = { startIso: string; endIso: string };

/** Calendar YYYY-MM-DD for an instant in an IANA timezone. */
function calendarYmd(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Shift a YYYY-MM-DD calendar date by whole days (UTC-safe arithmetic on parts). */
function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** UTC instant for local wall time in an IANA timezone (iterative refinement). */
function zonedLocalToUtc(ymd: string, time: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm, ssPart] = time.split(":");
  const [ss, ms = "0"] = (ssPart ?? "0").split(".");
  let utcMs = Date.UTC(
    y,
    m - 1,
    d,
    Number(hh),
    Number(mm),
    Number(ss),
    Number(ms),
  );

  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    }).formatToParts(new Date(utcMs));

    const got: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") got[p.type] = Number(p.value);
    }

    const desiredMs = Date.UTC(
      y,
      m - 1,
      d,
      Number(hh),
      Number(mm),
      Number(ss),
      Number(ms),
    );
    const gotMs = Date.UTC(
      got.year,
      got.month - 1,
      got.day,
      got.hour,
      got.minute,
      got.second,
      got.fractionalSecond ?? 0,
    );
    utcMs -= gotMs - desiredMs;
  }

  return new Date(utcMs);
}

function dayBoundsForYmd(ymd: string, timeZone: string): DayBounds {
  const start = zonedLocalToUtc(ymd, "00:00:00.000", timeZone);
  const end = zonedLocalToUtc(ymd, "23:59:59.999", timeZone);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Widen inclusive UTC bounds by whole calendar days in an IANA timezone. */
export function expandDayBounds(
  bounds: DayBounds,
  timeZone: string,
  daysBefore: number,
  daysAfter: number,
): DayBounds {
  const startYmd = calendarYmd(new Date(bounds.startIso), timeZone);
  const endYmd = calendarYmd(new Date(bounds.endIso), timeZone);
  const start = dayBoundsForYmd(shiftYmd(startYmd, -daysBefore), timeZone);
  const end = dayBoundsForYmd(shiftYmd(endYmd, daysAfter), timeZone);
  return { startIso: start.startIso, endIso: end.endIso };
}

/** Closed enum → inclusive UTC bounds in the elder's IANA timezone. */
export function dayRangeBounds(
  key: DayRangeKey,
  timeZone: string,
  now = new Date(),
): DayBounds {
  const todayYmd = calendarYmd(now, timeZone);

  switch (key) {
    case "today":
      return dayBoundsForYmd(todayYmd, timeZone);
    case "yesterday":
      return dayBoundsForYmd(shiftYmd(todayYmd, -1), timeZone);
    case "last7": {
      const startYmd = shiftYmd(todayYmd, -6);
      const start = zonedLocalToUtc(startYmd, "00:00:00.000", timeZone);
      const end = zonedLocalToUtc(todayYmd, "23:59:59.999", timeZone);
      return { startIso: start.toISOString(), endIso: end.toISOString() };
    }
  }
}
