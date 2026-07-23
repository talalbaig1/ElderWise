import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Dev-only auto-login. Fail closed.
 *
 * Why the platform env allowlist exists: DEV_AUTOLOGIN was set on Vercel
 * Production on 23 Jul 2026 and the public deployment auto-authenticated every
 * visitor as the seed care partner. The env flag alone is not sufficient
 * protection — deny unless VERCEL_ENV is undefined (local), "development", or
 * "preview". Then require DEV_AUTOLOGIN === "true". Missing seed creds → 404.
 * Credentials are server-only (never NEXT_PUBLIC_*).
 * Removed entirely in Phases A3.3.
 */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

function allowedDevAutologinEnv(vercelEnv: string | undefined): boolean {
  return (
    vercelEnv === undefined ||
    vercelEnv === "development" ||
    vercelEnv === "preview"
  );
}

function notFound() {
  return new NextResponse(null, { status: 404, headers: NO_STORE });
}

export async function POST() {
  if (!allowedDevAutologinEnv(process.env.VERCEL_ENV)) {
    return notFound();
  }

  if (process.env.DEV_AUTOLOGIN !== "true") {
    return notFound();
  }

  const email = process.env.DEV_SEED_EMAIL;
  const password = process.env.DEV_SEED_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password || !url || !anonKey) {
    return notFound();
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component context that cannot set cookies —
          // session cookies are still applied on the Route Handler response path.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "sign-in failed" },
      { status: 401, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      userId: data.user.id,
      email: data.user.email,
    },
    { headers: NO_STORE },
  );
}

export async function GET() {
  return notFound();
}
