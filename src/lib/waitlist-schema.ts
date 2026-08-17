import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone or WhatsApp number")
  .max(30, "Number is too long");

export const caringForOptions = ["parent", "spouse", "other"] as const;

export type CaringForOption = (typeof caringForOptions)[number];

/** Payload accepted by POST /api/waitlist */
export const waitlistApiSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),
  phone,
  whatsapp: phone,
  caringFor: z.enum(caringForOptions).optional(),
  location: z.string().trim().max(120, "Location is too long").optional(),
  consent: z.boolean().refine((value) => value === true, {
    message: "Please agree to be contacted to join the waitlist",
  }),
});

/** Client form values (includes UI-only helpers) */
export const waitlistSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    email: z.string().trim().email("Enter a valid email address"),
    phone,
    whatsapp: z.string().trim(),
    caringFor: z.enum(caringForOptions).or(z.literal("")).optional(),
    location: z.string().trim().max(120, "Location is too long").optional(),
    consent: z.boolean().refine((value) => value === true, {
      message: "Please agree to be contacted to join the waitlist",
    }),
    whatsappSameAsPhone: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.whatsappSameAsPhone) return;
    const result = phone.safeParse(data.whatsapp);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ["whatsapp"],
        });
      }
    }
  });

export type WaitlistValues = z.infer<typeof waitlistSchema>;
export type WaitlistApiPayload = z.infer<typeof waitlistApiSchema>;

export type WaitlistSubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
