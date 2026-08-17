| Field | Value |
| --- | --- |
| **Document** | PostDemoEnhancements.md — v1.8 |
| **Project** | ElderWise · AIGF Cohort 7 · Group 7 |
| **Date** | 17 August 2026 |
| **Status** | Deferred by ruling — scheduled to begin after Demo Day, 29 August 2026 |

## Purpose

This register holds work that is **correct to do and wrong to do now**.

Every item below was found during the 8 August verification pass, confirmed against a live artefact, and deliberately deferred. Deferral was ruled by the Team Lead on 9 August 2026 on the following basis:

- **No item here has a user-facing consumer.** No screen, message, or workflow reads the values in question.
- **The remedies carry more risk than the defects.** They touch tables every scheduler queries each minute, on one shared database, while nine testers work against it and 110 of 122 test cases remain unrun.
- **The binding constraint is the test run, not the code.** Demo Day is 29 August 2026.

This document exists so that deferral is a decision with a date attached rather than a set of findings that quietly rot. Nothing is dropped; everything is scheduled.

## Known cost of deferring

Until the routine tables carry real timestamps, **no tester report of the form "the app changed my data" can be verified after the fact.** This was hit on 8 August investigating a day-of-week report from a tester: the current row state was readable, but its prior state and edit history were not.

**Mitigation while deferred:** when a tester reports unexpected data, capture the row state immediately rather than investigating later.

## The register

### PD-1 · Routine tables have no `created_at` / `updated_at`

**Layer:** database, then frontend · **Owner:** Talal (migration), Cursor (mappers)

`medications`, `food_routines` and `health_routines` carry neither column. OBSERVED across all 17 public tables on 8 August 2026.

Remedy: add `created_at timestamptz NOT NULL DEFAULT now()` and `updated_at timestamptz NOT NULL DEFAULT now()`, plus a `BEFORE UPDATE` trigger maintaining `updated_at`. **Migration belongs to the Team Lead. No one else writes it.**

**Open decision — backfill.** Existing rows have no true creation time. `start_date` is the only candidate and it is user-editable, so backfilling from it bakes a fiction in permanently. Recommendation: backfill to `now()` and treat pre-migration rows as unknowable. Not yet ruled.

**Blocks PD-2.**

### PD-2 · Routine timestamps are fabricated from `start_date`

**Layer:** frontend · **Owner:** Cursor · **Blocked by:** PD-1

`src/lib/supabase/mappers.ts` sets both `createdAt` and `updatedAt` from `row.start_date` for all three routine domains — lines 172–173, 209–210, 251–252. OBSERVED 9 August 2026.

`start_date` is *the date a routine becomes active*, presented as *when the record was created*. They are different concepts, and because `start_date` is user-editable, editing it silently rewrites that routine's apparent creation history.

Remedy once PD-1 lands: map the real columns, and remove `createdAt` / `updatedAt` from write payloads so the database owns them rather than the client.

### PD-3 · `updatedAt` copied from `created_at` (existing item C3, scope corrected)

**Layer:** frontend only — no migration required · **Owner:** Cursor

`mappers.ts` lines 90–91, 319–320, 344–345 assign `updatedAt: row.created_at`. These tables **do** have `created_at`; the mapper invents `updatedAt` because the TypeScript type demands a value.

Remedy: either drop `updatedAt` from the type, or add a real column if edit tracking is genuinely wanted. Distinct from PD-1/PD-2 — nothing is missing from the database here, the frontend is simply asserting something untrue.

C3 was previously scoped to care partners, buddies and doctors. It should be read as covering every fabricated timestamp in `mappers.ts`.

### PD-4 · Revisit D-7 once routines carry `updated_at`

**Layer:** decision · **Owner:** Talal · **Blocked by:** PD-1

D-7 ruled that `elders.updated_at` would not be added. If the three routine tables gain `updated_at`, that exclusion becomes inconsistent and must either be reversed or explicitly re-scoped as "elders only, deliberately".

### PD-5 · Dashboard edit handlers lack the `ALL_DAYS` fallback

**Layer:** frontend · **Owner:** Cursor · **Priority:** P3

The three edit handlers in `src/components/loved-ones/routine-tabs.tsx` (~lines 138, 393, 526) call `setEditing({ ...item })` with no empty-array fallback. Onboarding guards this at `src/lib/onboarding.ts` 513, 531, 550.

**Currently unreachable.** OBSERVED 8 August: `days_of_week` is `NOT NULL DEFAULT '{}'` on all three tables, the Zod schema enforces `.min(1)` with no `.default()`, and zero empty or single-day rows exist live. Defensive hardening, not a fix.

### PD-6 · A-33 — redelivery after check-in closure

**Layer:** n8n (WF-5) · **Owner:** Talal / Claude · **Priority:** P3

The A-25 early exit sits after `Resolve Check-in`. A redelivery arriving once the check-in has closed resolves zero rows and falls to the no-open-check-in path instead of silent suppression — the dedup is never consulted on that path.

**17 August 2026:** the A-26 reply is **retired**. The false branch now calls WF-9. A redelivery after closure may ingest as a journal entry (`voice_journals.media_id` UNIQUE) rather than send the old "nothing to check" text. The early-exit ordering issue remains.

Remedy: move `Already Processed?` ahead of `Resolve Check-in`, directly after `Valid media_id?`. It depends only on `media_id` from the trigger. Costs one SDK cycle plus an HTTP credential re-bind.

### PD-7 · E2 — rotate WF-2's webhook when the repo goes private

**Layer:** infrastructure · **Owner:** Talal

WF-2's webhook id is committed in the repo. When the repository is made private after Demo Day, rotate it. Per n8n finding #1, WF-2 owns the Meta callback and **must only ever be edited in the n8n UI** — an SDK update rotates the `webhookId` and silently kills inbound traffic.

### PD-8 · A-23 — voice-notes retention undecided

**Layer:** policy, then implementation · **Owner:** Talal

Nothing deletes objects from the private `voice-notes` bucket. Retention has never been ruled. The bucket holds recordings of elderly people's voices, so this is a data-protection decision before it is an engineering one.

### PD-9 · Google OAuth — decouple authentication from onboarding

**Layer:** Next.js (auth + routing) · **Owner:** Talal · **Priority:** P3

Withdrawn from the MVP on 10 August 2026 (D-8), reversing open item C1. The "Continue with Google" buttons were placeholders that fired a toast and did nothing; they were removed from the sign-in and sign-up pages the same day.

Adding it back is not a configuration change. `ensureCarePartnerProfile` can only run where `fullName` and `timeZone` are available from a form submit handler, so an OAuth callback lands a session with no `care_partners` row — a third state `postAuthPath()` cannot express, and one that fails silently because `countOwnActiveElders` returns `0` on error across four call sites.

Remedy: a profile-creation path independent of form input, a third routing state distinguishing "no profile" from "no elder", and a decision on where the OAuth user supplies their timezone. Full reasoning in `Architecture.md` §7.1.

### PD-10 · Care Partner is told a reminder was sent when nothing was delivered

**Layer:** n8n (WF-6) · **Owner:** Talal / Claude · **Priority:** P2

WF-3c sweeps a check-in to `missed` on elapsed schedule alone, without regard to whether it was ever delivered. WF-6 then dispatches `elderwise_ct_missed_notice`, whose approved body states "We sent a reminder and haven't heard back" — fixed template copy, not conditional logic, so it is false on every path where no message went out.

Observed 9–10 August 2026: eight medication check-ins with `sent_at IS NULL` transitioned to `missed` roughly 30 minutes after `scheduled_for` while `elderwise_ep_medication_checkin` sat in Meta review, and Care Partners were notified. This is not specific to template problems — Meta rate limiting, a rotated credential, an invalid handset number, or the WhatsApp account going down (R1, unmitigated under A-5) all produce the identical state.

**Ruled by Talal, 10 August 2026 (D-9): accepted for the MVP, deferred to after Demo Day.** WF-3c is the sole owner of the `missed` transition, there is no defined target state for a never-sent check-in, and the test run is incomplete — the remedy carries more risk than the defect before the 29th.

Remedy (post-demo): leave WF-3c untouched. Guard **WF-6** so the Care Partner Missed Notice is suppressed when `sent_at IS NULL`. The row still records `missed`, ownership does not move, no enum or migration is needed. One guard IF on the existing zero-row-safe pattern. Revisit separately whether a never-sent check-in should carry a distinct terminal state, and whether Sama's Missed Notice copy should stop asserting that a reminder was sent.

### PD-11 · A send failure has no recorded cause

**Layer:** schema + n8n (WF-0 / WF-1 / WF-1b / WF-1c / WF-3b / WF-6) · **Owner:** Talal · **Priority:** P2

`checkins.sent_at IS NULL` is currently the only evidence that a dispatch failed, and it is silent about *why*. Diagnosing the 9–10 August medication outage required reading n8n execution JSON by hand to reach Meta error 132001; nothing in the database, the dashboard, or the Verification Console could have surfaced it. Every distinct failure mode collapses into the same undifferentiated NULL:

- template not approved, pending re-review after an in-place edit, or rejected (Meta 132001 / 132000 / 132005)
- Meta rate limiting or throttling
- rotated, revoked, or wrongly auto-assigned credential (see n8n finding #4)
- invalid or unreachable handset number
- WhatsApp Business account suspended or unavailable (R1 — no backup account, A-5)
- 24-hour-window or opt-in state problems

Remedy (post-demo): persist the cause of a failed dispatch — at minimum a nullable `send_failure_reason` (text) and `send_attempted_at` on `checkins`, written by the same nodes that would otherwise write `sent_at`, plus the Meta error code where one exists. This requires a migration, which stays with Talal. Once present it feeds three things that do not exist today: a real detector for **A-30** (the ±5-minute dispatch P1 that nothing currently reports), an accurate Missed Notice under PD-10, and a Verification Console check a tester could run without n8n access.

Depends on: nothing. Blocks: a genuine A-30 detector.

### PD-12 · SOS templates 10/12 need `_v2` + conditional WF-4 routing

**Layer:** Meta templates + n8n (WF-4) · **Owner:** Talal · **Priority:** P2

**Context (D-10, 11 August 2026).** Absent Local Buddy / Doctor fields now substitute **`Not on Record`** at send time (WF-4 Load Care Circle). That is safer than the opaque literal `NA`, but it does **not** fix the prose in the approved bodies.

Templates **10** and **12** contain sentences that cannot absorb an absent name:

- Template 10: *Local Buddy* {{3}} and Doctor {{4}} have also been alerted.
- Template 12 closing: His/Her family and local buddy have been alerted.

With the current substitution those lines still assert that a non-existent person was notified (e.g. "Local Buddy Not on Record … have also been alerted"). **Accepted for Demo Day with eyes open.**

Template **11** is unaffected — its *Doctor*: {{4}} / *Hospital/Clinic*: {{5}} label:value structure reads correctly with any substitution.

**Remedy (post-demo):** new **`_v2`** templates (Rules **W8** — never edit approved templates in place) **plus conditional routing in WF-4** so each absent-contact leg uses a body that omits the false assertion. A substitution-only change is not enough. Conditional `_v2` was specified and then **rejected before Demo Day** because each leg needs an IF plus a duplicate WhatsApp send node on the P0 SOS path, with 18 days to Demo Day and 110 of 122 test cases unrun — **scheduling risk**, not a copy preference.

**Latent data bug (confirmed 11 August 2026, not a demo risk on current data):** `lct_name_na` is built as `lc.first_name || ' ' || lc.last_name`. In Postgres, `NULL` in a `||` concat nulls the whole expression, so a buddy who exists but has no last name would render as **"Not on Record"** — indistinguishable from having no buddy at all. Verified against live data the same day: 3 local caregivers, 2 doctors, zero null name parts, zero null numbers, zero null clinic names. Fix with `COALESCE` / `concat_ws` when Load Care Circle is next touched.

Depends on: Meta approval of `_v2` SOS templates. Blocks: nothing else in this register.

### PD-13 · Align Care Circle "active" share-link filter with the reveal path

**Layer:** Next.js (Care Circle UI) · **Owner:** Cursor · **Priority:** P3 · **Source:** A-37

Reveal rejects expired tokens (`revoked_at` **and** `expires_at`). A-36 taught `activeLinks` / header revoke to use `isActiveShareLink` (revoked + expiry), but the Care Circle list empty-state and row membership still key off `unrevokedLinks` (`!revokedAt` only) — expired-unrevoked rows remain listed (labelled "(expired)"), and the empty copy still says "No active share links" only when none are unrevoked.

**Measurement (11 Aug 2026):** 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued.

**Assessed and deferred 11 August 2026.** The filter mismatch is real but not observable until 10 September 2026. Align list membership / empty-state with the reveal path (or confirm expired rows should stay visible for revoke) after Demo Day.

### PD-14 · Elder-wide cap on concurrent unrevoked share links

**Layer:** schema (+ optional UI) · **Owner:** Talal · **Priority:** P3 · **Source:** A-38

A-36 added `doctor_share_links_one_active_cp_link` for dashboard-issued only (`revoked_at IS NULL AND sos_event_id IS NULL`). That partial index **excludes SOS-minted rows by predicate**. Nothing limits total concurrent unrevoked credentials per elder across both origins; SOS-minted remain uncapped by design (A-36 Not addressed).

**Measurement (11 Aug 2026):** 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued.

**Assessed and deferred 11 August 2026.** Decide post-demo whether an elder-wide cap (or revoke-on-SOS-resolve) is required; any migration stays with Talal.

### PD-15 · `countOwnActiveElders` treats query errors as zero elders

**Layer:** Next.js (`src/lib/auth-routing.ts`) · **Owner:** Cursor · **Priority:** P2 · **Source:** onboarding-trap investigation 12 August 2026

`countOwnActiveElders` does `if (error) return 0`. A failed elders count is therefore indistinguishable from a genuinely empty result. Every consumer of `hasOwnProductElder` then treats an **onboarded** Care Partner as needing onboarding:

- `src/app/(app)/layout.tsx` → `redirect("/onboarding")`
- `RequireAuth` / `RequireGuest` / `RequireOnboarding` in `src/components/auth/route-guards.tsx`
- post-auth redirects on sign-in / sign-up

**Why not a throw today:** the three client guards run the check inside a `useEffect` IIFE. An unhandled rejection leaves `gate = "loading"` and renders `AuthLoading` forever — worse than a wrong redirect for Demo Day.

**Deferred 12 August 2026 (Talal):** ship the onboarding Sign out exit first (Architecture §7.1). Post-demo, return a Result (`ok` + count | error) and fail closed with an explicit error UI — never map errors to “needs onboarding”.

### PD-16 · Automated cleanup of abandoned signups

**Layer:** database (preferred: Supabase `pg_cron` migration — Talal) or n8n · **Owner:** Talal · **Priority:** P3 · **Source:** onboarding-trap investigation 12 August 2026

Accounts that never finish onboarding leave a `care_partners` row (often `whatsapp_number` NULL) and zero active elders. That shape is **byte-identical** to a Care Partner mid-onboarding — so the discriminator must be **TIME, never state**.

**Predicate (all must hold):**

- no elder with `active = true`
- AND `created_at < now() - 7 days`
- AND `coalesce(last_sign_in_at, created_at) < now() - 7 days`  
  (`last_sign_in_at` is on `auth.users`; join from `care_partners.id`)

**Hard exclusions — never delete, regardless of age**, if the account has any of:

- an active elder (`elders.active = true`)
- any check-in
- any SOS event
- any doctor share link

**Rejected:** any rule keyed on “no active elder” alone. It deletes live mid-onboarding sessions.

**Two-phase, never one-shot (14 days from last activity to deletion):**

1. **Flag.** Add `stale_flagged_at` to `care_partners`. A daily job flags matches and emails a warning. Any sign-in clears the flag.
2. **Delete.** A second job removes only rows flagged more than 7 days earlier and still matching the predicate + exclusions.

**Audit before delete.** Write every deletion (`id`, `email`, counts of cascaded rows) to an audit table **before** the delete runs. The FK chain from `auth.users` is CASCADE all the way to `checkins` and `sos_events` — once it fires there is nothing to recover from.

**Placement:** Supabase `pg_cron` (migration, Talal) is simpler than n8n, which would need the service-role key to reach the auth schema. Decide at build time.

**Deferred 12 August 2026.** Out of Demo Day scope; account-semantics risk if rushed. Complements the onboarding Sign out exit (local draft clear) — does not replace it.

### PD-17 · Voice journal retention

**Layer:** storage + product policy · **Owner:** Talal · **Deferred 17 August 2026 (Talal)**

Voice audio and transcripts are stored indefinitely with no expiry. Accepted for the capstone. A retention policy is owed after Demo Day.

Related: A-23 / PD-8 (voice-notes bucket objects) and A-24 (consent does not cover storing recordings). This item is the product-level retention decision, not the bucket-cleanup mechanism.

### PD-18 · Waitlist email deliverability

**Layer:** n8n / email · **Owner:** Talal · **Deferred 17 August 2026 (Talal)**

WF-8 confirmations send from a personal Gmail account via OAuth. Adequate for the capstone. A real transactional provider with a verified sending domain is the post-demo fix.

### PD-19 · Waitlist email uniqueness — **open decision**

**Layer:** database / WF-8 · **Owner:** Talal · **Opened 17 August 2026. Not resolved.**

There is no unique constraint on `waitlist.email`. Duplicates are permitted at the database.

A unique index would dedupe, but under an insert-only, no-select policy a unique violation is the only signal an anonymous caller ever receives back — which makes it an **email-enumeration oracle**.

**Options (neither chosen):**

1. Leave duplicates and dedupe in WF-8 on `lower(email)`.
2. Add a unique index and accept the oracle.

Do not write uniqueness up as settled. Record any future ruling here.

### PD-20 · `duration_seconds` unavailable

**Layer:** Meta payload / WF-9 · **Owner:** Talal · **Deferred 17 August 2026 (Talal)**

`voice_journals.duration_seconds` is always NULL. Meta's inbound audio payload carries `id`, `mime_type` and `sha256` — no duration. The UI cannot show a length. Known limitation, not a defect.

**Options for later:** derive duration from the OGG container, or request `verbose_json` from Whisper.

### PD-21 · WF-4c does not deduplicate by phone number

**Layer:** n8n (WF-4c) · **Owner:** Talal · **Deferred 17 August 2026 (Talal)**

One person holding several care-circle roles receives one stand-down message per role. Observed 17 August 2026: three identical messages to a single handset because Care Partner, Local Buddy and Doctor shared a number. Correct by design (S-6 attributes per role), but poor presentation.

**Deliberately not changed before Demo Day** — WF-4c is on the live SOS path.

### PD-22 · Frontend `SOSStatus` type mismatch

**Layer:** frontend types vs `sos_status` enum · **Owner:** Cursor / Talal · **Deferred 17 August 2026**

The frontend type is `active | acknowledged | resolved | cancelled`. The database enum is `open | resolved`. None of the four frontend values matches `open`. Pre-existing, unrelated to WF-9 / WF-10, worth resolving after Demo Day. Display mapping is already documented in `Architecture.md` §5.5.

### PD-23 · `resolved_by_role` has no `elder` value

**Layer:** schema + WF-4c · **Owner:** Talal · **Deferred 17 August 2026 (Talal)**

The enum is `care_partner, local_caregiver, doctor`. An elder-initiated cancel (WF-10, Option A) cannot record who stood the alert down and leaves the column NULL, so WF-4c falls back to `"Someone"`. Adding `elder` also requires an elder branch in WF-4c's resolver lookup.

### PD-24 · Delete control on the Loved One profile page

**Layer:** frontend · **Owner:** Cursor · **Deferred 17 August 2026 (Talal)**

Hard delete of a Loved One shipped on the list page only (`/loved-ones` dialog → `DELETE /api/loved-ones/[id]`). A matching control on `/loved-ones/[id]` was deliberately out of scope so the list remains the single entry point.

## Explicitly NOT deferred

Recorded here so nobody mistakes them for register items:

| Item | Why it stays live |
| --- | --- |
| WhatsApp template greeting ("Good morning" at all hours) | Meta review is outside our control and has its own clock. Submitted and under review as of 9 August 2026. |
| WF-1b Postgres connection timeout | A scheduler that silently fails to materialise check-ins means check-ins that never fire. Demo Day is the exposure. |
| The 67 remaining test cases | The binding constraint on the whole project. Reconciled 12 August 2026: 54 passed, 1 failed, 1 invalid pending re-run, 4 pending, 2 declined, 60 never touched, out of 122. |
| Test-data cleanup before Demo Day | Historical rows skew the dashboard statistics shown during the demo. |

## Change log

| Date | Version | Change |
| --- | --- | --- |
| 17 Aug 2026 | 1.8 | **PD-24 added.** Delete control on `/loved-ones/[id]` — deliberately out of scope of the list-page hard delete (17 August 2026). |
| 17 Aug 2026 | 1.7 | **PD-20–PD-23 added.** `duration_seconds` always NULL (Meta payload has no duration). WF-4c no phone-number dedupe (observed three identical stand-downs to one handset). Frontend `SOSStatus` vs DB `open\|resolved`. `resolved_by_role` has no `elder`. PD-6 updated: A-26 reply retired; redelivery after closure may ingest as a journal. |
| 17 Aug 2026 | 1.6 | **PD-17 / PD-18 / PD-19 added.** Voice journal retention (indefinite, accepted for capstone). Waitlist email from personal Gmail (transactional provider post-demo). Waitlist email uniqueness — **open decision**, not resolved. |
| 12 Aug 2026 | 1.5 | **PD-16 added.** Automated cleanup of abandoned signups — time-based discriminator (not “no active elder” alone), two-phase flag→delete (14 days), audit table before CASCADE, prefer `pg_cron`. Also corrects “Explicitly NOT deferred” test-case count from 110 unrun → 67 remaining (reconciled 12 August 2026). |
| 12 Aug 2026 | 1.4 | **PD-15 added.** `countOwnActiveElders` `if (error) return 0` footgun — failed query looks like empty; all four gates send onboarded CTs to onboarding. Client guards cannot simply throw (AuthLoading forever). Deferred after shipping onboarding Sign out. |
| 11 Aug 2026 | 1.3 | **PD-13 and PD-14 added.** From Architecture A-37 / A-38 (assessed and deferred). PD-13 — align Care Circle "active" share-link filter with reveal (observable from 10 September 2026). PD-14 — elder-wide cap on unrevoked share links; note A-36's partial index excludes SOS-minted rows by predicate. Measurement: 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued. |
| 11 Aug 2026 | 1.2 | **PD-12 added.** SOS templates 10/12 need `_v2` + conditional WF-4 routing (D-10). Records accepted demo prose defect after `Not on Record` substitution, and the latent `||` null-concat bug on `lct_name_na`. |
| 10 Aug 2026 | 1.1 | **PD-9, PD-10, PD-11 added.** PD-9 — Google OAuth withdrawn from the MVP (D-8); requires decoupling auth from onboarding. PD-10 — suppress Care Partner Missed Notice when `sent_at IS NULL` (D-9 accepted for MVP). PD-11 — persist send-failure cause (feeds A-30 / PD-10). |
| 9 Aug 2026 | 1.0 | Register created. PD-1 to PD-8 recorded and deferred to after Demo Day by ruling of the Team Lead. |
