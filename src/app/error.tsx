"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sos-soft text-sos">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        SilaCares hit an unexpected error. Your care data is stored in SilaCares&apos;s cloud
        database — try again or return home. If it keeps happening, sign out and back in.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
