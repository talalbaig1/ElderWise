import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  Sentry.captureException(
    new Error(
      "ElderWise Sentry verification — /share/FAKETOKEN1234567890abcdef and +966500000000 must both be redacted"
    )
  );
  await Sentry.flush(2000);
  return new Response("captured", { status: 200 });
}
