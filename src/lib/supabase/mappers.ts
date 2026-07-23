/**
 * camelCase (FE) ↔ snake_case (DB) mapping — Architecture §5.3 / §5.5.
 * Screens do not use these for live queries until A2.3.
 */

import type {
  CarePartner,
  CheckInStatus,
  LovedOne,
  Medication,
  FoodRoutine,
  HealthRoutine,
  CheckInResponse,
  SOSEvent,
  SOSCascadeStep,
  SOSTimelineEntry,
  AppNotification,
  LocalBuddy,
  FamilyDoctor,
  NotificationCategory,
} from "@/types";

export type DbCheckInStatus =
  | "scheduled"
  | "sent"
  | "reminded"
  | "responded"
  | "missed";

export function checkInStatusToUi(status: DbCheckInStatus): CheckInStatus {
  switch (status) {
    case "scheduled":
      return "upcoming";
    case "sent":
      return "pending";
    case "reminded":
      return "delayed";
    case "responded":
      return "taken";
    case "missed":
      return "missed";
  }
}

export function checkInStatusToDb(status: CheckInStatus): DbCheckInStatus | null {
  switch (status) {
    case "upcoming":
      return "scheduled";
    case "pending":
      return "sent";
    case "delayed":
      return "reminded";
    case "taken":
      return "responded";
    case "missed":
      return "missed";
    case "skipped":
      return null; // UI-only — no backend status
  }
}

export interface CarePartnerRow {
  id: string;
  full_name: string;
  email: string;
  whatsapp_number: string | null;
  phone_number: string | null;
  timezone: string;
  address: string | null;
  secondary_contact: unknown;
  created_at: string;
}

export function carePartnerFromRow(row: CarePartnerRow): CarePartner {
  const parts = row.full_name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;
  return {
    id: row.id,
    firstName,
    lastName,
    email: row.email,
    whatsappNumber: row.whatsapp_number ?? "",
    directContactNumber: row.phone_number ?? undefined,
    address: row.address ?? undefined,
    timeZone: row.timezone,
    language: "en",
    preferredNotificationMethod: "whatsapp",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export interface ElderRow {
  id: string;
  care_partner_id: string;
  first_name: string;
  surname: string;
  gender: string | null;
  whatsapp_number: string;
  timezone: string;
  address: string;
  consent_attested_by_ct: boolean;
  consent_attested_at: string | null;
  consent_confirmed_at: string | null;
  active: boolean;
  created_at: string;
}

export function lovedOneFromElderRow(row: ElderRow): LovedOne {
  return {
    id: row.id,
    carePartnerId: row.care_partner_id,
    firstName: row.first_name,
    surname: row.surname,
    gender: (row.gender as LovedOne["gender"]) || "prefer_not_to_say",
    whatsappNumber: row.whatsapp_number,
    preferredLanguage: "en",
    address: row.address,
    timeZone: row.timezone,
    relationshipToCarePartner: "",
    wellbeingStatus: "unknown",
    consentAttestedByCarePartner: row.consent_attested_by_ct,
    consentAttestedAt: row.consent_attested_at ?? "",
    consentConfirmedAt: row.consent_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export interface MedicationRow {
  id: string;
  elder_id: string;
  enabled: boolean;
  name: string;
  dosage: string;
  dosage_unit: string;
  times: string[];
  days_of_week: string[];
  start_date: string;
  end_date: string | null;
  timing_preference: Medication["timingPreference"];
  instructions: string | null;
  notify_care_partner: Medication["notifyCarePartner"];
  escalation_minutes: number;
  active: boolean;
}

export function medicationFromRow(row: MedicationRow): Medication {
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    enabled: row.enabled,
    name: row.name,
    dosage: row.dosage,
    dosageUnit: row.dosage_unit,
    times: row.times,
    daysOfWeek: row.days_of_week as Medication["daysOfWeek"],
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    timingPreference: row.timing_preference,
    instructions: row.instructions ?? undefined,
    notifyCarePartner: row.notify_care_partner,
    escalationMinutes: row.escalation_minutes,
    whatsappMessageTemplate: "",
    createdAt: row.start_date,
    updatedAt: row.start_date,
  };
}

export interface FoodRoutineRow {
  id: string;
  elder_id: string;
  enabled: boolean;
  meal_name: string;
  meal_type: FoodRoutine["mealType"];
  check_in_time: string;
  start_date: string;
  end_date: string | null;
  days_of_week: string[];
  frequency: FoodRoutine["frequency"];
  notify_care_partner: FoodRoutine["notifyCarePartner"];
  escalation_minutes: number;
  notes: string | null;
}

export function foodRoutineFromRow(row: FoodRoutineRow): FoodRoutine {
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    enabled: row.enabled,
    mealName: row.meal_name,
    mealType: row.meal_type,
    checkInTime: row.check_in_time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    daysOfWeek: row.days_of_week as FoodRoutine["daysOfWeek"],
    frequency: row.frequency,
    whatsappMessageTemplate: "",
    notifyCarePartner: row.notify_care_partner,
    escalationMinutes: row.escalation_minutes,
    notes: row.notes ?? undefined,
    createdAt: row.start_date,
    updatedAt: row.start_date,
  };
}

export interface HealthRoutineRow {
  id: string;
  elder_id: string;
  enabled: boolean;
  name: string;
  type: HealthRoutine["type"];
  frequency: HealthRoutine["frequency"];
  time: string;
  start_date: string;
  end_date: string | null;
  days_of_week: string[];
  question: string;
  answer_type: HealthRoutine["answerType"];
  notify_care_partner: HealthRoutine["notifyCarePartner"];
  escalation_minutes: number;
  typical_bedtime: string | null;
  typical_wake_time: string | null;
}

export function healthRoutineFromRow(row: HealthRoutineRow): HealthRoutine {
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    enabled: row.enabled,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    time: row.time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    daysOfWeek: row.days_of_week as HealthRoutine["daysOfWeek"],
    question: row.question,
    answerType: row.answer_type,
    notifyCarePartner: row.notify_care_partner,
    escalationMinutes: row.escalation_minutes,
    typicalBedtime: row.typical_bedtime?.slice(0, 5),
    typicalWakeTime: row.typical_wake_time?.slice(0, 5),
    createdAt: row.start_date,
    updatedAt: row.start_date,
  };
}

export interface CheckinRow {
  id: string;
  elder_id: string;
  domain: "medication" | "health" | "food";
  scheduled_for: string;
  sent_at: string | null;
  status: DbCheckInStatus;
  response_channel: "button" | "voice" | null;
  response_value: string | null;
  responded_at: string | null;
  reminder_sent_at: string | null;
  missed_at: string | null;
  escalated_at: string | null;
}

export function checkInFromRow(row: CheckinRow): CheckInResponse {
  const channel =
    row.response_channel === "voice"
      ? "whatsapp"
      : row.response_channel === "button"
        ? "whatsapp"
        : "manual";
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    routineId: row.elder_id,
    routineKind: row.domain === "food" ? "food" : row.domain,
    scheduledAt: row.scheduled_for,
    respondedAt: row.responded_at ?? undefined,
    status: checkInStatusToUi(row.status),
    response: row.response_value ?? undefined,
    channel,
    notes: row.response_channel === "voice" ? "voice" : undefined,
  };
}

export interface LocalCaregiverRow {
  id: string;
  elder_id: string;
  full_name: string;
  whatsapp_number: string;
  phone_number: string | null;
  action_plan: string | null;
  created_at: string;
}

export function localBuddyFromRow(row: LocalCaregiverRow): LocalBuddy {
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    name: row.full_name,
    relationship: "Local Buddy",
    whatsappNumber: row.whatsapp_number,
    directContactNumber: row.phone_number ?? undefined,
    availabilityNotes: row.action_plan ?? undefined,
    preferredContactMethod: "whatsapp",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export interface DoctorRow {
  id: string;
  elder_id: string;
  full_name: string;
  whatsapp_number: string;
  phone_number: string | null;
  address: string | null;
  timezone: string | null;
  approved_by_ct: boolean;
  created_at: string;
}

export function doctorFromRow(row: DoctorRow): FamilyDoctor {
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    name: row.full_name,
    whatsappNumber: row.whatsapp_number,
    directContactNumber: row.phone_number ?? undefined,
    clinicAddress: row.address ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export interface SosEventRow {
  id: string;
  elder_id: string;
  triggered_at: string;
  status: "open" | "resolved";
  nudges_sent: number;
  resolved_by_role: string | null;
  resolved_by_id: string | null;
  resolved_channel: string | null;
  resolved_at: string | null;
}

export interface SosNotificationRow {
  id: string;
  sos_event_id: string;
  recipient_role: "care_partner" | "local_caregiver" | "doctor";
  recipient_id: string;
  nudge_index: number;
  sent_at: string;
  delivered_at: string | null;
}

export function sosEventFromRows(
  event: SosEventRow,
  notifications: SosNotificationRow[],
  names: {
    carePartner?: string;
    localBuddy?: string;
    doctor?: string;
    /** elders.address (M17) — shown on SOS panels */
    location?: string;
  },
): SOSEvent {
  const related = notifications.filter((n) => n.sos_event_id === event.id);
  const carePartnerNotified = related.some((n) => n.recipient_role === "care_partner");
  const localBuddyNotified = related.some((n) => n.recipient_role === "local_caregiver");
  const doctorNotified = related.some((n) => n.recipient_role === "doctor");

  const cascadeSteps: SOSCascadeStep[] = [
    {
      role: "loved_one",
      label: "Loved One",
      actorName: "Loved One",
      status: "completed",
      notifiedAt: event.triggered_at,
    },
    {
      role: "care_partner",
      label: "Care Partner",
      actorName: names.carePartner ?? "Care Partner",
      status: carePartnerNotified ? "notified" : "pending",
      notifiedAt: related.find((n) => n.recipient_role === "care_partner")?.sent_at,
    },
    {
      role: "local_buddy",
      label: "Local Buddy",
      actorName: names.localBuddy ?? "Local Buddy",
      status: localBuddyNotified ? "notified" : "skipped",
      notifiedAt: related.find((n) => n.recipient_role === "local_caregiver")?.sent_at,
    },
    {
      role: "family_doctor",
      label: "Family Doctor",
      actorName: names.doctor ?? "Family Doctor",
      status: doctorNotified ? "notified" : "skipped",
      notifiedAt: related.find((n) => n.recipient_role === "doctor")?.sent_at,
    },
  ];

  const timeline: SOSTimelineEntry[] = [
    {
      id: `${event.id}-triggered`,
      at: event.triggered_at,
      title: "SOS triggered",
      tone: "sos",
    },
    ...related.map((n) => ({
      id: n.id,
      at: n.sent_at,
      title: `Notified ${n.recipient_role.replace("_", " ")}`,
      tone: "warn" as const,
    })),
  ];
  if (event.resolved_at) {
    timeline.push({
      id: `${event.id}-resolved`,
      at: event.resolved_at,
      title: "SOS resolved",
      tone: "ok",
    });
  }

  return {
    id: event.id,
    lovedOneId: event.elder_id,
    status: event.status === "open" ? "active" : "resolved",
    triggeredAt: event.triggered_at,
    triggerChannel: "whatsapp",
    locationPlaceholder: names.location?.trim() || undefined,
    carePartnerNotified,
    localBuddyNotified,
    doctorNotified,
    resolvedAt: event.resolved_at ?? undefined,
    responders: related.map((n) => n.recipient_role),
    callsMade: [],
    whatsappActions: related.map((n) => `nudge ${n.nudge_index}`),
    cascadeSteps,
    timeline,
    autoCascade: false,
  };
}

export interface CtNotificationRow {
  id: string;
  elder_id: string;
  care_partner_id: string;
  type: "interaction" | "missed";
  checkin_id: string | null;
  sent_at: string;
}

export function ctNotificationFromRow(
  row: CtNotificationRow,
  elderName?: string,
): AppNotification {
  const category: NotificationCategory =
    row.type === "missed" ? "routine" : "medication";
  const who = elderName ?? "Loved One";
  return {
    id: row.id,
    lovedOneId: row.elder_id,
    category,
    title: row.type === "missed" ? "Missed check-in" : "Check-in response",
    body:
      row.type === "missed"
        ? `${who} missed a scheduled check-in.`
        : `${who} responded to a check-in.`,
    createdAt: row.sent_at,
    // No read_at column on ct_notifications — always unread until schema decision
    read: false,
    href: row.checkin_id ? "/dashboard" : "/notifications",
  };
}
