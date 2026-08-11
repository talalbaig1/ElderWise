"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import {
  generateShareToken,
  hashShareToken,
  SHARE_DEFAULT_TTL_DAYS,
} from "@/lib/share/token";
import type { DoctorShareSummary } from "@/lib/share/types";

export type ShareActionResult =
  | { ok: true; rawToken: string; expiresAt: string; urlPath: string }
  | { ok: false; error: string };

export type RevokeShareResult =
  | { ok: true; revokedCount: number }
  | { ok: false; error: string };

export type RevealShareResult =
  | { ok: true; summary: DoctorShareSummary }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function revalidateSharePaths(elderId: string) {
  revalidatePath(`/loved-ones/${elderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/loved-ones");
  revalidatePath("/settings");
  revalidatePath("/reports");
  revalidatePath("/sos");
  revalidatePath("/notifications");
}

function isUniqueViolation(message: string): boolean {
  return (
    message.includes("doctor_share_links_one_active_cp_link") ||
    message.includes("duplicate key") ||
    message.includes("23505")
  );
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
    .eq("active", true)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Loved One not found or not owned by you";
  return null;
}

/**
 * Revoke every working (unrevoked + unexpired) share link for an elder.
 * Used by the Care Circle header control and by deleteDoctor.
 */
export async function revokeActiveDoctorShareLinks(
  elderId: string,
): Promise<RevokeShareResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data: rows, error: listErr } = await supabase
    .from("doctor_share_links")
    .select("id, expires_at")
    .eq("elder_id", elderId)
    .is("revoked_at", null);

  if (listErr) return fail(listErr.message);

  const nowMs = Date.now();
  const ids = (rows ?? [])
    .filter((row) => {
      const exp = row.expires_at as string | null;
      if (exp && new Date(exp).getTime() <= nowMs) return false;
      return true;
    })
    .map((row) => row.id as string);

  if (ids.length === 0) {
    revalidateSharePaths(elderId);
    return { ok: true, revokedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("doctor_share_links")
    .update({ revoked_at: nowIso })
    .in("id", ids)
    .eq("elder_id", elderId)
    .is("revoked_at", null)
    .select("id");

  if (error) return fail(error.message);

  revalidateSharePaths(elderId);
  return { ok: true, revokedCount: data?.length ?? 0 };
}

/** CT issues a share link — raw token returned once. Uses session RLS for insert. */
export async function issueDoctorShareLink(elderId: string): Promise<ShareActionResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data: doctor, error: docErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("elder_id", elderId)
    .maybeSingle();
  if (docErr) return fail(docErr.message);
  if (!doctor) {
    return fail("Add a Family Doctor before issuing a share link.");
  }

  // Cap matches partial unique index: any unrevoked dashboard-issued row
  // (sos_event_id IS NULL), including expired — index predicates cannot use now().
  const { data: existingRows, error: existingErr } = await supabase
    .from("doctor_share_links")
    .select("id")
    .eq("elder_id", elderId)
    .is("revoked_at", null)
    .is("sos_event_id", null)
    .limit(1)
    .maybeSingle();

  if (existingErr) return fail(existingErr.message);
  if (existingRows) {
    return fail(
      "A dashboard share link already exists. Revoke it before issuing a new one.",
    );
  }

  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);
  const expiresAt = new Date(
    Date.now() + SHARE_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("doctor_share_links")
    .insert({
      elder_id: elderId,
      token_hash: tokenHash,
      created_by: user.id,
      expires_at: expiresAt,
      sos_event_id: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error.message)) {
      return fail(
        "A dashboard share link already exists. Revoke it before issuing a new one.",
      );
    }
    return fail(error.message);
  }
  if (!data) return fail("Share link create failed — no row returned (check RLS)");

  revalidateSharePaths(elderId);
  return {
    ok: true,
    rawToken,
    expiresAt,
    urlPath: `/share/${rawToken}`,
  };
}

/** CT revokes a share link (sets revoked_at). */
export async function revokeDoctorShareLink(
  linkId: string,
  elderId: string,
): Promise<RevokeShareResult> {
  const { supabase, user, error: authErr } = await requireUser();
  if (authErr || !user) return fail(authErr ?? "Not signed in");

  const ownErr = await assertOwnsElder(supabase, elderId, user.id);
  if (ownErr) return fail(ownErr);

  const { data, error } = await supabase
    .from("doctor_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("elder_id", elderId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("Share link not found or already revoked");

  revalidateSharePaths(elderId);
  return { ok: true, revokedCount: 1 };
}

/**
 * Doctor click-through reveal — service-role, elder-scoped.
 * Called only after human interaction so crawlers never receive clinical HTML.
 * Rate-limited per platform IP (fail-open) — see checkRateLimit.
 */
export async function revealDoctorShareSummary(
  rawToken: string,
): Promise<RevealShareResult> {
  const token = rawToken.trim();
  if (!token || token.length < 32) {
    return fail("This link is invalid.");
  }

  // Platform IP (x-vercel-forwarded-for) — clients can forge x-forwarded-for.
  const limited = await checkRateLimit(
    "share:reveal",
    clientIpFromHeaders(await headers()),
    { max: 20, window: "1 m" },
  );
  if (!limited.ok) {
    // Same message shape as other failures — do not leak whether the token is valid.
    return fail("Too many requests. Try again shortly.");
  }

  try {
    const { loadDoctorShareSummary } = await import("@/lib/share/load-share-data");
    const summary = await loadDoctorShareSummary(token);
    if (!summary) {
      return fail("This link is invalid, expired, or has been revoked.");
    }
    return { ok: true, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to load share summary";
    return fail(message);
  }
}
