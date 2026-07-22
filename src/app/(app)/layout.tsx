import { RequireAuth } from "@/components/auth/route-guards";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </RequireAuth>
  );
}
