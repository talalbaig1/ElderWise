"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearOnboardingLocalDraft } from "@/components/onboarding/onboarding-context";
import {
  discardDraftElder,
  getOwnDraftElder,
} from "@/lib/data/onboarding-actions";

/**
 * Entry to onboard another Loved One while product elders already exist.
 * Enforces at-most-one-draft via dialog (Cancel / Resume / Start new).
 */
export function AddLovedOneButton({
  className,
  variant = "default",
  size = "default",
  label = "Add Loved One",
}: {
  className?: string;
  variant?: "default" | "outline" | "soft";
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{
    id: string;
    firstName: string;
  } | null>(null);

  const goAdditional = (fresh: boolean) => {
    const q = fresh ? "?mode=additional&fresh=1" : "?mode=additional";
    router.push(`/onboarding${q}`);
  };

  const onClick = async () => {
    setBusy(true);
    try {
      const result = await getOwnDraftElder();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.draft) {
        goAdditional(true);
        return;
      }
      setDialog(result.draft);
    } finally {
      setBusy(false);
    }
  };

  const onResume = () => {
    setDialog(null);
    goAdditional(false);
  };

  const onStartNew = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      // Clear local pointer BEFORE hard-delete so a mid-wizard failure cannot
      // keep pointing at a deleted elderId.
      clearOnboardingLocalDraft();
      const result = await discardDraftElder(dialog.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDialog(null);
      goAdditional(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        className={className}
        variant={variant}
        size={size}
        disabled={busy}
        onClick={() => void onClick()}
      >
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Resume unfinished setup for {dialog?.firstName ?? "your Loved One"}?
            </DialogTitle>
            <DialogDescription>
              You already started adding {dialog?.firstName ?? "this Loved One"}.
              Resume to continue where you left off, or start a new Loved One —
              that permanently discards the unfinished setup (including their
              WhatsApp number on this draft). Cancel returns you here with no
              changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button disabled={busy} onClick={onResume}>
              Resume unfinished setup
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void onStartNew()}
            >
              {busy ? "Discarding…" : "Start a new Loved One"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
