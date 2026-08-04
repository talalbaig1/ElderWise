import * as Sentry from "@sentry/nextjs";

export async function register() {
  (globalThis as Record<string, unknown>).__EW_REGISTER_RAN = true;
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
      (globalThis as Record<string, unknown>).__EW_SERVER_IMPORTED = true;
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
      (globalThis as Record<string, unknown>).__EW_EDGE_IMPORTED = true;
    }
  } catch (err) {
    (globalThis as Record<string, unknown>).__EW_IMPORT_ERROR =
      err instanceof Error ? err.message : String(err);
  }
}

export const onRequestError = Sentry.captureRequestError;
