"use server";

import { createClient } from "@/lib/supabase/server";

export type EnsureCarePartnerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Idempotent care_partners create / light update after Auth sign-up / first sign-in.
 * Timezone: set on INSERT from the client (Intl) only — M14.
 * Never overwrite timezone on an existing row (Settings / travel must not reset it).
 */
export async function ensureCarePartnerProfile(input: {
  fullName: string;
  email: string;
  timeZone: string;
}): Promise<EnsureCarePartnerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in — cannot create care partner profile." };
  }

  const fullName = input.fullName.trim();
  const email = (input.email || user.email || "").trim().toLowerCase();
  const timeZone = input.timeZone.trim() || "UTC";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  if (!fullName) {
    return { ok: false, error: "Full name is required for your Care Partner profile." };
  }
  if (!email) {
    return { ok: false, error: "Email is required for your Care Partner profile." };
  }
  if (!timeZone) {
    return { ok: false, error: "Timezone is required for your Care Partner profile." };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("care_partners")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, error: existingErr.message };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("care_partners")
      .update({
        first_name: firstName,
        last_name: lastName,
        email,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data) {
      return {
        ok: false,
        error: "Profile save failed — no row returned (check RLS).",
      };
    }
    return { ok: true };
  }

  const { data, error } = await supabase
    .from("care_partners")
    .insert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      timezone: timeZone,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error: "Profile save failed — no row returned (check RLS).",
    };
  }

  return { ok: true };
}
