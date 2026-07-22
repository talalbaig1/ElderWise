"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/shared/progress-ring";
import { cn, formatPercent } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: number;
  progress?: number;
  tone?: "default" | "success" | "warning" | "sos" | "medication" | "meals" | "health";
  onClick?: () => void;
  className?: string;
}

const toneMap = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  sos: "text-sos",
  medication: "text-[#2F6FED]",
  meals: "text-[#2F9E6B]",
  health: "text-[#D97706]",
};

const iconToneMap = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  sos: "text-sos",
  medication: "text-[#2F6FED]",
  meals: "text-[#2F9E6B]",
  health: "text-[#D97706]",
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  tone = "default",
  onClick,
  className,
}: MetricCardProps) {
  const reduceMotion = useReducedMotion();
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      whileHover={reduceMotion || !onClick ? undefined : { y: -3 }}
      className={cn("w-full text-left", className)}
    >
      <Card className="h-full transition-shadow hover:shadow-[0_12px_36px_-18px_rgba(31,75,69,0.45)]">
        <CardContent className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              {Icon ? <Icon className={cn("h-4 w-4", iconToneMap[tone])} /> : null}
              <span>{title}</span>
            </div>
            <div className="font-mono text-3xl font-semibold tracking-tight" data-metric>
              {typeof value === "number" && title.toLowerCase().includes("%")
                ? formatPercent(value)
                : value}
            </div>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            {typeof trend === "number" ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs",
                  trend >= 0 ? "bg-success/15 text-success" : "bg-sos-soft text-sos",
                )}
              >
                {trend >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(trend)}% vs prior
              </div>
            ) : null}
          </div>
          {typeof progress === "number" ? (
            <ProgressRing value={progress} size={72} className={toneMap[tone]} />
          ) : null}
        </CardContent>
      </Card>
    </Comp>
  );
}
