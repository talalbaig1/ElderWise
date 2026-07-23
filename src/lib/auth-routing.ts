import type { SupabaseClient } from "@supabase/supabase-js";

/** Client-side elder count for public-route guards (RequireGuest). */
export async function countOwnElders(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("elders")
    .select("id", { count: "exact", head: true });
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
