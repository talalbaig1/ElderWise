import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectElderAudioKeys,
  collectPrefixKeys,
  countRowsDeleted,
  removeKeys,
  type AdminClient,
} from "@/lib/supabase/elder-cascade-delete";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string() });

function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

type ElderSnapshot = {
  id: string;
  firstName: string;
  rowsDeleted: Record<string, number>;
  catalogKeys: string[];
};

async function sweepElderPrefix(
  admin: AdminClient,
  elderId: string,
  catalogKeys: string[],
): Promise<{ keys: string[]; remaining: number }> {
  const bucket = admin.storage.from("voice-notes");
  const removedFromCatalog = await removeKeys(bucket, catalogKeys);
  const leftover = await collectPrefixKeys(bucket, elderId);
  const removedFromSweep = await removeKeys(bucket, leftover);
  const keys = [...new Set([...removedFromCatalog, ...removedFromSweep])];
  const remainingList = await collectPrefixKeys(bucket, elderId);
  if (remainingList.length > 0) {
    console.error("[account/delete] storage remaining under prefix:", remainingList);
  }
  return { keys, remaining: remainingList.length };
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Email does not match" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  const sessionEmail = user.email ?? "";
  if (
    !parsed.success ||
    !sessionEmail ||
    !emailsMatch(parsed.data.email, sessionEmail)
  ) {
    return NextResponse.json({ error: "Email does not match" }, { status: 400 });
  }

  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[account/delete] admin client failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  const eldersRes = await admin
    .from("elders")
    .select("id, first_name")
    .eq("care_partner_id", user.id);
  if (eldersRes.error) {
    console.error("[account/delete] elders list failed:", eldersRes.error.message);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }
  const elderRows = eldersRes.data ?? [];

  const snapshots: ElderSnapshot[] = [];
  for (const row of elderRows) {
    const id = row.id as string;
    const [rowsDeleted, catalogKeys] = await Promise.all([
      countRowsDeleted(admin, id),
      collectElderAudioKeys(admin, id),
    ]);
    snapshots.push({
      id,
      firstName: (row.first_name as string) ?? "",
      rowsDeleted,
      catalogKeys,
    });
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("[account/delete] deleteUser failed:", deleteUserError.message);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  let storageRemoved = 0;
  let storageRemaining = 0;
  const auditRows: Array<{
    source: "account";
    elder_id: string | null;
    elder_first_name: string | null;
    care_partner_id: string;
    rows_deleted: Record<string, number>;
    storage_keys: string[];
    storage_remaining: number;
    note: string | null;
  }> = [];

  try {
    for (const snap of snapshots) {
      let keys: string[] = [];
      let remaining = 0;
      try {
        const swept = await sweepElderPrefix(admin, snap.id, snap.catalogKeys);
        keys = swept.keys;
        remaining = swept.remaining;
        storageRemoved += keys.length;
        storageRemaining += remaining;
      } catch (error) {
        console.error(
          "[account/delete] storage sweep failed:",
          snap.id,
          error instanceof Error ? error.message : error,
        );
      }
      auditRows.push({
        source: "account",
        elder_id: snap.id,
        elder_first_name: snap.firstName || null,
        care_partner_id: user.id,
        rows_deleted: snap.rowsDeleted,
        storage_keys: keys,
        storage_remaining: remaining,
        note: null,
      });
    }
  } catch (error) {
    console.error(
      "[account/delete] storage sweep failed:",
      error instanceof Error ? error.message : error,
    );
  }

  const elderCount = snapshots.length;
  auditRows.push({
    source: "account",
    elder_id: null,
    elder_first_name: null,
    care_partner_id: user.id,
    rows_deleted: { care_partners: 1, elders: elderCount },
    storage_keys: [],
    storage_remaining: storageRemaining,
    note:
      elderCount === 1
        ? "Deleted 1 Loved One"
        : `Deleted ${elderCount} Loved Ones`,
  });

  const { error: auditError } = await admin.from("deletion_events").insert(auditRows);
  if (auditError) {
    console.error("[account/delete] deletion_events insert failed:", auditError.message);
  }

  return NextResponse.json({
    deleted: true,
    elders: elderCount,
    storageRemoved,
    storageRemaining,
  });
}
