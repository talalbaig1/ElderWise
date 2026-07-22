"use client";

import {
  getPasswordStrength,
  passwordStrengthCopy,
  type PasswordStrength,
} from "@/lib/auth-schema";
import { cn } from "@/lib/utils";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  if (strength === "empty") {
    return (
      <p className="text-xs text-muted-foreground">
        Use 8+ characters with upper, lower, and a number.
      </p>
    );
  }

  const meta = passwordStrengthCopy[strength as Exclude<PasswordStrength, "empty">];

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", meta.barClass, meta.width)} />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Strength · {meta.label}
      </p>
    </div>
  );
}
