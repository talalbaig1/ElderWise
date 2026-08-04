import {
  assertElderOwned,
  enforceVerifyGate,
  FORBIDDEN_MESSAGE,
  INVALID_REQUEST_MESSAGE,
  verifyJsonResponse,
  verifyOptionsQuerySchema,
} from "@/lib/verify/access";
import { CHECK_IDS, getCheckDefinition } from "@/lib/verify/registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await enforceVerifyGate("verify:options", {
    max: 60,
    window: "1 m",
  });
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const parsed = verifyOptionsQuerySchema.safeParse({
    elderId: url.searchParams.get("elderId") ?? undefined,
  });

  if (!parsed.success) {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const { elderId } = parsed.data;

  if (elderId) {
    const owned = await assertElderOwned(gate.supabase, gate.userId, elderId);
    if (!owned) {
      return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
    }
  }

  const { data: elders, error: eldersError } = await gate.supabase
    .from("elders")
    .select("id, first_name, timezone")
    .eq("care_partner_id", gate.userId)
    .order("first_name", { ascending: true });

  if (eldersError) {
    console.error("[verify] elders options failed", eldersError.message);
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const checks = CHECK_IDS.map((id) => ({
    id,
    label: getCheckDefinition(id).label,
    params: getCheckDefinition(id).params,
  }));

  if (!elderId) {
    return verifyJsonResponse({ checks, elders: elders ?? [] }, 200);
  }

  const [{ data: checkins, error: checkinsError }, { data: sosEvents, error: sosError }] =
    await Promise.all([
      gate.supabase
        .from("checkins")
        .select("id, domain, scheduled_for, status")
        .eq("elder_id", elderId)
        .order("scheduled_for", { ascending: false })
        .limit(50),
      gate.supabase
        .from("sos_events")
        .select("id, triggered_at, status")
        .eq("elder_id", elderId)
        .order("triggered_at", { ascending: false })
        .limit(20),
    ]);

  if (checkinsError || sosError) {
    console.error("[verify] scoped options failed", {
      checkins: checkinsError?.message,
      sos: sosError?.message,
    });
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  return verifyJsonResponse(
    {
      checks,
      elders: elders ?? [],
      checkins: checkins ?? [],
      sosEvents: sosEvents ?? [],
    },
    200,
  );
}
