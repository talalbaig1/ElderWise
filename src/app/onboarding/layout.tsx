import { RequireOnboarding } from "@/components/auth/route-guards";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireOnboarding>{children}</RequireOnboarding>;
}
