export const CHECKIN_COLUMNS = [
  "id",
  "domain",
  "food_routine_id",
  "health_routine_id",
  "scheduled_for",
  "sent_at",
  "status",
  "response_value",
  "response_channel",
  "responded_at",
  "reminder_sent_at",
  "missed_at",
  "cancelled_at",
  "wa_message_id",
] as const;

/** PostgREST embed select — hard-coded, never assembled at runtime. */
export const MEDICINE_ITEMS_EMBED_SELECT =
  "taken, medications(name, dosage, dosage_unit)" as const;

export const MEDICATION_ROUTINE_COLUMNS = [
  "name",
  "times",
  "enabled",
  "active",
  "days_of_week",
  "escalation_minutes",
  "notify_care_partner",
  "start_date",
  "end_date",
] as const;

export const FOOD_ROUTINE_COLUMNS = [
  "meal_name",
  "check_in_time",
  "enabled",
  "active",
  "days_of_week",
  "escalation_minutes",
  "notify_care_partner",
  "start_date",
  "end_date",
] as const;

export const HEALTH_ROUTINE_COLUMNS = [
  "name",
  "time",
  "enabled",
  "active",
  "days_of_week",
  "escalation_minutes",
  "notify_care_partner",
  "start_date",
  "end_date",
] as const;

export type ParamKey = "elder" | "checkin" | "sosEvent" | "day";

export type CheckId =
  | "consent_state"
  | "checkins_for_day"
  | "checkin_detail"
  | "medicine_items"
  | "routines_for_elder"
  | "ct_notifications_for_day"
  | "sos_events_for_elder"
  | "sos_dispatch_log"
  | "voice_replies_for_day"
  | "share_links_for_elder"
  | "duplicate_slots"
  | "notification_ownership";

type OrderBy = { column: string; ascending: boolean };

export type CheckDefinition = {
  label: string;
  params: readonly ParamKey[];
  limit: number;
  orderBy: OrderBy;
} & (
  | {
      kind: "select";
      table: string;
      columns: readonly string[];
    }
  | {
      kind: "embed";
      table: string;
      embedSelect: typeof MEDICINE_ITEMS_EMBED_SELECT;
    }
  | {
      kind: "multi_select";
      tables: ReadonlyArray<{
        table: string;
        columns: readonly string[];
        orderBy: OrderBy;
      }>;
    }
  | {
      kind: "computed";
      compute: "duplicate_slots" | "notification_ownership";
      table: string;
      columns: readonly string[];
    }
);

export const VERIFY_CHECKS = {
  consent_state: {
    kind: "select",
    label: "Consent state of my elders",
    table: "elders",
    columns: [
      "first_name",
      "whatsapp_number",
      "timezone",
      "active",
      "consent_requested_at",
      "consent_confirmed_at",
      "consent_declined_at",
    ],
    params: [],
    orderBy: { column: "first_name", ascending: true },
    limit: 100,
  },
  checkins_for_day: {
    kind: "select",
    label: "Check-ins for a day",
    table: "checkins",
    columns: CHECKIN_COLUMNS,
    params: ["elder", "day"],
    orderBy: { column: "scheduled_for", ascending: true },
    limit: 500,
  },
  checkin_detail: {
    kind: "select",
    label: "One check-in, full state",
    table: "checkins",
    columns: CHECKIN_COLUMNS,
    params: ["checkin"],
    orderBy: { column: "scheduled_for", ascending: true },
    limit: 1,
  },
  medicine_items: {
    kind: "embed",
    label: "Medicines recorded on a check-in",
    table: "checkin_medication_items",
    embedSelect: MEDICINE_ITEMS_EMBED_SELECT,
    params: ["checkin"],
    orderBy: { column: "medication_id", ascending: true },
    limit: 100,
  },
  routines_for_elder: {
    kind: "multi_select",
    label: "Routines and their settings",
    tables: [
      {
        table: "medications",
        columns: MEDICATION_ROUTINE_COLUMNS,
        orderBy: { column: "name", ascending: true },
      },
      {
        table: "food_routines",
        columns: FOOD_ROUTINE_COLUMNS,
        orderBy: { column: "meal_name", ascending: true },
      },
      {
        table: "health_routines",
        columns: HEALTH_ROUTINE_COLUMNS,
        orderBy: { column: "name", ascending: true },
      },
    ],
    params: ["elder"],
    orderBy: { column: "name", ascending: true },
    limit: 500,
  },
  ct_notifications_for_day: {
    kind: "select",
    label: "Care Partner notification trail",
    table: "ct_notifications",
    columns: [
      "id",
      "type",
      "checkin_id",
      "care_partner_id",
      "wa_message_id",
      "sent_at",
    ],
    params: ["elder", "day"],
    orderBy: { column: "sent_at", ascending: true },
    limit: 500,
  },
  sos_events_for_elder: {
    kind: "select",
    label: "SOS events",
    table: "sos_events",
    columns: [
      "id",
      "triggered_at",
      "status",
      "nudges_sent",
      "resolved_by_role",
      "resolved_by_id",
      "resolved_channel",
      "resolved_at",
    ],
    params: ["elder"],
    orderBy: { column: "triggered_at", ascending: false },
    limit: 100,
  },
  sos_dispatch_log: {
    kind: "select",
    label: "SOS dispatch log for one event",
    table: "sos_notifications",
    columns: [
      "recipient_role",
      "recipient_id",
      "nudge_index",
      "status",
      "skip_reason",
      "wa_message_id",
      "sent_at",
      "created_at",
    ],
    params: ["sosEvent"],
    orderBy: { column: "created_at", ascending: true },
    limit: 100,
  },
  voice_replies_for_day: {
    kind: "select",
    label: "Voice replies",
    table: "voice_replies",
    columns: [
      "id",
      "checkin_id",
      "audio_path",
      "transcript",
      "provider",
      "confidence",
      "reask_count",
      "created_at",
    ],
    params: ["elder", "day"],
    orderBy: { column: "created_at", ascending: true },
    limit: 500,
  },
  share_links_for_elder: {
    kind: "select",
    label: "Doctor share links",
    table: "doctor_share_links",
    columns: [
      "id",
      "created_by",
      "expires_at",
      "revoked_at",
      "last_accessed_at",
    ],
    params: ["elder"],
    orderBy: { column: "expires_at", ascending: false },
    limit: 100,
  },
  duplicate_slots: {
    kind: "computed",
    compute: "duplicate_slots",
    label: "Duplicate check-in slots",
    table: "checkins",
    columns: ["domain", "scheduled_for", "duplicate_count", "checkin_ids"],
    params: ["elder", "day"],
    orderBy: { column: "scheduled_for", ascending: true },
    limit: 500,
  },
  notification_ownership: {
    kind: "computed",
    compute: "notification_ownership",
    label:
      "Notification ownership mismatches (RLS-limited — always zero here; not evidence)",
    table: "ct_notifications",
    columns: [
      "notification_id",
      "notification_care_partner_id",
      "elder_care_partner_id",
      "type",
      "sent_at",
    ],
    params: ["elder", "day"],
    orderBy: { column: "sent_at", ascending: true },
    limit: 500,
  },
} as const satisfies Record<CheckId, CheckDefinition>;

export const CHECK_IDS = Object.keys(VERIFY_CHECKS) as CheckId[];

export function getCheckDefinition(checkId: CheckId): CheckDefinition {
  return VERIFY_CHECKS[checkId];
}
