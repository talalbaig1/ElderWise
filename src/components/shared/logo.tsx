import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
}

export function Logo({ className, showWordmark = true, href = "/" }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Image
          src="/images/silacares-logo.png"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
      </span>
      {showWordmark ? (
        <span className="font-display text-xl tracking-tight text-foreground">
          SilaCares
        </span>
      ) : (
        <span className="sr-only">SilaCares</span>
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
