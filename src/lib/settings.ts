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
  { value: "Pacific/Midway", label: "UTC-11:00 — Midway, Samoa" },
  { value: "Pacific/Honolulu", label: "UTC-10:00 — Hawaii" },
  { value: "America/Anchorage", label: "UTC-09:00 — Alaska · DST" },
  { value: "America/Los_Angeles", label: "UTC-08:00 — US Pacific (Los Angeles) · DST" },
  { value: "America/Phoenix", label: "UTC-07:00 — Arizona" },
  { value: "America/Denver", label: "UTC-07:00 — US Mountain (Denver) · DST" },
  { value: "America/Mexico_City", label: "UTC-06:00 — Mexico City" },
  { value: "America/Chicago", label: "UTC-06:00 — US Central (Chicago) · DST" },
  { value: "America/Bogota", label: "UTC-05:00 — Colombia (Bogota)" },
  { value: "America/Lima", label: "UTC-05:00 — Peru (Lima)" },
  { value: "America/New_York", label: "UTC-05:00 — US Eastern (New York) · DST" },
  { value: "America/Halifax", label: "UTC-04:00 — Atlantic Canada (Halifax) · DST" },
  { value: "America/Caracas", label: "UTC-04:00 — Venezuela (Caracas)" },
  { value: "America/St_Johns", label: "UTC-03:30 — Newfoundland (St John's) · DST" },
  { value: "America/Argentina/Buenos_Aires", label: "UTC-03:00 — Argentina (Buenos Aires)" },
  { value: "America/Sao_Paulo", label: "UTC-03:00 — Brazil (Sao Paulo)" },
  { value: "Atlantic/Azores", label: "UTC-01:00 — Azores · DST" },
  { value: "Atlantic/Cape_Verde", label: "UTC-01:00 — Cape Verde" },
  { value: "Africa/Casablanca", label: "UTC+00:00 — Morocco (Casablanca) · DST" },
  { value: "Europe/Lisbon", label: "UTC+00:00 — Portugal (Lisbon) · DST" },
  { value: "UTC", label: "UTC+00:00 — UTC" },
  { value: "Europe/London", label: "UTC+00:00 — United Kingdom (London) · DST" },
  { value: "Europe/Paris", label: "UTC+01:00 — France (Paris) · DST" },
  { value: "Europe/Berlin", label: "UTC+01:00 — Germany (Berlin) · DST" },
  { value: "Europe/Rome", label: "UTC+01:00 — Italy (Rome) · DST" },
  { value: "Africa/Lagos", label: "UTC+01:00 — Nigeria (Lagos)" },
  { value: "Africa/Cairo", label: "UTC+02:00 — Egypt (Cairo) · DST" },
  { value: "Europe/Athens", label: "UTC+02:00 — Greece (Athens) · DST" },
  { value: "Africa/Kigali", label: "UTC+02:00 — Rwanda (Kigali)" },
  { value: "Africa/Johannesburg", label: "UTC+02:00 — South Africa (Johannesburg)" },
  { value: "Asia/Baghdad", label: "UTC+03:00 — Iraq (Baghdad)" },
  { value: "Africa/Nairobi", label: "UTC+03:00 — Kenya (Nairobi)" },
  { value: "Asia/Qatar", label: "UTC+03:00 — Qatar (Doha)" },
  { value: "Europe/Moscow", label: "UTC+03:00 — Russia (Moscow)" },
  { value: "Asia/Riyadh", label: "UTC+03:00 — Saudi Arabia (Riyadh, Madinah)" },
  { value: "Asia/Tehran", label: "UTC+03:30 — Iran (Tehran)" },
  { value: "Asia/Baku", label: "UTC+04:00 — Azerbaijan (Baku)" },
  { value: "Asia/Dubai", label: "UTC+04:00 — UAE (Dubai)" },
  { value: "Asia/Kabul", label: "UTC+04:30 — Afghanistan (Kabul)" },
  { value: "Asia/Almaty", label: "UTC+05:00 — Kazakhstan (Almaty)" },
  { value: "Asia/Karachi", label: "UTC+05:00 — Pakistan (Karachi)" },
  { value: "Asia/Tashkent", label: "UTC+05:00 — Uzbekistan (Tashkent)" },
  { value: "Asia/Kolkata", label: "UTC+05:30 — India (Mumbai, New Delhi)" },
  { value: "Asia/Colombo", label: "UTC+05:30 — Sri Lanka (Colombo)" },
  { value: "Asia/Kathmandu", label: "UTC+05:45 — Nepal (Kathmandu)" },
  { value: "Asia/Dhaka", label: "UTC+06:00 — Bangladesh (Dhaka)" },
  { value: "Asia/Yangon", label: "UTC+06:30 — Myanmar (Yangon)" },
  { value: "Asia/Jakarta", label: "UTC+07:00 — Indonesia (Jakarta)" },
  { value: "Asia/Bangkok", label: "UTC+07:00 — Thailand (Bangkok)" },
  { value: "Asia/Ho_Chi_Minh", label: "UTC+07:00 — Vietnam (Ho Chi Minh)" },
  { value: "Australia/Perth", label: "UTC+08:00 — Australia West (Perth)" },
  { value: "Asia/Shanghai", label: "UTC+08:00 — China (Beijing, Shanghai)" },
  { value: "Asia/Hong_Kong", label: "UTC+08:00 — Hong Kong" },
  { value: "Asia/Manila", label: "UTC+08:00 — Philippines (Manila)" },
  { value: "Asia/Singapore", label: "UTC+08:00 — Singapore" },
  { value: "Asia/Tokyo", label: "UTC+09:00 — Japan (Tokyo)" },
  { value: "Asia/Seoul", label: "UTC+09:00 — South Korea (Seoul)" },
  { value: "Australia/Adelaide", label: "UTC+09:30 — Australia Central (Adelaide) · DST" },
  { value: "Australia/Sydney", label: "UTC+10:00 — Australia East (Sydney, Melbourne) · DST" },
  { value: "Australia/Brisbane", label: "UTC+10:00 — Queensland (Brisbane)" },
  { value: "Pacific/Guadalcanal", label: "UTC+11:00 — Solomon Islands" },
  { value: "Pacific/Fiji", label: "UTC+12:00 — Fiji" },
  { value: "Pacific/Auckland", label: "UTC+12:00 — New Zealand (Auckland) · DST" },
  { value: "Pacific/Tongatapu", label: "UTC+13:00 — Tonga" },
  { value: "Pacific/Kiritimati", label: "UTC+14:00 — Line Islands (Kiritimati)" },
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
