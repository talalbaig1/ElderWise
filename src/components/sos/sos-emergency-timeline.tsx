"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatSosClock, formatSosDateTime } from "@/lib/sos";
import type { SOSTimelineEntry } from "@/types";

const toneStyles: Record<
  SOSTimelineEntry["tone"],
  { dot: string; glow: string; chip: string }
> = {
  sos: {
    dot: "bg-sos",
    glow: "shadow-[0_0_0_6px_rgba(184,67,58,0.15)]",
    chip: "bg-sos-soft text-sos",
  },
  warn: {
    dot: "bg-warning",
    glow: "shadow-[0_0_0_6px_rgba(227,162,60,0.18)]",
    chip: "bg-warning/15 text-warning",
  },
  ok: {
    dot: "bg-success",
    glow: "shadow-[0_0_0_6px_rgba(92,140,107,0.18)]",
    chip: "bg-success/15 text-success",
  },
  info: {
    dot: "bg-primary",
    glow: "shadow-[0_0_0_6px_rgba(31,75,69,0.14)]",
    chip: "bg-secondary text-primary",
  },
  neutral: {
    dot: "bg-muted-foreground/50",
    glow: "",
    chip: "bg-muted text-muted-foreground",
  },
};

export function SosEmergencyTimeline({
  entries,
  className,
  live,
}: {
  entries: SOSTimelineEntry[];
  className?: string;
  live?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const sorted = [...entries].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  useEffect(() => {
    if (!live) return;
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [entries.length, live, reduceMotion]);

  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Timeline will appear when an SOS is triggered.
      </p>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-sos/50 via-primary/25 to-success/40" />
      <ol className="space-y-0">
        {sorted.map((entry, index) => {
          const tone = toneStyles[entry.tone];
          const isLatest = index === sorted.length - 1;
          return (
            <motion.li
              key={entry.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              <span
                className={cn(
                  "relative z-10 mt-1.5 flex h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-background",
                  tone.dot,
                  isLatest && live ? tone.glow : "",
                )}
              >
                {isLatest && live && !reduceMotion ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-40" />
                ) : null}
              </span>
              <div
                className={cn(
                  "min-w-0 flex-1 rounded-2xl border bg-card/80 p-3.5 shadow-[0_10px_30px_-22px_rgba(30,43,39,0.45)] backdrop-blur-sm",
                  isLatest && live && "border-sos/30",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{entry.title}</p>
                  <time className="font-mono text-[11px] text-muted-foreground">
                    {formatSosClock(entry.at)}
                  </time>
                </div>
                {entry.detail ? (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                      tone.chip,
                    )}
                  >
                    {entry.tone}
                  </span>
                  {entry.role ? (
                    <span className="text-[11px] text-muted-foreground">
                      {entry.role.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] text-muted-foreground/80">
                    {formatSosDateTime(entry.at)}
                  </span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
