"use client";

import { cn } from "@/lib/utils";
import {
  DAYS,
  NOT_REQUIRED_WARNING_FOOD,
  NOT_REQUIRED_WARNING_HEALTH,
  NOT_REQUIRED_WARNING_MEDICATION,
  type NotifyCarePartnerMode,
} from "@/lib/onboarding";
import {
  normalizeWhatsAppNumber,
  validateOptionalWhatsAppNumber,
  validateRequiredWhatsAppNumber,
  WHATSAPP_E164_ERROR,
} from "@/lib/whatsapp-e164";
import type { DayOfWeek } from "@/types";
import { Input } from "@/components/ui/input";

export function DayChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (days: DayOfWeek[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map((day) => {
        const selected = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => {
              const next = selected
                ? value.filter((d) => d !== day.value)
                : [...value, day.value];
              onChange(next as DayOfWeek[]);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-secondary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const NOTIFY_SELECT_OPTIONS: { value: NotifyCarePartnerMode; label: string }[] = [
  { value: "every_time", label: "Every time" },
  { value: "only_missed", label: "Only if missed" },
  { value: "not_required", label: "Not required" },
];

/** Settings / legacy segmented control — three notify modes. */
export function SegmentedNotify({
  value,
  onChange,
}: {
  value: NotifyCarePartnerMode;
  onChange: (value: NotifyCarePartnerMode) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border">
      {NOTIFY_SELECT_OPTIONS.map(({ value: key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 px-2 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm",
            value === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Inline Not Required warning. Each variant reads only its own constant —
 * medication / food / health never share or fall back to another card's copy.
 */
export function NotRequiredWarning({
  variant,
}: {
  variant: "medication" | "food" | "health";
}) {
  switch (variant) {
    case "medication":
      return <p className="text-sm text-muted-foreground">{NOT_REQUIRED_WARNING_MEDICATION}</p>;
    case "food":
      return <p className="text-sm text-muted-foreground">{NOT_REQUIRED_WARNING_FOOD}</p>;
    case "health":
      return <p className="text-sm text-muted-foreground">{NOT_REQUIRED_WARNING_HEALTH}</p>;
  }
}

export function WhatsAppPreview({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
        {title}
      </div>
      <div className="bg-[#E9EDE3] p-3 dark:bg-[#1a2421]">
        <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#DCF8C6] px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm dark:bg-[#2a4034]">
          {message}
          <span className="mt-1 block text-right font-mono text-[10px] text-[#6b8f6f]">
            Preview ✓✓
          </span>
        </div>
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-sos">{message}</p>;
}

export function WhatsAppNumberInput({
  id,
  value,
  onChange,
  onBlurError,
  error,
  optional = false,
  placeholder = "+966569362418",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlurError?: (message?: string) => void;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (value.trim() === "") {
            if (optional) {
              onBlurError?.(undefined);
            } else {
              const result = validateRequiredWhatsAppNumber("");
              onBlurError?.(result.ok ? undefined : result.error);
            }
            return;
          }

          const normalized = normalizeWhatsAppNumber(value);
          if (normalized === null) {
            onBlurError?.(WHATSAPP_E164_ERROR);
            return;
          }

          if (normalized !== value) {
            onChange(normalized);
          }

          if (optional) {
            const result = validateOptionalWhatsAppNumber(normalized);
            onBlurError?.(result.ok ? undefined : result.error);
            return;
          }

          const result = validateRequiredWhatsAppNumber(normalized);
          onBlurError?.(result.ok ? undefined : result.error);
        }}
      />
      <FieldError message={error} />
    </div>
  );
}
