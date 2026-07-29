import { z } from "zod";
import type {
  CarePartner,
  DayOfWeek,
  ElderWiseStore,
  FamilyDoctor,
  FoodRoutine,
  Gender,
  HealthRoutine,
  LocalBuddy,
  LovedOne,
  Medication,
  NotificationMethod,
} from "@/types";
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { optionalWhatsAppE164Schema, requiredWhatsAppE164Schema } from "@/lib/whatsapp-e164";

export const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

export const ALL_DAYS: DayOfWeek[] = DAYS.map((d) => d.value);

/** Post-auth counted steps (PRD §7.1). Completion is not counted. */
export const ONBOARDING_WIZARD_STEPS = [
  {
    id: "care-circle",
    label: "Care Circle",
    title: "Who is in this Loved One’s care circle?",
  },
  {
    id: "wellness-details",
    label: "Wellness Details",
    title: "Set up medication, food, and health check-ins.",
  },
  {
    id: "review",
    label: "Review",
    title: "Does everything look right?",
  },
] as const;

export type OnboardingWizardStepId = (typeof ONBOARDING_WIZARD_STEPS)[number]["id"];

/** Includes completion (not in progress chrome). */
export type OnboardingStepId = OnboardingWizardStepId | "completion";

export const ONBOARDING_STEP_META: Record<
  OnboardingStepId,
  { label: string; title: string }
> = {
  "care-circle": ONBOARDING_WIZARD_STEPS[0],
  "wellness-details": ONBOARDING_WIZARD_STEPS[1],
  review: ONBOARDING_WIZARD_STEPS[2],
  completion: {
    label: "Done",
    title: "You are all set.",
  },
};

/** Full 4-step chrome including Get Started (sign-up). */
export const ONBOARDING_FULL_PROGRESS = [
  { id: "get-started", label: "Get Started" },
  ...ONBOARDING_WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label })),
] as const;

export const DOSAGE_UNITS = ["TAB", "ML", "CAP", "DROPS", "PUFF", "UNIT"] as const;

export const NOTIFY_MODES = ["every_time", "only_missed", "not_required"] as const;
export type NotifyCarePartnerMode = (typeof NOTIFY_MODES)[number];

/** Approved Not Required warning — Medication card only. */
export const NOT_REQUIRED_WARNING_MEDICATION =
  "You won't receive any alerts about this medication — including when a dose is missed. Missed doses still appear on your dashboard, but no one is notified at the time.";

/** Approved Not Required warning — Food card only. */
export const NOT_REQUIRED_WARNING_FOOD =
  "You won't receive any alerts about this meal — including when it's missed. Missed meals still appear on your dashboard, but no one is notified at the time.";

/** Approved Not Required warning — Health card only. */
export const NOT_REQUIRED_WARNING_HEALTH =
  "You won't receive any alerts about this health routine — including when it's missed. Missed check-ins still appear on your dashboard, but no one is notified at the time.";

const phone = requiredWhatsAppE164Schema;
const optionalPhone = optionalWhatsAppE164Schema;

export function todayInTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const carePartnerCircleSchema = z.object({
  whatsappNumber: phone,
  timeZone: z.string().trim().min(1, "Time zone is required"),
});

export const lovedOneCircleSchema = z.object({
  whatsappNumber: phone,
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  age: z.coerce.number().int().min(1).max(120),
  timeZone: z.string().trim().min(1, "Time zone is required"),
  relationshipToCarePartner: z.string().trim().min(1, "Relationship is required"),
  address: z
    .string()
    .trim()
    .min(1, "Address is required — the Local Buddy needs it in an emergency"),
});

export const localBuddyCircleSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  whatsappNumber: phone,
});

export const doctorCircleSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  clinicName: z.string().trim().min(1, "Clinic or hospital is required"),
  whatsappNumber: optionalPhone,
});

/** Settings / Care Circle tab — Local Buddy write shape (A4.4). */
export const localBuddySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  whatsappNumber: phone,
});

export const doctorSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  whatsappNumber: optionalPhone,
  clinicName: z.string().trim().min(1, "Clinic or hospital is required"),
});

export const medicationDraftSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Medication name is required"),
  dosage: z.string().trim().min(1, "Dosage quantity is required"),
  dosageUnit: z.enum(DOSAGE_UNITS),
  time: z.string().min(1, "Time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  mealTiming: z.enum(["before_food", "after_food"]),
  notifyCarePartner: z.enum(NOTIFY_MODES),
  escalationMinutes: z.coerce.number().min(5).max(240),
});

export const foodRoutineDraftSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  mealName: z.string().trim().min(1, "Meal name is required"),
  checkInTime: z.string().min(1, "Time is required"),
  notifyCarePartner: z.enum(NOTIFY_MODES),
});

export const healthRoutineDraftSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Routine name is required"),
  time: z.string().min(1, "Time is required"),
  notifyCarePartner: z.enum(NOTIFY_MODES),
});

/** Settings / routine editors until Pass 4 alignment. */
export const medicationSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Medication name is required"),
  dosage: z.string().trim().min(1, "Dosage quantity is required"),
  dosageUnit: z.enum(DOSAGE_UNITS),
  times: z.array(z.string().min(1)).length(1, "One time per medication"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notifyCarePartner: z.enum(NOTIFY_MODES),
  escalationMinutes: z.coerce.number().min(5).max(240),
});

export const foodRoutineSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  mealName: z.string().trim().min(1, "Meal name is required"),
  checkInTime: z.string().min(1, "Time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notifyCarePartner: z.enum(NOTIFY_MODES),
});

export const healthRoutineSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Routine name is required"),
  time: z.string().min(1, "Time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notifyCarePartner: z.enum(NOTIFY_MODES),
});

export type MedicationDraft = z.infer<typeof medicationDraftSchema>;
export type FoodRoutineDraft = z.infer<typeof foodRoutineDraftSchema>;
export type HealthRoutineDraft = z.infer<typeof healthRoutineDraftSchema>;
export type CarePartnerCircleDraft = z.infer<typeof carePartnerCircleSchema>;
export type LovedOneCircleDraft = z.infer<typeof lovedOneCircleSchema>;
export type LocalBuddyCircleDraft = z.infer<typeof localBuddyCircleSchema>;
export type DoctorCircleDraft = z.infer<typeof doctorCircleSchema>;

export interface OnboardingDraft {
  version: 3;
  accountId: string;
  currentStepId: OnboardingStepId;
  elderId: string | null;
  /** Display-only from Auth / care_partners — not re-collected on Care Circle. */
  carePartnerProfile: {
    firstName: string;
    lastName: string;
    email: string;
  };
  carePartner: CarePartnerCircleDraft;
  lovedOne: LovedOneCircleDraft;
  localBuddy: LocalBuddyCircleDraft;
  doctor: DoctorCircleDraft;
  foodRoutines: FoodRoutineDraft[];
  medications: MedicationDraft[];
  healthRoutines: HealthRoutineDraft[];
  updatedAt: string;
}

function newRowId() {
  return crypto.randomUUID();
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyFood(): FoodRoutineDraft {
  return {
    id: newRowId(),
    enabled: true,
    mealName: "Breakfast",
    checkInTime: "09:00",
    notifyCarePartner: "only_missed",
  };
}

export function createEmptyMedication(elderTimeZone = "Asia/Kolkata"): MedicationDraft {
  return {
    id: newRowId(),
    enabled: true,
    name: "Metformin 500mg",
    dosage: "1",
    dosageUnit: "TAB",
    time: "08:00",
    startDate: todayInTimeZone(elderTimeZone),
    endDate: "",
    mealTiming: "after_food",
    notifyCarePartner: "only_missed",
    escalationMinutes: 30,
  };
}

export function createEmptyHealth(): HealthRoutineDraft {
  return {
    id: newRowId(),
    enabled: true,
    name: "Morning wellness",
    time: "10:30",
    notifyCarePartner: "only_missed",
  };
}

export function emptyLocalBuddy(): LocalBuddyCircleDraft {
  return { firstName: "", lastName: "", whatsappNumber: "" };
}

export function emptyDoctor(): DoctorCircleDraft {
  return { firstName: "", lastName: "", clinicName: "", whatsappNumber: "" };
}

export function isLocalBuddyEngaged(buddy: LocalBuddyCircleDraft): boolean {
  return Boolean(
    buddy.firstName.trim() || buddy.lastName.trim() || buddy.whatsappNumber.trim(),
  );
}

export function isDoctorEngaged(doctor: DoctorCircleDraft): boolean {
  return Boolean(
    doctor.firstName.trim() ||
      doctor.lastName.trim() ||
      doctor.clinicName.trim() ||
      doctor.whatsappNumber.trim(),
  );
}

export function createDefaultDraft(
  accountId: string,
  seed?: { firstName?: string; lastName?: string; email?: string },
): OnboardingDraft {
  const timeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      : "Asia/Kolkata";

  return {
    version: 3,
    accountId,
    currentStepId: "care-circle",
    elderId: null,
    carePartnerProfile: {
      firstName: seed?.firstName ?? "",
      lastName: seed?.lastName ?? "",
      email: seed?.email ?? "",
    },
    carePartner: {
      whatsappNumber: "",
      timeZone,
    },
    lovedOne: {
      whatsappNumber: "",
      firstName: "",
      lastName: "",
      age: 70,
      timeZone,
      relationshipToCarePartner: "Parent",
      address: "",
    },
    localBuddy: emptyLocalBuddy(),
    doctor: emptyDoctor(),
    foodRoutines: [createEmptyFood()],
    medications: [createEmptyMedication(timeZone)],
    healthRoutines: [createEmptyHealth()],
    updatedAt: new Date().toISOString(),
  };
}

export function loadOnboardingDraft(accountId: string): OnboardingDraft | null {
  const draft = readStorage<OnboardingDraft | null>(STORAGE_KEYS.onboardingDraft, null);
  if (!draft || draft.version !== 3 || draft.accountId !== accountId) return null;
  return {
    ...draft,
    elderId: draft.elderId ?? null,
    foodRoutines:
      draft.foodRoutines?.length > 0
        ? draft.foodRoutines.map((item) => ({ ...createEmptyFood(), ...item }))
        : [createEmptyFood()],
    medications:
      draft.medications?.length > 0
        ? draft.medications.map((item) => ({
            ...createEmptyMedication(draft.lovedOne?.timeZone),
            ...item,
          }))
        : [createEmptyMedication(draft.lovedOne?.timeZone)],
    healthRoutines:
      draft.healthRoutines?.length > 0
        ? draft.healthRoutines.map((item) => ({ ...createEmptyHealth(), ...item }))
        : [createEmptyHealth()],
  };
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  writeStorage(STORAGE_KEYS.onboardingDraft, {
    ...draft,
    updatedAt: new Date().toISOString(),
  });
}

export function clearOnboardingDraft() {
  removeStorage(STORAGE_KEYS.onboardingDraft);
}

export function wizardStepIndex(stepId: OnboardingStepId): number {
  const idx = ONBOARDING_WIZARD_STEPS.findIndex((s) => s.id === stepId);
  return idx >= 0 ? idx : ONBOARDING_WIZARD_STEPS.length;
}

export function isUnfinishedDraftError(message: string): boolean {
  return /unfinished Loved One draft/i.test(message);
}

/** Mock-store apply path for local demo (not Supabase). */
export function applyOnboardingDraft(
  store: ElderWiseStore,
  draft: OnboardingDraft,
): ElderWiseStore {
  const now = new Date().toISOString();
  const carePartnerId = store.session.carePartnerId ?? uid("cp");
  const lovedOneId = uid("lo");
  const buddyEngaged = isLocalBuddyEngaged(draft.localBuddy);
  const doctorEngaged = isDoctorEngaged(draft.doctor);
  const buddyId = buddyEngaged ? uid("buddy") : undefined;
  const doctorId = doctorEngaged ? uid("doc") : undefined;

  const carePartner: CarePartner = {
    id: carePartnerId,
    firstName: draft.carePartnerProfile.firstName || "Care",
    lastName: draft.carePartnerProfile.lastName || "",
    email: draft.carePartnerProfile.email || "",
    whatsappNumber: draft.carePartner.whatsappNumber,
    timeZone: draft.carePartner.timeZone,
    language: "en",
    preferredNotificationMethod: "whatsapp" as NotificationMethod,
    createdAt: store.carePartner?.createdAt ?? now,
    updatedAt: now,
  };

  const lovedOne: LovedOne = {
    id: lovedOneId,
    firstName: draft.lovedOne.firstName,
    lastName: draft.lovedOne.lastName,
    age: draft.lovedOne.age,
    whatsappNumber: draft.lovedOne.whatsappNumber,
    gender: "prefer_not_to_say" as Gender,
    preferredLanguage: "en",
    address: draft.lovedOne.address,
    timeZone: draft.lovedOne.timeZone,
    relationshipToCarePartner: draft.lovedOne.relationshipToCarePartner,
    wellbeingStatus: "stable",
    carePartnerId,
    localBuddyId: buddyId,
    doctorId,
    consentAttestedByCarePartner: true,
    consentAttestedAt: now,
    consentConfirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const localBuddy: LocalBuddy | null = !buddyId
    ? null
    : {
        id: buddyId,
        lovedOneId,
        firstName: draft.localBuddy.firstName,
        lastName: draft.localBuddy.lastName,
        whatsappNumber: draft.localBuddy.whatsappNumber,
        preferredContactMethod: "whatsapp" as NotificationMethod,
        createdAt: now,
        updatedAt: now,
      };

  const doctor: FamilyDoctor | null = !doctorId
    ? null
    : {
        id: doctorId,
        lovedOneId,
        firstName: draft.doctor.firstName,
        lastName: draft.doctor.lastName,
        whatsappNumber: draft.doctor.whatsappNumber,
        clinicName: draft.doctor.clinicName,
        createdAt: now,
        updatedAt: now,
      };

  const medications: Medication[] = draft.medications.map((item) => ({
    id: item.id,
    lovedOneId,
    enabled: item.enabled,
    name: item.name,
    dosage: item.dosage,
    dosageUnit: item.dosageUnit,
    times: [item.time],
    startDate: item.startDate,
    endDate: item.endDate || undefined,
    daysOfWeek: [...ALL_DAYS],
    timingPreference: item.mealTiming,
    notifyCarePartner:
      item.notifyCarePartner === "not_required" ? "only_missed" : item.notifyCarePartner,
    escalationMinutes: item.escalationMinutes,
    whatsappMessageTemplate: `Hi {name}, time for ${item.name}.`,
    createdAt: now,
    updatedAt: now,
  }));

  const foodRoutines: FoodRoutine[] = draft.foodRoutines.map((item) => ({
    id: item.id,
    lovedOneId,
    enabled: item.enabled,
    mealName: item.mealName,
    mealType: "custom",
    checkInTime: item.checkInTime,
    startDate: todayInTimeZone(draft.lovedOne.timeZone),
    daysOfWeek: [...ALL_DAYS],
    frequency: "custom",
    whatsappMessageTemplate: `Hi {name}, have you had ${item.mealName.toLowerCase()} today?`,
    notifyCarePartner:
      item.notifyCarePartner === "not_required" ? "only_missed" : item.notifyCarePartner,
    escalationMinutes: 45,
    createdAt: now,
    updatedAt: now,
  }));

  const healthRoutines: HealthRoutine[] = draft.healthRoutines.map((item) => ({
    id: item.id,
    lovedOneId,
    enabled: item.enabled,
    name: item.name,
    type: "general_wellness",
    frequency: "custom",
    time: item.time,
    startDate: todayInTimeZone(draft.lovedOne.timeZone),
    daysOfWeek: [...ALL_DAYS],
    question: "How are you feeling today?",
    answerType: "yes_no",
    notifyCarePartner:
      item.notifyCarePartner === "not_required" ? "only_missed" : item.notifyCarePartner,
    escalationMinutes: 60,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    ...store,
    carePartner,
    lovedOnes: [...store.lovedOnes.filter((l) => l.id !== lovedOneId), lovedOne],
    localBuddies: localBuddy
      ? [...store.localBuddies.filter((b) => b.lovedOneId !== lovedOneId), localBuddy]
      : store.localBuddies.filter((b) => b.lovedOneId !== lovedOneId),
    doctors: doctor
      ? [...store.doctors.filter((d) => d.lovedOneId !== lovedOneId), doctor]
      : store.doctors.filter((d) => d.lovedOneId !== lovedOneId),
    foodRoutines: [
      ...store.foodRoutines.filter((f) => f.lovedOneId !== lovedOneId),
      ...foodRoutines,
    ],
    medications: [
      ...store.medications.filter((m) => m.lovedOneId !== lovedOneId),
      ...medications,
    ],
    healthRoutines: [
      ...store.healthRoutines.filter((h) => h.lovedOneId !== lovedOneId),
      ...healthRoutines,
    ],
  };
}
