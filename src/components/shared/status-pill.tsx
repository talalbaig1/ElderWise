import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CheckInStatus, SOSStatus, WellbeingStatus } from "@/types";

type StatusTone = NonNullable<BadgeProps["variant"]>;

interface StatusMeta {
  label: string;
  variant: StatusTone;
}

const checkInMap: Record<CheckInStatus, StatusMeta> = {
  taken: { label: "Taken", variant: "success" },
  missed: { label: "Missed", variant: "destructive" },
  delayed: { label: "Delayed", variant: "warning" },
  upcoming: { label: "Upcoming", variant: "info" },
  pending: { label: "Pending", variant: "warning" },
  skipped: { label: "Skipped", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const wellbeingMap: Record<WellbeingStatus, StatusMeta> = {
  stable: { label: "Stable", variant: "success" },
  attention: { label: "Needs attention", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
  unknown: { label: "Unknown", variant: "muted" },
};

const sosMap: Record<SOSStatus, StatusMeta> = {
  active: { label: "Active", variant: "destructive" },
  acknowledged: { label: "Acknowledged", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

type StatusPillProps =
  | { kind: "checkin"; status: CheckInStatus; className?: string }
  | { kind: "wellbeing"; status: WellbeingStatus; className?: string }
  | { kind: "sos"; status: SOSStatus; className?: string };

export function StatusPill(props: StatusPillProps) {
  const entry =
    props.kind === "checkin"
      ? checkInMap[props.status]
      : props.kind === "wellbeing"
        ? wellbeingMap[props.status]
        : sosMap[props.status];

  return (
    <Badge variant={entry.variant} className={cn("font-mono", props.className)}>
      {entry.label}
    </Badge>
  );
}
