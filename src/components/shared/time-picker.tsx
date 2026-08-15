"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  id?: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/** Native time input styled for SilaCares — accessible and mobile-friendly. */
export function TimePicker({
  id,
  label,
  value = "",
  onChange,
  className,
  disabled,
}: TimePickerProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div className="relative">
        <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          type="time"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="pl-10 font-mono"
        />
      </div>
    </div>
  );
}
