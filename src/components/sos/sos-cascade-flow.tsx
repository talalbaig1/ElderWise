"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  Check,
  CircleDashed,
  Stethoscope,
  UserRound,
  Users,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CASCADE_ROLE_META, formatSosClock } from "@/lib/sos";
import type { SOSCascadeRole, SOSCascadeStep } from "@/types";

const roleIcon: Record<SOSCascadeRole, typeof UserRound> = {
  loved_one: HeartHandshake,
  care_partner: UserRound,
  local_buddy: Users,
  family_doctor: Stethoscope,
};

function stepTone(status: SOSCascadeStep["status"]) {
  switch (status) {
    case "completed":
    case "acknowledged":
      return {
        ring: "border-success bg-success/10 text-success",
        line: "bg-success/50",
        badge: "bg-success/15 text-success",
      };
    case "notified":
      return {
        ring: "border-sos bg-sos-soft text-sos",
        line: "bg-sos/40",
        badge: "bg-sos-soft text-sos",
      };
    case "skipped":
      return {
        ring: "border-border bg-muted text-muted-foreground",
        line: "bg-border",
        badge: "bg-muted text-muted-foreground",
      };
    default:
      return {
        ring: "border-dashed border-border bg-card text-muted-foreground",
        line: "bg-border/70",
        badge: "bg-secondary text-muted-foreground",
      };
  }
}

export function SosCascadeFlow({
  steps,
  className,
}: {
  steps: SOSCascadeStep[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const Icon = roleIcon[step.role];
        const tone = stepTone(step.status);
        const isLive = step.status === "notified";
        return (
          <li key={step.role} className="relative flex gap-4">
            <div className="flex w-12 flex-col items-center">
              <motion.span
                animate={
                  reduceMotion || !isLive
                    ? undefined
                    : { scale: [1, 1.08, 1], boxShadow: ["0 0 0 0 rgba(184,67,58,0.35)", "0 0 0 10px rgba(184,67,58,0)", "0 0 0 0 rgba(184,67,58,0)"] }
                }
                transition={{ duration: 1.6, repeat: Infinity }}
                className={cn(
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2",
                  tone.ring,
                )}
              >
                {step.status === "completed" || step.status === "acknowledged" ? (
                  <Check className="h-5 w-5" />
                ) : step.status === "pending" ? (
                  <CircleDashed className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </motion.span>
              {index < steps.length - 1 ? (
                <span className={cn("my-1 w-0.5 flex-1 min-h-8 rounded-full", tone.line)} />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{step.label}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                    tone.badge,
                  )}
                >
                  {step.status}
                </span>
                {index < steps.length - 1 ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <ArrowDown className="h-3 w-3" />
                    next
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-foreground">{step.actorName}</p>
              <p className="text-xs text-muted-foreground">
                {CASCADE_ROLE_META[step.role].description}
              </p>
              {step.note ? (
                <p className="mt-2 text-sm text-muted-foreground">{step.note}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                {step.contact ? <span>{step.contact}</span> : null}
                {step.notifiedAt ? <span>Notified {formatSosClock(step.notifiedAt)}</span> : null}
                {step.acknowledgedAt ? (
                  <span>Ack {formatSosClock(step.acknowledgedAt)}</span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
