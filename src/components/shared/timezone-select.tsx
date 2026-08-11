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
import { ALL_TIME_ZONES, COMMON_TIME_ZONES } from "@/lib/timezone";

type TimeZoneSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Searchable-enough select over COMMON quick picks + full IANA list.
 * Preserves a stored value even when it is absent from ALL_TIME_ZONES
 * (e.g. legacy alias `Asia/Calcutta`) — never silently rewrite it.
 */
export function TimeZoneSelect({ id, value, onChange, disabled }: TimeZoneSelectProps) {
  const commonValues = new Set(COMMON_TIME_ZONES.map((o) => o.value));
  const inAll = ALL_TIME_ZONES.includes(value);
  const inCommon = commonValues.has(value);
  const preserveLegacy = Boolean(value) && !inAll && !inCommon;

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a time zone" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {preserveLegacy ? (
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
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
        <SelectGroup>
          <SelectLabel>All time zones</SelectLabel>
          {ALL_TIME_ZONES.filter((tz) => !commonValues.has(tz)).map((tz) => (
            <SelectItem key={tz} value={tz}>
              {tz}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
