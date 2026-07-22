"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Reply = "yes" | "no" | "later" | null;

const prompts = {
  idle: "Hi Fatima, it is time for your Metformin, 500 mg. Have you taken it?",
  yes: "Thank you, Fatima. We’ve let Sama know you took your medication.",
  no: "Understood. Sama has been notified so they can check in with you.",
  later: "No problem. We’ll gently remind you again in 15 minutes.",
};

export function WhatsAppDemo() {
  const [reply, setReply] = useState<Reply>(null);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  const choose = (value: Exclude<Reply, null>) => {
    if (busy) return;
    setBusy(true);
    setReply(null);
    window.setTimeout(() => {
      setReply(value);
      setBusy(false);
    }, reduce ? 0 : 450);
  };

  const reset = () => {
    setReply(null);
    setBusy(false);
  };

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_24px_60px_-36px_rgba(31,75,69,0.45)]">
      <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <MessageCircle className="h-4 w-4" />
        <div>
          <p className="text-sm font-semibold">Fatima · WhatsApp</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/65">
            Simulated check-in
          </p>
        </div>
      </div>

      <div className="min-h-[280px] space-y-3 bg-[#E9EDE3] p-4 dark:bg-[#1a2421]">
        <motion.div
          key={`prompt-${reply ?? "idle"}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[90%] rounded-2xl rounded-tl-md bg-[#DCF8C6] px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-sm dark:bg-[#2a4034] dark:text-foreground"
        >
          {prompts.idle}
          <span className="mt-1 block text-right font-mono text-[10px] text-[#6b8f6f]">
            8:00 AM ✓✓
          </span>
        </motion.div>

        {reply ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-white px-3.5 py-2.5 text-sm shadow-sm dark:bg-card"
          >
            {reply === "yes" ? "Yes" : reply === "no" ? "No" : "Remind me later"}
            <span className="mt-1 block text-right font-mono text-[10px] text-muted-foreground">
              8:04 AM
            </span>
          </motion.div>
        ) : null}

        {reply ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[90%] rounded-2xl rounded-tl-md bg-[#DCF8C6] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm dark:bg-[#2a4034]"
          >
            {prompts[reply]}
          </motion.div>
        ) : null}

        {busy ? (
          <p className="font-mono text-xs text-muted-foreground">Updating dashboard…</p>
        ) : null}
      </div>

      <div className="space-y-3 border-t bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Choose a response to see how ElderWise updates the Care Partner view.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["yes", "Yes", "default"],
              ["no", "No", "outline"],
              ["later", "Remind me later", "soft"],
            ] as const
          ).map(([value, label, variant]) => (
            <Button
              key={value}
              size="sm"
              variant={variant}
              disabled={busy}
              onClick={() => choose(value)}
              className={cn(reply === value && "ring-2 ring-ring")}
            >
              {label}
            </Button>
          ))}
          {reply ? (
            <Button size="sm" variant="ghost" onClick={reset}>
              Try again
            </Button>
          ) : null}
        </div>
        {reply === "yes" ? (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            Dashboard updated · Medication marked taken · Notification sent to Sama
          </p>
        ) : null}
        {reply === "no" ? (
          <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-foreground">
            Attention state · Care Partner notified for a gentle follow-up
          </p>
        ) : null}
        {reply === "later" ? (
          <p className="rounded-xl bg-info/10 px-3 py-2 text-sm text-info">
            Reminder scheduled · Timeline shows delayed pending response
          </p>
        ) : null}
      </div>
    </div>
  );
}
