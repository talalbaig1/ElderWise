import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_TERMS_VERSION } from "@/lib/consent-terms-version";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-4xl">Terms of Use</h1>
      <p className="mt-4 text-muted-foreground">
        Last updated: 26 July 2026 · Version {CONSENT_TERMS_VERSION}
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="font-display text-xl">Who you are agreeing with</h2>
          <p>Nobody, in the legal sense.</p>
          <p>
            SilaCares is a <strong>non-commercial student capstone project</strong> by Group 7 of
            Cohort 7 of the AI Generalist Fellowship.{" "}
            <strong>There is no registered company operating it</strong>, no contract of service
            is being offered, and no fee is being charged.
          </p>
          <p>
            These terms describe how the project is intended to be used and what you should not
            expect from it. They are a statement of intent, not a commercial agreement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Use it as a demonstration</h2>
          <p>
            SilaCares is built for coursework and demonstration. Please use test data. Do not
            enter real medical information, real home addresses, or the real WhatsApp number of an
            elderly person who has not clearly agreed to receive messages.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">No medical advice</h2>
          <p>
            SilaCares does not provide medical advice, diagnosis, or treatment, and is not a
            medical device. Nothing it displays or sends should be used to make a clinical
            decision. Medication reminders reflect only what a care partner typed in — they are
            not verified against any prescription, drug database, or clinician.
          </p>
          <p>
            <strong>Always consult a qualified healthcare professional.</strong> Never disregard
            or delay professional medical advice because of something SilaCares showed you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Not an emergency service</h2>
          <p>
            SOS alerts are WhatsApp messages sent to contacts you have named. Delivery is not
            guaranteed. Messages can be delayed, undelivered, or missed.
          </p>
          <p>
            <strong>
              SilaCares is not connected to emergency services and must not be relied upon in an
              emergency.
            </strong>{" "}
            Call your local emergency number.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Consent from the person being cared for</h2>
          <p>
            You must have the clear agreement of the elderly person before adding them. You are
            confirming that they have agreed to receive WhatsApp messages from SilaCares. Do not
            add someone who has not agreed, or who cannot meaningfully agree.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Your account and your data may be deleted</h2>
          <p>
            <strong>
              The project team may delete accounts and all associated data at any time, without
              notice and without recovery.
            </strong>{" "}
            The database is reset during development, and the project may be shut down entirely
            when the fellowship ends.
          </p>
          <p>Do not store anything in SilaCares that you would be upset to lose.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">No warranty</h2>
          <p>
            SilaCares is provided as-is, with no warranty of any kind. It may be unavailable,
            messages may not send, data may be lost, and features may change or disappear without
            notice. It is maintained by students alongside their coursework.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Third-party services</h2>
          <p>
            Using SilaCares means your messages pass through WhatsApp, operated by Meta, and are
            subject to Meta&apos;s own terms and policies. Other third-party services are listed in
            the Privacy Policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Acceptable use</h2>
          <p>
            Do not use SilaCares to harass, monitor, or contact anyone without their agreement; to
            send unlawful or harmful content; or to attempt to access another person&apos;s data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Changes</h2>
          <p>
            These terms may change as the project develops. Material changes come with a new
            version string, and you may be asked to re-confirm.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Contact</h2>
          <p>
            <strong>elderwise0@gmail.com</strong>
          </p>
        </section>

        <p className="text-xs italic leading-relaxed text-muted-foreground">
          SilaCares — AIGF Cohort 7, Group 7. A student capstone project.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/privacy" className="font-semibold text-primary hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/sign-up" className="font-semibold text-primary hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
