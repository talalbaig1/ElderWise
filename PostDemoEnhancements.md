| Field | Value |
| --- | --- |
| **Document** | PostDemoEnhancements.md — v1.0 |
| **Project** | ElderWise · AIGF Cohort 7 · Group 7 |
| **Date** | 9 August 2026 |
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
| 9 Aug 2026 | 1.0 | Register created. PD-1 to PD-8 recorded and deferred to after Demo Day by ruling of the Team Lead. |
