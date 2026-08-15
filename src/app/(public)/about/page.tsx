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

export default function AboutPage() {
  return (
    <>
      <MotionSection className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <MotionItem>
          <SectionEyebrow>About SilaCares</SectionEyebrow>
          <SectionHeading>Built for the love that stretches across distance.</SectionHeading>
          <SectionLead>
            SilaCares exists for adult children and families who want to stay present in a Loved
            One’s everyday wellbeing — medication, meals, mood, and moments that matter — without
            turning care into a hospital portal.
          </SectionLead>
        </MotionItem>
      </MotionSection>

      <MotionSection className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <MotionItem>
            <div className="rounded-[2rem] border bg-card p-8 sm:p-10">
              <p className="font-display text-2xl leading-snug text-foreground sm:text-3xl">
                Everyday reassurance for the people who matter most.
              </p>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                We believe technology should feel warm, calm, and trustworthy when families are
                already carrying enough. SilaCares uses familiar WhatsApp conversations, clear Care
                Partner dashboards, and honest safety language so support stays human.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/sign-up">Get Started</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/safety">Our safety stance</Link>
                </Button>
              </div>
            </div>
          </MotionItem>
          <MotionItem>
            <div className="flex h-full flex-col justify-between rounded-[2rem] bg-primary p-8 text-primary-foreground sm:p-10">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
                  Brand promise
                </p>
                <p className="mt-4 font-display text-3xl leading-tight">
                  Staying close, from a distance.
                </p>
              </div>
              <p className="mt-10 text-sm leading-relaxed text-white/75">
                SilaCares helps Care Partners coordinate routines, receive WhatsApp responses, and
                mobilise a trusted Care Circle — so remote caregiving stays warm, clear, and close.
              </p>
            </div>
          </MotionItem>
        </div>
      </MotionSection>

      <MotionSection className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <MotionItem>
            <SectionEyebrow>Our principles</SectionEyebrow>
            <SectionHeading>Warm. Premium. Calm. Human.</SectionHeading>
          </MotionItem>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Warm", "Language and colour that feel like care, not clinics."],
              ["Premium", "Polished interactions worthy of the people you love."],
              ["Calm", "Clear hierarchy, soft motion, and no unnecessary alarm."],
              ["Human", "Roles and words families already understand."],
            ].map(([title, text]) => (
              <MotionItem key={title}>
                <div className="rounded-2xl border bg-background p-5">
                  <h3 className="font-display text-xl">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                </div>
              </MotionItem>
            ))}
          </div>
        </div>
      </MotionSection>

      <FinalCta />
    </>
  );
}
