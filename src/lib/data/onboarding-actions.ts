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
  const payload = {
    care_partner_id: user.id,
    first_name: parsed.data.firstName,
    surname: parsed.data.surname,
    gender: "prefer_not_to_say",
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

  if (elderId) {
    const ownErr = await assertOwnsDraftElder(supabase, elderId, user.id);
    if (ownErr) return failElder(ownErr);

    const { data, error } = await supabase
      .from("elders")
      .update({
        first_name: payload.first_name,
        surname: payload.surname,
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
      full_name: parsed.data.firstName.trim(),
      phone_number: parsed.data.phoneNumber,
      whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
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
    // Skip = no write. Existing buddy row (if any) is left alone for MVP.
    return { ok: true };
  }

  const parsed = localBuddySchema.safeParse(input.buddy);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid Local Buddy");
  }

  const { data: existing } = await supabase
    .from("local_caregivers")
    .select("id")
    .eq("elder_id", input.elderId)
    .maybeSingle();

  const row = {
    id: existing?.id ?? crypto.randomUUID(),
    elder_id: input.elderId,
    full_name: parsed.data.name,
    whatsapp_number: parsed.data.whatsappNumber,
    phone_number: parsed.data.directContactNumber,
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

  if (input.skip) return { ok: true };

  const parsed = doctorSchema.safeParse(input.doctor);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid doctor");
  }

  const { data: existing } = await supabase
    .from("doctors")
    .select("id")
    .eq("elder_id", input.elderId)
    .maybeSingle();

  const base = {
    full_name: parsed.data.name,
    whatsapp_number: parsed.data.whatsappNumber,
    phone_number: parsed.data.directContactNumber || null,
    address: parsed.data.clinicOrHospitalName || null,
    approved_by_ct: true,
  };

  if (existing) {
    // Never overwrite doctors.timezone — no doctor settings UI to recover.
    const { data, error } = await supabase
      .from("doctors")
      .update(base)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Doctor save failed — no row returned (check RLS)");
    return { ok: true };
  }

  const { data: elder, error: elderErr } = await supabase
    .from("elders")
    .select("timezone")
    .eq("id", input.elderId)
    .maybeSingle();
  if (elderErr) return fail(elderErr.message);

  const { data, error } = await supabase
    .from("doctors")
    .insert({
      id: crypto.randomUUID(),
      elder_id: input.elderId,
      ...base,
      timezone: elder?.timezone ?? "UTC",
    })
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
): Promise<OnboardingActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsDraftElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data, error } = await supabase
    .from("elders")
    .update({ active: true })
    .eq("id", elderId)
    .eq("care_partner_id", user.id)
    .select("id, active")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Activation failed — no row returned (check RLS)");
  if (data.active !== true) return fail("Activation did not persist");

  revalidatePath("/dashboard");
  revalidatePath("/loved-ones");
  revalidatePath("/onboarding");
  return { ok: true };
}

export type OnboardingResumePayload = {
  elderId: string;
  currentStep: number;
  lovedOne: LovedOneDraft;
  carePartner: CarePartnerDraft;
  localBuddy: LocalBuddyDraft;
  skipLocalBuddy: boolean;
  doctor: DoctorDraft;
  skipDoctor: boolean;
  foodRoutines: FoodRoutineDraft[];
  medications: MedicationDraft[];
  healthRoutines: HealthRoutineDraft[];
};

/**
 * Resume from an inactive elder when localStorage draft is gone.
 *
 * KNOWN LIMITATION (MVP): after localStorage is cleared, "skipped Local Buddy"
 * and "hasn't reached Local Buddy" are indistinguishable — both have no
 * local_caregivers row. Resume returns the CT to the Local Buddy step in that
 * case. Acceptable for MVP; do not invent skip-state columns for this.
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

  let currentStep = 2; // Local Buddy — see KNOWN LIMITATION above
  if (healths.length > 0) currentStep = 7;
  else if (meds.length > 0) currentStep = 6;
  else if (foods.length > 0) currentStep = 5;
  else if (doctor) currentStep = 4;
  else if (buddy) currentStep = 3;

  const cpName = (cp?.full_name ?? "").trim();
  const firstName = cpName.split(/\s+/)[0] ?? "";

  return {
    ok: true,
    resume: {
      elderId: elder.id,
      currentStep,
      lovedOne: {
        whatsappNumber: elder.whatsapp_number,
        firstName: elder.first_name,
        surname: elder.surname,
        dateOfBirth: "",
        timeZone: elder.timezone,
        relationshipToCarePartner: "Parent",
        address: elder.address,
        consentAttestedByCarePartner: Boolean(elder.consent_attested_by_ct),
      },
      carePartner: {
        firstName,
        phoneNumber: cp?.phone_number ?? "",
        whatsappNumber: cp?.whatsapp_number ?? "",
        email: cp?.email ?? "",
        relationshipToLovedOne: "Daughter / Son",
        timeZone: cp?.timezone ?? elder.timezone,
      },
      localBuddy: buddy
        ? {
            name: buddy.full_name,
            whatsappNumber: buddy.whatsapp_number,
            directContactNumber: buddy.phone_number ?? "",
          }
        : {
            name: "",
            whatsappNumber: "",
            directContactNumber: "",
          },
      skipLocalBuddy: !buddy && currentStep > 2,
      doctor: doctor
        ? {
            name: doctor.full_name,
            whatsappNumber: doctor.whatsapp_number,
            directContactNumber: doctor.phone_number ?? "",
            clinicOrHospitalName: doctor.address ?? "",
          }
        : {
            name: "",
            whatsappNumber: "",
            directContactNumber: "",
            clinicOrHospitalName: "",
          },
      skipDoctor: !doctor && currentStep > 3,
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
