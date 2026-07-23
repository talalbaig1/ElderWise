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
