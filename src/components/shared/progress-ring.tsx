"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn, formatPercent } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  label?: string;
  showValue?: boolean;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 8,
  className,
  trackClassName,
  label,
  showValue = true,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={label ?? `Progress ${formatPercent(clamped)}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-[#E4E8E1] dark:stroke-border", trackClassName)}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn("stroke-current text-primary", className)}
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      {showValue ? (
        <span className="absolute font-mono text-sm font-semibold" data-metric>
          {formatPercent(clamped)}
        </span>
      ) : null}
    </div>
  );
}
