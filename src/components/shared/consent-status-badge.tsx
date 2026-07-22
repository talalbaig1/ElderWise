import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LovedOne } from "@/types";

/**
 * Read-only display of elder WhatsApp consent (M16 layer b).
 * Consent is for the Loved One only — never Care Partner / Buddy / Doctor.
 *
 * TODO(backend): consentConfirmedAt is set by the n8n WhatsApp flow when the
 * elder responds "Yes" to the welcome message. Until then it stays null and
 * NO check-ins are scheduled. Front end only displays this status.
 */
export function ConsentStatusBadge({
  lovedOne,
  className,
}: {
  lovedOne: Pick<LovedOne, "consentConfirmedAt">;
  className?: string;
}) {
  const confirmedAt = lovedOne.consentConfirmedAt;

  if (confirmedAt) {
    const dateLabel = (() => {
      try {
        return new Date(confirmedAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      } catch {
        return confirmedAt.slice(0, 10);
      }
    })();

    return (
      <Badge variant="success" className={cn("font-mono", className)}>
        ✓ Consent confirmed · {dateLabel}
      </Badge>
    );
  }

  return (
    <Badge variant="muted" className={cn("font-mono", className)}>
      ⏳ Awaiting WhatsApp confirmation
    </Badge>
  );
}
