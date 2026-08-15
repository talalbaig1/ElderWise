import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#DCE8E4_0%,transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,#24332f_0%,transparent_55%)]" />
      <div className="relative mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>
        <div className="rounded-[1.75rem] border border-border/80 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(31,75,69,0.4)] sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Care Partner access
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/" className="font-semibold text-primary hover:underline">
            Back to SilaCares
          </Link>
        </p>
      </div>
    </div>
  );
}
