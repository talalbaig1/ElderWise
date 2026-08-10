| Field | Value |
| --- | --- |
| **Document** | PostDemoEnhancements.md — v1.1 |
| **Project** | ElderWise · AIGF Cohort 7 · Group 7 |
| **Date** | 10 August 2026 |
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

The A-25 early exit sits after `Resolve Check-in`. A redelivery arriving once the check-in has closed resolves zero rows and falls to the no-open-check-in reply (A-26) instead of silent suppression — the dedup is never consulted on that path.

Remedy: move `Already Processed?` ahead of `Resolve Check-in`, directly after `Valid media_id?`. It depends only on `media_id` from the trigger. Costs one SDK cycle plus an HTTP credential re-bind. A confusing message, not data corruption.

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

## Explicitly NOT deferred

Recorded here so nobody mistakes them for register items:

| Item | Why it stays live |
| --- | --- |
| WhatsApp template greeting ("Good morning" at all hours) | Meta review is outside our control and has its own clock. Submitted and under review as of 9 August 2026. |
| WF-1b Postgres connection timeout | A scheduler that silently fails to materialise check-ins means check-ins that never fire. Demo Day is the exposure. |
| The 110 unrun test cases | The binding constraint on the whole project. |
| Test-data cleanup before Demo Day | Historical rows skew the dashboard statistics shown during the demo. |

## Change log

| Date | Version | Change |
| --- | --- | --- |
| 10 Aug 2026 | 1.1 | **PD-9, PD-10, PD-11 added.** PD-9 — Google OAuth withdrawn from the MVP (D-8); requires decoupling auth from onboarding. PD-10 — suppress Care Partner Missed Notice when `sent_at IS NULL` (D-9 accepted for MVP). PD-11 — persist send-failure cause (feeds A-30 / PD-10). |
| 9 Aug 2026 | 1.0 | Register created. PD-1 to PD-8 recorded and deferred to after Demo Day by ruling of the Team Lead. |
