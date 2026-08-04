import {
  enforceVerifyRequestGate,
  FORBIDDEN_MESSAGE,
  INVALID_REQUEST_MESSAGE,
  verifyJsonResponse,
  verifyRequestBodySchema,
} from "@/lib/verify/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await enforceVerifyRequestGate();
  if (!gate.ok) return gate.response;

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      json = JSON.parse(text);
    }
  } catch {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const parsed = verifyRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  const { data: existing, error: existingError } = await gate.supabase
    .from("console_access")
    .select("id")
    .eq("care_partner_id", gate.userId)
    .maybeSingle();

  if (existingError) {
    console.error("[verify] request lookup failed", existingError.message);
    return verifyJsonResponse({ error: INVALID_REQUEST_MESSAGE }, 400);
  }

  if (existing) {
    return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
  }

  const { error: insertError } = await gate.supabase
    .from("console_access")
    .insert({ care_partner_id: gate.userId });

  if (insertError) {
    console.error("[verify] request insert failed", insertError.message);
    return verifyJsonResponse({ error: FORBIDDEN_MESSAGE }, 403);
  }

  return verifyJsonResponse({ ok: true }, 201);
}
