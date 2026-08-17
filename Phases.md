# ElderWise — Phases

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Team** | AIGF Cohort 7 · Group 7 · **10 members** (Patrick Correya has left the team) · Team Lead: Talal Baig |
| **Document** | Phases.md — v1.24 |
| **Date** | 17 August 2026 |
| **Demo Day** | **Saturday 29 August 2026** |
| **Companion docs** | `PRD.md` · `Architecture.md` · `Rules.md` · `Templates.md` |

---

## 1. The shape of the plan

ElderWise is **two systems that meet at the database** (`Architecture.md` P1). Therefore the build runs as **two parallel tracks** from day one:

```
                        ┌──────────────────────────────────────────┐
   TRACK A  ───────────▶│  Dashboard (Next.js)                     │
   Dashboard            │  screens (fake data) → wire DB → auth UI │
                        └───────────────────┬──────────────────────┘
                                            │
                                     they meet ONLY here
                                            │
                                    ┌───────▼────────┐
                                    │    Supabase    │
                                    └───────▲────────┘
                                            │
                        ┌───────────────────┴──────────────────────┐
   TRACK B  ───────────▶│  Message path (n8n + WhatsApp)           │
   Message path         │  templates → workflows → STT → SOS       │
                        └──────────────────────────────────────────┘
```

**Why parallel, not sequential.** Track B contains the only dependency we do not control: **Meta template approval.** Templates get rejected and resubmitted, and that takes calendar time we cannot compress. If Track B waits for Track A to finish, we are submitting templates in mid-August and betting the whole capstone on Meta approving them first time. **Track B starts now.**

The two tracks cannot block each other — that is the entire reason the architecture separates them.

### 1.1 Track A sequence (Akhil's method, with one amendment)

1. **Screens with fake data** — screen by screen, sign off on design before touching a database.
2. **Wire to Supabase — single seeded user, no login UI.**
3. **Add the auth UI on top** — signup, signin (email + password), multi-user.

> **The amendment, and why it matters.** Step 2 was originally "connect the database *without login*." That quietly means *build the tables with no RLS* — and RLS retrofitted afterwards is exactly how one family ends up seeing another family's data. **X1 (cross-family access) is a release blocker** in `Rules.md` §14.
>
> **The fix costs nothing and keeps the sequence intact:** seed **one real Supabase auth user** and have the app sign in as them automatically during step 2. You still develop against a single user with no signup flow to fight — but **every table carries RLS from its first migration** and `auth.uid()` is real from day one. Step 3 then becomes what it should be: building the **login UI**, not retrofitting the **security model**.

---

## 2. Sprint calendar

| Sprint | Dates | Theme |
|---|---|---|
| **Sprint 3** | 6 – 19 July | Foundations · screens · **template submission starts** |
| **Sprint 4** | 20 July – 2 August | Both tracks build in earnest |
| **Sprint 5** | 3 – 16 August | Integration · auth · end-to-end |
| **Sprint 6** | 17 – 29 August | **Security gate** · hardening · rehearsal · **Demo Day 29 Aug** |

**Today is 4 August 2026 — Sprint 5 (integration · auth · end-to-end). Demo Day is 29 August (~25 days left).**

---

## 3. Phase 0 — Foundations *(Sprint 3, by 19 July)*

Nothing else can start cleanly until these are done. Several are already overdue.

| # | Task | Owner | Blocking |
|---|---|---|---|
| 0.1 | **Every member has a GitHub account** — confirm all 10 | Talal | Branch assignment → all coding |
| 0.2 | Monorepo created, `/docs` committed (PRD, Architecture, Rules, Phases), `.cursor/rules` committed | Talal | Everything |
| 0.3 | Branch-per-member set up; `main` protected | Talal + Bharathkumar | Parallel work |
| 0.4 | Supabase **Dev** + **Prod** projects created (free tier = exactly 2) | Ferdous | Track A step 2 |
| 0.5 | n8n instance provisioned; dev/prod workflows separated | Robert | Track B |
| 0.6 | ~~`Templates.md` written~~ — **DONE 14 Jul.** 14 templates + 5 free-form messages, verified against Meta's live docs. | Talal | 0.7 |
| 0.7 | **🔴 Meta template submission BEGINS** | Talal | **The critical path. See §7.** |
| 0.8 | ~~STT provider decided — Google STT vs ElevenLabs (A-1)~~ — **DONE 2 August 2026:** **OpenAI Whisper** (Talal). See `Architecture.md` §3 / A-1. | Talal | WF-5 |
| 0.9 | Sentry projects created, **PII scrubbing configured before it is switched on** (X9) | TBD | Observability |
| 0.10 | Role assignment for all 10 members — §8 | Talal | Accountability |

**Exit criteria:** every member can clone, branch, and run the app locally. **Templates are with Meta.**

---

## 4. TRACK A — Dashboard (Next.js)

### A0 · Front-end reconciliation patch *(immediate — before wiring)*
Sama's front end is substantially built (all screens, typed domain model, onboarding wizard, SOS cascade). A reconciliation pass on 22 Jul found it predates three decisions and must be patched **before** it is wired to the database. **Owner: Cursor**, per `patch_frontend.md`. The patch adds: **elder consent** (M16 — CT attestation + read-only confirmation-status badge), **elder address** (M17), the **medication two-step response** (M12), **Google OAuth**, and a buddy/doctor "added" acknowledgement. Docs were realigned the same day and again for vocabulary/SOS layers (`Architecture.md` §5.5): the front end's **per-routine** escalation model was adopted into the schema; **SOS display vs dispatch** are documented as two layers (FE cascade is presentation only; Meeting-11 parallel dispatch is the real behaviour); **Local Buddy is optional**. Vocabulary: Loved One / Care Partner / Local Buddy / Family Doctor ↔ EP / CT / LCT / DR — see `Architecture.md` §5.5.

**🚪 GATE A0.** Patch applied; consent + address collected in onboarding; no design regressions. Then proceed to A1/A2.

### A1 · Screens with fake data *(Sprint 3 → mid-Sprint 4, by ~26 July)*

Build all 8 screens against hardcoded fixtures. **No database. No auth. No API.**

| Screen | Owner |
|---|---|
| Landing (signup/signin — **UI only, non-functional**) | TBD |
| Dashboard (medication % · health · food · SOS panel · filters) | TBD |
| Edit Profile "Loved One" (food / medication / wellness profiles) | TBD |
| Care Circle (Local Buddy · Doctor · issue+revoke share link) | TBD |
| SOS History (timeline · filters) | TBD |
| Voice Journal (**hard-coded demo placeholder** — FR-DB-6) | TBD |
| Reports (timeline dropdown · download) | TBD |
| Settings (timezone · frequency + escalation overrides · password) | TBD |
| Onboarding wizard (4 steps: Get Started · Care Circle · Wellness Details · Review) | Superseded by **A4** |

**Design authority:** Sama (UI/UX). Mobile prototype → **converted to web**.

**🚪 GATE A1 — design sign-off.** Every screen reviewed, no outstanding design issues, Sama and Talal sign off. **Do not proceed to A2 with an unresolved screen.** Rebuilding a screen after it's wired to a database costs three times as much.

### A2 · Wire to Supabase — single seeded user, RLS ON *(Sprint 4 → early Sprint 5, by ~7 Aug)*

> **Sequence change (recorded):** A3 (authentication) was taken **before** A2.4 (onboarding writes), against the written order. Reason: after A2.3 added a server-side auth gate, the deployed app had no route to the dashboard, and A2.4 would otherwise have written elders scoped to `auth.uid()` while the UI's notion of identity still came from `localStorage`.

| # | Task |
|---|---|
| A2.1 | ~~Schema migrations written (`Architecture.md` §5) — **RLS policies in the same migration as the table.** Never after.~~ — **DONE.** |
| A2.2 | ~~One **seeded auth user** + one seeded elder + fixture data. App auto-signs-in as that user.~~ — **DONE** (superseded by A3.3). |
| A2.3 | ~~Every screen reads and writes real data. Fixtures deleted.~~ — **DONE.** |
| A2.4 | ~~Onboarding wizard writes real records (elder, contacts, `domain_configs`, medications). **Includes the mandatory elder address (M17) and the CT consent attestation (M16a) — onboarding cannot complete without either.**~~ — **DONE.** |
| A2.5 | ~~Timezone handling implemented per `Rules.md` D3–D5 — IANA only, UTC storage, viewer-local display.~~ — **DONE** (PDF + share page use elder TZ — see `Architecture.md` §10; CT timezone INSERT-only). |
| A2.6 | ~~Doctor share link: issue, revoke, **server-side token validation** (`Architecture.md` §7.3).~~ — **DONE.** |
| A2.7 | ~~Dashboard SOS-resolution route handler + **authenticated webhook to n8n** (§8, WF-4).~~ — **DONE.** n8n receiver **ElderWise WF-4a - SOS Resolution Receiver** (`jeNrf7b7ne3JX2Xu`) + `src/app/api/sos/resolve/route.ts`, verified end to end in production **2 August 2026**. |
| A2.8 | ~~Reports / PDF generation.~~ — **DONE** (23–24 Jul). |
| A2.9 | ~~**Verification console** — read-only, approval-gated; closed `CheckId` registry; `/verify` outside `(app)`; `scripts/verify-console-phase4.mjs`.~~ — **DONE 4 August 2026** (`feat/verify-console`, commit `a7d88a8`). See `Architecture.md` §11.2, `Rules.md` C11. Migration `20260804130000_console_access.sql` written; Talal applies. |
| A2.10 | ~~**Public waitlist** — `public.waitlist` + insert-only RLS, `/waitlist` + landing `WaitlistSection`, `POST /api/waitlist`, **WF-8** email dispatch (`V9VTNaLGJkFGUTFN`).~~ — **DONE 17 August 2026.** WhatsApp confirmation (`elderwise_wl_confirmation`) is **pending Meta approval**, not delivered. |
| A2.11 | ~~**Hard delete Loved One** — `DELETE /api/loved-ones/[id]`, session RLS then Storage API + prefix sweep; list-dialog copy with live counts.~~ — **DONE 17 August 2026.** Soft delete rejected (Talal). Profile-page control deferred (PD-24). |
| A2.12 | ~~**Hard delete Care Partner account** — `DELETE /api/account`, collect-then-`deleteUser`, Settings → Account card.~~ — **DONE 17 August 2026.** Re-onboarding with the same email and WhatsApp numbers is the purpose. Export-before-delete deferred (PD-25). |

**Owner:** Ferdous (schema) + TBD (application wiring).

**🚪 GATE A2.** **Fully met** (including A2.7). All screens work on real data. **RLS is enabled on every table** — verified, not assumed.

### A3 · Authentication UI *(Sprint 5, by ~14 Aug)*

Because RLS and `auth.uid()` already exist, this is **UI work, not a security retrofit**.

| # | Task |
|---|---|
| A3.1 | ~~Signup / signin (Supabase Auth — **email + password**)~~ — **DONE.** Google OAuth was never built; the placeholder buttons were removed 10 Aug 2026 and the feature is withdrawn from the MVP — see `Architecture.md` §7.1 (D-8) and `PostDemoEnhancements.md` PD-9. |
| A3.2 | ~~Session handling (httpOnly cookies, SSR client), protected routes~~ — **DONE.** |
| A3.3 | ~~Seeded-user auto-login removed~~ — **DONE.** |
| A3.4 | ~~**Multi-user + multi-elder** — one CT with several EPs; elder selector~~ — **DONE.** |
| A3.5 | ~~**Rate limiting** — share reveal (platform IP) + PDF (per user id); Auth signup/login left to Supabase quotas (Pass 3)~~ — **DONE** (code landed; Upstash unset on Vercel so limiter currently no-ops — see `Architecture.md` A-8). |

**🚪 GATE A3 — the isolation test.** **RE-EARNED 27 July 2026** (evidence below). This is X1, and X1 is a release blocker.

> **Coverage note (`rls-cross-tenant.mjs`):** The script is structurally **pairwise** — `TENANT_A` ↔ `TENANT_B`, two directions. The **48 checks** (24 per direction) do **not** scale with tenant count; the July "48 across 6 care partners" was the same 48 checks. A reduced tenant count in env does not mean reduced RLS coverage.

> **24 July evidence invalidated by A4.0.** Pre-wipe tenants and all public rows were deleted; gate scripts seed nothing. **Re-earned 27 July 2026:** seed applied (`create-seed-user.mjs` + `supabase/seed.sql`); `scripts/rls-cross-tenant.mjs` **48/48** pairwise A→B and B→A; plus `verify-a3-auth.mjs`, `rls-proof.mjs`, `share-link-isolation.mjs`, `verify-pass2-writes.mjs`, `verify-seed-reads.mjs`, `verify-a4-2-care-circle.mjs` — **7 scripts green**.

### A4 · Onboarding restructure & schema alignment *(after A3 — docs 26 Jul; build next)*

> **Not** Architecture open item A-4 (SOS webhook — already closed). This is Track A phase **A4**.

| # | Task |
|---|---|
| **A4.0** | **Full data reset** — execute **at the start of the migration window**, not before (otherwise the team refills with test data). Sequence: (1) full backup (dashboard backup or `pg_dump`) — irreversible otherwise; (2) delete all rows in public tables; (3) delete **all** Supabase Auth users (`care_partners.id` FK → `auth.users`; truncating public alone leaves accounts and `ensureCarePartner` silently recreates rows); (4) re-onboard two fresh tenants and update `.env.local` (`TENANT_A_*` / `TENANT_B_*` including elder IDs); (5) re-run `scripts/rls-cross-tenant.mjs`, `rls-proof.mjs`, `share-link-isolation.mjs`, and the `verify-*` scripts against the new schema. No Storage buckets in use; Redis holds only self-expiring rate-limit keys. **Discharges Architecture open item A-7.** |
| A4.1 | Schema migrations per `Architecture.md` v1.7: enum `not_required` **in its own migration first**; then column add/rename/drop, `times` CHECK length 1, doctor WA nullable, `clinic_name`, Review consent columns, `sos_notifications` skip fields. RLS re-verified (new columns inherit policies). |
| A4.2 | Care Circle write path — `SECURITY INVOKER` RPC (`Architecture.md` §5.7); remove `skipLocalBuddy` / `skipDoctor` draft flags and the KNOWN LIMITATION in `onboarding-actions.ts`. |
| A4.3 | UI — 4-step flow (Get Started progress chrome on `/sign-up` · Care Circle · Wellness Details · Review). Named step IDs. Add-another progress = **Step N of 3**. Field lists per `PRD.md` §7.1. Care Circle must surface the RPC one-draft error (`You have an unfinished Loved One draft — resume or discard it first`) as a **resume-or-discard choice**, not a raw error toast. |
| A4.4 | Post-login alignment — Settings, Care Circle tab, Loved One detail, `routine-tabs`, reports loader, doctor share page (`load-share-data.ts` → elder timezone), mappers, seed. |
| A4.5 | **Rebuild demo seed data** against the new schema (`supabase/seed.sql` + any demo fixtures) so Demo Day tenants match A4 columns and enums. Explicit deliverable — not optional cleanup. |
| A4.6 | Privacy/Terms rewrite **content** (supplied for approval — not drafted by agents) landed on `/privacy` and `/terms` so Review consent is honest. Must follow `PRD.md` §12.4 (no registered entity; demo/capstone disclosures; dated `consent_terms_version`). |
| A4.7 | Track B handoff — ~~Robert implements WF-6 per-routine `notify_care_partner`~~ — **discharged 3 Aug** (WF-6 built on `notify_care_partner`; A-9 closed). WF-4 doctor skip logging remains part of the WF-4 build (owner: Talal). |

**🚪 GATE A4 — PASSED 27 July 2026.** All of the following:

- [x] A4.0 wipe completed with backup; two fresh tenants in env; GATE A3 **re-earned 27 July 2026** (7 scripts green; `rls-cross-tenant.mjs` 48/48 pairwise A→B and B→A)
- [x] Schema matches `Architecture.md` §5.2 (incl. enum ordering); unused-column register respected
- [x] Onboarding is 4 steps; Care Circle atomic RPC; Review four consents; Not Required warning placeholder present
- [x] Demo seed rebuilt (A4.5) — applied and read back (`verify-seed-reads.mjs`)
- [x] Share page renders in elder timezone; no non-WhatsApp phone capture in product paths
- [x] RLS + verify scripts green on new schema — **7 scripts:** `verify-a3-auth.mjs`, `rls-cross-tenant.mjs` (48/48), `rls-proof.mjs`, `share-link-isolation.mjs`, `verify-pass2-writes.mjs`, `verify-seed-reads.mjs`, `verify-a4-2-care-circle.mjs`

---

## 5. TRACK B — Message path (n8n + WhatsApp)

Runs **in parallel with Track A from day one.**

### B1 · Templates & channel *(Sprint 3 — STARTS NOW)*

| # | Task | Owner |
|---|---|---|
| B1.1 | **`Templates.md`** — draft every message: 3 check-ins, 3 reminders, CT interaction notice, CT missed notice, SOS alert (×3 recipients), SOS nudge, SOS resolved, unclear-voice re-ask | Talal + Sama |
| B1.2 | Copy reviewed against `Rules.md` §9 (tone) — **read every string aloud imagining your own parent receiving it at 8am** | Sama + Reema |
| B1.3 | **Submit templates to Meta** — one by one, tracking status | Talal |
| B1.4 | Meta Cloud API connected to n8n; webhook receiving; **signature verification** (X3) | Robert + Talal |
| B1.5 | **Consent flow built** — **DONE 3 August 2026.** Verified on real WhatsApp, including the decline path (closes `Templates.md` OT-7). Schema: `consent_requested_at` / `consent_declined_at`. **WF-1 gates on `consent_confirmed_at`.** | Robert + Talal |

### B2 · Core workflows *(Sprint 4–5)*

> **Sixteen-workflow map** (`Architecture.md` §8). **All message-path workflows built as of 4 Aug 2026**, including **WF-5** voice → STT and **WF-3c** orphan cancel branch. **Remaining:** Sentry (§11 P0); A-25 idempotency; A-26 silent-drop; A-27/A-28/A-29; WF-3a guard; `some_of_them` fourth gate; Sama copy items.

| # | Workflow | Owner | Status |
|---|---|---|---|
| B2.0 | **WF-0 Consent Welcome Dispatch** (`n1EcFnlIDRMB5MEi`) — cron 5 min; claim-then-send | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug |
| B2.1 | **WF-1 Medication Scheduler** (`sqFa3XkYSEEVgPpC`) — materialise + dispatch; honours `days_of_week` | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug (evening pass) |
| B2.1b | **WF-1b Food Scheduler** (`J0HQ47OKo21whK9G`) | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug evening |
| B2.1c | **WF-1c Health Scheduler** (`2HgbXGM0Z5XQArf1`) | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug evening |
| B2.2 | **WF-2 Inbound Router** (thin, `oHSNqoskL0nOoOfo`) + **WF-2a** logic (`Ne4rNaezpjn95UMM`) incl. `food_health_response` | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug (evening pass) |
| B2.3 | **WF-3a** *Medication Response Handler* / **WF-3b** *Reminder Sweep (All Domains)* / **WF-3c** Missed (all domains) / **WF-3d** Food & Health Response | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug evening; **renamed** 4 Aug (WF-3a/3b/6 titles; WF-2 unchanged) |
| B2.4 | **WF-6 Care Partner Notifications (All Domains)** (`6I6OC7qJ5YhhUQxU`) — templates 8 and 9; notify via check-in FKs | Claude (in-session) · Talal (approval/test) | **DONE** 3 Aug (evening pass); **renamed** 4 Aug |

### B3 · Voice & SOS *(Sprint 5)*

| # | Workflow | Owner | Note |
|---|---|---|---|
| B3.1 | **WF-5 Voice → STT** (`IC6oR4fuQd2VMkfQ`) — WF-2a `voice_note` route; Whisper + LLM gate; `voice-notes` bucket; voice→medication mapping | Talal | **DONE 4 August 2026.** Test 1: zero open check-ins — chain routes, WF-5 halts before media fetch. Test 2: live medication check-in — `response_value=yes_all`, `status=responded`, `response_channel=voice`, one `checkin_medication_items` row (Vitimin D at 06:01; Panadol at 10:00 excluded), CT notice **"Status: Taken"**. **Re-ask cap proven 4 Aug:** two unclear notes — first incremented `reask_count` to 1 and sent re-ask; second saw `prior_reasks=1`, terminated at *Re-ask Already Used - Falls To Missed Path* (Send Re-ask / Increment absent from run data). **Correction:** re-ask cap was **not** proven on 3 August — no `voice_replies` row had `reask_count > 0` that day. |
| B3.2 | **WF-4 SOS family** — WF-4 (`HSEp1YhQFHjga9qa`) + WF-4b + WF-4c + WF-4d + existing WF-4a. **Alert + 3 nudges** (not 4 nudges). | Talal | **DONE 3 August 2026.** Proven E2E on real WhatsApp: dispatch to three recipients with `NA` substitution and share-link minting; resolution attributed by `context.id` to two different roles from a single shared number; template 14 broadcast to all three; nudge round 1 with a single correct increment; two-minute gate declining to re-send. **Not proven:** nudge rounds 2 and 3 and exhaustion at `nudges_sent = 3` — schedule one deliberate four-round run at rehearsal (I3). |
| B3.3 | **WF-2a audio branch** + voice→medication mapping + workflow renames (WF-3a *Medication Response Handler*, WF-3b *Reminder Sweep (All Domains)*, WF-6 *Care Partner Notifications (All Domains)*; WF-2 unchanged) | Talal | **DONE 4 August 2026**, published via UI |
| B3.4 | Three throwaway harness workflows archived | Talal | **DONE 4 August 2026** |
| B3.5 | **`cancelled` check-in status** — two DB migrations (`checkin_status` + `cancelled_at`); frontend support (`25114ed`); WF-3c **Cancel Orphaned Check-ins** branch | Talal | **DONE 4 August 2026.** Migrations applied. Frontend: types, mappers, status pill, `report-analytics` `statusBreakdown`; `adherence()` untouched in both analytics files. WF-3c cancel branch proven live on check-in `4af31e90` (Panadol 10:00, routine disabled — cancelled within 60 s; three enabled check-ins untouched). |
| B3.6 | **WF-9 Voice Journal Ingest** (`2KWtzSH22fTNxed9`) + **WF-10 SOS Cancel Handler** (`CPDmCJh8e1WO8Sod`) + `voice_journals` (RLS, no insert) + WF-5 / WF-2a rewires | Talal | **DONE 17 August 2026.** Full manual test pass on the **live handset**: journal classification correct across five transcripts; past-tense guard (`"I fell last week"` → `attention`, no SOS); emergency fired with three care-circle notifications all `sent`; cancel resolved in 18 seconds; medication button and voice-reply-to-check-in unaffected. B3.1 Test 1 (halt before media fetch on no open check-in) is **superseded** — that branch now calls WF-9. |

**Remaining (Track B):** Sentry (`Architecture.md` §11 P0). A-25 / A-26 / A-27 / A-28 / A-29 and the WF-3a guard are closed or accepted; `some_of_them` is A-12 accepted. OT-9 wording signed off; OT-10 parked with Sama.

**🚪 GATE B.** An elder confirms consent and only then begins receiving check-ins. A real WhatsApp number receives a real check-in, a Yes/No button reply is recorded, a voice reply is transcribed and recorded, a missed check-in escalates to the CT, and an SOS reaches all three recipients and can be resolved from **both** channels.

---

## 6. Integration, security & demo *(Sprint 5 → Sprint 6)*

### I1 · Integration *(by ~16 Aug)*
Both tracks meet at the database. A message sent by n8n appears on the dashboard. An SOS resolved on the dashboard stops n8n nudging. **End-to-end, on a real phone.** That is the only test that counts (`Rules.md` §11).

### 🔒 I2 · SECURITY GATE *(17 – 22 Aug — Sprint 6, week 1)*

**The full six-pass regime in `Rules.md` §14.** Not a code review. A dedicated, scheduled, owned block of time.

| Pass | Focus |
|---|---|
| 1 | Secret leak (service-role key, Meta token, n8n webhook secret) |
| 2 | Personal-data flow (what reaches OpenAI, the STT provider, Sentry) |
| 3 | Pre-deploy production audit |
| 4 | Deep audit: auth, RLS, share link, both webhooks |
| 5 | Attacker's perspective |
| **6** | **ElderWise-specific — X1…X12** |

**Release blockers: X1** (cross-family data access) and **X2** (forged SOS resolution). Findings logged with severity and owner (SR5).

**Owner:** Talal. **Nothing ships through a failed gate without a recorded decision.**

### I3 · Hardening & rehearsal *(23 – 28 Aug)*
Fix security findings · **full end-to-end rehearsal on a real phone** · demo script · deck / video · **pre-recorded working demo as insurance** (see R1) · demo-day readiness checklist (NFR-10) — **including: Supabase Prod project is NOT paused.** Free-tier projects auto-pause on inactivity. That alone could kill the demo for the dumbest reason imaginable.

### 🎤 Demo Day — 29 August 2026

---

## 7. 🔴 The critical path: Meta template approval

**Cleared early (2 August 2026).** Every EP-facing message is a Meta-approved template. All **14** templates are approved (`Templates.md` §9 — "Cleared early"). The 9 August channel go/no-go is **resolved: WhatsApp as planned**; Telegram fallback is moot.

Historical risk (kept for context): templates get **rejected**, and resubmission costs calendar days. That risk no longer blocks the demo channel.

| Date | Milestone |
|---|---|
| **By 19 July** | `Templates.md` complete; **first submissions with Meta** |
| ~~**By 2 August**~~ | ~~All templates submitted; rejections resubmitted~~ — **DONE.** All 14 approved 2 August 2026 (`Templates.md` §9 — "Cleared early"). |
| ~~**🚦 9 August — CHANNEL GO / NO-GO**~~ | **RESOLVED:** WhatsApp as planned. All 14 templates approved 2 Aug. Telegram fallback is moot. |
| **By 16 August** | All templates approved — **met early (2 Aug).** |

### 7.1 The fallback — and an honest warning about it

The proposal was a **second channel (Telegram)** so the demo could run even if templates failed.

**Status (3 Aug 2026):** the 9 August channel go/no-go is **cleared**. WhatsApp is the channel. Telegram fallback is **moot**.

**Historical note — two things that had to be checked before committing to Telegram:**

1. **⚠️ Telegram may be banned in India** — flagged by this team earlier (Sama). **Demo Day is the India Demo Day.** If that ban is real, Telegram is the *worst* possible fallback for this specific audience: the room may not be able to see it work. *(Owner was Talal. Verify-by-20-July item is superseded by the cleared go/no-go.)*
2. **A second channel costs real build time** in a 46-day window, and the message path is already the harder half of the product.

**Cheaper insurance (still useful):**
- **Submit templates early** — done; all 14 approved 2 Aug.
- **Record a working demo video** in Sprint 5, while everything works. If the live demo fails on stage for *any* reason — network, a paused Supabase project — you still show a working product.

> If the team ever re-opens a second channel, `Architecture.md` would need a channel-abstraction layer (one send/receive interface, two adapters) so workflows don't fork. **That is a design change, not a config change.**

---

## Post-Demo Day work (out of phase scope)

Work deferred until after Demo Day (29 August 2026) is tracked in **`PostDemoEnhancements.md`** (PD-1–PD-11). It is **not** in scope for any current phase.

---

## 8. Roles

**10 members** (Patrick Correya has left the team).

| Member | Role |
|---|---|
| **Talal Baig** | Team Lead · WhatsApp Business API + Meta templates · security gate owner · repo · **WF-4 (SOS orchestrator)** · **WF-5 (voice → STT)** |
| **Mirza Ferdous Ohid** | Database schema lead · Supabase migrations + RLS |
| **Sama Quraishi** | UI/UX lead · design system · message copy & tone |
| **Robert Nadra** | n8n infrastructure · Meta webhook / channel ops |
| **Bharathkumar Kasinathan** | Screens · repo support |
| **Reema Akhtar** | Copy review + QA (proposed) — owner: Reema to confirm role |
| **Sandhya "Sandy" Babu Kunadian** | Submitted **PR #2** (WF-3 and WF-6, 24 July) — **action: close, do not merge** (hand-adds `n8n/workflows/*.json`, collides with export script). Work re-imported to the shared n8n instance. |
| **Aimé Habimana** | Role to be confirmed — owner: Aimé / Talal |
| **Anil Kumar B** | Role to be confirmed — owner: Anil / Talal |
| **Jaimin Patel** | Role to be confirmed — owner: Jaimin / Talal |

### Remaining ownership gaps

| Work | Owner / status |
|---|---|
| WF-5 (voice → STT) | **Talal** — **only remaining Track B workflow** |
| Sentry (error reporting) | **Deferred** until all workflows complete (Talal, 3 Aug) — X9 scrubbing still required before switch-on |
| SOS nudge exhaustion (`nudges_sent = 3`, event stays `open`) | Assigned to a team member as a **rehearsal test scenario** (I3) |
| **Action: close PR #2** (Sandy) | **Close, do not merge** — hand-adds `n8n/workflows/*.json`, colliding with the export script that wipes and rewrites that directory |
| Application wiring (Track A2) | Needs owner — Talal to assign |
| Most of the 9 screens (Track A1) | Needs owner — Talal to assign |
| Sentry setup + PII scrubbing | Needs owner — Talal to assign |
| QA / end-to-end testing | Needs owner — Talal to assign |
| Demo-day deck + video | Needs owner — Talal to assign |

> **Remaining Track B workflow: WF-5 only** — **historical (3 August 2026).** WF-9 and WF-10 shipped 17 August 2026 (B3.6). Sentry remains deferred.

---

## 9. Risks

| # | Risk | Mitigation |
|---|---|---|
| **R1** | **Meta template rejection** — the critical path | Submit in Sprint 3. Go/no-go 9 Aug. Recorded demo as insurance. |
| **R2** | **One WhatsApp account, no backup** — the demo dies with it | **Still unmitigated.** Get a second account. |
| **R3** | **Team capacity** — 10 members, 5 unassigned, historic attendance of 3–6 per meeting | Close §8 at the next sync. Sukin's rule: follow up twice politely; the third time, build without them. |
| **R4** | **Scope creep** — both mentors' stated concern about this team | Must-have only. Rules.md S1. |
| **R5** | **Security findings surfacing late** | Gate is scheduled (17–22 Aug), not left to the end. X1/X2 block release. |
| **R6** | **Supabase free-tier auto-pause** on Demo Day morning | On the readiness checklist. Touch Prod weekly through August. |
| **R7** | ~~**A second channel (Telegram) eats the schedule**~~ — **moot.** Channel go/no-go cleared 2 Aug (WhatsApp; all 14 approved). | Closed |

---

## 10. Change log

| Date | Version | Change |
|---|---|---|
| 17 Aug 2026 | 1.24 | **Routine default time +2 min.** `ROUTINE_DEFAULT_TIME_OFFSET_MINUTES` = 2 (live-demo create must not be swept to missed before dispatch). Account-delete audit: `storage_remaining` `-1` on sweep failure. |
| 17 Aug 2026 | 1.23 | **Care Partner account delete delivered.** A2.12: `DELETE /api/account` (collect elders / storage keys, then `auth.admin.deleteUser`). |
| 17 Aug 2026 | 1.22 | **Loved One hard delete delivered.** A2.11: `DELETE /api/loved-ones/[id]` (session RLS, then `voice-notes` Storage API + prefix sweep). Soft delete rejected. |
| 17 Aug 2026 | 1.21 | **Voice journal + SOS cancel delivered.** WF-9 (`2KWtzSH22fTNxed9`), WF-10 (`CPDmCJh8e1WO8Sod`), `voice_journals` with RLS, WF-5 / WF-2a rewires. Full manual test pass on the live handset, 17 August 2026. Recorded as B3.6. |
| 17 Aug 2026 | 1.20 | **Waitlist delivered.** Table + insert-only RLS, public form, `POST /api/waitlist`, WF-8 email dispatch (`V9VTNaLGJkFGUTFN`). WhatsApp confirmation pending Meta approval of `elderwise_wl_confirmation` — not delivered. Recorded as A2.10. |
| 10 Aug 2026 | 1.19 | **D-8 — Google OAuth withdrawn from the MVP.** §1.1 step 3 and A3.1 corrected: auth is email + password only. A3.1 previously claimed Google OAuth was **DONE** when it was never built — false-completion claim struck; placeholders removed 10 Aug; work deferred as `PostDemoEnhancements.md` PD-9. Post-demo range updated to PD-1–PD-11 (adds PD-9 / PD-10 / PD-11). |
| 9 Aug 2026 | 1.18 | **Post-Demo Day register.** Deferred work lives in `PostDemoEnhancements.md` and is **not** in scope for any current phase (ruling 9 Aug 2026). |
| 4 Aug 2026 | 1.17 | **Verification console delivered (Track A).** A2.9 DONE — read-only `/verify` console, `console_access` gate, Phase 4 behavioural tests green; `Architecture.md` §11.2, `Rules.md` C11. |
| 4 Aug 2026 | 1.16 | **Cancelled check-ins DONE.** Two migrations; frontend `25114ed`; WF-3c cancel branch proven on `4af31e90`. A-27–A-29 opened. Remaining: Sentry, A-25, A-26, A-27–29, WF-3a guard, `some_of_them`, Sama copy. |
| 4 Aug 2026 | 1.15 | **Voice pass DONE.** WF-5 built + E2E proven (medication `yes_all`, CT "Taken"). WF-2a audio branch; voice→medication mapping; renames (WF-3a/3b/6); harnesses archived. Re-ask cap correction: proven 4 Aug, not 3 Aug. Sixteen-workflow map. Remaining: Sentry, A-25, A-26, WF-3a guard, `some_of_them` gate, Sama copy. |
| 3 Aug 2026 | 1.14 | **All-domain pass DONE (evening).** Health 19:15, food 19:30, `No` → `responded` + CT notice ("Dinner"). Fifteen-workflow map (+WF-1b/1c/3d). A-16 closed. Remaining Track B: **WF-5 only**. Sentry deferred; SOS nudge exhaustion = rehearsal scenario. |
| 3 Aug 2026 | 1.13 | **WF-4 SOS DONE.** B3.2 built as WF-4/4b/4c/4d (+ WF-4a); E2E proven on real WhatsApp (dispatch, `context.id` attribution, template 14, nudge round 1). Remaining Track B workflow: **WF-5 only**. PR #2 close-not-merge action recorded. |
| 3 Aug 2026 | 1.12 | **Correction pass.** B2 owners corrected: WF-0–WF-6 built by Claude in-session with Talal approval/test (not Robert). WF-4 and WF-5 owner = Talal (consistent across §5 / §8). Sandy: PR #2 (WF-3/WF-6) pending, will close not merge. §7 channel go/no-go cleared (WhatsApp; all 14 approved 2 Aug). Track B remaining = WF-4, WF-5, health + food; WF-1/3a/3b/3c medication-only. Footer → 3 Aug. |
| 3 Aug 2026 | 1.11 | **Track B build of 3 Aug.** B1.5 consent **DONE** (real WhatsApp, including decline — closes `Templates.md` OT-7). B2.1–B2.4 **DONE** (WF-1 NFR-6 verified at 26 s; WF-2 thin + WF-2a; WF-3a/3b/3c; WF-6). Remaining Track B: **WF-4** SOS orchestrator and **WF-5** voice → STT. Header date → 3 Aug (~26 days to Demo Day). |
| 2 Aug 2026 | 1.10 | **A2.7 DONE** — n8n WF-4a receiver `jeNrf7b7ne3JX2Xu` + `src/app/api/sos/resolve/route.ts`, E2E in production 2 Aug 2026. **GATE A2 fully met.** §0.8 STT = OpenAI Whisper (2 Aug). §5 B2: **WF-0** recorded; build order **WF-0 → WF-2 consent branch → WF-1**. Stale "Today is 14 July" header replaced. B1.5 points at consent_requested/declined migration (file only; Talal applies). |
| 27 Jul 2026 | 1.9 | **GATE A4 PASSED** (27 Jul 2026): all six checklist items ticked; evidence recorded (7 scripts, 48 pairwise RLS checks, seed applied/read back). GATE A3 **re-earned** 27 Jul (replaces invalidated 24 Jul evidence). `rls-cross-tenant` coverage clarification: 48 checks are pairwise A↔B and do not scale with tenant count. A4.5 seed backlog: `sos_notifications` row with `status = skipped`, `skip_reason = no_whatsapp_number`. |
| 27 Jul 2026 | 1.8 | A4.3: Care Circle one-draft RPC error must surface as resume-or-discard UI (not toast). |
| 26 Jul 2026 | 1.7 | A4.6 points at corrected `PRD.md` §12.4 legal posture (no entity; dated `consent_terms_version`). |
| 26 Jul 2026 | 1.6 | **A4 added** — onboarding restructure & schema alignment. **A4.0** full public + Auth wipe (discharges Architecture A-7); GATE A3 evidence marked **requires re-verification** after wipe; A4.5 demo seed rebuild; GATE A4 checklist. Not Architecture A-4 (SOS webhook). |
| 24 Jul 2026 | 1.5 | **Track A status sync.** A2.1–A2.6, A2.8 complete; A2.7 deferred (needs Robert's SOS webhook). A3.1–A3.5 complete; GATE A3 PASSED 24 Jul (48 checks, `scripts/rls-cross-tenant.mjs`). Recorded sequence change: A3 before A2.4 after the A2.3 auth gate left no dashboard path under localStorage identity. GATE A2 met except A2.7. |
| 23 Jul 2026 | 1.4 | **Companion-doc references no longer pin version numbers.** `main` is the single source of truth; pinned cross-references forced edits to every other doc on each version bump and went stale silently. Refs now name the file only. Each document's own version remains in its header. |
| 22 Jul 2026 | 1.3 | **Docs ↔ front-end reconciliation.** Companion doc versions bumped. A0 note updated: SOS display vs dispatch are two layers; Local Buddy optional; vocabulary points at `Architecture.md` §5.5. |
| 22 Jul 2026 | 1.2 | Added **A0 — front-end reconciliation patch** (owner: Cursor, per `patch_frontend.md`) as a gate before DB wiring, following the review of Sama's build. |
| 14 Jul 2026 | 1.1 | `Templates.md` complete (0.6 done). **B1.5 added — the consent flow, which gates every other check-in and must therefore be built first.** Onboarding (A2.4) now carries the mandatory elder address and the CT consent attestation. Gate B extended to require a consent confirmation before any check-in. |
| 14 Jul 2026 | 1.0 | Initial phase plan. Two parallel tracks (dashboard / message path), because Meta template approval is an uncontrollable long-lead dependency and must not wait behind the dashboard build. Track A follows Akhil's screens → database → auth sequence, amended so that step 2 uses a **seeded auth user with RLS enabled from the first migration** rather than a no-auth database — avoiding an RLS retrofit and the X1 release blocker. Security gate scheduled as a dedicated block (17–22 Aug). Channel go/no-go set for 9 Aug. Team reduced to 10 (Patrick Correya departed); 5 members and 8 work items remain unowned. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 4 August 2026.*
