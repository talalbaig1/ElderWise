import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VerifyConsole } from "@/components/verify/verify-console";
import { VerifyGatePanel } from "@/components/verify/verify-gate-panel";
import { createClient } from "@/lib/supabase/server";
import { isVerifyConsoleEnabled } from "@/lib/verify/access";

export default async function VerifyPage() {
  if (!isVerifyConsoleEnabled()) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/verify");
  }

  const { data: access } = await supabase
    .from("console_access")
    .select("approved_at, revoked_at")
    .eq("care_partner_id", user.id)
    .maybeSingle();

  let gate: "missing" | "pending" | "revoked" | "approved";
  if (!access) {
    gate = "missing";
  } else if (access.revoked_at) {
    gate = "revoked";
  } else if (!access.approved_at) {
    gate = "pending";
  } else {
    gate = "approved";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-block text-sm font-semibold text-primary hover:underline"
        >
          ← Back to dashboard
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          SilaCare · internal
        </p>
        <h1 className="font-display text-3xl text-foreground">
          Verification console
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Read-only database witness for approved testers. Raw column names and
          values — independent of the dashboard analytics layer.
        </p>
      </header>

      {gate === "approved" ? <VerifyConsole /> : <VerifyGatePanel state={gate} />}
    </div>
  );
}
