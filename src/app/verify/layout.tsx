import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Verification console",
  robots: { index: false, follow: false, nocache: true },
};

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/80 via-background to-background">
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </div>
  );
}
