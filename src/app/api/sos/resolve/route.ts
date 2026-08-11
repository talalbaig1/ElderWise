import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  sos_event_id: z.string().uuid(),
});

const WEBHOOK_TIMEOUT_MS = 10_000;

function logSosP1(payload: {
  sos_event_id: string;
  status?: number | string;
  body?: string;
  reason?: string;
}) {
  console.error("[SOS-P1]", payload);
}

async function notifyN8n(sosEventId: string): Promise<void> {
  const url = process.env.N8N_SOS_RESOLVED_WEBHOOK_URL;
  const secret = process.env.N8N_SOS_RESOLVED_WEBHOOK_SECRET;

  if (!url || !secret) {
    logSosP1({
      sos_event_id: sosEventId,
      reason: "missing N8N_SOS_RESOLVED_WEBHOOK_URL or N8N_SOS_RESOLVED_WEBHOOK_SECRET",
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ElderWise-Signature": secret,
      },
      body: JSON.stringify({ sos_event_id: sosEventId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      logSosP1({
        sos_event_id: sosEventId,
        status: response.status,
        body: responseBody.slice(0, 500),
      });
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    logSosP1({
      sos_event_id: sosEventId,
      status: timedOut ? "timeout" : "network_error",
      body: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "sos_event_id must be a UUID" }, { status: 400 });
  }

  const requestId = parsed.data.sos_event_id;
  const resolvedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("sos_events")
    .update({
      status: "resolved",
      resolved_at: resolvedAt,
      resolved_by_role: "care_partner",
      resolved_by_id: user.id,
      resolved_channel: "dashboard",
    })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return Response.json({ error: "Could not resolve SOS" }, { status: 500 });
  }

  if (updated?.id) {
    await notifyN8n(updated.id);
    return Response.json({ ok: true, sos_event_id: updated.id, already_resolved: false });
  }

  // Zero rows updated — distinguish unknown/other-CT vs already resolved.
  const { data: existing, error: selectError } = await supabase
    .from("sos_events")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (selectError) {
    return Response.json({ error: "Could not resolve SOS" }, { status: 500 });
  }

  if (!existing) {
    return Response.json({ error: "SOS event not found" }, { status: 404 });
  }

  if (existing.status === "resolved") {
    // Idempotent: WhatsApp may have resolved moments earlier — skip webhook.
    return Response.json({
      ok: true,
      sos_event_id: existing.id,
      already_resolved: true,
    });
  }

  // Visible under RLS, still open, but UPDATE matched nothing — unexpected.
  logSosP1({
    sos_event_id: requestId,
    reason: "update matched zero rows while status still open",
    status: existing.status,
  });
  return Response.json({ error: "Could not resolve SOS" }, { status: 500 });
}
