import type { ElderWiseStore, UserSettings } from "@/types";

/** Default UI preferences — not seed/demo clinical data. */
export const defaultSettings: UserSettings = {
  theme: "light",
  largerText: false,
  increasedContrast: false,
  reducedMotion: false,
  language: "en",
  timeZone: "Asia/Kolkata",
  emailNotifications: true,
  whatsappNotifications: true,
  pushNotifications: true,
  missedRoutineAlerts: true,
  reportReadyAlerts: true,
  whatsappQuietHoursEnabled: true,
  whatsappQuietHoursStart: "22:00",
  whatsappQuietHoursEnd: "07:00",
  whatsappDailyDigest: true,
  whatsappSosAlways: true,
  whatsappLanguage: "en",
};

/** Empty client shell. Domain rows come from Supabase via the server read model. */
export function createEmptyStore(): ElderWiseStore {
  return {
    version: 1,
    session: {
      isAuthenticated: false,
      carePartnerId: null,
      email: null,
    },
    carePartner: null,
    lovedOnes: [],
    localBuddies: [],
    doctors: [],
    medications: [],
    foodRoutines: [],
    healthRoutines: [],
    checkIns: [],
    sosEvents: [],
    voiceJournals: [],
    notifications: [],
    reports: [],
    settings: defaultSettings,
    selectedLovedOneId: null,
  };
}

/** @deprecated Use createEmptyStore — name kept briefly for any stale imports. */
export const createDemoStore = createEmptyStore;
