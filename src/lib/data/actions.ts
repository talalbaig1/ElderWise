"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  doctorSchema,
  foodRoutineSchema,
  healthRoutineSchema,
  localBuddySchema,
  medicationSchema,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import type {
  FamilyDoctor,
  FoodRoutine,
  HealthRoutine,
  LocalBuddy,
  Medication,
} from "@/types";

export type ActionResult =
  | { ok: true }
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

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateApp() {
  revalidatePath("/dashboard");
  revalidatePath("/loved-ones");
  revalidatePath("/settings");
  revalidatePath("/reports");
  revalidatePath("/sos");
  revalidatePath("/notifications");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, error: "Not signed in" };
  return { supabase, user, error: null as null };
}

async function assertOwnsElder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  elderId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("elders")
    .select("id")
    .eq("id", elderId)
    .eq("care_partner_id", userId)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Loved One not found or not owned by you";
  return null;
}

/**
 * Pass 2 derived-state rule (NOT yet in Architecture.md — flag for note):
 * After routine writes, domain_configs.frequency.times is set to the sorted
 * unique union of wall-clock times from routines that are BOTH schedulable
 * and enabled:
 *   - medications: active=true AND enabled=true (soft-deleted active=false never contribute)
 *   - food/health: enabled=true
 * domain_configs.enabled mirrors whether any such routine exists.
 * That makes frequency a fully derived field for dashboard writes — a direct
 * edit to frequency would be overwritten on the next routine save.
 */
/** Exported for onboarding — same derived rule as Pass 2 dashboard writes. */
export async function syncDomainConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  elderId: string,
  domain: "medication" | "food" | "health",
): Promise<string | null> {
  let times: string[] = [];
  let enabled = false;

  if (domain === "medication") {
    // Both gates: active (not soft-deleted) AND enabled (scheduled).
    const { data, error } = await supabase
      .from("medications")
      .select("times, enabled, active")
      .eq("elder_id", elderId)
      .eq("active", true)
      .eq("enabled", true);
    if (error) return error.message;
    const rows = data ?? [];
    enabled = rows.length > 0;
    times = [...new Set(rows.flatMap((r) => (r.times as string[]) ?? []))].sort();
  } else if (domain === "food") {
    const { data, error } = await supabase
      .from("food_routines")
      .select("check_in_time, enabled")
      .eq("elder_id", elderId)
      .eq("enabled", true);
    if (error) return error.message;
    const rows = data ?? [];
    enabled = rows.length > 0;
    times = [
      ...new Set(rows.map((r) => String(r.check_in_time).slice(0, 5))),
    ].sort();
  } else {
    const { data, error } = await supabase
      .from("health_routines")
      .select("time, enabled")
      .eq("elder_id", elderId)
      .eq("enabled", true);
    if (error) return error.message;
    const rows = data ?? [];
    enabled = rows.length > 0;
    times = [
      ...new Set(rows.map((r) => String(r.time).slice(0, 5))),
    ].sort();
  }

  const { data: existing, error: findErr } = await supabase
    .from("domain_configs")
    .select("id, ct_notification, escalate_to")
    .eq("elder_id", elderId)
    .eq("domain", domain)
    .maybeSingle();
  if (findErr) return findErr.message;

  const payload = {
    elder_id: elderId,
    domain,
    enabled,
    frequency: { times },
    ct_notification: existing?.ct_notification ?? "only_missed",
    escalate_to: existing?.escalate_to ?? "care_partner",
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("domain_configs")
      .update({
        enabled: payload.enabled,
        frequency: payload.frequency,
      })
      .eq("id", existing.id);
    return error?.message ?? null;
  }

  const { error } = await supabase.from("domain_configs").insert(payload);
  return error?.message ?? null;
}

const elderEditSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required"),
  surname: z.string().trim().min(1, "Surname is required"),
  whatsappNumber: z.string().trim().min(7, "Enter a valid WhatsApp number"),
  timeZone: z.string().trim().min(1, "Time zone is required"),
  address: z
    .string()
    .trim()
    .min(1, "Address is required — the Local Buddy needs it in an emergency"),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say"]),
});

export async function updateCarePartnerProfile(input: {
  firstName: string;
  lastName: string;
  whatsappNumber?: string;
  directContactNumber?: string;
  address?: string;
  timeZone: string;
  email?: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = z
    .object({
      firstName: z.string().trim().min(1, "First name is required"),
      lastName: z.string().trim().min(1, "Last name is required"),
      timeZone: z.string().trim().min(1, "Time zone is required"),
      whatsappNumber: z.string().optional(),
      directContactNumber: z.string().optional(),
      address: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
    })
    .safeParse({
      firstName: input.firstName,
      lastName: input.lastName,
      timeZone: input.timeZone,
      whatsappNumber: input.whatsappNumber,
      directContactNumber: input.directContactNumber,
      address: input.address,
      email: input.email ?? "",
    });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid profile");
  }

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const { data, error } = await supabase
    .from("care_partners")
    .update({
      full_name: fullName,
      whatsapp_number: parsed.data.whatsappNumber || null,
      phone_number: parsed.data.directContactNumber || null,
      timezone: parsed.data.timeZone,
      address: parsed.data.address || null,
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
    })
    .eq("id", user.id)
    .select("id, full_name")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Profile update failed — no row returned (check RLS)");

  revalidateApp();
  return { ok: true };
}

export async function updateElder(input: {
  id: string;
  firstName: string;
  surname: string;
  whatsappNumber: string;
  timeZone: string;
  address: string;
  gender: "female" | "male" | "other" | "prefer_not_to_say";
}): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = elderEditSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid Loved One");
  }

  // Never touch consent_confirmed_at or consent_attested_* (M16a/b).
  const { data, error } = await supabase
    .from("elders")
    .update({
      first_name: parsed.data.firstName,
      surname: parsed.data.surname,
      whatsapp_number: parsed.data.whatsappNumber,
      timezone: parsed.data.timeZone,
      address: parsed.data.address,
      gender: parsed.data.gender,
    })
    .eq("id", parsed.data.id)
    .eq("care_partner_id", user.id)
    .select("id, first_name, address, consent_confirmed_at, consent_attested_by_ct")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Loved One update failed — no row returned (check RLS)");

  revalidatePath(`/loved-ones/${parsed.data.id}`);
  revalidateApp();
  return { ok: true };
}

export async function upsertLocalCaregiver(buddy: LocalBuddy): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = localBuddySchema.safeParse({
    name: buddy.name,
    whatsappNumber: buddy.whatsappNumber,
    directContactNumber: buddy.directContactNumber ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid Local Buddy");
  }

  const ownErr = await assertOwnsElder(supabase, buddy.lovedOneId, user.id);
  if (ownErr) return fail(ownErr);

  const row = {
    id: buddy.id,
    elder_id: buddy.lovedOneId,
    full_name: parsed.data.name,
    whatsapp_number: parsed.data.whatsappNumber,
    phone_number: parsed.data.directContactNumber,
    action_plan: buddy.availabilityNotes || null,
  };

  const { data, error } = await supabase
    .from("local_caregivers")
    .upsert(row, { onConflict: "elder_id" })
    .select("id, full_name")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Local Buddy save failed — no row returned (check RLS)");

  revalidatePath(`/loved-ones/${buddy.lovedOneId}`);
  revalidateApp();
  return { ok: true };
}

export async function upsertDoctor(doctor: FamilyDoctor): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = doctorSchema.safeParse({
    name: doctor.name,
    whatsappNumber: doctor.whatsappNumber,
    directContactNumber: doctor.directContactNumber,
    clinicOrHospitalName: doctor.clinicOrHospitalName,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid doctor");
  }

  const ownErr = await assertOwnsElder(supabase, doctor.lovedOneId, user.id);
  if (ownErr) return fail(ownErr);

  const row = {
    id: doctor.id,
    elder_id: doctor.lovedOneId,
    full_name: parsed.data.name,
    whatsapp_number: parsed.data.whatsappNumber,
    phone_number: parsed.data.directContactNumber || null,
    address: parsed.data.clinicOrHospitalName || null,
    approved_by_ct: true,
  };

  const { data, error } = await supabase
    .from("doctors")
    .upsert(row, { onConflict: "elder_id" })
    .select("id, full_name")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Doctor save failed — no row returned (check RLS)");

  revalidatePath(`/loved-ones/${doctor.lovedOneId}`);
  revalidateApp();
  return { ok: true };
}

export async function upsertMedication(med: Medication): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = medicationSchema.safeParse({
    id: med.id,
    enabled: med.enabled,
    name: med.name,
    dosage: med.dosage,
    dosageUnit: med.dosageUnit,
    times: med.times,
    startDate: med.startDate,
    endDate: med.endDate,
    notifyCarePartner: med.notifyCarePartner,
    escalationMinutes: med.escalationMinutes,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid medication");
  }

  const ownErr = await assertOwnsElder(supabase, med.lovedOneId, user.id);
  if (ownErr) return fail(ownErr);

  const row = {
    id: parsed.data.id,
    elder_id: med.lovedOneId,
    enabled: parsed.data.enabled,
    name: parsed.data.name,
    dosage: parsed.data.dosage,
    dosage_unit: parsed.data.dosageUnit,
    times: parsed.data.times,
    days_of_week: med.daysOfWeek?.length ? med.daysOfWeek : [...DAYS],
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    timing_preference: med.timingPreference || "no_preference",
    instructions: med.instructions || null,
    notify_care_partner: parsed.data.notifyCarePartner,
    escalation_minutes: parsed.data.escalationMinutes,
    active: true,
  };

  const { data, error } = await supabase
    .from("medications")
    .upsert(row, { onConflict: "id" })
    .select("id, name, enabled, active")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Medication save failed — no row returned (check RLS)");

  const syncErr = await syncDomainConfig(supabase, med.lovedOneId, "medication");
  if (syncErr) return fail(`Medication saved but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${med.lovedOneId}`);
  revalidateApp();
  return { ok: true };
}

/** Soft-delete: medications.active=false (+ enabled=false). Never hard DELETE. */
export async function softDeleteMedication(
  medicationId: string,
  elderId: string,
): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data, error } = await supabase
    .from("medications")
    .update({ active: false, enabled: false })
    .eq("id", medicationId)
    .eq("elder_id", elderId)
    .select("id, active, enabled")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Medication soft-delete failed — no row returned (check RLS)");
  if (data.active !== false) return fail("Medication soft-delete did not persist");

  const syncErr = await syncDomainConfig(supabase, elderId, "medication");
  if (syncErr) return fail(`Soft-deleted but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${elderId}`);
  revalidateApp();
  return { ok: true };
}

export async function upsertFoodRoutine(item: FoodRoutine): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = foodRoutineSchema.safeParse({
    id: item.id,
    enabled: item.enabled,
    mealName: item.mealName,
    checkInTime: item.checkInTime,
    startDate: item.startDate,
    endDate: item.endDate,
    notifyCarePartner: item.notifyCarePartner,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid meal routine");
  }

  const ownErr = await assertOwnsElder(supabase, item.lovedOneId, user.id);
  if (ownErr) return fail(ownErr);

  const row = {
    id: parsed.data.id,
    elder_id: item.lovedOneId,
    enabled: parsed.data.enabled,
    meal_name: parsed.data.mealName,
    meal_type: item.mealType || "custom",
    check_in_time: parsed.data.checkInTime,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    days_of_week: item.daysOfWeek?.length ? item.daysOfWeek : [...DAYS],
    frequency: item.frequency || "daily",
    notify_care_partner: parsed.data.notifyCarePartner,
    escalation_minutes: item.escalationMinutes ?? 45,
    notes: item.notes || null,
  };

  const { data, error } = await supabase
    .from("food_routines")
    .upsert(row, { onConflict: "id" })
    .select("id, meal_name, enabled")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Meal routine save failed — no row returned (check RLS)");

  const syncErr = await syncDomainConfig(supabase, item.lovedOneId, "food");
  if (syncErr) return fail(`Meal saved but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${item.lovedOneId}`);
  revalidateApp();
  return { ok: true };
}

/** Soft-delete: food_routines.enabled=false. Never hard DELETE. */
export async function softDeleteFoodRoutine(
  routineId: string,
  elderId: string,
): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data, error } = await supabase
    .from("food_routines")
    .update({ enabled: false })
    .eq("id", routineId)
    .eq("elder_id", elderId)
    .select("id, enabled")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Meal soft-delete failed — no row returned (check RLS)");
  if (data.enabled !== false) return fail("Meal soft-delete did not persist");

  const syncErr = await syncDomainConfig(supabase, elderId, "food");
  if (syncErr) return fail(`Soft-deleted but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${elderId}`);
  revalidateApp();
  return { ok: true };
}

export async function upsertHealthRoutine(item: HealthRoutine): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const parsed = healthRoutineSchema.safeParse({
    id: item.id,
    enabled: item.enabled,
    name: item.name,
    time: item.time,
    startDate: item.startDate,
    endDate: item.endDate,
    notifyCarePartner: item.notifyCarePartner,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid health routine");
  }

  const ownErr = await assertOwnsElder(supabase, item.lovedOneId, user.id);
  if (ownErr) return fail(ownErr);

  const row = {
    id: parsed.data.id,
    elder_id: item.lovedOneId,
    enabled: parsed.data.enabled,
    name: parsed.data.name,
    type: item.type || "custom",
    frequency: item.frequency || "daily",
    time: parsed.data.time,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    days_of_week: item.daysOfWeek?.length ? item.daysOfWeek : [...DAYS],
    question: item.question || parsed.data.name,
    answer_type: item.answerType || "yes_no",
    notify_care_partner: parsed.data.notifyCarePartner,
    escalation_minutes: item.escalationMinutes ?? 60,
    typical_bedtime: item.typicalBedtime || null,
    typical_wake_time: item.typicalWakeTime || null,
  };

  const { data, error } = await supabase
    .from("health_routines")
    .upsert(row, { onConflict: "id" })
    .select("id, name, enabled")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Health routine save failed — no row returned (check RLS)");

  const syncErr = await syncDomainConfig(supabase, item.lovedOneId, "health");
  if (syncErr) return fail(`Health saved but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${item.lovedOneId}`);
  revalidateApp();
  return { ok: true };
}

/** Soft-delete: health_routines.enabled=false. Never hard DELETE. */
export async function softDeleteHealthRoutine(
  routineId: string,
  elderId: string,
): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data, error } = await supabase
    .from("health_routines")
    .update({ enabled: false })
    .eq("id", routineId)
    .eq("elder_id", elderId)
    .select("id, enabled")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Health soft-delete failed — no row returned (check RLS)");
  if (data.enabled !== false) return fail("Health soft-delete did not persist");

  const syncErr = await syncDomainConfig(supabase, elderId, "health");
  if (syncErr) return fail(`Soft-deleted but domain_configs sync failed: ${syncErr}`);

  revalidatePath(`/loved-ones/${elderId}`);
  revalidateApp();
  return { ok: true };
}
