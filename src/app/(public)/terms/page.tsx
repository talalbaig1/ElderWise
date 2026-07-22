import type { Metadata } from "next";
import Link from "next/link";
import { BrandLegalNote } from "@/components/shared/skip-link";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-4xl">Terms of use</h1>
      <p className="mt-4 text-muted-foreground">
        By using ElderWise you agree to use the Care Partner experience responsibly for the people
        you are authorised to support.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="font-display text-xl">Product purpose</h2>
          <p>
            ElderWise helps families coordinate daily care through WhatsApp-style check-ins, SOS
            coordination, and wellbeing reports. Some messaging and escalation flows may be simulated
            in this build.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl">Not medical advice</h2>
          <p>
            ElderWise does not diagnose, treat, or monitor clinical conditions. Always consult
            qualified clinicians for health decisions.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl">Accounts</h2>
          <p>
            Keep your sign-in details secure and use ElderWise only for people you are authorised
            to care for. Passwords are stored locally for this experience.
          </p>
        </section>
        <BrandLegalNote />
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
