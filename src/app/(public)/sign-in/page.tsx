"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { RequireGuest } from "@/components/auth/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findAccountByEmail } from "@/lib/auth";
import { signInSchema, type SignInValues } from "@/lib/auth-schema";
import { useAuth } from "@/lib/store";

export default function SignInPage() {
  return (
    <RequireGuest>
      <Suspense fallback={<div className="mx-auto h-40 max-w-md animate-pulse rounded-2xl bg-secondary" />}>
        <SignInForm />
      </Suspense>
    </RequireGuest>
  );
}

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signIn(values);
    if (!result.ok) {
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    const account = findAccountByEmail(values.email);
    const complete = Boolean(account?.onboardingComplete);
    const next = safeNextPath(searchParams.get("next"));

    if (!complete) {
      toast.success("Signed in", { description: "Continue onboarding to set up care." });
      router.replace("/onboarding");
      return;
    }

    toast.success("Welcome back");
    if (next && next !== "/onboarding" && !next.startsWith("/sign-")) {
      router.replace(next);
      return;
    }
    router.replace("/dashboard");
  });

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue caring for your Loved Ones with ElderWise."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={() => {
            // TODO(backend): Supabase Google OAuth
            toast.message("Google sign-in coming soon", {
              description: "Email and password still work for this demo.",
            });
          }}
        >
          Continue with Google
        </Button>
        <div className="relative text-center">
          <span className="bg-card px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            or
          </span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-sos">{errors.password.message}</p>
          ) : null}
        </div>

        {formError ? (
          <div className="rounded-xl bg-sos-soft px-3 py-2 text-sm text-sos" role="alert">
            {formError}
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
