"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock3, Pill, Utensils } from "lucide-react";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatusPill } from "@/components/shared/status-pill";

export function DashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <div
      className="relative w-full overflow-hidden rounded-none border-y border-primary/10 bg-gradient-to-br from-[#1F4B45] via-[#2A5F57] to-[#1A3D38] text-primary-foreground shadow-[0_40px_80px_-40px_rgba(31,75,69,0.65)] sm:rounded-[2rem] sm:border"
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,232,228,0.18),transparent_55%)]" />
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:p-10">
        <div className="space-y-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
              Care Partner dashboard
            </p>
            <p className="mt-2 font-display text-2xl text-white sm:text-3xl">
              Good morning, Sama.
            </p>
            <p className="mt-1 text-sm text-white/70">
              Here is how Fatima is doing today.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Medication", value: 92, tone: "text-[#B8D4C4]" },
              { label: "Meals", value: 100, tone: "text-[#DCE8E4]" },
              { label: "Health", value: 75, tone: "text-[#F0D9A8]" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm"
              >
                <ProgressRing
                  value={item.value}
                  size={64}
                  strokeWidth={7}
                  className={item.tone}
                  trackClassName="stroke-white/15"
                />
                <p className="mt-2 text-center text-xs font-semibold text-white/85">
                  {item.label}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-[#DCE8E4]/15 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5C8C6B] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#5C8C6B]" />
            </span>
            <p className="text-sm text-white/85">No active emergency alerts</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#EFF2ED] p-4 text-foreground shadow-inner sm:p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Today&apos;s timeline
          </p>
          <ul className="mt-4 space-y-3">
            {[
              {
                icon: Pill,
                title: "Metformin confirmed",
                time: "8:04 AM",
                status: "taken" as const,
              },
              {
                icon: Utensils,
                title: "Breakfast check-in",
                time: "9:11 AM",
                status: "taken" as const,
              },
              {
                icon: Clock3,
                title: "Wellness check-in",
                time: "1:00 PM",
                status: "pending" as const,
              },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <li
                  key={row.title}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.time}</p>
                  </div>
                  <StatusPill kind="checkin" status={row.status} />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-sage/70 px-3 py-2 text-sm text-primary">
            <Check className="h-4 w-4 shrink-0" />
            WhatsApp reply received — Yes
          </div>
        </div>
      </div>
    </div>
  );
}
