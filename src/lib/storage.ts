export const STORAGE_KEYS = {
  store: "elderwise:store",
  theme: "elderwise:theme",
  demoSeeded: "elderwise:demo-seeded",
  onboardingDraft: "elderwise:onboarding-draft",
} as const;

export function isBrowser() {
  return typeof window !== "undefined";
}

export function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — ignore for demo resilience
  }
}

export function removeStorage(key: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
}

export function clearElderWiseStorage() {
  if (!isBrowser()) return;
  Object.values(STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
