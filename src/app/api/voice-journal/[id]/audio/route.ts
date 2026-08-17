import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;
const idSchema = z.string().uuid();

function objectKeyFromAudioPath(audioPath: string): string | null {
  const trimmed = audioPath.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  return trimmed.replace(/^voice-notes\//, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Session client + RLS: another family's row returns nothing. 404, not 403.
  const { data: journal, error: selectError } = await supabase
    .from("voice_journals")
    .select("id, audio_path")
    .eq("id", id)
    .maybeSingle();

  if (selectError) {
    console.error("[voice-journal/audio] select failed:", selectError.message);
    return NextResponse.json({ error: "Could not load audio" }, { status: 500 });
  }

  if (!journal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!journal.audio_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const objectKey = objectKeyFromAudioPath(journal.audio_path);
  if (!objectKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership already proven. Service-role is used only to sign that path.
  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("voice-notes")
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error("[voice-journal/audio] sign failed:", signError?.message);
    return NextResponse.json({ error: "Could not load audio" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
