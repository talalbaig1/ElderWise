import * as Sentry from "@sentry/nextjs";
import { waitlistApiSchema } from "@/lib/waitlist-schema";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WEBHOOK_TIMEOUT_MS = 10_000;

function json(
  body: { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> },
  status: number,
) {
  return Response.json(body, { status });
}

async function notifyN8n(waitlistId: string): Promise<void> {
  const url = process.env.N8N_WAITLIST_WEBHOOK_URL?.trim();
  const secret = process.env.N8N_WAITLIST_WEBHOOK_SECRET?.trim();

  if (!url || !secret) {
    console.error("[waitlist] missing N8N_WAITLIST_WEBHOOK_URL or N8N_WAITLIST_WEBHOOK_SECRET", {
      waitlist_id: waitlistId,
    });
    Sentry.captureMessage("Waitlist n8n webhook env missing", {
      level: "error",
      extra: { waitlist_id: waitlistId },
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
      body: JSON.stringify({ waitlist_id: waitlistId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("[waitlist] n8n webhook non-2xx", {
        waitlist_id: waitlistId,
        status: response.status,
        body: responseBody.slice(0, 500),
      });
      Sentry.captureMessage("Waitlist n8n webhook failed", {
        level: "error",
        extra: {
          waitlist_id: waitlistId,
          status: response.status,
          body: responseBody.slice(0, 500),
        },
      });
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("[waitlist] n8n webhook error", {
      waitlist_id: waitlistId,
      status: timedOut ? "timeout" : "network_error",
      body: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, { extra: { waitlist_id: waitlistId } });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(
    "waitlist",
    clientIpFromHeaders(request.headers),
    { max: 8, window: "10 m" },
  );
  if (!limited.ok) {
    return json({ ok: false, error: "Too many requests. Try again shortly." }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const parsed = waitlistApiSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return json(
      {
        ok: false,
        error: "Please check the form and try again.",
        fieldErrors,
      },
      400,
    );
  }

  const payload = parsed.data;
  const id = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").insert({
    id,
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    whatsapp: payload.whatsapp,
    caring_for: payload.caringFor ?? null,
    location: payload.location ?? null,
    consent: payload.consent,
  });

  if (error) {
    console.error("[waitlist] insert failed", error.message);
    Sentry.captureException(error);
    return json({ ok: false, error: "Could not join the waitlist. Please try again." }, 500);
  }

  try {
    await notifyN8n(id);
  } catch (error) {
    console.error("[waitlist] n8n notify threw after insert", {
      waitlist_id: id,
      body: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, { extra: { waitlist_id: id } });
  }

  return json({ ok: true, id }, 200);
}
