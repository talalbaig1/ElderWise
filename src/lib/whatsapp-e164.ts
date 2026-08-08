import { z } from "zod";

/** Strict E.164 — leading +, country code 1–9, 8–15 digits total. */
export const E164_WHATSAPP_REGEX = /^\+[1-9][0-9]{7,14}$/;

/** Masked example only — never a real in-service number. */
export const WHATSAPP_PLACEHOLDER = "+966 5XX XXX XXX";

export const WHATSAPP_E164_ERROR =
  `Please enter the number with the country code, for example ${WHATSAPP_PLACEHOLDER}.`;

/** Strip only whitespace, hyphens, brackets, and parentheses. */
function stripWhatsAppSeparators(raw: string): string {
  return raw.trim().replace(/[\s\-()[\]]/g, "");
}

/**
 * Normalise user input toward canonical E.164.
 * Returns null when unexpected characters remain after separator stripping.
 */
export function normalizeWhatsAppNumber(raw: string): string | null {
  let value = stripWhatsAppSeparators(raw);

  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("+")) {
    const digits = value.slice(1);
    if (digits.length === 0 || !/^\d+$/.test(digits)) {
      return null;
    }
    return `+${digits}`;
  }

  if (value.length === 0 || !/^\d+$/.test(value)) {
    return null;
  }

  return value;
}

export function isValidWhatsAppE164(value: string): boolean {
  return E164_WHATSAPP_REGEX.test(value);
}

export function validateRequiredWhatsAppNumber(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "WhatsApp number is required" };
  }

  const normalized = normalizeWhatsAppNumber(trimmed);
  if (normalized === null || !isValidWhatsAppE164(normalized)) {
    return { ok: false, error: WHATSAPP_E164_ERROR };
  }

  return { ok: true, value: normalized };
}

export function validateOptionalWhatsAppNumber(
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const normalized = normalizeWhatsAppNumber(trimmed);
  if (normalized === null || !isValidWhatsAppE164(normalized)) {
    return { ok: false, error: WHATSAPP_E164_ERROR };
  }

  return { ok: true, value: normalized };
}

export function mapWhatsAppDbError(message: string): string {
  if (/whatsapp_e164|check constraint|check_violation/i.test(message)) {
    return WHATSAPP_E164_ERROR;
  }
  return message;
}

export const requiredWhatsAppE164Schema = z
  .string()
  .trim()
  .min(1, "WhatsApp number is required")
  .transform((value) => normalizeWhatsAppNumber(value))
  .refine(
    (value): value is string => value !== null && isValidWhatsAppE164(value),
    WHATSAPP_E164_ERROR,
  )
  .transform((value) => value as string);

export const optionalWhatsAppE164Schema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "" : normalizeWhatsAppNumber(value)))
  .refine(
    (value): value is "" | string =>
      value === "" || (typeof value === "string" && isValidWhatsAppE164(value)),
    WHATSAPP_E164_ERROR,
  )
  .transform((value) => (value === "" ? "" : value));
