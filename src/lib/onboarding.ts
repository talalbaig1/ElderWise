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
  MedicationTiming,
  NotificationMethod,
} from "@/types";
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

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

export const ONBOARDING_STEPS = [
  { id: "loved-one", label: "Loved One", title: "Tell us about the person you would like to stay connected with." },
  { id: "care-partner", label: "Care Partner", title: "Now, tell us how we should keep you updated." },
  { id: "local-buddy", label: "Local Buddy", title: "Who is nearby if your Loved One needs help quickly?" },
  { id: "doctor", label: "Family Doctor", title: "Add a trusted medical contact for urgent situations." },
  { id: "food", label: "Food", title: "Set up food check-ins." },
  { id: "medication", label: "Medication", title: "Set up medication reminders." },
  { id: "health", label: "Health", title: "Set up health and wellness check-ins." },
  { id: "review", label: "Review", title: "Does everything look right?" },
  { id: "completion", label: "Done", title: "You are all set." },
] as const;

export type OnboardingStepIndex = number;

const phone = z.string().trim().min(7, "Enter a valid phone or WhatsApp number");
const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email");

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export const lovedOneSchema = z.object({
  whatsappNumber: phone,
  firstName: z.string().trim().min(1, "First name is required"),
  surname: z.string().trim().min(1, "Surname is required"),
  dateOfBirth: z.string().optional(),
  timeZone: z.string().trim().min(1, "Time zone is required"),
  relationshipToCarePartner: z.string().trim().min(1, "Relationship is required"),
  address: z
    .string()
    .trim()
    .min(1, "Address is required — the Local Buddy needs it in an emergency"),
  consentAttestedByCarePartner: z.boolean().refine((value) => value === true, {
    message: "Please confirm that your Loved One has agreed to receive ElderWise messages",
  }),
});

export const carePartnerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  phoneNumber: phone,
  whatsappNumber: z.string().optional(),
  email: optionalEmail,
  relationshipToLovedOne: z.string().trim().min(1, "Relationship is required"),
  timeZone: z.string().trim().min(1, "Time zone is required"),
});

export const localBuddySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  whatsappNumber: phone,
  directContactNumber: phone,
});

export const doctorSchema = z.object({
  name: z.string().trim().min(1, "Doctor name is required"),
  whatsappNumber: phone,
  directContactNumber: z.string().optional(),
  clinicOrHospitalName: z.string().optional(),
});

export const foodRoutineSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  mealName: z.string().trim().min(1, "Meal name is required"),
  checkInTime: z.string().min(1, "Time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  notifyCarePartner: z.enum(["every_time", "only_missed"]),
});

export const medicationSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Medication name is required"),
  dosage: z.string().trim().min(1, "Dosage is required"),
  dosageUnit: z.string().trim().min(1, "Unit is required"),
  times: z.array(z.string().min(1)).min(1, "Add at least one time"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notifyCarePartner: z.enum(["every_time", "only_missed"]),
  escalationMinutes: z.coerce.number().min(5).max(240),
});

export const healthRoutineSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Routine name is required"),
  time: z.string().min(1, "Time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  notifyCarePartner: z.enum(["every_time", "only_missed"]),
});

export type LovedOneDraft = z.infer<typeof lovedOneSchema>;
export type CarePartnerDraft = z.infer<typeof carePartnerSchema>;
export type LocalBuddyDraft = z.infer<typeof localBuddySchema>;
export type DoctorDraft = z.infer<typeof doctorSchema>;
export type FoodRoutineDraft = z.infer<typeof foodRoutineSchema>;
export type MedicationDraft = z.infer<typeof medicationSchema>;
export type HealthRoutineDraft = z.infer<typeof healthRoutineSchema>;

export interface OnboardingDraft {
  version: 2;
  accountId: string;
  currentStep: number;
  /** Supabase elders.id once Loved One step has written the draft row (active=false). */
  elderId: string | null;
  lovedOne: LovedOneDraft;
  carePartner: CarePartnerDraft;
  localBuddy: LocalBuddyDraft;
  doctor: DoctorDraft;
  foodRoutines: FoodRoutineDraft[];
  medications: MedicationDraft[];
  healthRoutines: HealthRoutineDraft[];
  updatedAt: string;
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Postgres uuid PKs — do not prefix (unlike local mock store ids). */
function newRowId() {
  return crypto.randomUUID();
}

export function createEmptyFood(): FoodRoutineDraft {
  return {
    id: newRowId(),
    enabled: true,
    mealName: "Breakfast",
    checkInTime: "09:00",
    startDate: todayDate(),
    endDate: todayDate(),
    notifyCarePartner: "only_missed",
  };
}

export function createEmptyMedication(): MedicationDraft {
  return {
    id: newRowId(),
    enabled: true,
    name: "Metformin",
    dosage: "500",
    dosageUnit: "mg",
    times: ["08:00"],
    startDate: todayDate(),
    endDate: "",
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
    startDate: todayDate(),
    endDate: todayDate(),
    notifyCarePartner: "only_missed",
  };
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
    version: 2,
    accountId,
    currentStep: 0,
    elderId: null,
    lovedOne: {
      whatsappNumber: "",
      firstName: "",
      surname: "",
      dateOfBirth: "",
      timeZone,
      relationshipToCarePartner: "Parent",
      address: "",
      consentAttestedByCarePartner: false,
    },
    carePartner: {
      firstName: seed?.firstName ?? "",
      phoneNumber: "",
      whatsappNumber: "",
      email: seed?.email ?? "",
      relationshipToLovedOne: "Daughter / Son",
      timeZone,
    },
    localBuddy: {
      name: "",
      whatsappNumber: "",
      directContactNumber: "",
    },
    doctor: {
      name: "",
      whatsappNumber: "",
      directContactNumber: "",
      clinicOrHospitalName: "",
    },
    foodRoutines: [createEmptyFood()],
    medications: [createEmptyMedication()],
    healthRoutines: [createEmptyHealth()],
    updatedAt: new Date().toISOString(),
  };
}

export function loadOnboardingDraft(accountId: string): OnboardingDraft | null {
  const draft = readStorage<OnboardingDraft | null>(STORAGE_KEYS.onboardingDraft, null);
  if (!draft || draft.version !== 2 || draft.accountId !== accountId) return null;
  // Drop legacy skip* flags from older localStorage drafts (A4.2).
  const { skipLocalBuddy: _sb, skipDoctor: _sd, ...rest } = draft as OnboardingDraft & {
    skipLocalBuddy?: boolean;
    skipDoctor?: boolean;
  };
  void _sb;
  void _sd;
  return {
    ...rest,
    elderId: rest.elderId ?? null,
    foodRoutines: rest.foodRoutines.map((item) => {
      const fallback = createEmptyFood();
      return {
        ...fallback,
        ...item,
        notifyCarePartner: item.notifyCarePartner ?? fallback.notifyCarePartner,
      };
    }),
    medications: rest.medications.map((item) => {
      const fallback = createEmptyMedication();
      return {
        ...fallback,
        ...item,
        notifyCarePartner: item.notifyCarePartner ?? fallback.notifyCarePartner,
        escalationMinutes: item.escalationMinutes ?? fallback.escalationMinutes,
      };
    }),
    healthRoutines: rest.healthRoutines.map((item) => {
      const fallback = createEmptyHealth();
      return {
        ...fallback,
        ...item,
        notifyCarePartner: item.notifyCarePartner ?? fallback.notifyCarePartner,
      };
    }),
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

/** Card engaged = any identifying field filled (Architecture §5.7 — no skip flags). */
export function isLocalBuddyEngaged(buddy: LocalBuddyDraft): boolean {
  return Boolean(
    buddy.name.trim() ||
      buddy.whatsappNumber.trim() ||
      buddy.directContactNumber.trim(),
  );
}

export function isDoctorEngaged(doctor: DoctorDraft): boolean {
  return Boolean(
    doctor.name.trim() ||
      doctor.whatsappNumber.trim() ||
      (doctor.directContactNumber ?? "").trim() ||
      (doctor.clinicOrHospitalName ?? "").trim(),
  );
}

export function emptyLocalBuddy(): LocalBuddyDraft {
  return { name: "", whatsappNumber: "", directContactNumber: "" };
}

export function emptyDoctor(): DoctorDraft {
  return {
    name: "",
    whatsappNumber: "",
    directContactNumber: "",
    clinicOrHospitalName: "",
  };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
) {
  return Object.entries(vars).reduce(
    (msg, [key, value]) => msg.replaceAll(`{${key}}`, value || `{${key}}`),
    template,
  );
}

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
    firstName: draft.carePartner.firstName || "Care",
    lastName: store.carePartner?.lastName || "",
    email: draft.carePartner.email || "",
    whatsappNumber:
      draft.carePartner.whatsappNumber?.trim() || draft.carePartner.phoneNumber,
    directContactNumber: draft.carePartner.phoneNumber,
    timeZone: draft.carePartner.timeZone,
    language: "en",
    preferredNotificationMethod: "whatsapp" as NotificationMethod,
    relationshipToLovedOne: draft.carePartner.relationshipToLovedOne,
    createdAt: store.carePartner?.createdAt ?? now,
    updatedAt: now,
  };

  const lovedOne: LovedOne = {
    id: lovedOneId,
    firstName: draft.lovedOne.firstName,
    surname: draft.lovedOne.surname,
    whatsappNumber: draft.lovedOne.whatsappNumber,
    gender: "prefer_not_to_say" as Gender,
    dateOfBirth: draft.lovedOne.dateOfBirth || undefined,
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
    // TODO(backend): consentConfirmedAt is set by the n8n WhatsApp flow when the
    // elder responds "Yes" to the welcome message. Until then it stays null and
    // NO check-ins are scheduled. Front end only displays this status.
    consentConfirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const localBuddy: LocalBuddy | null =
    !buddyId
      ? null
      : {
          id: buddyId,
          lovedOneId,
          name: draft.localBuddy.name,
          relationship: "Local Buddy",
          whatsappNumber: draft.localBuddy.whatsappNumber,
          directContactNumber: draft.localBuddy.directContactNumber,
          preferredContactMethod: "whatsapp" as NotificationMethod,
          createdAt: now,
          updatedAt: now,
        };

  const doctor: FamilyDoctor | null =
    !doctorId
      ? null
      : {
          id: doctorId,
          lovedOneId,
          name: draft.doctor.name,
          whatsappNumber: draft.doctor.whatsappNumber,
          directContactNumber: draft.doctor.directContactNumber || undefined,
          clinicOrHospitalName: draft.doctor.clinicOrHospitalName || undefined,
          createdAt: now,
          updatedAt: now,
        };

  const foodRoutines: FoodRoutine[] = draft.foodRoutines.map((item) => ({
    id: item.id,
    lovedOneId,
    enabled: item.enabled,
    mealName: item.mealName,
    mealType: "custom",
    checkInTime: item.checkInTime,
    startDate: item.startDate,
    endDate: item.endDate || undefined,
    daysOfWeek: [...ALL_DAYS],
    frequency: "custom",
    whatsappMessageTemplate: `Hi {name}, have you had ${item.mealName.toLowerCase()} today?`,
    notifyCarePartner: item.notifyCarePartner,
    escalationMinutes: 45,
    createdAt: now,
    updatedAt: now,
  }));

  const medications: Medication[] = draft.medications.map((item) => ({
    id: item.id,
    lovedOneId,
    enabled: item.enabled,
    name: item.name,
    dosage: item.dosage,
    dosageUnit: item.dosageUnit,
    times: item.times,
    daysOfWeek: [...ALL_DAYS],
    startDate: item.startDate,
    endDate: item.endDate || undefined,
    timingPreference: "no_preference" as MedicationTiming,
    notifyCarePartner: item.notifyCarePartner,
    escalationMinutes: item.escalationMinutes,
    // TODO(backend/n8n): "Yes, all" records all; "Some of them" opens the 24h window
    // and sends a free-form interactive list of this elder's medicines; "Not yet" arms
    // the reminder. Templates cannot carry a dropdown — see Templates.md §1.1.
    whatsappMessageTemplate:
      "Good morning {name} — it's {time}, time for your medicines: {medicineList}. Did you take them? [Yes, all] [Some of them] [Not yet]",
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
    startDate: item.startDate,
    endDate: item.endDate || undefined,
    daysOfWeek: [...ALL_DAYS],
    question: "How are you feeling today?",
    answerType: "yes_no",
    notifyCarePartner: item.notifyCarePartner,
    escalationMinutes: 60,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    ...store,
    carePartner,
    lovedOnes: [lovedOne, ...store.lovedOnes.filter((lo) => lo.id !== lovedOneId)],
    localBuddies: localBuddy
      ? [localBuddy, ...store.localBuddies.filter((b) => b.lovedOneId !== lovedOneId)]
      : store.localBuddies.filter((b) => b.lovedOneId !== lovedOneId),
    doctors: doctor
      ? [doctor, ...store.doctors.filter((d) => d.lovedOneId !== lovedOneId)]
      : store.doctors.filter((d) => d.lovedOneId !== lovedOneId),
    foodRoutines: [
      ...foodRoutines,
      ...store.foodRoutines.filter((f) => f.lovedOneId !== lovedOneId),
    ],
    medications: [
      ...medications,
      ...store.medications.filter((m) => m.lovedOneId !== lovedOneId),
    ],
    healthRoutines: [
      ...healthRoutines,
      ...store.healthRoutines.filter((h) => h.lovedOneId !== lovedOneId),
    ],
    selectedLovedOneId: lovedOneId,
  };
}
