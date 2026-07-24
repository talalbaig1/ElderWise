import type { ReactNode } from "react";

/**
 * Share route lives outside (app) — no Care Partner auth.
 * Clinical data is not rendered here; ShareGate loads it after click-through.
 */
export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/80 via-background to-background">
      {children}
    </div>
  );
}
