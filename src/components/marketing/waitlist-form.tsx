"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitWaitlist } from "@/lib/waitlist";
import {
  caringForOptions,
  waitlistSchema,
  type WaitlistValues,
} from "@/lib/waitlist-schema";
import { cn } from "@/lib/utils";

const caringForLabels: Record<(typeof caringForOptions)[number], string> = {
  parent: "Parent",
  spouse: "Spouse / partner",
  other: "Someone else",
};

interface WaitlistFormProps {
  className?: string;
}

export function WaitlistForm({ className }: WaitlistFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      whatsapp: "",
      caringFor: "",
      location: "",
      consent: false,
      whatsappSameAsPhone: true,
    },
  });

  const phone = watch("phone");
  const whatsappSameAsPhone = watch("whatsappSameAsPhone");
  const consent = watch("consent");

  useEffect(() => {
    if (whatsappSameAsPhone) {
      setValue("whatsapp", phone || "", { shouldValidate: false });
    }
  }, [phone, whatsappSameAsPhone, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitWaitlist(values);
    if (!result.ok) {
      setFormError(result.error);
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
    toast.success("You’re on the waitlist", {
      description: "We’ll be in touch by email and WhatsApp.",
    });
  });

  if (submitted) {
    return (
      <div
        className={cn("rounded-[1.5rem] border border-border bg-white p-6 text-foreground sm:p-8", className)}
        role="status"
      >
        <p className="font-display text-2xl leading-snug text-primary">
          You’re on the list.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Thank you for joining the SilaCares waitlist. We’ll confirm by email and WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-5 text-foreground", className)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="waitlist-fullName" className="text-foreground">
          Full name
        </Label>
        <Input
          id="waitlist-fullName"
          autoComplete="name"
          className="bg-white text-foreground"
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-xs text-sos">{errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-email" className="text-foreground">
          Email
        </Label>
        <Input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="bg-white text-foreground"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-sos">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-phone" className="text-foreground">
            Phone
          </Label>
          <Input
            id="waitlist-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+91…"
            className="bg-white text-foreground"
            {...register("phone")}
          />
          {errors.phone ? (
            <p className="text-xs text-sos">{errors.phone.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-whatsapp" className="text-foreground">
            WhatsApp
          </Label>
          <Input
            id="waitlist-whatsapp"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+91…"
            className="bg-white text-foreground"
            disabled={whatsappSameAsPhone}
            {...register("whatsapp")}
          />
          {errors.whatsapp ? (
            <p className="text-xs text-sos">{errors.whatsapp.message}</p>
          ) : null}
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={Boolean(whatsappSameAsPhone)}
          onCheckedChange={(checked) =>
            setValue("whatsappSameAsPhone", checked === true, {
              shouldValidate: true,
            })
          }
          className="mt-0.5"
        />
        <span>WhatsApp number is the same as phone</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-caringFor" className="text-foreground">
            Who are you caring for?{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <select
            id="waitlist-caringFor"
            className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("caringFor")}
          >
            <option value="">Select…</option>
            {caringForOptions.map((value) => (
              <option key={value} value={value}>
                {caringForLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-location" className="text-foreground">
            City / country{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="waitlist-location"
            autoComplete="address-level2"
            placeholder="e.g. Mumbai, India"
            className="bg-white text-foreground"
            {...register("location")}
          />
          {errors.location ? (
            <p className="text-xs text-sos">{errors.location.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox
            checked={Boolean(consent)}
            onCheckedChange={(checked) =>
              setValue("consent", checked === true, { shouldValidate: true })
            }
            className="mt-0.5"
            aria-invalid={Boolean(errors.consent)}
          />
          <span className="leading-relaxed">
            I agree to be contacted by SilaCares by email and WhatsApp about early access.
          </span>
        </label>
        {errors.consent ? (
          <p className="text-xs text-sos">{errors.consent.message}</p>
        ) : null}
      </div>

      {formError ? (
        <div className="rounded-xl bg-sos-soft px-3 py-2 text-sm text-sos" role="alert">
          {formError}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
