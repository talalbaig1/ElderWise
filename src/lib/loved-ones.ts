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

/** Postgres uuid PK — never prefix; `med-…` / `food-…` fail UUID cast. */
function newId() {
  return crypto.randomUUID();
}

export function createBlankLovedOne(carePartnerId: string): LovedOne {
  const now = new Date().toISOString();
  const timeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      : "Asia/Kolkata";

  return {
    id: newId(),
    firstName: "",
    lastName: "",
    age: 70,
    whatsappNumber: "",
    gender: "prefer_not_to_say",
    preferredLanguage: "en",
    address: "",
    timeZone,
    relationshipToCarePartner: "",
    wellbeingStatus: "unknown",
    carePartnerId,
    consentAttestedByCarePartner: false,
    consentAttestedAt: "",
    // TODO(backend): consentConfirmedAt is set by the n8n WhatsApp flow when the
    // elder responds "Yes" to the welcome message. Until then it stays null and
    // NO check-ins are scheduled. Front end only displays this status.
    consentConfirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankMedication(lovedOneId: string): Medication {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: newId(),
    lovedOneId,
    enabled: true,
    name: "",
    dosage: "",
    dosageUnit: "TAB",
    times: ["08:00"],
    daysOfWeek: [...ALL_DAYS],
    startDate: today,
    endDate: "",
    timingPreference: "before_food",
    notifyCarePartner: "only_missed",
    escalationMinutes: 30,
    // TODO(backend/n8n): "Yes, all" records all; "Some of them" opens the 24h window
    // and sends a free-form interactive list of this elder's medicines; "Not yet" arms
    // the reminder. Templates cannot carry a dropdown — see Templates.md §1.1.
    whatsappMessageTemplate:
      "Good morning {name} — it's {time}, time for your medicines: {medicineList}. Did you take them? [Yes, all] [Some of them] [Not yet]",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankFood(lovedOneId: string): FoodRoutine {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: newId(),
    lovedOneId,
    enabled: true,
    mealName: "Breakfast",
    mealType: "custom",
    checkInTime: "09:00",
    startDate: today,
    endDate: undefined,
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
    id: newId(),
    lovedOneId,
    enabled: true,
    name: "Wellness check-in",
    type: "general_wellness",
    frequency: "custom",
    time: "10:30",
    startDate: today,
    endDate: undefined,
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
    id: newId(),
    lovedOneId,
    firstName: "",
    lastName: "",
    whatsappNumber: "",
    preferredContactMethod: "whatsapp",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankDoctor(lovedOneId: string): FamilyDoctor {
  const now = new Date().toISOString();
  return {
    id: newId(),
    lovedOneId,
    firstName: "",
    lastName: "",
    whatsappNumber: "",
    clinicName: "",
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
