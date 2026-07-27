# ElderWise — Phases

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Team** | AIGF Cohort 7 · Group 7 · **10 members** (Patrick Correya has left the team) · Team Lead: Talal Baig |
| **Document** | Phases.md — v1.8 |
| **Date** | 27 July 2026 |
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
3. **Add the auth UI on top** — signup, signin, Google OAuth, multi-user.

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

**Today is 14 July — we are mid-Sprint 3, with 46 days left.**

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
| 0.8 | STT provider decided — Google STT vs ElevenLabs (A-1) | Talal + Ferdous | WF-5 |
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
| A2.7 | Dashboard SOS-resolution route handler + **authenticated webhook to n8n** (§8, WF-4). — **DEFERRED.** Needs Robert's endpoint — the only point where Track A and Track B meet. |
| A2.8 | ~~Reports / PDF generation.~~ — **DONE** (23–24 Jul). |

**Owner:** Ferdous (schema) + TBD (application wiring).

**🚪 GATE A2.** Met **except A2.7** (deferred pending Robert's n8n webhook). All other screens work on real data. **RLS is enabled on every table** — verified, not assumed.

### A3 · Authentication UI *(Sprint 5, by ~14 Aug)*

Because RLS and `auth.uid()` already exist, this is **UI work, not a security retrofit**.

| # | Task |
|---|---|
| A3.1 | ~~Signup / signin (Supabase Auth — email + password **and Google OAuth**)~~ — **DONE.** |
| A3.2 | ~~Session handling (httpOnly cookies, SSR client), protected routes~~ — **DONE.** |
| A3.3 | ~~Seeded-user auto-login removed~~ — **DONE.** |
| A3.4 | ~~**Multi-user + multi-elder** — one CT with several EPs; elder selector~~ — **DONE.** |
| A3.5 | ~~**Rate limiting** — share reveal (platform IP) + PDF (per user id); Auth signup/login left to Supabase quotas (Pass 3)~~ — **DONE** (code landed; Upstash unset on Vercel so limiter currently no-ops — see `Architecture.md` A-8). |

**🚪 GATE A3 — the isolation test.** **PASSED 24 July 2026** (evidence: `scripts/rls-cross-tenant.mjs`, 48 checks). This is X1, and X1 is a release blocker.

> **⚠ GATE A3 evidence does not survive A4.0.** The 24–25 July runs authenticated as pre-existing tenants from env vars; those tenants and all public rows are deleted by the A4.0 wipe. The gate scripts **seed nothing**. After A4.0 + schema migration, GATE A3 must be **re-earned** against two fresh tenants. Do **not** leave A3 marked green as if the old evidence still holds — treat it as **requires re-verification** until the scripts pass again.

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
| A4.7 | Track B handoff — Robert implements WF-6 per-routine `notify_care_partner` (incl. `not_required`) and WF-4 doctor skip logging (`Architecture.md` A-9 / WF-4). |

**🚪 GATE A4.** All of the following:

- [ ] A4.0 wipe completed with backup; two fresh tenants in env; GATE A3 scripts **re-passed**
- [ ] Schema matches `Architecture.md` §5.2 (incl. enum ordering); unused-column register respected
- [ ] Onboarding is 4 steps; Care Circle atomic RPC; Review four consents; Not Required warning placeholder present
- [ ] Demo seed rebuilt (A4.5)
- [ ] Share page renders in elder timezone; no non-WhatsApp phone capture in product paths
- [ ] RLS + verify scripts green on new schema

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
| B1.5 | **Consent flow built** — welcome message → elder confirms / declines / stays silent. **WF-1 gates on `consent_confirmed_at`.** This blocks every other check-in; build it first. | TBD |

### B2 · Core workflows *(Sprint 4, by ~2 Aug)*

| # | Workflow | Owner |
|---|---|---|
| B2.1 | **WF-1 Scheduler** — cron, elder-timezone-aware, materialise check-ins, dispatch (±5 min, NFR-6) | Robert |
| B2.2 | **WF-2 Inbound router** — button / dropdown / voice / SOS / SOS-resolution | Robert |
| B2.3 | **WF-3 Response, reminder & escalation** — 30-min resend → missed → escalate **to CT only** | TBD |
| B2.4 | **WF-6 CT notification dispatch** — `every_interaction` \| `only_missed` | TBD |

### B3 · Voice & SOS — the hard parts *(Sprint 4 → Sprint 5, by ~10 Aug)*

| # | Workflow | Owner | Note |
|---|---|---|---|
| B3.1 | **WF-5 Voice → STT** — download audio → Storage → transcribe → derive answer → **treat exactly as a button tap** | TBD | **Never guess** (N3). Low confidence → re-ask once → then missed. |
| B3.2 | **WF-4 SOS orchestrator** — immediate dispatch → 4 nudges, 2 min apart → resolve via WhatsApp **or** dashboard → status re-check before every nudge | Robert + Talal | **The most important code in the repo (N2).** |

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

**This is the single most dangerous item in the entire plan.** Every EP-facing message is a Meta-approved template. Templates get **rejected**, and resubmission costs calendar days.

If templates are still unapproved in late August, Group 7 demos a product that cannot send a single message.

| Date | Milestone |
|---|---|
| **By 19 July** | `Templates.md` complete; **first submissions with Meta** |
| **By 2 August** | All templates submitted; rejections resubmitted |
| **🚦 9 August — CHANNEL GO / NO-GO** | If core templates are approved → **WhatsApp, as planned.** If approval is at serious risk → trigger the fallback below. |
| **By 16 August** | All templates approved, or the fallback is fully in flight |

### 7.1 The fallback — and an honest warning about it

The proposal is a **second channel (Telegram)** so the demo can run even if templates fail.

**Two things must be checked before committing to this:**

1. **⚠️ Telegram may be banned in India** — flagged by this team earlier (Sama). **Demo Day is the India Demo Day.** If that ban is real, Telegram is the *worst* possible fallback for this specific audience: the room may not be able to see it work. **Verify this first, before a single hour is spent building it.** *(Owner: Talal. Verify by 20 July.)*
2. **A second channel costs real build time** in a 46-day window, and the message path is already the harder half of the product.

**Cheaper insurance, available today:**
- **Submit templates in Sprint 3** (this is 0.7 — it buys weeks of rejection-and-resubmit headroom, and it is free).
- **Record a working demo video** in Sprint 5, while everything works. If the live demo fails on stage for *any* reason — templates, network, a paused Supabase project — you still show a working product.

**Recommendation:** do both of the cheap things now. Treat Telegram as a **decision to be taken at the 9 August go/no-go**, informed by (1), not as a commitment made today. If the ban is real, drop Telegram and rely on early submission + the recorded demo.

> If the team does adopt Telegram, `Architecture.md` gains a channel-abstraction layer (one send/receive interface, two adapters) so WF-1…WF-6 don't fork. **That is a design change, not a config change** — which is exactly why the decision needs a date and a deadline rather than drifting.

---

## 8. Roles

**10 members** (Patrick Correya has left the team).

| Member | Role |
|---|---|
| **Talal Baig** | Team Lead · WhatsApp Business API + Meta templates · security gate owner · repo |
| **Mirza Ferdous Ohid** | Database schema lead · Supabase migrations + RLS |
| **Sama Quraishi** | UI/UX lead · design system · message copy & tone |
| **Robert Nadra** | n8n infrastructure · WF-1, WF-2, WF-4 (SOS) |
| **Bharathkumar Kasinathan** | Screens · repo support |
| **Reema Akhtar** | `[TBD]` — proposed: copy review + QA |
| **Sandhya "Sandy" Babu Kunadian** | `[TBD]` — strongest engineering background on the team (Head of Development & AI); currently unassigned |
| **Aimé Habimana** | `[TBD]` |
| **Anil Kumar B** | `[TBD]` |
| **Jaimin Patel** | `[TBD]` |

### Unowned work — needs an owner at the next sync

| Work | Status |
|---|---|
| WF-3 (response, reminder, escalation) | **Unowned** |
| WF-5 (voice → STT) | **Unowned** |
| WF-6 (CT notifications) | **Unowned** |
| Application wiring (Track A2) | **Unowned** |
| Most of the 9 screens (Track A1) | **Unowned** |
| Sentry setup + PII scrubbing | **Unowned** |
| QA / end-to-end testing | **Unowned** |
| Demo-day deck + video | **Unowned** |

> **This table is the most important thing in this document.** Five of ten members are unassigned and eight significant pieces of work have no owner. On a 46-day clock, work without an owner is work that does not happen. **Close this at the next sync.**

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
| **R7** | **A second channel (Telegram) eats the schedule** — or is unusable in the demo venue | Verify the India ban by 20 July. Decide 9 Aug. Don't drift. |

---

## 10. Change log

| Date | Version | Change |
|---|---|---|
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

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 26 July 2026.*
