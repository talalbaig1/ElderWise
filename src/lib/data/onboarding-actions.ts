"use server";

import { revalidatePath } from "next/cache";
import {
  ALL_DAYS,
  foodRoutineDraftSchema,
  healthRoutineDraftSchema,
  medicationDraftSchema,
  todayInTimeZone,
  type FoodRoutineDraft,
  type HealthRoutineDraft,
  type MedicationDraft,
  type OnboardingStepId,
} from "@/lib/onboarding";
import type { DayOfWeek } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { syncDomainConfig } from "@/lib/data/actions";
import {
  mapWhatsAppDbError,
  validateOptionalWhatsAppNumber,
  validateRequiredWhatsAppNumber,
} from "@/lib/whatsapp-e164";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ElderWriteResult =
  | { ok: true; elderId: string }
  | { ok: false; error: string };

const WHATSAPP_TAKEN =
  "This WhatsApp number is already registered to a Loved One";

/** Postgres unique_violation — globally UNIQUE elders.whatsapp_number. */
function isWhatsappUniqueViolation(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "23505") return true;
  return /whatsapp_number|duplicate key/i.test(error.message ?? "");
}

function fail(error: string): OnboardingActionResult {
  return { ok: false, error };
}

function failElder(error: string): ElderWriteResult {
  return { ok: false, error };
}



async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, error: "Not signed in" };
  return { supabase, user, error: null as null };
}

async function assertOwnsDraftElder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  elderId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("elders")
    .select("id, active")
    .eq("id", elderId)
    .eq("care_partner_id", userId)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Loved One not found or not owned by you";
  if (data.active === true) {
    return "This Loved One is already active — open the dashboard instead";
  }
  return null;
}

export async function saveOnboardingFoodRoutines(input: {
  elderId: string;
  elderTimeZone: string;
  items: FoodRoutineDraft[];
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (input.items.length === 0) return fail("Add at least one meal check-in");

  for (const item of input.items) {
    const parsed = foodRoutineDraftSchema.safeParse(item);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid meal routine");
    }

    const startDate = todayInTimeZone(input.elderTimeZone);
    const { data, error } = await supabase
      .from("food_routines")
      .upsert(
        {
          id: parsed.data.id,
          elder_id: input.elderId,
          enabled: parsed.data.enabled,
          meal_name: parsed.data.mealName,
          meal_type: "custom",
          check_in_time: parsed.data.checkInTime,
          start_date: startDate,
          end_date: null,
          days_of_week: parsed.data.daysOfWeek,
          frequency: "daily",
          notify_care_partner: parsed.data.notifyCarePartner,
          escalation_minutes: 45,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Meal routine save failed — no row returned (check RLS)");
  }

  const keepIds = input.items.map((i) => i.id);
  const { data: existing } = await supabase
    .from("food_routines")
    .select("id")
    .eq("elder_id", input.elderId);
  const remove = (existing ?? []).filter((r) => !keepIds.includes(r.id)).map((r) => r.id);
  if (remove.length > 0) {
    const { error } = await supabase.from("food_routines").delete().in("id", remove);
    if (error) return fail(error.message);
  }

  const syncErr = await syncDomainConfig(supabase, input.elderId, "food");
  if (syncErr) return fail(`Meals saved but domain_configs sync failed: ${syncErr}`);
  return { ok: true };
}

export async function saveOnboardingMedications(input: {
  elderId: string;
  items: MedicationDraft[];
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (input.items.length === 0) return fail("Add at least one medication");

  for (const item of input.items) {
    const parsed = medicationDraftSchema.safeParse(item);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid medication");
    }

    const { data, error } = await supabase
      .from("medications")
      .upsert(
        {
          id: parsed.data.id,
          elder_id: input.elderId,
          enabled: parsed.data.enabled,
          name: parsed.data.name,
          dosage: parsed.data.dosage,
          dosage_unit: parsed.data.dosageUnit,
          times: [parsed.data.time],
          days_of_week: parsed.data.daysOfWeek,
          start_date: parsed.data.startDate,
          end_date: parsed.data.endDate || null,
          timing_preference: parsed.data.mealTiming,
          notify_care_partner: parsed.data.notifyCarePartner,
          escalation_minutes: parsed.data.escalationMinutes,
          active: true,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Medication save failed — no row returned (check RLS)");
  }

  const keepIds = input.items.map((i) => i.id);
  const { data: existing } = await supabase
    .from("medications")
    .select("id")
    .eq("elder_id", input.elderId)
    .eq("active", true);
  const remove = (existing ?? []).filter((r) => !keepIds.includes(r.id)).map((r) => r.id);
  if (remove.length > 0) {
    const { error } = await supabase
      .from("medications")
      .update({ active: false, enabled: false })
      .in("id", remove);
    if (error) return fail(error.message);
  }

  const syncErr = await syncDomainConfig(supabase, input.elderId, "medication");
  if (syncErr) return fail(`Medications saved but domain_configs sync failed: ${syncErr}`);
  return { ok: true };
}

export async function saveOnboardingHealthRoutines(input: {
  elderId: string;
  elderTimeZone: string;
  items: HealthRoutineDraft[];
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  for (const item of input.items) {
    const parsed = healthRoutineDraftSchema.safeParse(item);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid health routine");
    }

    const startDate = todayInTimeZone(input.elderTimeZone);
    const { data, error } = await supabase
      .from("health_routines")
      .upsert(
        {
          id: parsed.data.id,
          elder_id: input.elderId,
          enabled: parsed.data.enabled,
          name: parsed.data.name,
          type: "general_wellness",
          frequency: "daily",
          time: parsed.data.time,
          start_date: startDate,
          end_date: null,
          days_of_week: parsed.data.daysOfWeek,
          question: "How are you feeling today?",
          answer_type: "yes_no",
          notify_care_partner: parsed.data.notifyCarePartner,
          escalation_minutes: 60,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Health routine save failed — no row returned (check RLS)");
  }

  const keepIds = input.items.map((i) => i.id);
  const { data: existing } = await supabase
    .from("health_routines")
    .select("id")
    .eq("elder_id", input.elderId);
  const remove = (existing ?? []).filter((r) => !keepIds.includes(r.id)).map((r) => r.id);
  if (remove.length > 0) {
    const { error } = await supabase.from("health_routines").delete().in("id", remove);
    if (error) return fail(error.message);
  }

  const syncErr = await syncDomainConfig(supabase, input.elderId, "health");
  if (syncErr) return fail(`Health saved but domain_configs sync failed: ${syncErr}`);
  return { ok: true };
}

/** Completion — flip draft → active so (app)/layout admits the CT to the dashboard. */
export async function activateOnboardingElder(
  elderId: string,
): Promise<ElderWriteResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return failElder(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, elderId, user.id);
  if (ownErr) return failElder(ownErr);

  const { data, error } = await supabase
    .from("elders")
    .update({ active: true })
    .eq("id", elderId)
    .eq("care_partner_id", user.id)
    .select("id, active")
    .maybeSingle();

  if (error) return failElder(error.message);
  if (!data) return failElder("Activation failed — no row returned (check RLS)");
  if (data.active !== true) return failElder("Activation did not persist");

  revalidatePath("/dashboard");
  revalidatePath("/loved-ones");
  revalidatePath("/onboarding");
  return { ok: true, elderId: data.id };
}

/**
 * Review consents (M16a / FR-ON-7).
 * When data-sharing consent is given and a Doctor row exists, sets
 * doctors.approved_by_ct = true in the same logical step as
 * elders.consent_data_sharing_at (Architecture §5.7).
 */
export async function saveReviewConsents(input: {
  elderId: string;
  consentMedAccuracy: boolean;
  /** Required true when Local Buddy or Doctor was added; omit/false if both skipped. */
  consentDataSharing: boolean;
  consentTerms: boolean;
  consentTermsVersion: string;
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (!input.consentMedAccuracy) {
    return fail("Medication-details acknowledgement is required");
  }
  if (!input.consentTerms) {
    return fail("Terms & Privacy confirmation is required");
  }
  const termsVersion = input.consentTermsVersion.trim();
  if (!termsVersion) {
    return fail("consent_terms_version is required");
  }

  const [{ data: buddy }, { data: doctor }] = await Promise.all([
    supabase
      .from("local_caregivers")
      .select("id")
      .eq("elder_id", input.elderId)
      .maybeSingle(),
    supabase
      .from("doctors")
      .select("id")
      .eq("elder_id", input.elderId)
      .maybeSingle(),
  ]);

  const hasShareTarget = Boolean(buddy || doctor);
  if (hasShareTarget && !input.consentDataSharing) {
    return fail("Data-sharing consent is required when a Local Buddy or Doctor was added");
  }
  if (!hasShareTarget && input.consentDataSharing) {
    return fail("Data-sharing consent applies only when a Local Buddy or Doctor was added");
  }

  const now = new Date().toISOString();
  const elderPatch: Record<string, string | boolean> = {
    consent_med_accuracy_at: now,
    consent_terms_at: now,
    consent_terms_version: termsVersion,
    consent_attested_by_ct: true,
    consent_attested_at: now,
  };
  if (input.consentDataSharing) {
    elderPatch.consent_data_sharing_at = now;
  }

  const { data: elderRow, error: elderErr } = await supabase
    .from("elders")
    .update(elderPatch)
    .eq("id", input.elderId)
    .eq("care_partner_id", user.id)
    .select("id")
    .maybeSingle();

  if (elderErr) return fail(elderErr.message);
  if (!elderRow) return fail("Review consent save failed — no elder row returned (check RLS)");

  if (input.consentDataSharing && doctor) {
    const { data: docRow, error: docErr } = await supabase
      .from("doctors")
      .update({ approved_by_ct: true })
      .eq("elder_id", input.elderId)
      .select("id, approved_by_ct")
      .maybeSingle();
    if (docErr) return fail(docErr.message);
    if (!docRow || docRow.approved_by_ct !== true) {
      return fail("Doctor approval failed — approved_by_ct did not persist");
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/loved-ones");
  return { ok: true };
}

/** At most one draft per CT — for the Add Loved One dialog. */
export async function getOwnDraftElder(): Promise<
  | { ok: true; draft: { id: string; firstName: string } | null }
  | { ok: false; error: string }
> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return { ok: false, error: authErr ?? "Not signed in" };

  const { data, error } = await supabase
    .from("elders")
    .select("id, first_name")
    .eq("care_partner_id", user.id)
    .eq("active", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, draft: null };
  return {
    ok: true,
    draft: {
      id: data.id as string,
      firstName: ((data.first_name as string) || "").trim() || "Loved One",
    },
  };
}

/**
 * Care Circle — atomic draft write via SECURITY INVOKER RPC (Architecture §5.7).
 * Buddy / doctor payloads are null when that card was not engaged (no row written).
 * Any error rolls back the whole transaction.
 */
export async function saveCareCircleDraft(input: {
  carePartner: {
    whatsappNumber: string;
    timezone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  elder: {
    id?: string | null;
    firstName: string;
    lastName: string;
    age: number;
    relationshipToCarePartner: string;
    whatsappNumber: string;
    timezone: string;
    address: string;
  };
  /** null = card not engaged → no local_caregivers row */
  localBuddy: {
    firstName: string;
    lastName: string;
    whatsappNumber: string;
  } | null;
  /** null = card not engaged → no doctors row */
  doctor: {
    firstName: string;
    lastName: string;
    whatsappNumber?: string;
    clinicName: string;
  } | null;
}): Promise<ElderWriteResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return failElder(authErr ?? "Not signed in");

  const waCheck = validateRequiredWhatsAppNumber(input.carePartner.whatsappNumber);
  if (!waCheck.ok) return failElder(waCheck.error);
  const elderWaCheck = validateRequiredWhatsAppNumber(input.elder.whatsappNumber);
  if (!elderWaCheck.ok) return failElder(elderWaCheck.error);

  const tz = input.carePartner.timezone.trim();
  if (!tz) return failElder("Care partner timezone is required");

  if (
    !Number.isInteger(input.elder.age) ||
    input.elder.age < 1 ||
    input.elder.age > 120
  ) {
    return failElder("Loved One age must be between 1 and 120");
  }

  const p_care_partner = {
    whatsapp_number: waCheck.value,
    timezone: tz,
    ...(input.carePartner.firstName?.trim()
      ? { first_name: input.carePartner.firstName.trim() }
      : {}),
    ...(input.carePartner.lastName?.trim()
      ? { last_name: input.carePartner.lastName.trim() }
      : {}),
    ...(input.carePartner.email?.trim()
      ? { email: input.carePartner.email.trim().toLowerCase() }
      : {}),
  };

  const p_elder = {
    ...(input.elder.id?.trim() ? { id: input.elder.id.trim() } : {}),
    first_name: input.elder.firstName.trim(),
    last_name: input.elder.lastName.trim(),
    age: input.elder.age,
    relationship_to_care_partner: input.elder.relationshipToCarePartner.trim(),
    whatsapp_number: elderWaCheck.value,
    timezone: input.elder.timezone.trim(),
    address: input.elder.address.trim(),
  };

  let p_local_buddy: {
    first_name: string;
    last_name: string;
    whatsapp_number: string;
  } | null = null;

  if (input.localBuddy) {
    const buddyWa = validateRequiredWhatsAppNumber(input.localBuddy.whatsappNumber);
    if (!buddyWa.ok) return failElder(buddyWa.error);
    p_local_buddy = {
      first_name: input.localBuddy.firstName.trim(),
      last_name: input.localBuddy.lastName.trim(),
      whatsapp_number: buddyWa.value,
    };
  }

  let p_doctor: {
    first_name: string;
    last_name: string;
    whatsapp_number: string;
    clinic_name: string;
  } | null = null;

  if (input.doctor) {
    const doctorWa = validateOptionalWhatsAppNumber(input.doctor.whatsappNumber ?? "");
    if (!doctorWa.ok) return failElder(doctorWa.error);
    p_doctor = {
      first_name: input.doctor.firstName.trim(),
      last_name: input.doctor.lastName.trim(),
      whatsapp_number: doctorWa.value ?? "",
      clinic_name: input.doctor.clinicName.trim(),
    };
  }

  const { data, error } = await supabase.rpc("save_care_circle_draft", {
    p_care_partner,
    p_elder,
    p_local_buddy,
    p_doctor,
  });

  if (error) {
    if (isWhatsappUniqueViolation(error)) return failElder(WHATSAPP_TAKEN);
    return failElder(mapWhatsAppDbError(error.message));
  }

  const elderId = typeof data === "string" ? data : String(data ?? "");
  if (!elderId) {
    return failElder("Care Circle save failed — no elder id returned");
  }

  revalidatePath("/loved-ones");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true, elderId };
}

/**
 * Hard-delete an unfinished draft elder.
 *
 * Unlike medication/food/health soft-delete, drafts use DELETE (not active=false).
 * Drafts have consent_confirmed_at NULL — nothing was scheduled; the app never
 * writes checkins or sos_events for them; children CASCADE. Soft-deleting would
 * keep elders.whatsapp_number UNIQUE locked forever (including against another
 * care partner who cannot see the row) — e.g. two siblings caring for the same
 * parent. Routines soft-delete because they have history to preserve; drafts do not.
 */
export async function discardDraftElder(
  elderId: string,
): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const { data: row, error: findErr } = await supabase
    .from("elders")
    .select("id, active, consent_confirmed_at")
    .eq("id", elderId)
    .eq("care_partner_id", user.id)
    .maybeSingle();

  if (findErr) return fail(findErr.message);
  if (!row) return fail("Draft not found or not owned by you");
  if (row.active === true) {
    return fail("Cannot discard an active Loved One");
  }
  if (row.consent_confirmed_at != null) {
    return fail("Cannot discard — this Loved One already confirmed WhatsApp consent");
  }

  const { data, error } = await supabase
    .from("elders")
    .delete()
    .eq("id", elderId)
    .eq("care_partner_id", user.id)
    .eq("active", false)
    .is("consent_confirmed_at", null)
    .select("id")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Draft discard failed — no row returned (check RLS)");

  revalidatePath("/loved-ones");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type OnboardingResumePayload = {
  elderId: string;
  currentStepId: OnboardingStepId;
  carePartnerProfile: { firstName: string; lastName: string; email: string };
  carePartner: { whatsappNumber: string; timeZone: string };
  lovedOne: {
    whatsappNumber: string;
    firstName: string;
    lastName: string;
    age: number;
    timeZone: string;
    relationshipToCarePartner: string;
    address: string;
  };
  localBuddy: { firstName: string; lastName: string; whatsappNumber: string };
  doctor: {
    firstName: string;
    lastName: string;
    clinicName: string;
    whatsappNumber: string;
  };
  foodRoutines: FoodRoutineDraft[];
  medications: MedicationDraft[];
  healthRoutines: HealthRoutineDraft[];
};

/**
 * Care Partner WhatsApp + timezone from care_partners (additional-Loved-One path).
 * /onboarding is outside AppDataProvider, so the client store has no domain CP row.
 */
export async function loadCarePartnerOnboardingDefaults(): Promise<
  | {
      ok: true;
      whatsappNumber: string;
      timeZone: string;
      firstName: string;
      lastName: string;
      email: string;
    }
  | { ok: false; error: string }
> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return { ok: false, error: authErr ?? "Not signed in" };

  const { data, error } = await supabase
    .from("care_partners")
    .select("first_name, last_name, email, whatsapp_number, timezone")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Care Partner profile not found" };

  return {
    ok: true,
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    email: data.email ?? "",
    whatsappNumber: data.whatsapp_number ?? "",
    timeZone: data.timezone ?? "",
  };
}

/**
 * Resume from an inactive elder when localStorage draft is gone.
 * Buddy / doctor presence is row presence only (Architecture §5.7).
 */
export async function loadOnboardingResume(): Promise<
  | { ok: true; resume: OnboardingResumePayload | null }
  | { ok: false; error: string }
> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return { ok: false, error: authErr ?? "Not signed in" };

  const { data: elder, error } = await supabase
    .from("elders")
    .select("*")
    .eq("care_partner_id", user.id)
    .eq("active", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!elder) return { ok: true, resume: null };

  const [cpRes, buddyRes, doctorRes, foodRes, medRes, healthRes] = await Promise.all([
    supabase.from("care_partners").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("local_caregivers").select("*").eq("elder_id", elder.id).maybeSingle(),
    supabase.from("doctors").select("*").eq("elder_id", elder.id).maybeSingle(),
    supabase.from("food_routines").select("*").eq("elder_id", elder.id),
    supabase.from("medications").select("*").eq("elder_id", elder.id).eq("active", true),
    supabase.from("health_routines").select("*").eq("elder_id", elder.id),
  ]);

  const cp = cpRes.data;
  const buddy = buddyRes.data;
  const doctor = doctorRes.data;
  const foods = foodRes.data ?? [];
  const meds = medRes.data ?? [];
  const healths = healthRes.data ?? [];

  let currentStepId: OnboardingStepId = "wellness-details";
  if (healths.length > 0 || meds.length > 0 || foods.length > 0) {
    currentStepId = "review";
  }

  const notify = (v: string) =>
    (v === "every_time" || v === "only_missed" || v === "not_required"
      ? v
      : "only_missed") as MedicationDraft["notifyCarePartner"];

  const dosageUnit = (u: string) => {
    const allowed = ["TAB", "ML", "CAP", "DROPS", "PUFF", "UNIT"] as const;
    return (allowed.includes(u as (typeof allowed)[number]) ? u : "TAB") as MedicationDraft["dosageUnit"];
  };

  const daysOfWeek = (raw: unknown): DayOfWeek[] => {
    const arr = Array.isArray(raw) ? (raw as string[]) : [];
    return arr.length > 0 ? (arr as DayOfWeek[]) : [...ALL_DAYS];
  };

  return {
    ok: true,
    resume: {
      elderId: elder.id,
      currentStepId,
      carePartnerProfile: {
        firstName: cp?.first_name ?? "",
        lastName: cp?.last_name ?? "",
        email: cp?.email ?? "",
      },
      carePartner: {
        whatsappNumber: cp?.whatsapp_number ?? "",
        timeZone: cp?.timezone ?? elder.timezone,
      },
      lovedOne: {
        whatsappNumber: elder.whatsapp_number,
        firstName: elder.first_name,
        lastName: elder.last_name,
        age: Number(elder.age) || 70,
        timeZone: elder.timezone,
        relationshipToCarePartner: elder.relationship_to_care_partner || "Parent",
        address: elder.address,
      },
      localBuddy: buddy
        ? {
            firstName: buddy.first_name,
            lastName: buddy.last_name,
            whatsappNumber: buddy.whatsapp_number,
          }
        : { firstName: "", lastName: "", whatsappNumber: "" },
      doctor: doctor
        ? {
            firstName: doctor.first_name,
            lastName: doctor.last_name,
            clinicName: doctor.clinic_name ?? "",
            whatsappNumber: doctor.whatsapp_number ?? "",
          }
        : { firstName: "", lastName: "", clinicName: "", whatsappNumber: "" },
      foodRoutines: foods.map((f) => ({
        id: f.id,
        enabled: f.enabled,
        mealName: f.meal_name,
        checkInTime: String(f.check_in_time).slice(0, 5),
        daysOfWeek: daysOfWeek(f.days_of_week),
        notifyCarePartner: notify(f.notify_care_partner),
      })),
      medications: meds.map((m) => {
        const times = (m.times as string[]) ?? [];
        const meal =
          m.timing_preference === "before_food" || m.timing_preference === "after_food"
            ? m.timing_preference
            : "after_food";
        return {
          id: m.id,
          enabled: m.enabled,
          name: m.name,
          dosage: m.dosage,
          dosageUnit: dosageUnit(m.dosage_unit),
          time: String(times[0] ?? "08:00").slice(0, 5),
          startDate: m.start_date,
          endDate: m.end_date ?? "",
          mealTiming: meal as MedicationDraft["mealTiming"],
          daysOfWeek: daysOfWeek(m.days_of_week),
          notifyCarePartner: notify(m.notify_care_partner),
          escalationMinutes: m.escalation_minutes,
        };
      }),
      healthRoutines: healths.map((h) => ({
        id: h.id,
        enabled: h.enabled,
        name: h.name,
        time: String(h.time).slice(0, 5),
        daysOfWeek: daysOfWeek(h.days_of_week),
        notifyCarePartner: notify(h.notify_care_partner),
      })),
    },
  };
}
