"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sos-soft text-sos">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h2 className="font-display text-2xl">This screen could not load</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Try again. If it keeps happening, reset demo data from Settings or return to the dashboard.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/settings#account">Settings</Link>
        </Button>
      </div>
    </div>
  );
}
