import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Dev-only auto-login. Fail closed:
 * - Missing/false DEV_AUTOLOGIN → 404
 * - Missing seed creds → 404
 * Credentials are server-only (never NEXT_PUBLIC_*).
 * Removed entirely in Phases A3.3.
 */
export async function POST() {
  if (process.env.DEV_AUTOLOGIN !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const email = process.env.DEV_SEED_EMAIL;
  const password = process.env.DEV_SEED_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password || !url || !anonKey) {
    return new NextResponse(null, { status: 404 });
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
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    userId: data.user.id,
    email: data.user.email,
  });
}

export async function GET() {
  return new NextResponse(null, { status: 404 });
}
