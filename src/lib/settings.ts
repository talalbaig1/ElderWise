import { defaultSettings } from "@/data/mock";
import type { UserSettings } from "@/types";

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "mr", label: "Marathi" },
  { value: "bn", label: "Bengali" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
] as const;

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Riyadh", label: "Saudi Arabia (Asia/Riyadh)" },
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Japan (Asia/Tokyo)" },
  { value: "Europe/London", label: "UK (Europe/London)" },
  { value: "Europe/Berlin", label: "Central Europe (Berlin)" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Australia/Sydney", label: "Australia (Sydney)" },
  { value: "UTC", label: "UTC" },
] as const;

/** Merge persisted settings with defaults so older localStorage stays valid. */
export function normalizeSettings(partial?: Partial<UserSettings> | null): UserSettings {
  return {
    ...defaultSettings,
    ...(partial ?? {}),
  };
}

export function detectBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}
