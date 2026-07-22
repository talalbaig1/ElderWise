"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { RequireGuest } from "@/components/auth/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schema";

export default function ForgotPasswordPage() {
  return (
    <RequireGuest>
      <ForgotPasswordForm />
    </RequireGuest>
  );
}

function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = requestPasswordReset(values.email);
    setSent(true);
    toast.success("Check your inbox", { description: result.message });
  });

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email for your Care Partner account. We’ll send a reset link if it exists."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-sage/70 px-4 py-4 text-sm leading-relaxed text-primary">
            If an account exists for that email, a reset link has been sent.
            <span className="mt-2 block text-muted-foreground">
              In this build, no email is delivered. Use Sign in when you are ready.
            </span>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-sos">{errors.email.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
