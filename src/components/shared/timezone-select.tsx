"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

type TimeZoneSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Offset-ordered select over the curated TIMEZONE_OPTIONS list.
 * First-letter type-ahead only (not filter search). Preserves any stored
 * value that is not in the curated list (e.g. legacy alias `Asia/Calcutta`) —
 * never silently rewrite it.
 */
export function TimeZoneSelect({ id, value, onChange, disabled }: TimeZoneSelectProps) {
  const commonValues = new Set<string>(COMMON_TIME_ZONES.map((o) => o.value));
  const inCommon = commonValues.has(value);
  const preserveLegacy = Boolean(value) && !inCommon;

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a time zone" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {preserveLegacy ? (
          <SelectGroup>
            <SelectLabel>Current (not in the list)</SelectLabel>
            <SelectItem value={value}>{value}</SelectItem>
          </SelectGroup>
        ) : null}
        <SelectGroup>
          <SelectLabel>Common</SelectLabel>
          {COMMON_TIME_ZONES.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
