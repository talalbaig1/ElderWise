/** ElderWise domain models — designed for a future Supabase/API backend. */

export type ID = string;

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type NotificationMethod = "whatsapp" | "sms" | "email" | "push";

export type Gender = "female" | "male" | "other" | "prefer_not_to_say";

export type WellbeingStatus = "stable" | "attention" | "urgent" | "unknown";

export type CheckInStatus =
  | "taken"
  | "missed"
  | "delayed"
  | "upcoming"
  | "pending"
  | "skipped"
  | "cancelled";

export type ResponseChoice = "yes" | "no" | "remind_later";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "custom";

export type MedicationTiming = "before_food" | "after_food" | "no_preference";

export type HealthRoutineType =
  | "sleep"
  | "blood_pressure"
  | "blood_sugar"
  | "water_intake"
  | "exercise"
  | "mood"
  | "weight"
  | "general_wellness"
  | "custom";

export type AnswerType = "yes_no" | "number" | "mood" | "short_text";

export type MoodTag =
  | "positive"
  | "calm"
  | "tired"
  | "lonely"
  | "concerned"
  | "neutral";

export type SOSStatus = "active" | "acknowledged" | "resolved" | "cancelled";

export type SOSCascadeRole =
  | "loved_one"
  | "care_partner"
  | "local_buddy"
  | "family_doctor";

export type SOSCascadeStepStatus =
  | "pending"
  | "notified"
  | "acknowledged"
  | "completed"
  | "skipped";

export interface SOSCascadeStep {
  role: SOSCascadeRole;
  label: string;
  actorName: string;
  contact?: string;
  status: SOSCascadeStepStatus;
  notifiedAt?: string;
  acknowledgedAt?: string;
  note?: string;
}

export interface SOSTimelineEntry {
  id: ID;
  at: string;
  title: string;
  detail?: string;
  tone: "sos" | "warn" | "ok" | "neutral" | "info";
  role?: SOSCascadeRole;
}

export type NotificationCategory =
  | "medication"
  | "meal"
  | "health"
  | "sos"
  | "report"
  | "routine"
  | "system";

export type ReportType =
  | "medication"
  | "food"
  | "health"
  | "sos"
  | "voice_journal"
  | "combined_wellbeing";

export type DateRangePreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "year"
  | "custom";

export interface CarePartner {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  whatsappNumber: string;
  address?: string;
  timeZone: string;
  language: string;
  preferredNotificationMethod: NotificationMethod;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LovedOne {
  id: ID;
  firstName: string;
  lastName: string;
  /** Stored snapshot — does not self-update (Architecture elders.age). */
  age: number;
  whatsappNumber: string;
  gender: Gender;
  preferredLanguage: string;
  /** Mandatory for SOS — shared with Local Buddy in an emergency (M17). */
  address: string;
  timeZone: string;
  relationshipToCarePartner: string;
  avatarUrl?: string;
  wellbeingStatus: WellbeingStatus;
  carePartnerId: ID;
  localBuddyId?: ID;
  doctorId?: ID;
  /** Layer (a) — CT attestation at onboarding (M16). Elder-only; not for buddy/doctor. */
  consentAttestedByCarePartner: boolean;
  consentAttestedAt: string;
  /**
   * Layer (b) — elder's in-channel WhatsApp confirmation.
   * TODO(backend): consentConfirmedAt is set by the n8n WhatsApp flow when the
   * elder responds "Yes" to the welcome message. Until then it stays null and
   * NO check-ins are scheduled. Front end only displays this status.
   */
  consentConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalBuddy {
  id: ID;
  lovedOneId: ID;
  firstName: string;
  lastName: string;
  whatsappNumber: string;
  preferredContactMethod: NotificationMethod;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyDoctor {
  id: ID;
  lovedOneId: ID;
  firstName: string;
  lastName: string;
  /** Empty string when doctors.whatsapp_number is null. */
  whatsappNumber: string;
  clinicName: string;
  createdAt: string;
  updatedAt: string;
}

/** CT-facing share link row — never includes raw token or token_hash. */
export interface DoctorShareLink {
  id: ID;
  lovedOneId: ID;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
}

export interface Medication {
  id: ID;
  lovedOneId: ID;
  enabled: boolean;
  name: string;
  dosage: string;
  dosageUnit: string;
  times: string[];
  daysOfWeek: DayOfWeek[];
  startDate: string;
  endDate?: string;
  timingPreference: MedicationTiming;
  instructions?: string;
  notifyCarePartner: "every_time" | "only_missed" | "not_required";
  escalationMinutes: number;
  whatsappMessageTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodRoutine {
  id: ID;
  lovedOneId: ID;
  enabled: boolean;
  mealName: string;
  mealType: MealType;
  checkInTime: string;
  startDate: string;
  endDate?: string;
  daysOfWeek: DayOfWeek[];
  frequency: "daily" | "weekly" | "custom";
  whatsappMessageTemplate: string;
  notifyCarePartner: "every_time" | "only_missed" | "not_required";
  escalationMinutes: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRoutine {
  id: ID;
  lovedOneId: ID;
  enabled: boolean;
  name: string;
  type: HealthRoutineType;
  frequency: "daily" | "every_2_days" | "weekly" | "custom";
  time: string;
  startDate: string;
  endDate?: string;
  daysOfWeek: DayOfWeek[];
  question: string;
  answerType: AnswerType;
  notifyCarePartner: "every_time" | "only_missed" | "not_required";
  escalationMinutes: number;
  typicalBedtime?: string;
  typicalWakeTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInResponse {
  id: ID;
  lovedOneId: ID;
  /** Set for food/health (1:1 routine FK). Omitted for medication — aggregated check-in. */
  routineId?: ID;
  routineKind: "medication" | "food" | "health";
  scheduledAt: string;
  respondedAt?: string;
  status: CheckInStatus;
  response?: ResponseChoice | string | number;
  channel: "whatsapp" | "manual" | "simulated";
  notes?: string;
}

export interface SOSEvent {
  id: ID;
  lovedOneId: ID;
  status: SOSStatus;
  triggeredAt: string;
  triggerChannel: "whatsapp" | "app" | "simulated";
  locationPlaceholder?: string;
  carePartnerNotified: boolean;
  localBuddyNotified: boolean;
  doctorNotified: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  averageResponseMinutes?: number;
  responders: string[];
  callsMade: string[];
  whatsappActions: string[];
  /** Cascade: Loved One → Care Partner → Local Buddy → Family Doctor */
  cascadeSteps: SOSCascadeStep[];
  /** Chronological emergency timeline (auto-updated during demo cascade) */
  timeline: SOSTimelineEntry[];
  /** When true, client advances cascade steps on a short demo timer */
  autoCascade?: boolean;
}

export interface VoiceJournalEntry {
  id: ID;
  lovedOneId: ID;
  recordedAt: string;
  durationSeconds: number;
  /** Optional demo/playable audio URL or generated blob URL */
  audioUrl?: string;
  /** Short snippet shown in lists */
  transcriptPreview: string;
  /** Full transcript when available */
  transcript?: string;
  aiSummary: string;
  mood: MoodTag;
  themes: string[];
  attentionFlag?: boolean;
}

export interface AppNotification {
  id: ID;
  lovedOneId?: ID;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface ReportDefinition {
  id: ID;
  type: ReportType;
  title: string;
  description: string;
  lovedOneId?: ID;
  rangePreset: DateRangePreset;
  customFrom?: string;
  customTo?: string;
}

export interface ReportSnapshot {
  id: ID;
  type: ReportType;
  lovedOneId: ID;
  generatedAt: string;
  rangeLabel: string;
  adherencePercent?: number;
  summary: string;
  metrics: Record<string, string | number>;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  largerText: boolean;
  increasedContrast: boolean;
  reducedMotion: boolean;
  language: string;
  timeZone: string;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  pushNotifications: boolean;
  /** Notify on missed routines */
  missedRoutineAlerts: boolean;
  /** Notify when weekly report is ready */
  reportReadyAlerts: boolean;
  /** WhatsApp quiet hours */
  whatsappQuietHoursEnabled: boolean;
  whatsappQuietHoursStart: string;
  whatsappQuietHoursEnd: string;
  /** End-of-day WhatsApp digest */
  whatsappDailyDigest: boolean;
  /** SOS always bypasses quiet hours */
  whatsappSosAlways: boolean;
  /** Language used in WhatsApp check-in templates */
  whatsappLanguage: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  carePartnerId: string | null;
  email: string | null;
}

export interface ElderWiseStore {
  version: number;
  session: AuthSession;
  carePartner: CarePartner | null;
  lovedOnes: LovedOne[];
  localBuddies: LocalBuddy[];
  doctors: FamilyDoctor[];
  medications: Medication[];
  foodRoutines: FoodRoutine[];
  healthRoutines: HealthRoutine[];
  checkIns: CheckInResponse[];
  sosEvents: SOSEvent[];
  voiceJournals: VoiceJournalEntry[];
  notifications: AppNotification[];
  reports: ReportSnapshot[];
  settings: UserSettings;
  selectedLovedOneId: string | null;
}
