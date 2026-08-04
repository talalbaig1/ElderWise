import {
  assertCheckinOwned,
  assertElderOwned,
  assertSosEventOwned,
  enforceVerifyGate,
  FORBIDDEN_MESSAGE,
  getElderTimezone,
  INVALID_REQUEST_MESSAGE,
  logVerifyRun,
  verifyJsonResponse,
  verifyRunBodySchema,
} from "@/lib/verify/access";
import { executeVerifyCheck } from "@/lib/verify/run";
import { getCheckDefinition, type ParamKey } from "@/lib/verify/registry";

export const runtime = "nodejs";

function paramsAllowedForCheck(
  declared: readonly ParamKey[],
  params: Record<string, unknown>,
): boolean {
  for (const key of ["elder", "checkin", "sosEvent", "day"] as const) {
    if (params[key] !== undefined && !declared.includes(key)) {
      return false;
    }
  }
  return true;
}

export async function POST(request: Request) {
  const gate = await enforceVerifyGate("verify:run", {
    max: 60,
    window: "1 m",
  });
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const parsed = verifyRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const { checkId, params } = parsed.data;
  const def = getCheckDefinition(checkId);

  if (!paramsAllowedForCheck(def.params, params)) {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  for (const key of def.params) {
    if (params[key] === undefined) {
      return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
    }
  }

  if (params.elder) {
    const owned = await assertElderOwned(
      gate.supabase,
      gate.userId,
      params.elder,
    );
    if (!owned) {
      return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
    }
  }

  if (params.checkin) {
    const owned = await assertCheckinOwned(
      gate.supabase,
      gate.userId,
      params.checkin,
    );
    if (!owned) {
      return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
    }
  }

  if (params.sosEvent) {
    const owned = await assertSosEventOwned(
      gate.supabase,
      gate.userId,
      params.sosEvent,
    );
    if (!owned) {
      return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
    }
  }

  try {
    const result = await executeVerifyCheck(
      gate.supabase,
      checkId,
      params,
      (elderId) => getElderTimezone(gate.supabase, elderId),
    );

    logVerifyRun(checkId, gate.userId, result.rowCount);

    return verifyJsonResponse(result, 200);
  } catch (err) {
    console.error(
      "[verify] run failed",
      err instanceof Error ? err.message : err,
    );
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }
}
