"use client";

import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCta } from "@/components/marketing/final-cta";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { marketingFaq } from "@/data/marketing";

const extraFaq = [
  {
    question: "Is SilaCare a medical device?",
    answer:
      "No. SilaCare supports family communication and routine monitoring. It does not provide medical diagnosis or replace professional care.",
  },
  {
    question: "What if my Loved One does not use WhatsApp?",
    answer:
      "SilaCare is built around WhatsApp-style check-ins because they feel familiar. Additional channels can be added later; WhatsApp remains the core experience today.",
  },
  {
    question: "Can I skip Local Buddy or Family Doctor during setup?",
    answer:
      "Yes. You can add them later. We recommend adding a Local Buddy when possible, because nearby support is invaluable during an SOS.",
  },
];

export default function FaqPage() {
  return (
    <>
      <MotionSection className="mx-auto max-w-3xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20">
        <MotionItem>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionHeading>Answers for Care Partners getting started.</SectionHeading>
          <SectionLead>
            If you still have questions, explore how SilaCare works or begin with a Care Partner
            account.
          </SectionLead>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </MotionItem>
      </MotionSection>

      <MotionSection className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <MotionItem>
          <FaqAccordion items={[...marketingFaq, ...extraFaq]} />
        </MotionItem>
      </MotionSection>

      <FinalCta
        title="Still wondering if SilaCare is right for your family?"
        description="Start with one Loved One and one routine. You can expand as confidence grows."
      />
    </>
  );
}
