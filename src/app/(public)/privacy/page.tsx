import type { Metadata } from "next";
import Link from "next/link";
import { BrandLegalNote } from "@/components/shared/skip-link";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-4xl">Privacy</h1>
      <p className="mt-4 text-muted-foreground">
        ElderWise stores Care Partner data in your browser&apos;s localStorage on this device.
        Nothing is sent to a cloud backend from this experience.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="font-display text-xl">What we store locally</h2>
          <p>
            Account details, Care Partner profile, Loved Ones, routines, check-ins, SOS events,
            Voice Journal entries, reports, notifications, and settings preferences.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl">What we do not do</h2>
          <p>
            We do not upload health data to a cloud API, sell personal information, or deliver live
            WhatsApp messages from this build. Exports (CSV/PDF) stay on your device.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl">Your controls</h2>
          <p>
            Use Settings → Restore starter data to reset local content, or clear site data in your
            browser to remove ElderWise storage keys.
          </p>
        </section>
        <BrandLegalNote />
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
