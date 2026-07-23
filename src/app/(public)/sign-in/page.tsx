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
import { ensureCarePartnerProfile } from "@/lib/data/ensure-care-partner";
import { clientTimeZone, hasOwnProductElder, postAuthPath } from "@/lib/auth-routing";
import { signInSchema, type SignInValues } from "@/lib/auth-schema";
import { createClient } from "@/lib/supabase/client";
import { useElderWiseStore } from "@/lib/store";

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
  if (raw.startsWith("/sign-")) return null;
  return raw;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mirrorSupabaseUser } = useElderWiseStore();
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
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });

    if (error || !data.user) {
      const msg = error?.message ?? "Sign-in failed";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const fullName =
      (data.user.user_metadata?.full_name as string | undefined) ||
      data.user.email?.split("@")[0] ||
      "Care Partner";

    const profile = await ensureCarePartnerProfile({
      fullName,
      email: data.user.email ?? values.email,
      timeZone: clientTimeZone(),
    });

    if (!profile.ok) {
      await supabase.auth.signOut();
      setFormError(profile.error);
      toast.error(profile.error);
      return;
    }

    mirrorSupabaseUser({
      userId: data.user.id,
      email: data.user.email ?? null,
    });

    const hasElder = await hasOwnProductElder(supabase);
    const next = safeNextPath(searchParams.get("next"));
    const dest =
      next === "/onboarding" || !hasElder
        ? postAuthPath(hasElder)
        : next && hasElder
          ? next
          : postAuthPath(hasElder);

    toast.success("Welcome back");
    router.replace(dest);
    router.refresh();
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
