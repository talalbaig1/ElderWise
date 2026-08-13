/** Shared routine-list order: active first, then alert time, then name. */

export type RoutineSortKey = {
  enabled: boolean;
  /** Wall-clock HH:MM (or HH:MM:SS) in the elder's timezone. */
  alertTime: string;
  name: string;
};

function normalizeAlertTime(time: string): string {
  const t = time.trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function compareRoutines(a: RoutineSortKey, b: RoutineSortKey): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  const byTime = normalizeAlertTime(a.alertTime).localeCompare(
    normalizeAlertTime(b.alertTime),
  );
  if (byTime !== 0) return byTime;
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export function sortRoutineList<T>(
  items: T[],
  key: (item: T) => RoutineSortKey,
): T[] {
  return [...items].sort((a, b) => compareRoutines(key(a), key(b)));
}
