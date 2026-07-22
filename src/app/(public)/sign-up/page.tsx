"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { RequireGuest } from "@/components/auth/route-guards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpSchema, type SignUpValues } from "@/lib/auth-schema";
import { useAuth } from "@/lib/store";

export default function SignUpPage() {
  return (
    <RequireGuest>
      <SignUpForm />
    </RequireGuest>
  );
}

function SignUpForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const password = watch("password");
  const acceptTerms = watch("acceptTerms");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signUp({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
    });

    if (!result.ok) {
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Welcome to ElderWise", {
      description: "Let’s set up your Loved One next.",
    });
    router.replace("/onboarding");
  });

  return (
    <AuthShell
      title="Create your Care Partner account"
      description="Start staying close to the people who matter most. We’ll guide you through a warm onboarding next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
            {errors.firstName ? (
              <p className="text-xs text-sos">{errors.firstName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
            {errors.lastName ? (
              <p className="text-xs text-sos">{errors.lastName.message}</p>
            ) : null}
          </div>
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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <PasswordStrengthMeter password={password || ""} />
          {errors.password ? (
            <p className="text-xs text-sos">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-sos">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={acceptTerms}
              onCheckedChange={(checked) =>
                setValue("acceptTerms", checked === true, { shouldValidate: true })
              }
              className="mt-0.5"
              aria-invalid={Boolean(errors.acceptTerms)}
            />
            <span className="leading-relaxed text-muted-foreground">
              I accept the{" "}
              <Link href="/terms" className="font-semibold text-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-primary hover:underline">
                Privacy
              </Link>{" "}
              policy, and understand ElderWise supports family communication and is not a
              substitute for emergency services.
            </span>
          </label>
          {errors.acceptTerms ? (
            <p className="text-xs text-sos">{errors.acceptTerms.message}</p>
          ) : null}
        </div>

        {formError ? (
          <div className="rounded-xl bg-sos-soft px-3 py-2 text-sm text-sos" role="alert">
            {formError}
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
