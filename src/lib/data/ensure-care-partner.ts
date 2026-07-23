"use server";

import { createClient } from "@/lib/supabase/server";

export type EnsureCarePartnerResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Idempotent care_partners upsert after Auth sign-up / first sign-in.
 * Timezone must come from the client (Intl) — M14; no auth.users trigger.
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

  if (!fullName) {
    return { ok: false, error: "Full name is required for your Care Partner profile." };
  }
  if (!email) {
    return { ok: false, error: "Email is required for your Care Partner profile." };
  }
  if (!timeZone) {
    return { ok: false, error: "Timezone is required for your Care Partner profile." };
  }

  const { data, error } = await supabase
    .from("care_partners")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        email,
        timezone: timeZone,
      },
      { onConflict: "id" },
    )
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
