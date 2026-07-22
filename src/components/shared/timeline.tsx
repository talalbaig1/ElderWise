import type { LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { CheckInStatus } from "@/types";

export interface TimelineItem {
  id: string;
  title: string;
  time: string;
  status?: CheckInStatus;
  icon?: LucideIcon;
  description?: string;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function Timeline({ items, className, orientation = "vertical" }: TimelineProps) {
  if (orientation === "horizontal") {
    return (
      <ol className={cn("flex gap-4 overflow-x-auto pb-2", className)}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="min-w-[180px] rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                {Icon ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                ) : null}
                <time className="font-mono text-xs text-muted-foreground">{item.time}</time>
              </div>
              <p className="text-sm font-semibold">{item.title}</p>
              {item.status ? (
                <div className="mt-2">
                  <StatusPill kind="checkin" status={item.status} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 py-3",
              index < items.length - 1 && "border-b border-border/70",
            )}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              {Icon ? <Icon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.status ? <StatusPill kind="checkin" status={item.status} /> : null}
              </div>
              <time className="font-mono text-xs text-muted-foreground">{item.time}</time>
              {item.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
