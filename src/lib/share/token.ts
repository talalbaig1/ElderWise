import { createHash, randomBytes } from "crypto";

/** 32+ bytes random; base64url for URL-safe tokens. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export const SHARE_DEFAULT_TTL_DAYS = 30;
