"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GateState = "missing" | "pending" | "revoked";

export function VerifyGatePanel({ state }: { state: GateState }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestAccess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/verify/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.status === 201) {
        router.refresh();
        return;
      }
      if (res.status === 403) {
        router.refresh();
        return;
      }
      setError("Could not submit access request. Try again.");
    } catch {
      setError("Could not submit access request. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (state === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access requested</CardTitle>
          <CardDescription>
            Waiting for approval. This page will show the console once your
            access is approved.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state === "revoked") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access revoked</CardTitle>
          <CardDescription>
            Your verification console access has been revoked. Contact the team
            lead if you believe this is an error.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request access</CardTitle>
        <CardDescription>
          Verification console access requires team-lead approval before you
          can read database rows here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={() => void requestAccess()} disabled={loading}>
          {loading ? "Submitting…" : "Request access"}
        </Button>
      </CardContent>
    </Card>
  );
}
