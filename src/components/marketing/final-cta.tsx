"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";

interface FinalCtaProps {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function FinalCta({
  eyebrow = "Ready when you are",
  title = "Stay close to their everyday care.",
  description = "Create a Care Partner account, add your Loved One, and build a routine that feels human, not clinical.",
}: FinalCtaProps) {
  return (
    <MotionSection className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(220,232,228,0.22),transparent_50%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <MotionItem>
          <SectionEyebrow className="text-white/60">{eyebrow}</SectionEyebrow>
          <SectionHeading className="text-white">{title}</SectionHeading>
          <SectionLead className="text-white/75">{description}</SectionLead>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white text-primary hover:bg-white/90"
            >
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/35 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </MotionItem>
      </div>
    </MotionSection>
  );
}

