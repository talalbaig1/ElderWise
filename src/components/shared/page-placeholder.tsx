import Link from "next/link";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PagePlaceholderProps {
  title: string;
  description: string;
  phase?: string;
  backHref?: string;
  backLabel?: string;
}

export function PagePlaceholder({
  title,
  description,
  phase = "Coming in a later phase",
  backHref,
  backLabel = "Back",
}: PagePlaceholderProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Construction className="h-5 w-5" />
          </span>
          <Badge variant="secondary" className="font-mono">
            Foundation placeholder
          </Badge>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{phase}</p>
        {backHref ? (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
