import { TIMEZONE_OPTIONS } from "@/lib/settings";

/** Runtime check — does `Intl.DateTimeFormat` accept this zone? Never list membership. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Convenience quick-picks — re-export; do not duplicate the list. */
export const COMMON_TIME_ZONES = TIMEZONE_OPTIONS;

/**
 * Full IANA list where available. Falls back to COMMON values.
 * Never throws at module load.
 */
export const ALL_TIME_ZONES: string[] = (() => {
  try {
    const supported = (
      Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) return supported;
  } catch {
    // fall through
  }
  return TIMEZONE_OPTIONS.map((o) => o.value);
})();
