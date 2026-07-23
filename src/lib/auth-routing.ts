import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Active elders only — drafts use active=false during A2.4 onboarding, so a
 * CT mid-wizard must still count as "needs onboarding" (postAuthPath → /onboarding).
 */
export async function countOwnElders(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("elders")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  if (error) return 0;
  return count ?? 0;
}

export function clientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function postAuthPath(elderCount: number): "/onboarding" | "/dashboard" {
  return elderCount > 0 ? "/dashboard" : "/onboarding";
}
