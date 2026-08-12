import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CarePartner,
  LovedOne,
  Medication,
  FoodRoutine,
  HealthRoutine,
  CheckInResponse,
  SOSEvent,
  SOSStatus,
  AppNotification,
  LocalBuddy,
  FamilyDoctor,
  ElderWiseStore,
  AuthSession,
  UserSettings,
  DoctorShareLink,
} from "@/types";
import { defaultSettings } from "@/data/mock";
import {
  carePartnerFromRow,
  lovedOneFromElderRow,
  medicationFromRow,
  foodRoutineFromRow,
  healthRoutineFromRow,
  checkInFromRow,
  localBuddyFromRow,
  doctorFromRow,
  sosEventFromRows,
  ctNotificationFromRow,
  type CarePartnerRow,
  type ElderRow,
  type MedicationRow,
  type FoodRoutineRow,
  type HealthRoutineRow,
  type CheckinRow,
  type LocalCaregiverRow,
  type DoctorRow,
  type SosEventRow,
  type SosNotificationRow,
  type CtNotificationRow,
} from "@/lib/supabase/mappers";
import { deriveWellbeingStatus } from "@/lib/wellbeing";

export interface AppReadModel {
  carePartner: CarePartner | null;
  lovedOnes: LovedOne[];
  localBuddies: LocalBuddy[];
  doctors: FamilyDoctor[];
  medications: Medication[];
  foodRoutines: FoodRoutine[];
  healthRoutines: HealthRoutine[];
  checkIns: CheckInResponse[];
  sosEvents: SOSEvent[];
  notifications: AppNotification[];
  viewerTimeZone: string;
  /** Always empty in MVP — voice_journal_entries table does not exist */
  voiceJournals: [];
  doctorShareLinks: DoctorShareLink[];
  /** Always empty until templates seeded */
  messageTemplates: [];
}

export const EMPTY_APP_READ_MODEL: AppReadModel = {
  carePartner: null,
  lovedOnes: [],
  localBuddies: [],
  doctors: [],
  medications: [],
  foodRoutines: [],
  healthRoutines: [],
  checkIns: [],
  sosEvents: [],
  notifications: [],
  viewerTimeZone: "UTC",
  voiceJournals: [],
  doctorShareLinks: [],
  messageTemplates: [],
};

export async function loadAppData(
  supabase: SupabaseClient,
): Promise<AppReadModel> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return EMPTY_APP_READ_MODEL;
  }

  const [
    cpRes,
    eldersRes,
    lctRes,
    docRes,
    medRes,
    foodRes,
    healthRes,
    checkinsRes,
    sosRes,
    sosNotifRes,
    ctNotifRes,
    shareRes,
  ] = await Promise.all([
    supabase.from("care_partners").select("*").eq("id", user.id).maybeSingle(),
    // Same rule as hasOwnProductElder / countOwnActiveElders: product elder =
    // active=true. Drafts (active=false) stay out of the read model.
    supabase
      .from("elders")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase.from("local_caregivers").select("*"),
    supabase.from("doctors").select("*"),
    // Soft-deleted / disabled routines stay out of the active list (history
    // remains via checkins FKs). Meds: active=false OR enabled=false. Food/health:
    // enabled=false only. Re-enable requires a new row until a true delete+restore
    // path exists (hard DELETE is forbidden — CASCADE would wipe check-in history).
    supabase.from("medications").select("*").eq("active", true).eq("enabled", true),
    supabase.from("food_routines").select("*").eq("enabled", true),
    supabase.from("health_routines").select("*").eq("enabled", true),
    supabase.from("checkins").select("*").order("scheduled_for", { ascending: false }),
    supabase.from("sos_events").select("*").order("triggered_at", { ascending: false }),
    supabase.from("sos_notifications").select("*"),
    supabase.from("ct_notifications").select("*").order("sent_at", { ascending: false }),
    supabase
      .from("doctor_share_links")
      .select(
        "id, elder_id, created_by, sos_event_id, expires_at, revoked_at, last_accessed_at",
      )
      .order("expires_at", { ascending: false }),
  ]);

  // C14: a discarded Supabase read error is indistinguishable from an empty list.
  const readErrors: Array<{ table: string; message: string }> = [
    { table: "care_partners", message: cpRes.error?.message ?? "" },
    { table: "elders", message: eldersRes.error?.message ?? "" },
    { table: "local_caregivers", message: lctRes.error?.message ?? "" },
    { table: "doctors", message: docRes.error?.message ?? "" },
    { table: "medications", message: medRes.error?.message ?? "" },
    { table: "food_routines", message: foodRes.error?.message ?? "" },
    { table: "health_routines", message: healthRes.error?.message ?? "" },
    { table: "checkins", message: checkinsRes.error?.message ?? "" },
    { table: "sos_events", message: sosRes.error?.message ?? "" },
    { table: "sos_notifications", message: sosNotifRes.error?.message ?? "" },
    { table: "ct_notifications", message: ctNotifRes.error?.message ?? "" },
    { table: "doctor_share_links", message: shareRes.error?.message ?? "" },
  ].filter((e) => e.message);

  for (const err of readErrors) {
    console.error(`[loadAppData] ${err.table} read failed:`, err.message);
  }

  const carePartner = cpRes.data
    ? carePartnerFromRow(cpRes.data as CarePartnerRow)
    : null;
  const localBuddies = (lctRes.data ?? []).map((r) =>
    localBuddyFromRow(r as LocalCaregiverRow),
  );
  const doctors = (docRes.data ?? []).map((r) => doctorFromRow(r as DoctorRow));
  const medications = (medRes.data ?? []).map((r) =>
    medicationFromRow(r as MedicationRow),
  );
  const foodRoutines = (foodRes.data ?? []).map((r) =>
    foodRoutineFromRow(r as FoodRoutineRow),
  );
  const healthRoutines = (healthRes.data ?? []).map((r) =>
    healthRoutineFromRow(r as HealthRoutineRow),
  );
  const checkIns = (checkinsRes.data ?? []).map((r) =>
    checkInFromRow(r as CheckinRow),
  );

  const elderRows = (eldersRes.data ?? []) as ElderRow[];
  const sosNotifications = (sosNotifRes.data ?? []) as SosNotificationRow[];
  const sosEventRows = (sosRes.data ?? []) as SosEventRow[];

  const lovedOnes = elderRows.map((r) => {
    const elderCheckIns = checkIns.filter((c) => c.lovedOneId === r.id);
    const elderSosStatuses = sosEventRows
      .filter((ev) => ev.elder_id === r.id)
      .map((ev) => ev.status as SOSStatus);
    return lovedOneFromElderRow(
      r,
      deriveWellbeingStatus({
        sosStatuses: elderSosStatuses,
        checkIns: elderCheckIns.map((c) => ({
          status: c.status,
          scheduledAt: c.scheduledAt,
        })),
      }),
    );
  });

  const elderName = (id: string) => {
    const lo = lovedOnes.find((e) => e.id === id);
    return lo ? `${lo.firstName} ${lo.lastName}`.trim() : undefined;
  };

  const sosEvents = sosEventRows.map((ev) => {
    const buddy = localBuddies.find((b) => b.lovedOneId === ev.elder_id);
    const doc = doctors.find((d) => d.lovedOneId === ev.elder_id);
    const elder = lovedOnes.find((e) => e.id === ev.elder_id);
    return sosEventFromRows(ev, sosNotifications, {
      carePartner: carePartner
        ? `${carePartner.firstName} ${carePartner.lastName}`.trim()
        : undefined,
      localBuddy: buddy
        ? `${buddy.firstName} ${buddy.lastName}`.trim()
        : undefined,
      doctor: doc ? `${doc.firstName} ${doc.lastName}`.trim() : undefined,
      location: elder?.address,
    });
  });

  const notifications = ((ctNotifRes.data ?? []) as CtNotificationRow[]).map(
    (row) => ctNotificationFromRow(row, elderName(row.elder_id)),
  );

  const doctorShareLinks: DoctorShareLink[] = (shareRes.data ?? []).map((row) => ({
    id: row.id as string,
    lovedOneId: row.elder_id as string,
    createdBy: row.created_by as string,
    sosEventId: (row.sos_event_id as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    lastAccessedAt: (row.last_accessed_at as string | null) ?? null,
  }));

  return {
    carePartner,
    lovedOnes,
    localBuddies,
    doctors,
    medications,
    foodRoutines,
    healthRoutines,
    checkIns,
    sosEvents,
    notifications,
    viewerTimeZone: carePartner?.timeZone ?? "UTC",
    voiceJournals: [],
    doctorShareLinks,
    messageTemplates: [],
  };
}

/** In-memory ElderWiseStore shape for analytics — never written to localStorage. */
export function toAnalyticsStore(
  data: AppReadModel,
  session: AuthSession,
  settings: UserSettings,
  selectedLovedOneId: string | null,
): ElderWiseStore {
  const selected =
    selectedLovedOneId && data.lovedOnes.some((l) => l.id === selectedLovedOneId)
      ? selectedLovedOneId
      : (data.lovedOnes[0]?.id ?? null);

  return {
    version: 1,
    session,
    carePartner: data.carePartner,
    lovedOnes: data.lovedOnes,
    localBuddies: data.localBuddies,
    doctors: data.doctors,
    medications: data.medications,
    foodRoutines: data.foodRoutines,
    healthRoutines: data.healthRoutines,
    checkIns: data.checkIns,
    sosEvents: data.sosEvents,
    voiceJournals: [],
    notifications: data.notifications,
    reports: [],
    settings: settings ?? defaultSettings,
    selectedLovedOneId: selected,
  };
}
