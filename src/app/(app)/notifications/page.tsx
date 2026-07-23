"use client";

import { useMemo, useState } from "react";
import { Bell, Filter } from "lucide-react";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDomainStore } from "@/components/data/app-data-provider";
import type { NotificationCategory } from "@/types";

export default function NotificationsPage() {
  const { store, hydrated } = useDomainStore();
  const unread = store.notifications.filter((n) => !n.read).length;
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");

  const filtered = useMemo(() => {
    if (category === "all") return store.notifications;
    return store.notifications.filter((n) => n.category === category);
  }, [store.notifications, category]);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Inbox</p>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            Care Partner alerts from check-ins (ct_notifications). Mark-as-read is not
            stored yet — no read_at column on this table.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 font-mono">
          <Bell className="h-3.5 w-3.5" />
          {unread} unread
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Activity</CardTitle>
            <CardDescription>
              {filtered.length} of {store.notifications.length} notifications
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as "all" | NotificationCategory)}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sos">SOS</SelectItem>
                <SelectItem value="medication">Medication</SelectItem>
                <SelectItem value="meal">Meals</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="report">Reports</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationPanel items={filtered} />
        </CardContent>
      </Card>
    </div>
  );
}
