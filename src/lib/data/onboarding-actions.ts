"use server";

import { revalidatePath } from "next/cache";
import {
  carePartnerSchema,
  doctorSchema,
  foodRoutineSchema,
  healthRoutineSchema,
  localBuddySchema,
  lovedOneSchema,
  medicationSchema,
  type CarePartnerDraft,
  type DoctorDraft,
  type FoodRoutineDraft,
  type HealthRoutineDraft,
  type LocalBuddyDraft,
  type LovedOneDraft,
  type MedicationDraft,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { syncDomainConfig } from "@/lib/data/actions";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ElderWriteResult =
  | { ok: true; elderId: string }
  | { ok: false; error: string };

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

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

function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function ageFromDateOfBirth(dob: string | undefined): number | null {
  if (!dob?.trim()) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  if (age < 1 || age > 120) return null;
  return age;
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

/**
 * Loved One step — earliest DB write. Inserts elders.active=false (draft) + three
 * domain_configs with enabled=false (same derived rule as syncDomainConfig: no
 * enabled routines yet). Never writes consent_confirmed_at (M16b / Track B).
 */
export async function saveOnboardingLovedOne(input: {
  lovedOne: LovedOneDraft;
  elderId?: string | null;
}): Promise<ElderWriteResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return failElder(authErr ?? "Not signed in");

  const parsed = lovedOneSchema.safeParse(input.lovedOne);
  if (!parsed.success) {
    return failElder(parsed.error.issues[0]?.message ?? "Invalid Loved One");
  }

  const attestedAt = new Date().toISOString();
  const age = ageFromDateOfBirth(parsed.data.dateOfBirth);
  if (age == null) {
    return failElder("Age is required (enter a valid date of birth for now)");
  }
  const payload = {
    care_partner_id: user.id,
    first_name: parsed.data.firstName,
    last_name: parsed.data.surname,
    age,
    relationship_to_care_partner: parsed.data.relationshipToCarePartner,
    whatsapp_number: parsed.data.whatsappNumber,
    timezone: parsed.data.timeZone,
    address: parsed.data.address,
    consent_attested_by_ct: true,
    consent_attested_at: attestedAt,
    active: false,
  };

  let elderId = input.elderId?.trim() || null;

  // Same CT restarting a draft with the same WhatsApp — reuse the row instead of
  // hitting the global UNIQUE constraint with a useless Postgres error.
  if (!elderId) {
    const { data: ownMatch } = await supabase
      .from("elders")
      .select("id, active")
      .eq("care_partner_id", user.id)
      .eq("whatsapp_number", parsed.data.whatsappNumber)
      .maybeSingle();
    if (ownMatch?.id) {
      if (ownMatch.active) {
        return failElder(WHATSAPP_TAKEN);
      }
      elderId = ownMatch.id;
    }
  }

  // One-draft invariant (server-authoritative). URL ?mode=additional can bypass the
  // client dialog — refuse creating a second draft with a recoverable message.
  {
    const { data: existingDraft, error: draftErr } = await supabase
      .from("elders")
      .select("id, first_name")
      .eq("care_partner_id", user.id)
      .eq("active", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (draftErr) return failElder(draftErr.message);
    if (existingDraft && (!elderId || existingDraft.id !== elderId)) {
      const name = (existingDraft.first_name as string)?.trim() || "your Loved One";
      return failElder(
        `You have an unfinished setup for ${name} — resume or discard it first`,
      );
    }
  }

  if (elderId) {
    const ownErr = await assertOwnsDraftElder(supabase, elderId, user.id);
    if (ownErr) return failElder(ownErr);

    const { data, error } = await supabase
      .from("elders")
      .update({
        first_name: payload.first_name,
        last_name: payload.last_name,
        age: payload.age,
        relationship_to_care_partner: payload.relationship_to_care_partner,
        whatsapp_number: payload.whatsapp_number,
        timezone: payload.timezone,
        address: payload.address,
        consent_attested_by_ct: true,
        consent_attested_at: attestedAt,
        // Never touch consent_confirmed_at.
      })
      .eq("id", elderId)
      .eq("care_partner_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (isWhatsappUniqueViolation(error)) return failElder(WHATSAPP_TAKEN);
      return failElder(error.message);
    }
    if (!data) return failElder("Loved One update failed — no row returned (check RLS)");
    return { ok: true, elderId: data.id };
  }

  const { data, error } = await supabase
    .from("elders")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isWhatsappUniqueViolation(error)) return failElder(WHATSAPP_TAKEN);
    return failElder(error.message);
  }
  if (!data) return failElder("Loved One save failed — no row returned (check RLS)");

  // enabled = any enabled routine → false at creation. Do not rely on column default true.
  const { error: cfgErr } = await supabase.from("domain_configs").insert(
    (["medication", "food", "health"] as const).map((domain) => ({
      elder_id: data.id,
      domain,
      enabled: false,
      frequency: { times: [] },
      ct_notification: "only_missed",
      escalate_to: "care_partner",
    })),
  );
  if (cfgErr) {
    return failElder(`Loved One saved but domain_configs failed: ${cfgErr.message}`);
  }

  return { ok: true, elderId: data.id };
}

export async function saveOnboardingCarePartner(
  input: CarePartnerDraft,
): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = carePartnerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid Care Partner");
  }

  const { data, error } = await supabase
    .from("care_partners")
    .update({
      whatsapp_number:
        parsed.data.whatsappNumber?.trim() || parsed.data.phoneNumber,
      timezone: parsed.data.timeZone,
      ...(parsed.data.email?.trim()
        ? { email: parsed.data.email.trim().toLowerCase() }
        : {}),
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Care Partner update failed — no row returned (check RLS)");
  return { ok: true };
}

export async function saveOnboardingLocalBuddy(input: {
  elderId: string;
  skip: boolean;
  buddy?: LocalBuddyDraft;
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (input.skip) {
    // Skipped card = no row (Architecture §5.7).
    const { error } = await supabase
      .from("local_caregivers")
      .delete()
      .eq("elder_id", input.elderId);
    if (error) return fail(error.message);
    return { ok: true };
  }

  const parsed = localBuddySchema.safeParse(input.buddy);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid Local Buddy");
  }

  const names = splitPersonName(parsed.data.name);
  const row = {
    elder_id: input.elderId,
    first_name: names.firstName,
    last_name: names.lastName,
    whatsapp_number: parsed.data.whatsappNumber,
  };

  const { data, error } = await supabase
    .from("local_caregivers")
    .upsert(row, { onConflict: "elder_id" })
    .select("id")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Local Buddy save failed — no row returned (check RLS)");
  return { ok: true };
}

export async function saveOnboardingDoctor(input: {
  elderId: string;
  skip: boolean;
  doctor?: DoctorDraft;
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (input.skip) {
    const { error } = await supabase
      .from("doctors")
      .delete()
      .eq("elder_id", input.elderId);
    if (error) return fail(error.message);
    return { ok: true };
  }

  const parsed = doctorSchema.safeParse(input.doctor);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid doctor");
  }

  const names = splitPersonName(parsed.data.name);
  const clinic = parsed.data.clinicOrHospitalName?.trim();
  if (!clinic) {
    return fail("Clinic or hospital name is required");
  }

  const row = {
    elder_id: input.elderId,
    first_name: names.firstName,
    last_name: names.lastName,
    whatsapp_number: parsed.data.whatsappNumber.trim() || null,
    clinic_name: clinic,
    approved_by_ct: false,
  };

  const { data, error } = await supabase
    .from("doctors")
    .upsert(row, { onConflict: "elder_id" })
    .select("id")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Doctor save failed — no row returned (check RLS)");
  return { ok: true };
}

export async function saveOnboardingFoodRoutines(input: {
  elderId: string;
  items: FoodRoutineDraft[];
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  if (input.items.length === 0) return fail("Add at least one meal check-in");

  for (const item of input.items) {
    const parsed = foodRoutineSchema.safeParse(item);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid meal routine");
    }

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
          start_date: parsed.data.startDate,
          end_date: parsed.data.endDate || null,
          days_of_week: [...DAYS],
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
    const parsed = medicationSchema.safeParse(item);
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
          times: parsed.data.times,
          days_of_week: [...DAYS],
          start_date: parsed.data.startDate,
          end_date: parsed.data.endDate || null,
          timing_preference: "no_preference",
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
  items: HealthRoutineDraft[];
}): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, input.elderId, user.id);
  if (ownErr) return fail(ownErr);

  for (const item of input.items) {
    const parsed = healthRoutineSchema.safeParse(item);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid health routine");
    }

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
          start_date: parsed.data.startDate,
          end_date: parsed.data.endDate || null,
          days_of_week: [...DAYS],
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

  const wa = input.carePartner.whatsappNumber.trim();
  const tz = input.carePartner.timezone.trim();
  if (!wa) return failElder("Care partner WhatsApp number is required");
  if (!tz) return failElder("Care partner timezone is required");

  if (
    !Number.isInteger(input.elder.age) ||
    input.elder.age < 1 ||
    input.elder.age > 120
  ) {
    return failElder("Loved One age must be between 1 and 120");
  }

  const p_care_partner = {
    whatsapp_number: wa,
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
    whatsapp_number: input.elder.whatsappNumber.trim(),
    timezone: input.elder.timezone.trim(),
    address: input.elder.address.trim(),
  };

  const p_local_buddy = input.localBuddy
    ? {
        first_name: input.localBuddy.firstName.trim(),
        last_name: input.localBuddy.lastName.trim(),
        whatsapp_number: input.localBuddy.whatsappNumber.trim(),
      }
    : null;

  const p_doctor = input.doctor
    ? {
        first_name: input.doctor.firstName.trim(),
        last_name: input.doctor.lastName.trim(),
        whatsapp_number: input.doctor.whatsappNumber?.trim() ?? "",
        clinic_name: input.doctor.clinicName.trim(),
      }
    : null;

  const { data, error } = await supabase.rpc("save_care_circle_draft", {
    p_care_partner,
    p_elder,
    p_local_buddy,
    p_doctor,
  });

  if (error) {
    if (isWhatsappUniqueViolation(error)) return failElder(WHATSAPP_TAKEN);
    return failElder(error.message);
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
  currentStep: number;
  lovedOne: LovedOneDraft;
  carePartner: CarePartnerDraft;
  localBuddy: LocalBuddyDraft;
  doctor: DoctorDraft;
  foodRoutines: FoodRoutineDraft[];
  medications: MedicationDraft[];
  healthRoutines: HealthRoutineDraft[];
};

/**
 * Resume from an inactive elder when localStorage draft is gone.
 * Buddy / doctor presence is row presence only — no skip flags (Architecture §5.7).
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

  const [
    cpRes,
    buddyRes,
    doctorRes,
    foodRes,
    medRes,
    healthRes,
  ] = await Promise.all([
    supabase.from("care_partners").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("local_caregivers")
      .select("*")
      .eq("elder_id", elder.id)
      .maybeSingle(),
    supabase.from("doctors").select("*").eq("elder_id", elder.id).maybeSingle(),
    supabase.from("food_routines").select("*").eq("elder_id", elder.id),
    supabase
      .from("medications")
      .select("*")
      .eq("elder_id", elder.id)
      .eq("active", true),
    supabase.from("health_routines").select("*").eq("elder_id", elder.id),
  ]);

  const cp = cpRes.data;
  const buddy = buddyRes.data;
  const doctor = doctorRes.data;
  const foods = foodRes.data ?? [];
  const meds = medRes.data ?? [];
  const healths = healthRes.data ?? [];

  // After Care Circle draft exists, resume at Local Buddy if neither optional
  // contact is present; otherwise advance past written sections.
  let currentStep = 2;
  if (healths.length > 0) currentStep = 7;
  else if (meds.length > 0) currentStep = 6;
  else if (foods.length > 0) currentStep = 5;
  else if (doctor) currentStep = 4;
  else if (buddy) currentStep = 3;

  return {
    ok: true,
    resume: {
      elderId: elder.id,
      currentStep,
      lovedOne: {
        whatsappNumber: elder.whatsapp_number,
        firstName: elder.first_name,
        surname: elder.last_name,
        dateOfBirth: "",
        timeZone: elder.timezone,
        relationshipToCarePartner:
          elder.relationship_to_care_partner || "Parent",
        address: elder.address,
        consentAttestedByCarePartner: Boolean(elder.consent_attested_by_ct),
      },
      carePartner: {
        firstName: cp?.first_name ?? "",
        phoneNumber: cp?.whatsapp_number ?? "",
        whatsappNumber: cp?.whatsapp_number ?? "",
        email: cp?.email ?? "",
        relationshipToLovedOne: "Daughter / Son",
        timeZone: cp?.timezone ?? elder.timezone,
      },
      localBuddy: buddy
        ? {
            name: `${buddy.first_name} ${buddy.last_name}`.trim(),
            whatsappNumber: buddy.whatsapp_number,
            directContactNumber: "",
          }
        : {
            name: "",
            whatsappNumber: "",
            directContactNumber: "",
          },
      doctor: doctor
        ? {
            name: `${doctor.first_name} ${doctor.last_name}`.trim(),
            whatsappNumber: doctor.whatsapp_number ?? "",
            directContactNumber: "",
            clinicOrHospitalName: doctor.clinic_name ?? "",
          }
        : {
            name: "",
            whatsappNumber: "",
            directContactNumber: "",
            clinicOrHospitalName: "",
          },
      foodRoutines: foods.map((f) => ({
        id: f.id,
        enabled: f.enabled,
        mealName: f.meal_name,
        checkInTime: String(f.check_in_time).slice(0, 5),
        startDate: f.start_date,
        endDate: f.end_date ?? f.start_date,
        notifyCarePartner: f.notify_care_partner as "every_time" | "only_missed",
      })),
      medications: meds.map((m) => ({
        id: m.id,
        enabled: m.enabled,
        name: m.name,
        dosage: m.dosage,
        dosageUnit: m.dosage_unit,
        times: (m.times as string[]) ?? [],
        startDate: m.start_date,
        endDate: m.end_date ?? "",
        notifyCarePartner: m.notify_care_partner as "every_time" | "only_missed",
        escalationMinutes: m.escalation_minutes,
      })),
      healthRoutines: healths.map((h) => ({
        id: h.id,
        enabled: h.enabled,
        name: h.name,
        time: String(h.time).slice(0, 5),
        startDate: h.start_date,
        endDate: h.end_date ?? h.start_date,
        notifyCarePartner: h.notify_care_partner as "every_time" | "only_missed",
      })),
    },
  };
}
