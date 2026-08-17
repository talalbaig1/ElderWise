import { createAdminClient } from "@/lib/supabase/admin";
import { objectKeyFromAudioPath } from "@/lib/supabase/voice-notes-path";

export const LIST_PAGE = 100;

export type AdminClient = ReturnType<typeof createAdminClient>;
type StorageClient = ReturnType<AdminClient["storage"]["from"]>;

export function uniqueKeys(paths: Array<string | null | undefined>): string[] {
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
      console.error("[elder-cascade] list failed:", folder, error.message);
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
export async function collectPrefixKeys(
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

export async function removeKeys(
  bucket: StorageClient,
  keys: string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const removed: string[] = [];
  for (let i = 0; i < keys.length; i += LIST_PAGE) {
    const chunk = keys.slice(i, i + LIST_PAGE);
    const { error } = await bucket.remove(chunk);
    if (error) {
      console.error("[elder-cascade] storage remove failed:", error.message);
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

async function innerJoinCount(
  supabase: AdminClient,
  table: string,
  parent: "checkins" | "sos_events",
  elderId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select(`${parent}!inner(elder_id)`, { count: "exact", head: true })
    .eq(`${parent}.elder_id`, elderId);
  if (error) {
    console.error(`[elder-cascade] ${table} count failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Server-side cascade counts. Admin client — watchdog_alerts has RLS on
 * with zero SELECT policies, so a session count is silently 0.
 */
export async function countRowsDeleted(
  supabase: AdminClient,
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
    console.error("[elder-cascade] cascade count failed:", embedRes.error.message);
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

export async function collectElderAudioKeys(
  admin: AdminClient,
  elderId: string,
): Promise<string[]> {
  const journalRes = await admin
    .from("voice_journals")
    .select("audio_path")
    .eq("elder_id", elderId);
  if (journalRes.error) {
    console.error("[elder-cascade] voice_journals paths:", journalRes.error.message);
  }

  const checkinRes = await admin.from("checkins").select("id").eq("elder_id", elderId);
  if (checkinRes.error) {
    console.error("[elder-cascade] checkins ids:", checkinRes.error.message);
  }
  const checkinIds = (checkinRes.data ?? []).map((row) => row.id as string);

  let replyPaths: Array<string | null> = [];
  if (checkinIds.length > 0) {
    const replyRes = await admin
      .from("voice_replies")
      .select("audio_path")
      .in("checkin_id", checkinIds);
    if (replyRes.error) {
      console.error("[elder-cascade] voice_replies paths:", replyRes.error.message);
    } else {
      replyPaths = (replyRes.data ?? []).map((row) => row.audio_path as string | null);
    }
  }

  return uniqueKeys([
    ...(journalRes.data ?? []).map((row) => row.audio_path as string | null),
    ...replyPaths,
  ]);
}
