import { redirect } from "next/navigation";
import { RequireAuth } from "@/components/auth/route-guards";
import { SessionBridge } from "@/components/auth/session-bridge";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AppDataProvider } from "@/components/data/app-data-provider";
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

  const data = await loadAppData(supabase);

  // Derive from loadAppData — no second elders query. Zero elders → onboarding
  // (A2.4 will write real elders; until then new CTs loop here on purpose on a3-auth).
  if (data.lovedOnes.length === 0) {
    redirect("/onboarding");
  }

  return (
    <AppDataProvider data={data}>
      <SessionBridge />
      <RequireAuth>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </RequireAuth>
    </AppDataProvider>
  );
}
