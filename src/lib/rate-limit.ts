import type { Ratelimit } from "@upstash/ratelimit";

export type RateLimitResult = { ok: true } | { ok: false };

type WindowStr = `${number} ${"s" | "m" | "h" | "d"}`;

/**
 * FAIL-OPEN on purpose.
 *
 * If Redis is unreachable, misconfigured, or errors, ALLOW the request and log.
 * Share security is the unguessable token; PDF security is the CT session + RLS.
 * A Redis outage must not stop a doctor reading a share or a CT downloading a PDF.
 * Do not "harden" this to fail-closed without an explicit product decision.
 */
let warnedUnconfigured = false;
const limiters = new Map<string, Ratelimit>();

function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

async function getLimiter(
  bucket: string,
  max: number,
  window: WindowStr,
): Promise<Ratelimit | null> {
  if (!redisConfigured()) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset — limiter no-ops (allow all)",
      );
    }
    return null;
  }

  const key = `${bucket}:${max}:${window}`;
  const existing = limiters.get(key);
  if (existing) return existing;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `elderwise:rl:${bucket}`,
      analytics: false,
    });
    limiters.set(key, limiter);
    return limiter;
  } catch (err) {
    console.warn(
      "[rate-limit] failed to init Upstash — fail-open",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  opts: { max: number; window: WindowStr },
): Promise<RateLimitResult> {
  const id = identifier.trim() || "unknown";
  try {
    const limiter = await getLimiter(bucket, opts.max, opts.window);
    if (!limiter) return { ok: true };

    const result = await limiter.limit(id);
    if (result.success) return { ok: true };
    return { ok: false };
  } catch (err) {
    // FAIL-OPEN — see file header. Do not convert to deny.
    console.warn(
      "[rate-limit] check failed — fail-open",
      err instanceof Error ? err.message : err,
    );
    return { ok: true };
  }
}

/**
 * Prefer Vercel’s platform-set IP (`x-vercel-forwarded-for`).
 * Clients can rotate `x-forwarded-for`; they cannot forge the Vercel header.
 * Fall back to `x-forwarded-for` / `x-real-ip` for local `next dev`.
 */
export function clientIpFromHeaders(h: Headers): string {
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;

  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
