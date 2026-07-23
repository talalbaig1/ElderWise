"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";

/**
 * Read-only notification list for A2.3 Pass 1.
 * ct_notifications has no read_at column — mark-read is disabled (open schema decision).
 */
export function NotificationPanel({ items }: { items?: AppNotification[] }) {
  const list = items ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        title="No notifications yet"
        description="Check-ins, SOS alerts, and report updates will appear here."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {list.length} notification{list.length === 1 ? "" : "s"}
        </p>
        <Button variant="ghost" size="sm" disabled title="No read_at on ct_notifications">
          Mark all read (unavailable)
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Read receipts are not stored yet — open schema decision: add{" "}
        <code className="font-mono">read_at</code> vs defer to v2.
      </p>
      <Separator className="mb-2" />
      <ScrollArea className="h-[min(60vh,480px)] pr-3">
        <ul className="space-y-2">
          {list.map((item) => (
            <li key={item.id}>
              <div
                className={cn(
                  "w-full rounded-2xl border p-3 text-left",
                  "border-primary/30 bg-sage/40",
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <Badge variant="muted" className="font-mono capitalize">
                    {item.category}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <time className="font-mono text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </time>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
