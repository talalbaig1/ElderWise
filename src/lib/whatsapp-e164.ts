import { z } from "zod";

/** Strict E.164 — leading +, country code 1–9, 8–15 digits total. */
export const E164_WHATSAPP_REGEX = /^\+[1-9][0-9]{7,14}$/;

export const WHATSAPP_E164_ERROR =
  "Please enter the number with the country code, for example +966569362418.";

export function normalizeWhatsAppNumber(raw: string): string {
  let value = raw.trim().replace(/[\s\-()[\]]/g, "");

  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("+")) {
    return `+${value.slice(1).replace(/\D/g, "")}`;
  }

  return value.replace(/\D/g, "");
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
  if (!isValidWhatsAppE164(normalized)) {
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
  if (!isValidWhatsAppE164(normalized)) {
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
  .transform(normalizeWhatsAppNumber)
  .refine(isValidWhatsAppE164, WHATSAPP_E164_ERROR);

export const optionalWhatsAppE164Schema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "" : normalizeWhatsAppNumber(value)))
  .refine((value) => value === "" || isValidWhatsAppE164(value), WHATSAPP_E164_ERROR);
