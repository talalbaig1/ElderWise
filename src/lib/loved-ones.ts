import type {
  FamilyDoctor,
  FoodRoutine,
  HealthRoutine,
  LocalBuddy,
  LovedOne,
  Medication,
} from "@/types";
import { ALL_DAYS, todayInTimeZone, nowTimeInTimeZone } from "@/lib/onboarding";
import { deriveWellbeingStatus } from "@/lib/wellbeing";

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
    wellbeingStatus: deriveWellbeingStatus({ sosStatuses: [], checkIns: [] }),
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

export function createBlankMedication(lovedOneId: string, timeZone = "UTC"): Medication {
  const now = new Date().toISOString();
  return {
    id: newId(),
    lovedOneId,
    enabled: true,
    name: "",
    dosage: "1",
    dosageUnit: "TAB",
    times: [nowTimeInTimeZone(timeZone)],
    daysOfWeek: [...ALL_DAYS],
    startDate: todayInTimeZone(timeZone),
    endDate: "",
    timingPreference: "before_food",
    notifyCarePartner: "every_time",
    escalationMinutes: 5,
    // TODO(backend/n8n): "Yes, all" records all; "Some of them" opens the 24h window
    // and sends a free-form interactive list of this elder's medicines; "Not yet" arms
    // the reminder. Templates cannot carry a dropdown — see Templates.md §1.1.
    whatsappMessageTemplate:
      "Good morning {name} — it's {time}, time for your medicines: {medicineList}. Did you take them? [Yes, all] [Some of them] [Not yet]",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankFood(lovedOneId: string, timeZone = "UTC"): FoodRoutine {
  const now = new Date().toISOString();
  return {
    id: newId(),
    lovedOneId,
    enabled: true,
    mealName: "Breakfast",
    mealType: "custom",
    checkInTime: nowTimeInTimeZone(timeZone),
    startDate: todayInTimeZone(timeZone),
    endDate: undefined,
    daysOfWeek: [...ALL_DAYS],
    frequency: "daily",
    whatsappMessageTemplate: "Hi {name}, have you had breakfast today?",
    notifyCarePartner: "every_time",
    escalationMinutes: 45,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankHealth(lovedOneId: string, timeZone = "UTC"): HealthRoutine {
  const now = new Date().toISOString();
  return {
    id: newId(),
    lovedOneId,
    enabled: true,
    name: "Wellness check-in",
    type: "general_wellness",
    frequency: "daily",
    time: nowTimeInTimeZone(timeZone),
    startDate: todayInTimeZone(timeZone),
    endDate: undefined,
    daysOfWeek: [...ALL_DAYS],
    question: "How are you feeling today?",
    answerType: "yes_no",
    notifyCarePartner: "every_time",
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
