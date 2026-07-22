"use client";

import Link from "next/link";
import { FinalCta } from "@/components/marketing/final-cta";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

const steps = [
  {
    step: "01",
    title: "Download & complete setup",
    text: "Create your Care Partner account, add your Loved One, and invite the people in their Care Circle.",
  },
  {
    step: "02",
    title: "Everyday WhatsApp care begins",
    text: "Medication, meal, and wellness notifications arrive on WhatsApp — familiar, gentle, and on time.",
  },
  {
    step: "03",
    title: "They reply. You stay close.",
    text: "Simple answers update your Care Partner view so you know how the day is going without guessing.",
  },
  {
    step: "04",
    title: "Reports show the bigger picture",
    text: "Review medication, meals, and wellbeing over time — clear enough to share with family.",
  },
  {
    step: "05",
    title: "SOS reaches the Care Circle",
    text: "When something urgent happens, ElderWise alerts the Care Partner, Local Buddy, and Family Doctor together.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <MotionSection className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <MotionItem>
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHeading>From setup to everyday peace of mind.</SectionHeading>
          <SectionLead>
            ElderWise is remote caregiving for elders through WhatsApp — a guided journey from
            first setup to daily reassurance, reports, and SOS support.
          </SectionLead>
        </MotionItem>
      </MotionSection>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <ol className="relative space-y-6">
          <div
            className="absolute bottom-6 left-[1.65rem] top-6 hidden w-px bg-border sm:block"
            aria-hidden
          />
          {steps.map((item, index) => (
            <MotionSection key={item.step}>
              <MotionItem>
                <li className="relative grid gap-4 rounded-[1.75rem] border bg-card p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
                  <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                    <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary font-mono text-sm font-semibold text-primary-foreground">
                      {item.step}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:hidden">
                      Step {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-1 font-display text-2xl sm:text-3xl">{item.title}</h3>
                    <p className="mt-3 max-w-2xl text-muted-foreground">{item.text}</p>
                  </div>
                </li>
              </MotionItem>
            </MotionSection>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start caring with ElderWise</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/features">Explore features</Link>
          </Button>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
