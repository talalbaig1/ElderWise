"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";

const TIMESTAMP_COLUMNS = new Set([
  "scheduled_for",
  "sent_at",
  "responded_at",
  "reminder_sent_at",
  "missed_at",
  "cancelled_at",
  "triggered_at",
  "resolved_at",
  "created_at",
  "expires_at",
  "revoked_at",
  "last_accessed_at",
  "consent_requested_at",
  "consent_confirmed_at",
  "consent_declined_at",
  "start_date",
  "end_date",
]);

function isTimestampColumn(column: string): boolean {
  return TIMESTAMP_COLUMNS.has(column) || column.endsWith("_at");
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatElderLocal(iso: string, timezone: string | null): string | null {
  if (!timezone) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "medium",
      hour12: false,
    }).format(date);
  } catch {
    return null;
  }
}

export type VerifyResultsProps = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  ranAt: string;
  elderTimezone: string | null;
};

export function VerifyResultsTable({
  columns,
  rows,
  rowCount,
  ranAt,
  elderTimezone,
}: VerifyResultsProps) {
  const copyAsText = useCallback(() => {
    const header = columns.join("\t");
    const body = rows
      .map((row) => columns.map((col) => formatCellValue(row[col])).join("\t"))
      .join("\n");
    const footer = `\n\nrowCount: ${rowCount}\nranAt: ${ranAt}`;
    void navigator.clipboard.writeText(`${header}\n${body}${footer}`);
  }, [columns, rows, rowCount, ranAt]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rowCount} row{rowCount === 1 ? "" : "s"} · ran at{" "}
          <span className="font-mono text-foreground">{ranAt}</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={copyAsText}>
          Copy as text
        </Button>
      </div>

      {rowCount === 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          Zero rows. This can mean the row does not exist{" "}
          <strong>or</strong> that row-level security refused it. These are
          indistinguishable here. Confirm with a check you know should return
          data before treating this as a pass.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-max border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/60 last:border-0 odd:bg-card even:bg-secondary/20"
              >
                {columns.map((col) => {
                  const value = row[col];
                  const isNull = value === null || value === undefined;
                  const raw = formatCellValue(value);
                  const localLine =
                    !isNull &&
                    typeof value === "string" &&
                    isTimestampColumn(col)
                      ? formatElderLocal(value, elderTimezone)
                      : null;

                  return (
                    <td key={col} className="align-top px-3 py-2 text-foreground">
                      {isNull ? (
                        <span className="font-semibold text-destructive">NULL</span>
                      ) : (
                        <div className="space-y-0.5">
                          <span>{raw}</span>
                          {localLine ? (
                            <div className="text-[10px] text-muted-foreground">
                              {elderTimezone}: {localLine}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
