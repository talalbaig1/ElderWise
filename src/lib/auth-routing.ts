import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Product elder = `elders.active = true` only.
 *
 * Draft Loved Ones written during A2.4 onboarding use `active=false` and must
 * NOT count as onboarded. This is the single source for
 * "does this CT have a product elder?" — use `hasOwnProductElder` (or
 * `countOwnActiveElders` when a count is needed) from route guards, (app)/layout,
 * and post-auth redirects. Do not re-derive the boolean from
 * `loadAppData().lovedOnes.length` in those gates.
 *
 * `loadAppData` must keep the same `.eq("active", true)` filter on its elders
 * query so the product read model stays aligned with this helper.
 */
export async function countOwnActiveElders(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("elders")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  if (error) return 0;
  return count ?? 0;
}

/** Canonical gate: true iff this session's CT owns at least one product elder. */
export async function hasOwnProductElder(
  supabase: SupabaseClient,
): Promise<boolean> {
  return (await countOwnActiveElders(supabase)) > 0;
}

export function clientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function postAuthPath(
  hasProductElder: boolean,
): "/onboarding" | "/dashboard" {
  return hasProductElder ? "/dashboard" : "/onboarding";
}
