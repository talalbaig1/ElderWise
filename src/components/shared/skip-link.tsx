import type { ReactNode } from "react";
import Link from "next/link";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

export function BrandLegalNote() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      ElderWise supports family communication and routine monitoring. It is not a substitute for
      professional medical advice or emergency services. In a real emergency, call local emergency
      services.
    </p>
  );
}

export function SoftPageLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="font-semibold text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
