"use client";

import Link from "next/link";
import {
  BookOpen,
  FileBarChart,
  HeartHandshake,
  MessageCircle,
  Pill,
  Shield,
  Siren,
  Users,
  Utensils,
} from "lucide-react";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingPhoto } from "@/components/marketing/marketing-photo";
import {
  MotionItem,
  MotionSection,
  SectionEyebrow,
  SectionHeading,
  SectionLead,
} from "@/components/marketing/section";
import { WhatsAppConversation } from "@/components/marketing/whatsapp-conversation";
import { Button } from "@/components/ui/button";
import { marketingFaq, testimonials } from "@/data/marketing";
import { marketingImages } from "@/data/marketing-images";

const howItWorks = [
  {
    step: "01",
    title: "Download & complete setup",
    text: "Create your Care Partner account, add your Loved One, and set their care circle in a few calm steps.",
  },
  {
    step: "02",
    title: "Everyday WhatsApp care begins",
    text: "Gentle notifications go out for medication, meals, and wellness — on the WhatsApp they already use.",
  },
  {
    step: "03",
    title: "They reply. You stay close.",
    text: "Simple answers update your Care Partner view, so distance no longer means guessing.",
  },
  {
    step: "04",
    title: "Reports show the bigger picture",
    text: "See how medication, meals, and wellbeing are going across the week — clear enough to share with family.",
  },
  {
    step: "05",
    title: "SOS reaches the Care Circle",
    text: "When something urgent happens, SilaCares alerts the Care Partner, Local Buddy, and Family Doctor together.",
  },
];

const benefits = [
  {
    icon: HeartHandshake,
    title: "Peace of mind, every day",
    text: "Know that morning medicine, meals, and wellness check-ins are happening — without another worried call.",
  },
  {
    icon: MessageCircle,
    title: "Care through WhatsApp",
    text: "Your Loved One stays in a familiar conversation. No new app for them to learn.",
  },
  {
    icon: Users,
    title: "A circle that shows up",
    text: "Care Partner, Local Buddy, and Family Doctor each have a clear role when support is needed.",
  },
  {
    icon: Shield,
    title: "Safety with warmth",
    text: "SOS and reports keep the family aligned — calmly, clearly, and with care.",
  },
];

const featureBlocks = [
  {
    id: "medication",
    icon: Pill,
    eyebrow: "Medication",
    title: "Reminders that feel personal, not clinical.",
    text: "Schedule doses and see taken, missed, or delayed replies as they arrive — so daily care stays gentle and clear.",
    image: marketingImages.medication,
  },
  {
    id: "meals",
    icon: Utensils,
    eyebrow: "Meals",
    title: "Gentle food check-ins through the day.",
    text: "Breakfast, lunch, dinner, or custom meals — with calm updates when something needs a follow-up.",
    image: marketingImages.meals,
  },
  {
    id: "health",
    icon: HeartHandshake,
    eyebrow: "Wellness",
    title: "Simple wellbeing questions, meaningful patterns.",
    text: "Sleep, mood, and everyday wellness help you notice changes early — without medical jargon.",
    image: marketingImages.wellness,
  },
  {
    id: "sos",
    icon: Siren,
    eyebrow: "SOS",
    title: "A clear path when urgency appears.",
    text: "Escalate to the Care Partner, Local Buddy, and Family Doctor. SilaCares supports coordination — always contact local emergency services in a crisis.",
    image: marketingImages.familyPhone,
  },
  {
    id: "voice",
    icon: BookOpen,
    eyebrow: "Voice Journal",
    title: "Hear how their day felt.",
    text: "Listen to reflections with thoughtful summaries and mood tags — never presented as a diagnosis.",
    image: marketingImages.careCircle,
  },
  {
    id: "reports",
    icon: FileBarChart,
    eyebrow: "Reports",
    title: "Shareable clarity for the people who care.",
    text: "Medication, meal, wellness, and combined wellbeing reports — ready to download, print, or share with family.",
    image: marketingImages.connection,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero — brand first, full-bleed emotional imagery */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <MarketingPhoto
          src={marketingImages.hero.src}
          alt={marketingImages.hero.alt}
          priority
          className="absolute inset-0"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1f1c]/92 via-[#0f1f1c]/70 to-[#0f1f1c]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f1c]/80 via-transparent to-[#0f1f1c]/40" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 lg:pb-24">
          <div className="max-w-2xl">
            <p className="font-display text-5xl tracking-tight text-white sm:text-6xl lg:text-7xl">
              SilaCares
            </p>
            <h1 className="mt-5 font-display text-2xl leading-snug text-white/95 sm:text-3xl lg:text-[2.15rem]">
              Remote caregiving for elders through WhatsApp — so family stays close to daily care.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Medication reminders, meal check-ins, wellness updates, and family support — gentle
              conversations that bring peace of mind, even from far away.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90"
              >
                <Link href="/sign-up">Start caring with SilaCares</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works — directly under hero */}
      <MotionSection
        id="how-it-works"
        className="border-b bg-[linear-gradient(180deg,#EFF2ED_0%,#F7F8F5_100%)] dark:bg-[linear-gradient(180deg,#15201d_0%,#121a18_100%)]"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <MotionItem>
            <SectionEyebrow>How it works</SectionEyebrow>
            <SectionHeading>From setup to everyday peace of mind.</SectionHeading>
            <SectionLead>
              Five simple steps — so you know exactly how SilaCares helps you care for someone you
              love.
            </SectionLead>
          </MotionItem>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {howItWorks.map((item, index) => (
              <MotionItem key={item.step}>
                <li className="relative flex h-full flex-col rounded-[1.5rem] border border-border/70 bg-card/90 p-5">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-3 font-display text-xl leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </li>
              </MotionItem>
            ))}
          </ol>
        </div>
      </MotionSection>

      {/* Why families choose SilaCares */}
      <MotionSection className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <MotionItem>
          <SectionEyebrow>Why families choose SilaCares</SectionEyebrow>
          <SectionHeading>Everyday reassurance, rooted in love.</SectionHeading>
          <SectionLead>
            Built for adult children and relatives who want to stay connected to a Loved One’s day —
            with warmth, not overwhelm.
          </SectionLead>
        </MotionItem>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <MotionItem key={item.title}>
                <div className="h-full">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </MotionItem>
            );
          })}
        </div>
      </MotionSection>

      {/* Problem */}
      <MotionSection className="relative overflow-hidden border-y">
        <MarketingPhoto
          src={marketingImages.familyPhone.src}
          alt={marketingImages.familyPhone.alt}
          className="absolute inset-0 opacity-[0.18]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-card/85" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <MotionItem>
            <SectionEyebrow>The quiet worry</SectionEyebrow>
            <SectionHeading>
              Caring from a distance should not feel like guessing.
            </SectionHeading>
            <SectionLead>
              Did they take their medicine? Did lunch happen? Is today a good day? SilaCares turns
              those unanswered questions into gentle WhatsApp check-ins and clear signals — so love
              can feel close again.
            </SectionLead>
          </MotionItem>
        </div>
      </MotionSection>

      {/* Features */}
      <div id="features" className="mx-auto max-w-6xl space-y-6 px-4 py-16 sm:px-6 sm:py-20">
        <MotionItem>
          <SectionEyebrow>Features</SectionEyebrow>
          <SectionHeading>Daily care, family support, and safety — together.</SectionHeading>
          <SectionLead>
            Medication, meals, wellness, SOS, Voice Journal, and reports — everything a Care Partner
            needs to stay present.
          </SectionLead>
        </MotionItem>

        {featureBlocks.map((block, index) => {
          const Icon = block.icon;
          const reverse = index % 2 === 1;
          return (
            <MotionSection
              key={block.id}
              id={block.id}
              className="grid items-stretch gap-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card lg:grid-cols-2"
            >
              <MotionItem
                className={`flex flex-col justify-center px-6 py-10 sm:px-10 ${reverse ? "lg:order-2" : ""}`}
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <SectionEyebrow className="mt-5">{block.eyebrow}</SectionEyebrow>
                <SectionHeading>{block.title}</SectionHeading>
                <SectionLead>{block.text}</SectionLead>
                <Button asChild variant="soft" className="mt-6 w-fit">
                  <Link href="/features">Explore features</Link>
                </Button>
              </MotionItem>
              <MotionItem className={reverse ? "lg:order-1" : undefined}>
                <MarketingPhoto
                  src={block.image.src}
                  alt={block.image.alt}
                  className="min-h-[240px] h-full w-full lg:min-h-[320px]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </MotionItem>
            </MotionSection>
          );
        })}
      </div>

      {/* Care Circle / Safety */}
      <MotionSection id="safety" className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <MotionItem>
            <SectionEyebrow className="text-white/60">Care Circle & safety</SectionEyebrow>
            <SectionHeading className="text-white">
              Everyone has a clear role when it matters.
            </SectionHeading>
            <SectionLead className="text-white/75">
              SilaCares connects the people around your Loved One — with language that feels human
              and responsibilities that stay clear.
            </SectionLead>
          </MotionItem>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Loved One",
                text: "Receives gentle WhatsApp check-ins and replies in their own words.",
              },
              {
                title: "Care Partner",
                text: "Builds routines, watches wellbeing, and stays informed from afar.",
              },
              {
                title: "Local Buddy",
                text: "A trusted nearby person who can respond in person during an SOS.",
              },
              {
                title: "Family Doctor",
                text: "A medical contact notified for urgent situations — not day-to-day noise.",
              },
            ].map((role) => (
              <MotionItem key={role.title}>
                <div className="h-full rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
                  <h3 className="font-display text-xl text-white">{role.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{role.text}</p>
                </div>
              </MotionItem>
            ))}
          </div>
        </div>
      </MotionSection>

      {/* WhatsApp conversation */}
      <MotionSection className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <MotionItem>
            <SectionEyebrow>Staying connected</SectionEyebrow>
            <SectionHeading>From reminder to reassurance in moments.</SectionHeading>
            <SectionLead>
              A medication check-in becomes a calm update — so you know how the morning is going
              without another worried phone call.
            </SectionLead>
            <ol className="mt-8 space-y-4">
              {[
                "A gentle reminder arrives at the right time",
                "Your Loved One replies “Yes”",
                "You see the update in your Care Partner view",
                "Peace of mind settles in",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </MotionItem>
          <MotionItem>
            <WhatsAppConversation />
          </MotionItem>
        </div>
      </MotionSection>

      {/* About / stories */}
      <MotionSection id="about" className="border-y bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <MotionItem>
            <SectionEyebrow>About SilaCares</SectionEyebrow>
            <SectionHeading>Families who want to stay close.</SectionHeading>
            <SectionLead>
              Real distance. Real love. A calmer way to keep showing up for the people you care for.
            </SectionLead>
          </MotionItem>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <MotionItem key={item.name}>
                <blockquote className="flex h-full flex-col rounded-[1.5rem] border bg-background p-6">
                  <p className="flex-1 font-display text-xl leading-snug text-foreground">
                    “{item.quote}”
                  </p>
                  <footer className="mt-6">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {item.role}
                    </p>
                  </footer>
                </blockquote>
              </MotionItem>
            ))}
          </div>
        </div>
      </MotionSection>

      {/* FAQ */}
      <MotionSection id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <MotionItem>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionHeading>Questions families ask first.</SectionHeading>
          <SectionLead>
            Clear answers about WhatsApp, Loved Ones, SOS, and reports.{" "}
            <Link
              href="/faq"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              View all FAQs
            </Link>
          </SectionLead>
        </MotionItem>
        <MotionItem className="mt-8">
          <FaqAccordion items={[...marketingFaq]} />
        </MotionItem>
      </MotionSection>

      <FinalCta
        eyebrow="Begin with calm confidence"
        title="Stay close to their everyday care."
        description="Create your Care Partner account, set up your Loved One, and start receiving gentle WhatsApp updates that bring peace of mind."
      />
    </>
  );
}
