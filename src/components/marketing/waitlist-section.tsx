"use client";

import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { cn } from "@/lib/utils";

interface WaitlistSectionProps {
  className?: string;
  /** Compact page layout (e.g. /waitlist) vs full homepage band */
  variant?: "band" | "page";
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function WaitlistSection({
  className,
  variant = "band",
  eyebrow = "Waitlist",
  title = "Join the SilaCares waitlist.",
  description = "Leave your details and we’ll reach out by email and WhatsApp. Built for Care Partners who want to stay close from a distance.",
}: WaitlistSectionProps) {
  if (variant === "page") {
    return (
      <MotionSection
        className={cn("mx-auto max-w-xl px-4 pb-20 pt-16 sm:px-6 sm:pt-20", className)}
      >
        <MotionItem>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <SectionHeading>{title}</SectionHeading>
          <SectionLead>{description}</SectionLead>
        </MotionItem>
        <MotionItem className="mt-10">
          <div className="rounded-[1.75rem] border border-border bg-white p-6 text-foreground shadow-sm sm:p-8">
            <WaitlistForm />
          </div>
        </MotionItem>
      </MotionSection>
    );
  }

  return (
    <MotionSection
      className={cn(
        "relative overflow-hidden bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(220,232,228,0.22),transparent_50%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <MotionItem>
          <SectionEyebrow className="text-white/60">{eyebrow}</SectionEyebrow>
          <SectionHeading className="text-white">{title}</SectionHeading>
          <SectionLead className="text-white/75">{description}</SectionLead>
        </MotionItem>
        <MotionItem>
          {/* Isolate from primary-foreground so labels/inputs stay dark on white */}
          <div className="rounded-[1.75rem] border border-border/70 bg-white p-6 text-foreground shadow-[0_24px_60px_-36px_rgba(15,31,28,0.45)] sm:p-8">
            <WaitlistForm />
          </div>
        </MotionItem>
      </div>
    </MotionSection>
  );
}
