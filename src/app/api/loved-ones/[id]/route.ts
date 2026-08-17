import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { objectKeyFromAudioPath } from "@/lib/supabase/voice-notes-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const LIST_PAGE = 100;

type StorageClient = ReturnType<ReturnType<typeof createAdminClient>["storage"]["from"]>;

function uniqueKeys(paths: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const path of paths) {
    if (!path) continue;
    const key = objectKeyFromAudioPath(path);
    if (key) out.add(key);
  }
  return [...out];
}

async function listFolder(
  bucket: StorageClient,
  folder: string,
): Promise<{ files: string[]; folders: string[] }> {
  const files: string[] = [];
  const folders: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await bucket.list(folder, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      console.error("[loved-ones/delete] list failed:", folder, error.message);
      break;
    }
    if (!data?.length) break;

    for (const item of data) {
      const key = folder ? `${folder}/${item.name}` : item.name;
      if (item.id == null) folders.push(key);
      else files.push(key);
    }

    if (data.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }

  return { files, folders };
}

/** Walk `{id}/`, `{id}/journal/`, and each `{id}/{checkin_id}/`. */
async function collectPrefixKeys(
  bucket: StorageClient,
  elderId: string,
): Promise<string[]> {
  const keys: string[] = [];
  const root = await listFolder(bucket, elderId);
  keys.push(...root.files);
  for (const folder of root.folders) {
    const inner = await listFolder(bucket, folder);
    keys.push(...inner.files);
  }
  return keys;
}

async function removeKeys(
  bucket: StorageClient,
  keys: string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const removed: string[] = [];
  for (let i = 0; i < keys.length; i += LIST_PAGE) {
    const chunk = keys.slice(i, i + LIST_PAGE);
    const { error } = await bucket.remove(chunk);
    if (error) {
      console.error("[loved-ones/delete] storage remove failed:", error.message);
      continue;
    }
    removed.push(...chunk);
  }
  return removed;
}

function embedCount(value: unknown): number {
  if (!Array.isArray(value) || value[0] == null) return 0;
  const count = (value[0] as { count?: unknown }).count;
  return typeof count === "number" ? count : Number(count) || 0;
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

async function innerJoinCount(
  supabase: SessionClient,
  table: string,
  parent: "checkins" | "sos_events",
  elderId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select(`${parent}!inner(elder_id)`, { count: "exact", head: true })
    .eq(`${parent}.elder_id`, elderId);
  if (error) {
    console.error(`[loved-ones/delete] ${table} count failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Server-side cascade counts before the DELETE. Dialog numbers are not read.
 * Direct children: one PostgREST request of scalar `count(*)` subselects.
 * Grandchildren have no `elder_id` — each is `count(*)` through an inner join.
 */
async function countRowsDeleted(
  supabase: SessionClient,
  elderId: string,
): Promise<Record<string, number>> {
  const [embedRes, medicationItems, voiceReplies, watchdogAlerts, sosNotifications] =
    await Promise.all([
      supabase
        .from("elders")
        .select(
          `
          local_caregivers(count),
          doctors(count),
          doctor_share_links(count),
          domain_configs(count),
          medications(count),
          food_routines(count),
          health_routines(count),
          checkins(count),
          sos_events(count),
          ct_notifications(count),
          voice_journals(count)
        `,
        )
        .eq("id", elderId)
        .maybeSingle(),
      innerJoinCount(supabase, "checkin_medication_items", "checkins", elderId),
      innerJoinCount(supabase, "voice_replies", "checkins", elderId),
      innerJoinCount(supabase, "watchdog_alerts", "checkins", elderId),
      innerJoinCount(supabase, "sos_notifications", "sos_events", elderId),
    ]);

  if (embedRes.error) {
    console.error("[loved-ones/delete] cascade count failed:", embedRes.error.message);
    return {};
  }
  if (!embedRes.data) return {};

  const row = embedRes.data as Record<string, unknown>;
  return {
    elders: 1,
    local_caregivers: embedCount(row.local_caregivers),
    doctors: embedCount(row.doctors),
    doctor_share_links: embedCount(row.doctor_share_links),
    domain_configs: embedCount(row.domain_configs),
    medications: embedCount(row.medications),
    food_routines: embedCount(row.food_routines),
    health_routines: embedCount(row.health_routines),
    checkins: embedCount(row.checkins),
    checkin_medication_items: medicationItems,
    voice_replies: voiceReplies,
    sos_events: embedCount(row.sos_events),
    sos_notifications: sosNotifications,
    ct_notifications: embedCount(row.ct_notifications),
    watchdog_alerts: watchdogAlerts,
    voice_journals: embedCount(row.voice_journals),
  };
}

export async function DELETE(
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

  const { data: elder, error: lookupError } = await supabase
    .from("elders")
    .select("id, first_name")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("[loved-ones/delete] lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not delete Loved One" }, { status: 500 });
  }
  if (!elder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const journalRes = await supabase
    .from("voice_journals")
    .select("audio_path")
    .eq("elder_id", id);
  if (journalRes.error) {
    console.error("[loved-ones/delete] voice_journals paths:", journalRes.error.message);
  }

  const checkinRes = await supabase.from("checkins").select("id").eq("elder_id", id);
  if (checkinRes.error) {
    console.error("[loved-ones/delete] checkins ids:", checkinRes.error.message);
  }
  const checkinIds = (checkinRes.data ?? []).map((row) => row.id as string);

  let replyPaths: Array<string | null> = [];
  if (checkinIds.length > 0) {
    const replyRes = await supabase
      .from("voice_replies")
      .select("audio_path")
      .in("checkin_id", checkinIds);
    if (replyRes.error) {
      console.error("[loved-ones/delete] voice_replies paths:", replyRes.error.message);
    } else {
      replyPaths = (replyRes.data ?? []).map((row) => row.audio_path as string | null);
    }
  }

  const collectedKeys = uniqueKeys([
    ...(journalRes.data ?? []).map((row) => row.audio_path as string | null),
    ...replyPaths,
  ]);

  const rowsDeleted = await countRowsDeleted(supabase, id);

  const { data: deleted, error: deleteError } = await supabase
    .from("elders")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("[loved-ones/delete] elder delete failed:", deleteError.message);
    return NextResponse.json({ error: "Could not delete Loved One" }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidatePath("/loved-ones", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");

  let storageRemoved = 0;
  let storageRemaining = 0;
  let storageKeys: string[] = [];

  try {
    const admin = createAdminClient();
    try {
      const bucket = admin.storage.from("voice-notes");
      const removedFromCatalog = await removeKeys(bucket, collectedKeys);
      const leftover = await collectPrefixKeys(bucket, id);
      const removedFromSweep = await removeKeys(bucket, leftover);
      storageKeys = [...new Set([...removedFromCatalog, ...removedFromSweep])];
      storageRemoved = storageKeys.length;

      const remaining = await collectPrefixKeys(bucket, id);
      storageRemaining = remaining.length;
      if (storageRemaining > 0) {
        console.error("[loved-ones/delete] storage remaining under prefix:", remaining);
      }
    } catch (error) {
      console.error(
        "[loved-ones/delete] storage sweep failed:",
        error instanceof Error ? error.message : error,
      );
    }

    const { error: auditError } = await admin.from("deletion_events").insert({
      source: "app",
      elder_id: id,
      elder_first_name: elder.first_name,
      care_partner_id: user.id,
      rows_deleted: rowsDeleted,
      storage_keys: storageKeys,
      storage_remaining: storageRemaining,
    });
    if (auditError) {
      console.error("[loved-ones/delete] deletion_events insert failed:", auditError.message);
    }
  } catch (error) {
    console.error(
      "[loved-ones/delete] admin client failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    deleted: true,
    storageRemoved,
    storageRemaining,
  });
}
