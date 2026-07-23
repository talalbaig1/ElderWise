import { redirect } from "next/navigation";
import { RequireAuth } from "@/components/auth/route-guards";
import { SessionBridge } from "@/components/auth/session-bridge";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AppDataProvider } from "@/components/data/app-data-provider";
import { hasOwnProductElder } from "@/lib/auth-routing";
import { loadAppData } from "@/lib/data/load-app-data";
import { createClient } from "@/lib/supabase/server";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Single source: product elder = active=true (drafts stay on /onboarding).
  if (!(await hasOwnProductElder(supabase))) {
    redirect("/onboarding");
  }

  const data = await loadAppData(supabase);

  return (
    <AppDataProvider data={data}>
      <SessionBridge />
      <RequireAuth>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </RequireAuth>
    </AppDataProvider>
  );
}
