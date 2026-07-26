import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_TERMS_VERSION } from "@/lib/consent-terms-version";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-4xl">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">
        Last updated: 26 July 2026 · Version {CONSENT_TERMS_VERSION}
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="font-display text-xl">What ElderWise is</h2>
          <p>
            ElderWise is a <strong>non-commercial student capstone project</strong> built by
            Group 7 of Cohort 7 of the AI Generalist Fellowship (AIGF), an educational programme
            run by Outskill.
          </p>
          <p>
            There is <strong>no registered company</strong> behind ElderWise. It is operated by
            the project team as coursework. It is not a business, not a commercial service, and
            not a product you are purchasing or subscribing to.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Please do not enter real health information</h2>
          <p>
            ElderWise is a <strong>demonstration project</strong>. It has not been
            security-audited, it carries no uptime or data-protection guarantees, and it is
            maintained by students as part of a time-limited course.
          </p>
          <p>
            <strong>
              Please do not enter real medical information, real home addresses, or the real
              WhatsApp number of an elderly person who has not clearly agreed to it.
            </strong>{" "}
            Use test data wherever you can.
          </p>
          <p>
            <strong>
              Your account and all associated data may be deleted at any time, without notice and
              without the ability to recover it.
            </strong>{" "}
            This is not a remote possibility — the project team resets the database during
            development. Do not rely on ElderWise to store anything you would be upset to lose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">What we collect</h2>
          <p>If you create an account as a care partner, we collect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your first name, last name, and email address</li>
            <li>Your WhatsApp number and time zone</li>
          </ul>
          <p>
            If you add an elderly person (&quot;loved one&quot;), we collect the information you
            enter about them:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              First name, last name, age, WhatsApp number, time zone, home address, and their
              relationship to you
            </li>
            <li>
              Their medication, meal, and health check-in routines, including times and reminder
              settings
            </li>
            <li>
              Their responses to check-in messages, and any voice notes they send in reply
            </li>
            <li>Any SOS alerts they raise, and how those alerts were resolved</li>
          </ul>
          <p>
            If you add a local buddy or doctor, we collect the name, WhatsApp number, and — for a
            doctor — the clinic or hospital name that you enter.
          </p>
          <p>
            We also record when you gave each of the consents shown on the final onboarding
            screen, and which version of this policy was in effect at the time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">How we use it</h2>
          <p>We use this information only to operate the features you have set up:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Sending WhatsApp check-in and reminder messages to the elderly person at the times
              you configured
            </li>
            <li>Recording their responses and showing them to you on your dashboard</li>
            <li>
              Notifying you when a check-in is missed, according to the notification setting you
              chose for each routine
            </li>
            <li>
              Sending SOS alerts to you, the local buddy, and the doctor when an SOS is raised
            </li>
            <li>
              Generating a health summary you can share with a doctor through a link you create
            </li>
          </ul>
          <p>
            We do not sell your data. We do not use it for advertising. We do not use it to train
            AI models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Who your data is shared with</h2>
          <p>ElderWise runs on third-party services that necessarily process your data:</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 font-semibold">What it handles</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>Supabase</strong>
                  </td>
                  <td className="py-2">Database, authentication, and access control</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>Vercel</strong>
                  </td>
                  <td className="py-2">Application hosting and content delivery</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>Meta (WhatsApp Business Cloud API)</strong>
                  </td>
                  <td className="py-2">Delivery of all WhatsApp messages</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>OpenAI</strong>
                  </td>
                  <td className="py-2">Interpreting free-text and voice replies</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>Speech-to-text provider</strong>
                  </td>
                  <td className="py-2">Transcribing voice notes</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4 align-top">
                    <strong>Upstash</strong>
                  </td>
                  <td className="py-2">Rate limiting</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Each of these operates under its own privacy policy and terms.</p>
          <p>
            Health summaries are shared only with a doctor you explicitly name, through a link you
            choose to create. That link expires after 30 days. You can find more detail on your
            dashboard.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Where your data is stored</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Database and authentication:</strong> Supabase, in the{" "}
              <strong>ap-northeast-2</strong> region (<strong>Seoul, South Korea</strong>)
            </li>
            <li>
              <strong>Rate limiting:</strong> Upstash, in the <strong>us-east-1</strong> region (
              <strong>United States</strong>)
            </li>
            <li>
              <strong>Application hosting:</strong> Vercel&apos;s global edge network
            </li>
            <li>
              <strong>Message delivery:</strong> Meta&apos;s infrastructure, subject to Meta&apos;s
              own data handling
            </li>
          </ul>
          <p>
            If you are outside these regions, your data is transferred to and stored in them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Retention and deletion</h2>
          <p>
            There is no fixed retention schedule. Data persists until it is deleted — by you, or
            by the project team, or when the project ends.
          </p>
          <p>
            <strong>The project team may delete all data at any time without notice.</strong> When
            the fellowship concludes, the project may be shut down and all data destroyed.
          </p>
          <p>
            To request deletion of your account and data, email{" "}
            <strong>elderwise0@gmail.com</strong>. We will action reasonable requests, but we
            cannot promise a response time — this is a student project without staffed support.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Security</h2>
          <p>
            Access to data is enforced at the database level, so one care partner cannot read
            another&apos;s records. Traffic is encrypted in transit. Passwords are handled by
            Supabase Auth and are never stored by us in readable form.
          </p>
          <p>
            That said: this system has not undergone an independent security audit. Treat it as a
            student project, because it is one.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">What ElderWise is not</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Not a HIPAA covered entity or business associate.</strong> ElderWise makes
              no HIPAA compliance claim of any kind.
            </li>
            <li>
              <strong>Not a medical device.</strong> ElderWise does not diagnose, treat, or make
              clinical recommendations, and provides no medical advice.
            </li>
            <li>
              <strong>Not an emergency service.</strong> SOS alerts are WhatsApp messages to
              people you have named. They are not connected to emergency services and can fail. In
              an emergency, contact your local emergency number.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Children</h2>
          <p>
            ElderWise is not intended for anyone under 18 and we do not knowingly collect data from
            children.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Changes to this policy</h2>
          <p>
            If this policy changes materially, the version string will change and you may be asked
            to re-confirm. The version you agreed to is recorded with your consent.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Contact</h2>
          <p>
            <strong>elderwise0@gmail.com</strong>
          </p>
        </section>

        <p className="text-xs italic leading-relaxed text-muted-foreground">
          ElderWise — AIGF Cohort 7, Group 7. A student capstone project.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/terms" className="font-semibold text-primary hover:underline">
          Terms
        </Link>
        {" · "}
        <Link href="/safety" className="font-semibold text-primary hover:underline">
          Safety
        </Link>
      </p>
    </div>
  );
}
