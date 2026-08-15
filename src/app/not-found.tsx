import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Compass className="h-6 w-6" />
      </span>
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        That path does not exist in SilaCare. Head back to the dashboard or marketing home.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Marketing home</Link>
        </Button>
      </div>
    </div>
  );
}
