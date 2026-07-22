import type {
  FamilyDoctor,
  FoodRoutine,
  HealthRoutine,
  LocalBuddy,
  LovedOne,
  Medication,
  ElderWiseStore,
} from "@/types";
import { ALL_DAYS } from "@/lib/onboarding";

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createBlankLovedOne(carePartnerId: string): LovedOne {
  const now = new Date().toISOString();
  const timeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      : "Asia/Kolkata";

  return {
    id: uid("lo"),
    firstName: "",
    surname: "",
    whatsappNumber: "",
    gender: "prefer_not_to_say",
    preferredLanguage: "en",
    timeZone,
    relationshipToCarePartner: "",
    wellbeingStatus: "unknown",
    carePartnerId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankMedication(lovedOneId: string): Medication {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: uid("med"),
    lovedOneId,
    enabled: true,
    name: "",
    dosage: "",
    dosageUnit: "mg",
    times: ["08:00"],
    daysOfWeek: [...ALL_DAYS],
    startDate: today,
    endDate: "",
    timingPreference: "no_preference",
    notifyCarePartner: "only_missed",
    escalationMinutes: 30,
    whatsappMessageTemplate:
      "Hi {name}, it is time for your {medicine}, {dosage} {unit}. Have you taken it?",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankFood(lovedOneId: string): FoodRoutine {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: uid("food"),
    lovedOneId,
    enabled: true,
    mealName: "Breakfast",
    mealType: "custom",
    checkInTime: "09:00",
    startDate: today,
    endDate: today,
    daysOfWeek: [...ALL_DAYS],
    frequency: "custom",
    whatsappMessageTemplate: "Hi {name}, have you had breakfast today?",
    notifyCarePartner: "only_missed",
    escalationMinutes: 45,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankHealth(lovedOneId: string): HealthRoutine {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: uid("health"),
    lovedOneId,
    enabled: true,
    name: "Wellness check-in",
    type: "general_wellness",
    frequency: "custom",
    time: "10:30",
    startDate: today,
    endDate: today,
    daysOfWeek: [...ALL_DAYS],
    question: "How are you feeling today?",
    answerType: "yes_no",
    notifyCarePartner: "only_missed",
    escalationMinutes: 60,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankBuddy(lovedOneId: string): LocalBuddy {
  const now = new Date().toISOString();
  return {
    id: uid("buddy"),
    lovedOneId,
    name: "",
    relationship: "",
    whatsappNumber: "",
    preferredContactMethod: "whatsapp",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankDoctor(lovedOneId: string): FamilyDoctor {
  const now = new Date().toISOString();
  return {
    id: uid("doc"),
    lovedOneId,
    name: "",
    whatsappNumber: "",
    createdAt: now,
    updatedAt: now,
  };
}

/** Remove a Loved One and cascade related records. */
export function removeLovedOneFromStore(
  store: ElderWiseStore,
  lovedOneId: string,
): ElderWiseStore {
  const remaining = store.lovedOnes.filter((lo) => lo.id !== lovedOneId);
  const selectedLovedOneId =
    store.selectedLovedOneId === lovedOneId
      ? remaining[0]?.id ?? null
      : store.selectedLovedOneId;

  return {
    ...store,
    lovedOnes: remaining,
    localBuddies: store.localBuddies.filter((b) => b.lovedOneId !== lovedOneId),
    doctors: store.doctors.filter((d) => d.lovedOneId !== lovedOneId),
    medications: store.medications.filter((m) => m.lovedOneId !== lovedOneId),
    foodRoutines: store.foodRoutines.filter((f) => f.lovedOneId !== lovedOneId),
    healthRoutines: store.healthRoutines.filter((h) => h.lovedOneId !== lovedOneId),
    checkIns: store.checkIns.filter((c) => c.lovedOneId !== lovedOneId),
    sosEvents: store.sosEvents.filter((e) => e.lovedOneId !== lovedOneId),
    voiceJournals: store.voiceJournals.filter((j) => j.lovedOneId !== lovedOneId),
    reports: store.reports.filter((r) => r.lovedOneId !== lovedOneId),
    notifications: store.notifications.filter((n) => n.lovedOneId !== lovedOneId),
    selectedLovedOneId,
  };
}

export function ageFromDob(dob?: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}
