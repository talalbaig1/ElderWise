import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { publicNav } from "@/lib/navigation";

export function PublicFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-12">
        <div className="space-y-4 md:col-span-4">
          <Logo href="/" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Everyday reassurance for the people who matter most.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Staying close, from a distance
          </p>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Product</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/sign-up" className="hover:text-foreground">
                Get Started
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Company</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/about" className="hover:text-foreground">
                About
              </Link>
            </li>
            <li>
              <a href="mailto:hello@silacares.demo" className="hover:text-foreground">
                Contact
              </a>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Safety</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/safety" className="hover:text-foreground">
                SOS & escalation
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-foreground">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Connect</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="mailto:hello@silacares.demo" className="hover:text-foreground">
                hello@silacares.demo
              </a>
            </li>
            <li>
              <Link href="/about" className="hover:text-foreground">
                Our story
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-foreground">
                Support FAQ
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} SilaCares. Demo marketing experience.</p>
          <p className="max-w-xl sm:text-right">
            SilaCares supports family communication and routine monitoring. It is not a substitute
            for professional medical advice or emergency services.
          </p>
        </div>
      </div>
    </footer>
  );
}
