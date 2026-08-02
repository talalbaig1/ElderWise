import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  elder_id: z.string().uuid(),
});

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
    return Response.json({ error: "elder_id must be a UUID" }, { status: 400 });
  }

  const elderId = parsed.data.elder_id;

  const { data: openExisting, error: openError } = await supabase
    .from("sos_events")
    .select("id")
    .eq("elder_id", elderId)
    .eq("status", "open")
    .limit(1);

  if (openError) {
    return Response.json({ error: "Could not start demo SOS" }, { status: 500 });
  }

  if (openExisting && openExisting.length > 0) {
    return Response.json(
      { error: "An SOS is already open for this Loved One" },
      { status: 409 },
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("sos_events")
    .insert({
      elder_id: elderId,
      status: "open",
    })
    .select("id")
    .maybeSingle();

  if (insertError || !created?.id) {
    // RLS WITH CHECK rejects elders the CT does not own — treat as not found.
    return Response.json({ error: "Loved One not found" }, { status: 404 });
  }

  return Response.json({ ok: true, sos_event_id: created.id });
}
