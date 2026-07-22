import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
}

export function Logo({ className, showWordmark = true, href = "/" }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Leaf className="h-4 w-4" aria-hidden />
      </span>
      {showWordmark ? (
        <span className="font-display text-xl tracking-tight text-foreground">
          ElderWise
        </span>
      ) : (
        <span className="sr-only">ElderWise</span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
