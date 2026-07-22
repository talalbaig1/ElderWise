# ElderWise — Front-End Patch Instructions (for Cursor)

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Document** | patch_frontend.md — v1.0 |
| **Date** | 22 July 2026 |
| **For** | Cursor / Claude Code |
| **Applies to** | The existing Next.js front end (`src/`), authored by Sama |
| **Read first** | `PRD.md` (v1.6) · `Architecture.md` (v1.3) · `Rules.md` · `Templates.md` |

---

## 0. Context — read this before touching anything

The front end is already well built: all screens, a typed domain model in `src/types/index.ts`, a full onboarding wizard in `src/components/onboarding/`, an SOS cascade, reports, and a voice-journal screen. **It is good. Do not rewrite it, do not restructure it, do not restyle it.**

It was built before three product decisions were finalised, so a few specific things are missing. **This file is a surgical patch list, not a redesign brief.** Make exactly these changes and nothing more. Preserve the existing design system, component patterns, file structure, and naming conventions. Match the code style already in the repo.

**Golden rules for this patch:**
1. **Additive only.** Do not remove or rename existing fields, types, or components unless this file explicitly says to.
2. **Match existing patterns.** New form fields must use the same `Input` / `Label` / `FieldError` / Zod-schema pattern already in `src/components/onboarding/steps/` and `src/lib/onboarding.ts`.
3. **This is still front-end-only.** No Supabase, no API calls, no n8n. Consent confirmation status and all data continue to use the existing mock/localStorage store. Leave a clearly-marked TODO where the backend will later write.
4. **After each task, report what you changed** — file, what was added, and confirm the app still builds (`npm run build`).

---

## Task 1 — 🔴 Elder consent (opt-in) · HIGHEST PRIORITY

**Why:** WhatsApp/Meta require the message *recipient* to opt in. In ElderWise the Care Partner supplies the elder's number, so the elder has consented to nothing. This is a compliance gate **and** an ethical one. See `PRD.md` M16, `Templates.md` §1.2.

**Important scoping:** consent is required for **the elder only** — the "Loved One". Do **not** add consent gates to the Care Partner, Local Buddy, or Doctor numbers. (The buddy/doctor get a lighter acknowledgement — see Task 5.)

Consent has two layers. The front end builds layer (a) fully, and provides the *display* for layer (b).

### 1a. CT attestation checkbox — in the Loved One onboarding step

In `src/components/onboarding/steps/loved-one-step.tsx`, add a **required checkbox** at the end of the form, before the Next button:

> ☐ **I confirm that [First name] has agreed to receive daily ElderWise check-in messages on WhatsApp.**
> *(Their number is used only for these check-ins and emergency alerts. They can stop at any time by replying STOP.)*

- Use the existing shadcn `Checkbox` component (already in `src/components/ui/checkbox.tsx`).
- Wire it into `lovedOneSchema` in `src/lib/onboarding.ts` as a required boolean that must be `true` to proceed — mirror the `acceptTerms` pattern already in `src/lib/auth-schema.ts` (`.refine((v) => v === true, { message: "…" })`).
- If unchecked, block Next and show a `FieldError`, exactly like the other fields in this step.
- Interpolate the elder's first name into the label once entered.

### 1b. Store the attestation on the Loved One

Extend the `LovedOne` type in `src/types/index.ts` and the onboarding draft/apply logic in `src/lib/onboarding.ts`:

```ts
// add to LovedOne
consentAttestedByCarePartner: boolean;   // layer (a) — set true when CT ticks the box
consentAttestedAt: string;               // ISO timestamp when ticked
consentConfirmedAt: string | null;       // layer (b) — set by the WhatsApp backend later; null until then
```

In `applyOnboardingDraft`, set `consentAttestedByCarePartner: true`, `consentAttestedAt: now`, and `consentConfirmedAt: null`.

### 1c. Confirmation-status badge — read-only, on the Loved One

Layer (b) — the elder's own in-channel confirmation — happens over WhatsApp and is set by the n8n backend later. The front end must **display** this status wherever a Loved One is shown (the Loved One detail page `src/app/(app)/loved-ones/[id]/page.tsx`, and the Loved One card on the dashboard / list):

- `consentConfirmedAt === null` → a muted badge: **"⏳ Awaiting WhatsApp confirmation"**
- `consentConfirmedAt` set → a positive badge: **"✓ Consent confirmed"** with the date.

Use the existing `StatusPill` / `Badge` component. Add a clear code comment:

```ts
// TODO(backend): consentConfirmedAt is set by the n8n WhatsApp flow when the
// elder responds "Yes" to the welcome message. Until then it stays null and
// NO check-ins are scheduled. Front end only displays this status.
```

Seed a couple of mock Loved Ones with each state (`null` and a confirmed date) so the badge is visible in the demo.

---

## Task 2 — 🔴 Elder address · needed for SOS

**Why:** the SOS message to the Local Buddy carries the elder's address so they can physically get there. The `LovedOne` type has an optional `address?`, but the onboarding step never collects it, so it is always empty. See `PRD.md` M17, `Templates.md` template 11.

- In `src/components/onboarding/steps/loved-one-step.tsx`, add an **Address** field (a `textarea` or multi-line `Input`) after the timezone/relationship row.
- Make it **required** in `lovedOneSchema` (`z.string().trim().min(1, "Address is required — the Local Buddy needs it in an emergency")`).
- In `src/types/index.ts`, change `LovedOne.address?` to required `address: string`.
- Ensure `applyOnboardingDraft` writes it through.
- Add a short helper line under the field: *"We only share this with your Local Buddy during an emergency."*

---

## Task 3 — 🟠 Medication response = two-step flow

**Why:** Meta templates cannot carry a dropdown. The scheduled medication message must name every medicine and offer three quick-reply buttons; the "which ones" picker follows only if needed. See `PRD.md` M12, `Templates.md` §1.1 and template 2.

This is mostly a **template-copy and preview** change in the front end (the real button logic lives in n8n later). Specifically:

- Wherever the medication WhatsApp message is composed or previewed (the medication onboarding step and any WhatsApp preview component, e.g. `src/components/marketing/whatsapp-*` and the medication template string in `src/lib/onboarding.ts`), update the medication template so it:
  1. **names all scheduled medicines** for that time in the body, and
  2. offers three options: **Yes, all** · **Some of them** · **Not yet**.
- Current string to replace in `src/lib/onboarding.ts`:
  `"Hi {name}, it is time for your {medicine}, {dosage} {unit}. Have you taken it?"`
  → something like:
  `"Good morning {name} — it's {time}, time for your medicines: {medicineList}. Did you take them?"` with the three options represented.
- If there is a WhatsApp-preview mock, show the three buttons, and (for the demo) show the follow-up medicine checklist appearing after "Some of them".
- Do **not** build real interactive-list logic — that is n8n's job. This is copy + preview only.

Add a comment:
```ts
// TODO(backend/n8n): "Yes, all" records all; "Some of them" opens the 24h window
// and sends a free-form interactive list of this elder's medicines; "Not yet" arms
// the reminder. Templates cannot carry a dropdown — see Templates.md §1.1.
```

---

## Task 4 — 🟠 Google OAuth on sign-in / sign-up

**Why:** auth is `email + password` **and Google OAuth** (`PRD.md` M13). The front end currently has email/password only (`src/lib/auth-schema.ts`, `src/app/(public)/sign-in`, `sign-up`).

- Add a **"Continue with Google"** button to both the sign-in and sign-up screens, above or below the email/password form, using the existing button styles.
- Front-end only: wire it to a placeholder handler with a `// TODO(backend): Supabase Google OAuth` comment. Do not integrate Supabase now.
- Keep the existing email/password flow exactly as is.

---

## Task 5 — 🟡 Local Buddy & Doctor "you've been added" acknowledgement

**Why:** the Buddy and Doctor are emergency contacts. They do **not** need the elder's blocking opt-in, but Meta etiquette and basic courtesy mean they should be *told* they've been listed. This is **not** a consent gate — do not add a required checkbox to their steps.

- In the Local Buddy and Doctor onboarding steps, add a short informational note (not a checkbox):
  > *"We'll send [Name] a one-time WhatsApp message letting them know you've added them as [an emergency contact / [Elder]'s doctor], so they're expecting alerts if there's ever an emergency."*
- No new required fields. This is a copy addition so the CT knows what will happen. The actual message is sent by n8n later.

---

## Task 6 — 🟡 Mark v2/Could-have UI as clearly non-functional

**Why:** several screens/fields represent post-MVP features (`Architecture.md` §5.4). They can stay in the UI, but must not read as finished features that the backend needs to fulfil.

For each of the following, ensure there is a visible **"Preview / Coming soon"** treatment (a small badge or disabled state) and a code comment marking it as out-of-MVP-scope:

- **Voice Journal** screen (`src/app/(app)/voice-journal/`) — this is a **hard-coded demo placeholder** (PRD FR-DB-6). Add a subtle "Demo preview" marker.
- **Settings:** WhatsApp **quiet hours** and **daily digest** toggles — not in MVP scope. Leave visible but comment `// TODO(v2)`.
- **Settings / notifications:** SMS / Email / Push channel options — MVP is **WhatsApp only** (C8). Disable or mark the non-WhatsApp channels "Coming soon".
- **Health routine answer types** other than Yes/No (`number`, `mood`, `short_text`) — MVP is Yes/No; mark the others as later.

Do **not** delete these — just make it unambiguous they are not live, so the backend team doesn't try to wire them.

---

## Task 7 — housekeeping

- **Confirm `.env` is gitignored** (it is, per `.gitignore`) and that **no secrets** are committed anywhere (`Rules.md` §14, Pass 1). This front end has none yet — keep it that way.
- Do **not** add any real API keys, Supabase URLs, or tokens in this patch.
- Keep all data in the existing localStorage/mock store. No backend calls.

---

## Definition of done for this patch

- [ ] Loved One onboarding collects **consent attestation** (required) and **address** (required).
- [ ] `LovedOne` type has `consentAttestedByCarePartner`, `consentAttestedAt`, `consentConfirmedAt`, and required `address`.
- [ ] Loved One views show a **consent-status badge** (awaiting / confirmed), read-only, with a backend TODO.
- [ ] Medication message copy + preview reflect the **three-option, all-medicines-named** flow.
- [ ] **Google** button on sign-in and sign-up (placeholder handler).
- [ ] Buddy & Doctor steps show the **"we'll notify them"** note (no checkbox).
- [ ] v2/Could-have UI clearly marked non-functional.
- [ ] No secrets; `.env` gitignored; data still mock/localStorage.
- [ ] `npm run build` passes.
- [ ] A short report listing every file changed and what changed in it.

---

## What NOT to do

- ❌ Do not restructure the app, routing, or component hierarchy.
- ❌ Do not restyle or swap the design system.
- ❌ Do not add consent to the Care Partner, Local Buddy, or Doctor numbers — **elder only**.
- ❌ Do not build interactive-list / button *logic* for WhatsApp — that is n8n's job. Copy + preview only.
- ❌ Do not integrate Supabase, n8n, or any backend in this patch.
- ❌ Do not delete the v2/Could-have screens — just mark them non-functional.

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 22 July 2026.*
