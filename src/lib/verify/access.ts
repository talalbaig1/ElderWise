import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { CHECK_IDS, type CheckId } from "@/lib/verify/registry";

export const FORBIDDEN_MESSAGE = "Forbidden";
export const INVALID_REQUEST_MESSAGE = "Invalid request";
export const NOT_FOUND_MESSAGE = "Not found";
export const NOT_SIGNED_IN_MESSAGE = "Not signed in";
export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests";

type WindowStr = `${number} ${"s" | "m" | "h" | "d"}`;

export type ConsoleAccessState =
  | "missing"
  | "pending"
  | "revoked"
  | "approved";

export function isVerifyConsoleEnabled(): boolean {
  return process.env.VERIFY_CONSOLE_ENABLED === "true";
}

export function verifyNotFoundResponse(): Response {
  return Response.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}

export function verifyJsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      ...extraHeaders,
    },
  });
}

const checkIdTuple = CHECK_IDS as unknown as readonly [CheckId, ...CheckId[]];

export const verifyRunBodySchema = z
  .object({
    checkId: z.enum(checkIdTuple),
    params: z
      .object({
        elder: z.string().uuid().optional(),
        checkin: z.string().uuid().optional(),
        sosEvent: z.string().uuid().optional(),
        day: z.enum(["today", "yesterday", "last7"]).optional(),
      })
      .strict(),
  })
  .strict();

export const verifyRequestBodySchema = z.object({}).strict();

export const verifyOptionsQuerySchema = z
  .object({
    elderId: z.string().uuid().optional(),
  })
  .strict();

export type VerifyRunBody = z.infer<typeof verifyRunBodySchema>;

type RateLimitOpts = { max: number; window: WindowStr };

export type VerifyGateSuccess = {
  ok: true;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export type VerifyGateFailure = {
  ok: false;
  response: Response;
};

export type VerifyGateResult = VerifyGateSuccess | VerifyGateFailure;

async function loadConsoleAccessState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ConsoleAccessState> {
  const { data, error } = await supabase
    .from("console_access")
    .select("approved_at, revoked_at")
    .eq("care_partner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[verify] console_access lookup failed", error.message);
    return "missing";
  }

  if (!data) return "missing";
  if (data.revoked_at) return "revoked";
  if (!data.approved_at) return "pending";
  return "approved";
}

function forbiddenResponse(): Response {
  return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
}

/** Steps 1–4: flag, rate limit, getUser(), approval gate. */
export async function enforceVerifyGate(
  bucket: string,
  rateLimit: RateLimitOpts,
): Promise<VerifyGateResult> {
  if (!isVerifyConsoleEnabled()) {
    return { ok: false, response: verifyNotFoundResponse() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: verifyJsonResponse({ error: NOT_SIGNED_IN_MESSAGE }, 401),
    };
  }

  const limited = await checkRateLimit(bucket, user.id, rateLimit);
  if (!limited.ok) {
    return {
      ok: false,
      response: verifyJsonResponse(
        { error: TOO_MANY_REQUESTS_MESSAGE },
        429,
      ),
    };
  }

  const access = await loadConsoleAccessState(supabase, user.id);
  if (access !== "approved") {
    return { ok: false, response: forbiddenResponse() };
  }

  return { ok: true, userId: user.id, supabase };
}

/** Steps 1–3 only — for access request before approval exists. */
export async function enforceVerifyRequestGate(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: Response }
> {
  if (!isVerifyConsoleEnabled()) {
    return { ok: false, response: verifyNotFoundResponse() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: verifyJsonResponse({ error: NOT_SIGNED_IN_MESSAGE }, 401),
    };
  }

  const limited = await checkRateLimit("verify:request", user.id, {
    max: 5,
    window: "1 h",
  });
  if (!limited.ok) {
    return {
      ok: false,
      response: verifyJsonResponse(
        { error: TOO_MANY_REQUESTS_MESSAGE },
        429,
      ),
    };
  }

  return { ok: true, userId: user.id, supabase };
}

export async function assertElderOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  elderId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("elders")
    .select("id")
    .eq("id", elderId)
    .eq("care_partner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[verify] elder ownership check failed", error.message);
    return false;
  }

  return Boolean(data);
}

export async function assertCheckinOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  checkinId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("checkins")
    .select("id, elder_id")
    .eq("id", checkinId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[verify] checkin lookup failed", error.message);
    }
    return false;
  }

  return assertElderOwned(supabase, userId, data.elder_id);
}

export async function assertSosEventOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sosEventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sos_events")
    .select("id, elder_id")
    .eq("id", sosEventId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[verify] sos_event lookup failed", error.message);
    }
    return false;
  }

  return assertElderOwned(supabase, userId, data.elder_id);
}

export async function getElderTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  elderId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("elders")
    .select("timezone")
    .eq("id", elderId)
    .maybeSingle();

  if (error || !data) return null;
  return data.timezone;
}

export function logVerifyRun(
  checkId: string,
  userId: string,
  rowCount: number,
): void {
  console.info("[verify]", { checkId, userId, rowCount });
}
