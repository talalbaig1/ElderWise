"use client";

import Link from "next/link";
import { Phone, ShieldAlert, Users } from "lucide-react";
import { FinalCta } from "@/components/marketing/final-cta";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export default function SafetyPage() {
  return (
    <>
      <MotionSection className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <MotionItem>
          <SectionEyebrow>Safety</SectionEyebrow>
          <SectionHeading>Clear escalation. Honest limits. Human support.</SectionHeading>
          <SectionLead>
            SilaCares helps families coordinate when something feels urgent — while staying clear
            that we are not a replacement for emergency services or medical professionals.
          </SectionLead>
        </MotionItem>
      </MotionSection>

      <MotionSection className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: ShieldAlert,
              title: "SOS escalation",
              text: "When an SOS is triggered, SilaCares notifies the Care Partner, Local Buddy, and Family Doctor in the Loved One’s care circle.",
            },
            {
              icon: Users,
              title: "Trusted people, clear roles",
              text: "Local Buddies can respond nearby. Care Partners stay informed remotely. Doctors are reserved for urgent situations.",
            },
            {
              icon: Phone,
              title: "Always call local emergency services",
              text: "In a real emergency, contact local emergency services immediately. SilaCares supports family communication — it does not replace 911 or equivalent services.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <MotionItem key={item.title}>
                <article className="h-full rounded-[1.5rem] border bg-card p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sos-soft text-sos">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </article>
              </MotionItem>
            );
          })}
        </div>
      </MotionSection>

      <MotionSection className="border-y bg-card/70">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <MotionItem>
            <SectionEyebrow>Important disclaimers</SectionEyebrow>
            <SectionHeading>What SilaCares is — and is not.</SectionHeading>
            <ul className="mt-8 space-y-4 text-muted-foreground">
              <li className="rounded-2xl border bg-background px-5 py-4 text-sm leading-relaxed">
                SilaCares supports family communication and routine monitoring.
              </li>
              <li className="rounded-2xl border bg-background px-5 py-4 text-sm leading-relaxed">
                SilaCares is not a substitute for professional medical advice, diagnosis, or treatment.
              </li>
              <li className="rounded-2xl border bg-background px-5 py-4 text-sm leading-relaxed">
                Voice Journal mood summaries are reflective aids, not clinical conclusions.
              </li>
              <li className="rounded-2xl border border-sos/20 bg-sos-soft/60 px-5 py-4 text-sm leading-relaxed text-foreground">
                In a real emergency, contact local emergency services first.
              </li>
            </ul>
            <Button asChild className="mt-8" variant="outline">
              <Link href="/faq">Read FAQs</Link>
            </Button>
          </MotionItem>
        </div>
      </MotionSection>

      <FinalCta
        title="Care with clarity and care with honesty."
        description="Set up a trusted circle so the right people know when to step in."
      />
    </>
  );
}
