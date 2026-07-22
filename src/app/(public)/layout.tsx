import { PublicLayout } from "@/components/layout/public-layout";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
