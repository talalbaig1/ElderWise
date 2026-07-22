"use client";

import Link from "next/link";
import {
  BookOpen,
  FileBarChart,
  HeartHandshake,
  MessageCircle,
  Pill,
  Siren,
  Users,
  Utensils,
} from "lucide-react";
import { FinalCta } from "@/components/marketing/final-cta";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Pill,
    title: "Medication reminders",
    text: "Schedule doses, customise WhatsApp wording, and track taken, missed, or delayed replies.",
  },
  {
    icon: Utensils,
    title: "Meal check-ins",
    text: "Breakfast through dinner — or custom snacks — with escalation when there’s no response.",
  },
  {
    icon: HeartHandshake,
    title: "Health & wellness updates",
    text: "Sleep, mood, blood pressure, water, exercise, and custom questions that fit their day.",
  },
  {
    icon: Siren,
    title: "SOS emergency circle",
    text: "Notify Care Partner, Local Buddy, and Family Doctor together when urgency appears.",
  },
  {
    icon: BookOpen,
    title: "Voice Journal",
    text: "Capture how their day felt with summaries and mood tags — never framed as a diagnosis.",
  },
  {
    icon: FileBarChart,
    title: "Family reports",
    text: "View and download medication, meal, health, SOS, and combined wellbeing reports.",
  },
  {
    icon: Users,
    title: "Multiple Loved Ones",
    text: "Support more than one person from a single Care Partner account with clear switching.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp communication",
    text: "Your Loved One replies with Yes, No, or Remind me later — no new app required.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <MotionSection className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20">
        <MotionItem>
          <SectionEyebrow>Features</SectionEyebrow>
          <SectionHeading>Everything you need to stay gently informed.</SectionHeading>
          <SectionLead>
            ElderWise combines routines, WhatsApp check-ins, emergency coordination, and clear
            reports — with a calm design made for Care Partners.
          </SectionLead>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </MotionItem>
      </MotionSection>

      <MotionSection className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <MotionItem key={feature.title}>
                <article className="group h-full rounded-[1.5rem] border border-border/80 bg-card p-6 transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(31,75,69,0.45)]">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary transition-transform group-hover:-translate-y-0.5">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </article>
              </MotionItem>
            );
          })}
        </div>
      </MotionSection>

      <FinalCta
        title="Build a care rhythm that feels human."
        description="Start with one Loved One, one routine, and a WhatsApp conversation that already feels familiar."
      />
    </>
  );
}
