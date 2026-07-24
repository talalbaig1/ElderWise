import { Suspense } from "react";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-2xl bg-secondary" />}
    >
      {children}
    </Suspense>
  );
}
