import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const eventId = Sentry.captureException(
    new Error(
      "ElderWise Sentry verification — /share/FAKETOKEN1234567890abcdef and +966500000000 must both be redacted"
    )
  );
  const flushed = await Sentry.flush(3000);

  return Response.json({
    clientInitialised: Boolean(Sentry.getClient()),
    dsnPresent: Boolean(process.env.SENTRY_DSN),
    runtime: process.env.NEXT_RUNTIME ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    eventId,
    flushed,
  });
}
