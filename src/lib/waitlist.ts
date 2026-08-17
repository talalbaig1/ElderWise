import {
  waitlistApiSchema,
  type WaitlistApiPayload,
  type WaitlistSubmitResult,
  type WaitlistValues,
} from "@/lib/waitlist-schema";

export function toWaitlistPayload(values: WaitlistValues): WaitlistApiPayload {
  const whatsapp = values.whatsappSameAsPhone ? values.phone : values.whatsapp;
  const caringFor =
    values.caringFor === "" || values.caringFor === undefined
      ? undefined
      : values.caringFor;
  const location = values.location?.trim() ? values.location.trim() : undefined;

  return waitlistApiSchema.parse({
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    whatsapp,
    caringFor,
    location,
    consent: values.consent,
  });
}

export async function submitWaitlist(
  values: WaitlistValues,
): Promise<WaitlistSubmitResult> {
  let payload: WaitlistApiPayload;
  try {
    payload = toWaitlistPayload(values);
  } catch {
    return { ok: false, error: "Please check the form and try again." };
  }

  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | WaitlistSubmitResult
      | null;

    if (!response.ok) {
      if (data && data.ok === false) return data;
      return {
        ok: false,
        error: "Something went wrong. Please try again in a moment.",
      };
    }

    if (data && data.ok === true) return data;
    return { ok: true, id: "pending" };
  } catch {
    return {
      ok: false,
      error: "Could not reach the server. Check your connection and try again.",
    };
  }
}
