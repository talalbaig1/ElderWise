# ElderWise — Rules

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Team** | AIGF Cohort 7 · Group 7 (10 members) · Team Lead: Talal Baig |
| **Document** | Rules.md — v1.27 |
| **Date** | 13 August 2026 |
| **Audience** | **Every human on this team, and every AI agent (Cursor, Claude Code) working in this repo.** |
| **Companion docs** | `PRD.md` · `Architecture.md` · `Phases.md` |

> **Read this before writing a single line of code.**
> This file is the contract. Ten people across seven timezones are building one product in six weeks with AI agents that will happily generate whatever they're asked for. Without a shared set of rules, we don't get one product — we get ten, badly merged.
>
> **This file lives at `/.cursor/rules/` and is committed to the repo.** Cursor and Claude Code read it. It applies to them exactly as it applies to you.

---

## 0. The order of authority

When two things conflict, the higher one wins:

1. **`PRD.md`** — what the product does.
2. **`Architecture.md`** — how it's built.
3. **`Rules.md`** (this file) — how we work.
4. **`Phases.md`** — when things happen.
5. Anything an AI agent suggests.
6. Anything anyone remembers from a meeting.

If a document is wrong, **fix the document** — don't work around it in code. A codebase that has drifted from its PRD is a codebase nobody can reason about.

---

## 1. The five non-negotiables

These are not style preferences. Violating one of these is a bug, regardless of what the code does.

| # | Rule |
|---|---|
| **N1** | **ElderWise never diagnoses.** No medical advice, no symptom interpretation, no clinical inference, no "that sounds like it could be…". Not in an LLM prompt, not in dashboard copy, not in a WhatsApp template. ElderWise records facts and routes them to humans. It is a care-coordination tool, **not a medical device**. |
| **N2** | **The SOS path is sacred.** It is the most important code in this repository. It never queues behind routine traffic, never fails silently, and never auto-closes. A bug here is the worst thing this system can do to a family. Treat every change to WF-4 as high-risk. |
| **N3** | **Never guess on behalf of an elderly person.** If a reply cannot be understood with confidence, **ask again in plain language**. Never infer, never default, never assume. Guessing "yes" on a medication question because the audio was muddy is how a care tool becomes a liability. |
| **N4** | **Never add anything to the elderly person's surface area.** No app, no login, no link to click, no menu to navigate, no jargon, no error codes. Their entire experience is a WhatsApp message they answer with one tap or a short voice reply. Sukin's single biggest directive: *make the UX genuinely easy for elderly users.* Adding to it requires a decision from the team lead. |
| **N5** | **The elderly person must consent, herself.** WhatsApp requires recipient opt-in, and so does basic decency — we are about to message someone's mother several times a day. The CT attests at onboarding; **the elder confirms in-channel**; and until she does, **`consent_confirmed_at` is NULL and nothing is ever scheduled for her**. If she says no, she is never messaged again. **Silence is not consent.** |
| **N6** | **Data isolation is enforced at the database.** RLS on every table, no exceptions. A care partner must never be able to see another family's data — and that guarantee must not depend on application code being bug-free. |

---

## 2. Scope discipline

Both mentors flagged the same risk for this team: **feature overload**.

| # | Rule |
|---|---|
| **S1** | **Build Must-haves only.** Should-have (v2) and Could-have (v3) do not enter the MVP without an explicit decision from the team lead. Not "while I was in there anyway." Not "it was only ten minutes." |
| **S2** | **If it isn't in `PRD.md`, it isn't in the product.** Found something the PRD doesn't cover? That's not permission to invent — it's a gap to raise. |
| **S3** | **Never add a feature on an assumption.** Only what the PRD specifies. (Sukin's warning, verbatim.) |
| **S4** | **Deleting scope is a valid contribution.** If a Must-have turns out to be unbuildable in the time we have, say so early and loudly. Discovering it on 27 August is a catastrophe; discovering it on 27 July is a Tuesday. |

---

## 3. Rules for AI agents (Cursor, Claude Code)

You are working in a repository with ten contributors and a hard deadline. You are not a free agent.

| # | Rule |
|---|---|
| **A1** | **Read `PRD.md` and `Architecture.md` before generating code.** They are in `/docs`. They are the specification. Do not infer requirements from the codebase — the codebase may be wrong. |
| **A2** | **Do not invent features, fields, tables, or endpoints.** If the spec doesn't define it, stop and ask. A plausible-looking table nobody asked for is worse than no table. |
| **A3** | **Do not silently change the schema.** The database schema is in `Architecture.md` §5 and in `/supabase/migrations`. Changes go through a migration and a human review — never an ad-hoc `alter table` and never a quiet edit. |
| **A4** | **Do not introduce a new dependency, service, or library without asking.** Especially: no vector database, no ORM, no state-management library, no alternative auth. The stack is fixed (`Architecture.md` §3). |
| **A5** | **Do not build a RAG pipeline.** The team's older flow diagrams say "DB (RAG)". They are wrong — it's a relational lookup. **There is no pgvector, no embedding, no vector store, no RAG in this product.** (`Architecture.md` §3.1.) |
| **A6** | **When uncertain, ask. Do not fill the gap with a confident guess.** An agent that quietly assumes is more dangerous than one that stops. |
| **A7** | **Never touch WF-4 (SOS) casually.** Changes there get flagged for human review, always. |
| **A8** | **Never write a secret into client-side code.** See §7. If you are about to put anything in `NEXT_PUBLIC_*`, stop and check whether it belongs there. |

---

## 4. Architectural boundaries

From `Architecture.md` §1 (P1). These are the walls that let ten people work in parallel without colliding.

| # | Rule |
|---|---|
| **B1** | **n8n owns the message path.** Everything that sends, receives, schedules, retries, escalates, transcribes, or nudges over WhatsApp lives in n8n. |
| **B2** | **Next.js owns the dashboard.** Everything a human clicks: landing, auth, onboarding, dashboard, care circle, SOS history, reports, settings. |
| **B3** | **They meet at the database, not at each other.** No Next.js code sends a WhatsApp message. No n8n workflow renders a page. |
| **B4** | **One documented exception:** the Next.js route handler fires an authenticated webhook to n8n when an SOS is resolved from the dashboard — because on the SOS path, latency is the harm. The database is still the source of truth: **WF-4 re-checks `sos_events.status` before every nudge.** This exception is not a precedent. Do not add a second one without a team-lead decision. |
| **B5** | **n8n never calls Next.js.** Not once, not ever. |

---

## 5. Database rules

| # | Rule |
|---|---|
| **D1** | **Every schema change is a migration** in `/supabase/migrations`, committed to the repo. No changes made by clicking around the Supabase dashboard. If it isn't in a migration, it doesn't exist — and it will vanish the moment we rebuild the environment. |
| **D2** | **RLS on every table, from the first migration.** Not "we'll add it later." Later never comes, and a table without RLS is a data breach with a delay fuse. |
| **D3** | **All timestamps are `timestamptz`, stored in UTC.** Always. |
| **D4** | **All timezones are IANA strings** (`Asia/Kolkata`), never UTC offsets (`+05:30`). Offsets don't survive DST, and a reminder that fires an hour late is a broken product. |
| **D5** | **Schedules are computed in the elder's timezone. Timestamps are displayed in the viewer's timezone.** Never assume the elder and the care partner share a timezone — the entire premise of this product is that they don't. |
| **D6** | **No contact detail is stored twice.** Contacts live in `care_partners`, `elders`, `local_caregivers`, `doctors` — and are referenced by foreign key everywhere else. The old spreadsheet-shaped schema repeated phone numbers in every domain row; a number changed in one place and stale in two others is a missed SOS. |
| **D7** | **Audio files go in Supabase Storage.** The database stores the object path, never the file. |
| **D9** | **`elders.consent_confirmed_at` is a hard gate, not a flag.** Any code path that schedules or sends a check-in must check it first. A NULL means that elder has not agreed to be messaged. |
| **D10** | **`elders.address` is NOT NULL.** Mandatory even if Local Buddy / LCT is skipped. When an LCT exists, their SOS message carries the address — their purpose is to physically reach her. |
| **D8** | **Foreign keys and indexes are not optional.** In particular `elders.whatsapp_number` must be indexed — the inbound webhook hits it on every single message. |
| **D11** | **Drafts are hard-deleted; product data is soft-deleted.** A draft has no history worth keeping and holds a UNIQUE constraint (`elders.whatsapp_number`) hostage; a routine's history is the clinical record. **Never hard-DELETE a food/health/medication routine** — `checkins_*_routine_id_fkey` are `ON DELETE CASCADE` and would erase check-in history. **Two-column model (all three domains):** `enabled` = the Care Partner's pause switch (dispatch stops; the routine **stays visible** marked Inactive); `active` = the tombstone (soft-delete sets `active = false` AND `enabled = false`; the routine leaves the active list; history is kept). **Never reuse a user-facing field as a tombstone.** A paused routine (`enabled = false`, `active = true`) is shown as inactive and **never hidden**. Drop only unsent `scheduled` rows from today onward. |
| **D12** | **One time per medication row.** `medications.times` has exactly one entry (`CHECK (cardinality(times) = 1)`). Two doses a day = two medication rows (Duplicate). Do not reintroduce multi-time UI or writers. Do not use `array_length` for this CHECK — it returns NULL on `'{}'` and the constraint would pass. |
| **D13** | **Applied migrations are immutable.** Once a migration is recorded in `supabase_migrations.schema_migrations`, its file is never edited. Corrections ship as a new forward migration. Editing an applied migration means the repo no longer records what was actually run, and fresh environments diverge silently from production. |

---

## 6. n8n rules

| # | Rule |
|---|---|
| **W1** | **Workflows are exported to JSON and committed** to `/n8n/workflows`. A workflow that exists only in someone's n8n UI is not part of the product — it's a liability with a single point of failure named after a person. |
| **W2** | **Every workflow has an explicit error branch.** A failed node must never silently end an execution. Silence on the SOS path is the worst possible failure mode. |
| **W3** | **Every attempted WhatsApp send is logged with its `wa_message_id`, or it is not sent.** An unlogged message is an untraceable one, and we cannot debug what we cannot see. **Intentional non-sends are not silent failures:** (a) SOS doctor nudge with no channel → `sos_notifications` row with `status = skipped`, `skip_reason`, `wa_message_id` NULL, `sent_at` NULL; (b) routine `notify_care_partner = not_required` → no CT WhatsApp at all, miss still recorded on the dashboard. Configured mute ≠ workflow failure. |
| **W4** | **Credentials live in n8n's credential store**, never hardcoded in a node, never in a committed JSON export. **Scrub credentials before exporting.** |
| **W5** | **Dev and prod workflows are separate** inside the single n8n instance and point at different Supabase projects. Never test against prod. |
| **W6** | **n8n uses the service-role key and therefore bypasses RLS.** This is deliberate — n8n is trusted infrastructure. It also means an n8n bug can touch *any* family's data. Write these workflows accordingly. |
| **W7** | **The n8n instance is authoritative for workflows. The JSON under `n8n/workflows/` is a read-only snapshot and must never be re-imported.** Re-importing an export rotates trigger nodes' `webhookId` values. For WF-2, whose webhook is registered as the Meta WhatsApp callback, that **silently kills all inbound traffic** — messages stop arriving with no error anywhere. Use the exports for reading, diffing and review. To restore a workflow, rebuild it in the n8n UI. |
| **W8** | **Never edit an approved WhatsApp template in place. Create a `_v2`, get it approved, then repoint the workflow.** Editing an approved template returns it to Meta review. While it is `PENDING`, every send against that name fails with **error 132001 / HTTP 404 — `template name does not exist in <language>`**, and the *previous* approved version is unavailable too. There is no rollback. This cost 22 hours of medication outage on 9–10 August 2026. A one-word copy change to `elderwise_ep_medication_checkin` (removing a time-of-day greeting) put it into review; WF-1 then failed once a minute for over 1,400 executions, every medication check-in in that window went undelivered and was subsequently marked `missed`, and five of a tester's eleven passing negative cases were invalidated because they asserted that no medication message would arrive. **The required sequence, every time:** (1) Create a new template with a versioned name — `<name>_v2`, `_v3`, and so on (pattern already used by `elderwise_ep_health_checkin_v2` and `elderwise_ep_health_reminder_v2`). (2) Submit it and wait for **APPROVED**. Confirm with the read-only Template Audit workflow (`PADE2m75e6xVGS2e`) — do not rely on the WhatsApp Manager UI alone. (3) Only then repoint the workflow's send node at the new `name`\|`language`. Where the node is a WhatsApp node inside a webhook-bearing workflow, edit in the UI (n8n finding #7). (4) Leave the old template in place. Do not delete it until the new one has been observed sending successfully in production. **Language codes are `en`, not `en_US`.** The one `en_US` template in the account is Meta's `hello_world` sample. Template changes are Talal's alone — he holds the sole Meta dashboard account. |

---

## 6a. n8n implementation rules (pre-merge checklist)

> Every item below cost real debugging time on **3–4 August 2026**. Check each before merging a workflow change.

- [ ] **Never edit a workflow that contains a webhook trigger via the API.** `update_workflow` rotates the trigger node's `webhookId`. That changes the Meta callback URL and silently stops all inbound WhatsApp. **UI only** for webhook-bearing workflows (WF-2, WF-4a). Sub-workflows without a webhook are safe to update programmatically.
- [ ] **Guard every node that consumes a Postgres result — reads as well as writes.** An `INSERT`/`UPDATE` matching zero rows returns `{success: true}`, and so does a **CTE-based `SELECT`** matching zero rows. Only a simple single-statement `SELECT` reliably returns `[]`. Do not rely on statement type to decide whether a guard is needed. Guard everything. Proven twice on 3 August: WF-4c `Load Broadcast Recipients` and WF-4d `Find Due Nudge Recipients` are pure read queries on CTEs and both returned `{success: true}` on zero rows. In WF-4d that carried undefined values into the WhatsApp node. Consequence: on a one-minute cron, WF-4d would have errored every minute that no SOS was due — roughly 1,400 times a day — firing the error workflow into Telegram and Gmail each time, burying a real alert.
- [ ] **Guard every parameterised query's input.** An empty `queryReplacement` sends no parameters: there is no parameter `$1`.
- [ ] **Verify which credential n8n actually bound**, after every create and every update. It has bound the wrong one, dropped one, and silently corrected one. On **update**, `autoAssignedCredentials: []` means "no new assignments were made", **not** "the binding was dropped". Existing bindings persist across updates — verified 3 August.
- [ ] **Act on your own validity flags.** If a parser sets `parsed: false`, the next node must not run.
- [ ] **Delivery-status callbacks** (`statuses`, no `messages`) are normal inbound traffic and must be handled, not treated as errors.
- [ ] **A sub-workflow called from another sub-workflow must be published before it can execute.** A first-level call from a manual execution resolves the draft, but a second-level call goes through `getPublishedWorkflowData` and fails with *"Workflow is not active and cannot be executed."* This is broader than the known rule that a parent cannot be published until its children are. Production chains are three deep — WF-2 → WF-2a → WF-4b → WF-4c — so every workflow below WF-2a must be published. Failure mode observed 3 August: the resolution was written to the database and then the broadcast call failed, leaving an SOS marked resolved with nobody told, and the only trace an execution marked `error`. Architecture §11 classes this as **P0**.
- [ ] **Verify enum values before using them.** `checkins.response_channel` is `button | voice` — **not** `whatsapp`. It does not mirror `sos_events.resolved_channel`. Reasoning by analogy between similarly-named enums produces a runtime failure.
- [ ] **One writer per state transition.** A status change that triggers a notification must have exactly one workflow that performs it. Three workflows once marked check-ins `missed`; only one notified, and they raced.
- [ ] **Sub-workflow calls must resolve by ID, never by name.** Verified 4 August across all exports: every `executeWorkflow` node uses `mode=id` except WF-2's call to WF-2a, which is `mode=list` but still carries the ID as its value (`cachedResultName` is a display label only). This is why the WF-3a / WF-3b / WF-6 renames were safe.
- [ ] **A node's protection can live in its POSITION, not its guard.** WF-5 resolves the check-in **before** fetching any media, so an elder with no open check-in never has audio downloaded or stored. That ordering — not the WF-2a consent gate alone — is the real safeguard. Reordering it would remove the protection silently. **Ordering constraints must be documented as constraints.**
- [ ] **A plain single-statement SELECT returning zero rows halts the chain**, which can make a downstream "not found" branch **unreachable**. If that branch must run, either use the probe pattern (WF-3a's `FROM (SELECT 1) probe LEFT JOIN LATERAL …`) or `alwaysOutputData` paired with an IF that tests the empty case.
- [ ] **`alwaysOutputData` is only safe when paired with such an IF.** Alone it pushes an empty `{}` downstream and causes undefined reads.
- [ ] **Verify enum-vs-text before writing.** `response_value` is plain TEXT with no constraint; the database will not catch a wrong value. Only the human-facing template will, and only if someone reads it. (`checkins.response_channel` is `button | voice` — not `whatsapp`.)
- [ ] **Two branches off one trigger satisfy "one writer per state transition" ONLY when their selection sets are mutually exclusive by construction.** WF-3c's missed branch selects **enabled** routines and its cancel branch selects **disabled** ones; they cannot overlap, and each UPDATE re-checks status so a mid-run flag flip is safe in either execution order.
- [ ] **Adding an enum value is a FRONTEND-BREAKING change.** The DB-to-UI mapper is an exhaustive switch with **no default**: update the TypeScript union and deploy **before** any workflow writes the new value, or the mapper returns `undefined` at runtime and the status pill renders blank or throws. This deliberately inverts the docs-first / code-second habit — **and the inversion is correct** for enum additions.
- [ ] **`ON CONFLICT` cannot infer a partial unique index without its predicate.** If the index is `UNIQUE (col) WHERE col IS NOT NULL`, then `ON CONFLICT (col) DO NOTHING` fails at runtime — *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*. Write `ON CONFLICT (col) WHERE col IS NOT NULL DO NOTHING`. A bare `ON CONFLICT DO NOTHING` also works but silently swallows every other unique violation on the table, so prefer the explicit predicate. Cost of getting this wrong is total, not partial: the statement fails on **every** insert, not only on duplicates.
- [ ] **A POST to Supabase Storage does not overwrite.** Posting to an object key that already exists returns **409 Duplicate**. If a deterministic key is used for idempotency, add the `x-upsert: true` header — otherwise a retry-enabled node burns its retries and fires the error workflow.


## 7. Security rules

| # | Rule |
|---|---|
| **SEC1** | **The Supabase service-role key never reaches a browser.** Not in `NEXT_PUBLIC_*`, not in a client component, not in a props payload, not "temporarily for debugging." |
| **SEC2** | **The doctor share token is stored hashed.** The raw token exists only in the URL, shown once. |
| **SEC3** | **The doctor share route is server-side only.** Validate the token hash, check `revoked_at` and `expires_at`, scope the query to exactly one `elder_id`. Never hand a Supabase client to the doctor's browser. |
| **SEC4** | **The SOS-resolution webhook is authenticated** with a shared secret and called **server-side only**. Without this, anyone on the internet can resolve anyone's SOS. |
| **SEC5** | **Verify Meta's webhook signature** on every inbound message. |
| **SEC6** | **No secrets in the repo.** Ever. `.env` is gitignored; `.env.example` documents the shape with no values. If a secret is ever committed, it is burned — rotate it, don't just delete the commit. |
| **SEC7** | **This system holds health-adjacent data about vulnerable people.** We make no HIPAA/GDPR compliance claims, but we behave as though someone is watching, because the data deserves it. |
| **SEC8** | **The service-role key appears in exactly one Next.js module** (`src/lib/supabase/admin.ts`). Every other app path uses the anon key plus the user's session so RLS applies. A query that fails under RLS means the payload or ownership mapping is wrong — **never escalate privilege**. |

---

## 8. Code standards

Defaults, not dogma. Consistency across ten contributors matters more than any individual preference here.

| # | Rule |
|---|---|
| **C1** | **TypeScript, strict mode.** No `any` without a comment explaining why. |
| **C2** | **shadcn/ui components + Tailwind.** Don't hand-roll a component that shadcn already provides; don't introduce a second component library. |
| **C3** | **Server components by default.** `"use client"` only where interactivity actually requires it. |
| **C4** | **Data fetching happens on the server.** Never expose a query to the browser that RLS isn't protecting. |
| **C5** | **No `console.log` in committed code.** Errors go to Sentry. |
| **C6** | **Name things after the domain.** `elder`, `care_partner`, `local_caregiver`, `doctor`, `checkin`, `sos_event`. Not `user1`, `user2`, `contact_b`. UI labels (Loved One, Local Buddy, Family Doctor) map to these — see `Architecture.md` §5.5. The next person to read this code is a teammate in a different timezone at midnight. |
| **C7** | **The product is spelled *ElderWise*.** Not ElderVoice. Not Elder Wise. It slips in meetings; it does not slip in the codebase. |
| **C8** | **Every user-facing string is in English** (NFR-9). Multi-language is v2 — but don't hardcode strings in a way that makes v2 a rewrite. |
| **C9** | **Never render a percentage on a zero denominator.** Show "—" or "No data". 100% on no data reads as perfect adherence when nothing happened. This occurred twice: the meal-completion card and nearly the PDF generator. |
| **C10** | **This project uses `src/`, so every Next.js root-convention file lives in `src/` — `instrumentation.ts`, `middleware.ts`, and anything similar.** Root placement does not error, does not warn, and does not appear in the build output. It compiles to **nothing** and the feature is silently absent. Proven 4 August 2026: `src/instrumentation.ts` emitted `.next/server/instrumentation.js` (~1.5 MB) while root `middleware.ts` emitted an empty manifest (A-32). **Verify the build artifact, not the file's existence.** |
| **C11** | **The verification console (`src/app/verify/`, `src/app/api/verify/`, `src/lib/verify/`, `src/components/verify/`) is a fixed security surface.** It must never contain: free-text input; SQL strings or template-literal query assembly; `.rpc()`; writes on the **read** path (`.insert` / `.update` / `.delete` / `.upsert`); or any import of `createAdminClient`, `dashboard-analytics`, `report-analytics`, or `supabase/mappers`. The standing check is the §9 grep block in the console task spec (service-role / `getSession` / read-path writes / dashboard coupling / no `NEXT_PUBLIC_VERIFY`). Re-run before merge. |
| **C12** | **When a shared Zod schema gains a required field, enumerate every consumer before merging.** `safeParse()` accepts `unknown`, so a hand-built payload missing a newly-required property is **invisible to TypeScript**. `npx tsc --noEmit` will pass on code that fails at runtime for every user. **Observed 8 August 2026.** Wave 2 added a required `daysOfWeek` to `medicationSchema`, `foodRoutineSchema` and `healthRoutineSchema`. The three dashboard upserts in `src/lib/data/actions.ts` still built their payloads by hand and were never updated. Every dashboard routine save failed validation with "Invalid input" before touching the database. Type-checking passed, the diff review passed, and the regression reached production. **Required before merge:** grep for every `.safeParse(` and `.parse(` call site that feeds the changed schema, and confirm each payload carries the new field. A passing `tsc` is not evidence. |
| **C13** | **Any value the scheduler passes to Postgres must be validated at the point of entry.** `AT TIME ZONE e.timezone` runs across every elder in a single query — one invalid value throws for the whole batch and halts materialisation for all families. Time zones must be validated with `isValidTimeZone()`, a **runtime** check (does `Intl.DateTimeFormat` accept it), never list membership: `TIMEZONE_OPTIONS` is a convenience offset-grouped quick-pick list that still excludes legacy aliases such as `Asia/Calcutta`, which two live elders use, and `Intl.supportedValuesOf('timeZone')` returns canonical zones only. Learned from the 33-minute Track B outage of 10 August 2026 (`Asia/India`) and a second failure of the same class on 11 August 2026 (`Arabian Standard Time (AST)`), 18 hours apart and from different users (A-35). |
| **C14** | **A discarded Supabase read error is indistinguishable from an empty result.** `(res.data ?? [])` on a failed query yields an empty list that renders as "nothing here" — no error, no warning, no type failure. This is the read-path twin of the `if (!data)` write rule: a write denied by RLS returns no error and no rows, and a read that errors returns no rows either. **Every query in a loader must have its `.error` checked and logged with the table name.** Learned 11 August 2026: `load-app-data.ts` selected a non-existent column (`created_at`) from `doctor_share_links` (which has `created_by`), and the Doctor share links panel showed "No active share links" for every elder from the day it shipped while 13 live tokens existed (A-36). `tsc` could not catch it — loosely typed row access, same class as C12. |
| **C15** | **Check-in status reaches a human only after mapping BOTH the DB status and the response value, then a display formatter.** Never print a raw `checkins.status` enum (`responded`, `reminded`, `sent`, `scheduled`) to a doctor, PDF, CSV, or print view — those words are Track B vocabulary. Call `checkInStatusToUi(status, response_value)` (or load through a path that already maps), then `formatCheckInStatus` (and `formatCheckInStatusWithResponse` when the response text must sit beside the label). A `responded` row is **not** enough on its own to choose a UI status — `no` and `some_of_them` are negatives and must not render as Taken. Do not rely on CSS `capitalize` for semantics. Learned 11 August 2026 (A-29 rescope): the share page already title-cased via CSS but still showed "Reminded" for a delayed dose. |
| **C16** | **Routine CRUD owns same-day check-in propagation in Next.js — not n8n.** On create/update/soft-delete of `food_routines`, `health_routines`, or `medications`, sync today's `checkins` in the **elder's** IANA timezone using the materialiser slot expression (`(elder-local date + wall time) AT TIME ZONE elder.timezone`). Never modify a row with `sent_at` set; never hard-delete routines (D11); never collapse multiple routines by domain or meal name. Every write needs an explicit `if (!data)` check (RLS denial returns no error). CT must be told when a change applies from tomorrow because today's check-in already left. |
| **C17** | **Document version numbers are chosen at merge time, not branch time.** Immediately before bumping `Architecture.md`, `Rules.md`, or any companion doc, read the document headers on `main` (or the branch you are merging into) and confirm the next version — do not assume from memory or from the number you expected when the branch opened. Date the header and the changelog row to the **merge date**. Five version collisions in one day came from bumping at branch time against a stale tip. |
| **C18** | **Onboarding must offer a Sign out exit on every wizard step.** A CT with no product elder cannot reach Settings or `/sign-in` (guest gate bounces a live session back to `/onboarding`). Sign out clears the Supabase session and the local onboarding draft, then navigates to `/sign-in`. Warn when local progress exists; never block the exit. Do not invent a `?force=` guest bypass unless a verified race requires it. |

---

## 9. Copy and tone rules (WhatsApp + dashboard)

The elderly person's experience *is* the product. These rules matter as much as the code.

| # | Rule |
|---|---|
| **T1** | **Warm, short, plain.** "Good morning — did you take your blood-pressure tablet?" Not "MEDICATION REMINDER: Please confirm adherence." |
| **T2** | **One question per message.** Never two. Never a paragraph. |
| **T3** | **Never show an error code, a technical term, or a tool name to an elderly person.** If something breaks, they get a kind human sentence, not a stack trace. |
| **T4** | **Never imply a diagnosis or a judgement.** Not "You've missed 3 doses this week — this is dangerous." Just the facts, routed to the care partner. |
| **T5** | **Never make the elderly person feel monitored, scolded, or like a burden.** Read every string you write out loud, imagining your own parent receiving it at 8am. If it makes you wince, rewrite it. |
| **T6** | **Dashboard copy is factual, never alarmist.** The care partner is anxious by default; the product's job is to reduce that anxiety, not to farm it. |

---

## 10. Git & collaboration (11 people, one repo)

| # | Rule |
|---|---|
| **G1** | **Branch per member.** `feature/<name>-<what>`. Build in isolation, merge into a stable `main`. (Akhil's directive.) |
| **G2** | **`main` is always demo-able.** If `main` is broken, that is a stop-the-line event, not a "someone will fix it tomorrow" event. |
| **G3** | **No direct commits to `main`.** PR, review, merge. |
| **G4** | **Small PRs, merged often.** A ten-person team that all merge in week six will not have a product in week six. |
| **G5** | **Pull from `main` before you start work each day.** Distributed team, seven timezones — the repo moved while you slept. |
| **G6** | **If you're blocked, say so within 24 hours.** Silence in a distributed team reads as progress, right up until it doesn't. |
| **G7** | **Prerequisite: every member has a GitHub account.** (Open item — blocks branch assignment.) |

---

## 11. Definition of Done

A task is done when **all** of these are true. Not four out of six.

- [ ] It does what `PRD.md` says — no more, no less.
- [ ] It respects the architectural boundaries (§4).
- [ ] Schema changes are in a committed migration, with RLS.
- [ ] Timezones are handled per §5 (D3–D5).
- [ ] Errors go somewhere a human will see them (Sentry for Next.js; the n8n error workflow for Track B).
- [ ] No secret is exposed client-side.
- [ ] n8n workflows are exported, scrubbed, and committed.
- [ ] It has been tested **end to end on a real WhatsApp number**, not just in isolation. The unit that matters is the message arriving on a phone.
- [ ] It's merged to `main`, and `main` still works.
- [ ] If it touched auth, RLS, the SOS path, the doctor share link, or a webhook — the relevant security checks in §14 were re-run.

---

## 12. The forbidden list

Do not build these. Not partially, not "just in case", not "it was easy".

| | |
|---|---|
| ❌ AI medical diagnosis or clinical inference | ❌ A vector store / RAG / embeddings |
| ❌ A login for the elderly person | ❌ Twilio (Meta Cloud API direct) |
| ❌ A native mobile app | ❌ pg_cron (n8n owns all scheduling) |
| ❌ A conversational voice-companion bot | ❌ Payment, billing, subscription code |
| ❌ Voice/phone-call escalation (SIP) | ❌ A doctor account with its own login |
| ❌ SMS or email notification channels | ❌ WhatsApp number verification |
| ❌ **Messaging an elder who has not confirmed** | ❌ WhatsApp Flows (a v2 path, not now) |
| ❌ Anything in Should-have or Could-have | ❌ A second exception to B3 |

---

## 14. Security review regime

> **Rule: security is a gate, not a phase.** A full security review runs **when the MVP is feature-complete**, and again **before every version ships** (v2, v3). New code means new attack surface — there is no version that is exempt because it's "just a small feature."
>
> **Owner:** Team Lead (Talal). **Nothing ships through a failed gate without a recorded decision.**

### 14.1 Why this matters more for ElderWise than for a normal capstone

Be clear-eyed about what we're holding: **phone numbers, home context, medication names and dosages, health check-in histories, voice recordings of elderly people, and the identity of who is coming to help them in an emergency.** That is a rich target and a vulnerable population. On top of that:

- The code is being written **fast, by ten people, with AI agents** — the exact profile that produces the vulnerabilities catalogued below.
- **n8n runs with the service-role key and bypasses RLS**, so one bad workflow can reach every family's data.
- A **denial-of-care** attack (silencing reminders, forging a "yes I took my medicine", or resolving someone else's live SOS) is worse than a data breach. It's the only system I know of in this cohort where a security bug can plausibly hurt a human body, not just a database.

### 14.2 The gate — five review passes

Run these against the codebase, **in order**, using Cursor or Claude Code. Each pass must end with the agent **reporting exactly what it found and what it changed** — read that report, don't rubber-stamp it.

*(Passes 1–5 are adapted from the "5 Security Checks Before You Launch" guide by Mayank Shah — themselves based on Gitleaks, Bearer, ECC Production Audit, Trail of Bits, and ECC Security Review. Written for Emergent; adapted here for our stack. Pass 6 is ElderWise-specific and is the one that actually matters most.)*

| Pass | Focus | Key checks for **our** stack |
|---|---|---|
| **1 · Secret leak** | Hardcoded keys, tokens, credentials anywhere in source | **Supabase service-role key never client-side.** Anon key is only safe *with RLS on every table* — verify that, don't assume it. Meta WhatsApp token, OpenAI key, STT key, n8n webhook secret — all env-only. Nothing sensitive behind `NEXT_PUBLIC_*`. `.env` gitignored, `.env.example` has shape but no values. **If a secret was ever committed, it lives in git history forever — rotate it, don't just delete the commit.** |
| **2 · Personal-data flow** | Where PII enters, travels, and lands | Map every collection point: phone numbers, names, addresses, medication names, health responses, **voice audio and transcripts**. No PII in logs, ever. Audit what we send to **OpenAI, the STT provider, and Sentry** — strip every field they don't need. Cookies `httpOnly` + `secure` + `sameSite`. No PII in `localStorage`. API responses return only what the client needs — never another family's rows, never internal IDs. **Is there an account-deletion path?** Right now there isn't. |
| **3 · Pre-deploy production audit** | Everything that must be true before it's live | App refuses to start if a critical env var is missing. All debug code, test endpoints, seed routes, and hardcoded test credentials removed. Errors return a generic message + correlation ID — **never a stack trace, query, or file path**. Security headers (`nosniff`, `X-Frame-Options`, HSTS, CSP). **Rate limiting on signup/login/password-reset.** CORS locked to our domain, not `*`. |
| **4 · Deep audit of critical logic** | The paths where a bug is severe | For us the "complex logic" is **not payments** (we have none — W1). It is **auth, RLS, the doctor share link, the SOS webhook, and the WhatsApp webhook.** See 14.3 — that's where this pass should spend its time. Also: **parameterised queries only** (Postgres, so SQL injection, not NoSQL); XSS on any user input rendered in the dashboard; file/audio upload validation. |
| **5 · Attacker's perspective** | Break it on purpose | IDOR: change an `elder_id` in a URL or request body — **can I see another family's data?** Auth bypass, expired/malformed token handling, privilege escalation (can a CT act as a doctor?). Feature abuse and rate limits. Injection into every text field. Exposed `.env`, `.git`, health endpoints, API docs. |
| **6 · ElderWise-specific** | **The ones no generic guide will catch** | **See 14.3. Do not skip this pass.** |

### 14.3 Pass 6 — the ElderWise-specific attacks

These are the ones that would actually hurt a family. **Every one of them must be explicitly tested, not reasoned about.**

| # | Attack | Why it's severe | Must verify |
|---|---|---|---|
| **X1** | **Cross-family data access (IDOR at the DB layer)** | The whole product promise | Sign in as CT-A, attempt to read CT-B's elder, check-ins, SOS events, voice audio — by ID, by URL, by API call. **Every table, not a sample.** A table without RLS is a breach with a delay fuse. |
| **X2** | **Forged SOS resolution** | **Denial of care.** An attacker silences a live emergency. | The n8n SOS-resolution webhook **must reject any call without the shared secret**. Try calling it unauthenticated with a guessed `sos_event_id`. It must fail. |
| **X3** | **Forged WhatsApp webhook** | An attacker could **fabricate a "yes, I took my medication"** — poisoning the health record and hiding a real missed dose from the family — or **fire a fake SOS**. | **Verify Meta's webhook signature on every inbound message.** Replay an old valid payload — is it accepted twice? |
| **X4** | **Doctor share-link abuse** | Health data leak, permanently | Tokens must be **long and random** (not guessable, not sequential). **Revoked and expired tokens must actually stop working** — test both. A token must resolve to **exactly one elder** and never leak a second. Check the token doesn't leak via `Referer` headers to third parties. |
| **X5** | **Service-role key escaping via n8n** | Total compromise of every family's data | The key must never appear in a **committed n8n workflow JSON export** (W4 — scrub before export), in a log, or in an error message. n8n bypasses RLS; anything holding that key is a crown-jewel asset. |
| **X6** | **Voice audio bucket exposure** | Recordings of elderly people discussing their health, publicly listable | Supabase Storage bucket must **not** be public. Signed, expiring URLs only. Try listing the bucket anonymously. |
| **X7** | **Elder enumeration by phone number** | Reveals who is a customer, and who is elderly and alone | No endpoint may confirm whether a given WhatsApp number is registered. Watch webhook and onboarding responses for this leak. |
| **X8** | **SOS spam / reminder flood** | Alert fatigue is how a real SOS gets ignored. Also burns the WhatsApp account. | Rate-limit SOS triggers per elder. Rate-limit outbound sends per number. |
| **X9** | **PII in Sentry** | We are about to pipe **health voice transcripts and phone numbers** into a third-party error tracker | Configure Sentry scrubbing **before** turning it on. Transcripts, phone numbers, names, medication names must never reach it. |
| **X10** | **Prompt injection via voice transcript or free text** | An elder's transcribed reply is fed to an LLM. Crafted text could steer message generation. | Treat every transcript as **untrusted input**, never as instructions. Never let LLM output alone decide who to notify or whether an SOS resolves — **that decision is code, reading the database.** |
| **X11** | **Long-input DoS** (from the "7 vulnerabilities" guide) | Cheap to exploit, easy to prevent | Cap password length (e.g. 128 chars) **before** it reaches the hashing function. Cap all input lengths at the validation layer. Cap audio file size before download and transcription. |
| **X12** | **ReDoS via catastrophic regex** (same source) | AI-generated regex is a classic source of this | Use a battle-tested validator (Zod / `validator.js`) — **do not let an AI agent hand-roll validation regex** for phone numbers or emails. |

### 14.4 Not applicable to our stack — and why

Named so nobody wastes a day on them, and so nobody assumes we forgot:

| Item from the source guides | Status |
|---|---|
| Payment/pricing manipulation, Stripe webhooks | **N/A** — no payments in the MVP (W1). Re-add this check the moment monetisation appears. |
| NoSQL injection, `mongo-sanitize` | **N/A** — Postgres. **SQL injection still applies**: parameterised queries only. |
| PM2 / Node cluster / single-thread crash guard | **N/A** — Vercel serverless + managed n8n. |
| Server-Side Template Injection (EJS/Pug/Jinja) | **Low** — React/JSX escapes by default. Still: never `dangerouslySetInnerHTML` on user input. |
| Clipboard pastejacking | **N/A** — we serve no copyable code snippets. |
| Login replay | **Covered** — TLS everywhere; Supabase Auth handles token expiry. |

### 14.5 Standing rules

| # | Rule |
|---|---|
| **SR1** | **The security gate runs at MVP completion, and before every version thereafter.** No exceptions for "small" releases. |
| **SR2** | **Re-run Pass 5 and Pass 6 after any change to auth, RLS, the SOS path, the doctor share link, or either webhook.** New code, new attack surface. |
| **SR3** | **Read the agent's report. Do not rubber-stamp it.** An AI audit you didn't read is not an audit. |
| **SR4** | **An AI audit is not a substitute for human review.** It catches the common mistakes; it does not think like a determined attacker. For anything beyond the demo — real families, real data — get a human security review before launch. |
| **SR5** | **Findings are logged**, with severity, owner, and resolution. A finding that isn't written down is a finding that comes back. |
| **SR6** | **X1 (cross-family access) and X2 (forged SOS resolution) are release blockers.** Everything else is triaged. These two are not. |

---

## 13. Change log

| Date | Version | Change |
|---|---|---|
| 13 Aug 2026 | 1.27 | **D11 — two-column pause vs soft-delete.** `enabled` = pause (shown Inactive, never hidden); `active` = tombstone on all three domains. Never reuse a user-facing field as a tombstone. Ruling: Talal, 12 August 2026. |
| 12 Aug 2026 | 1.26 | **C18 — onboarding Sign out on every wizard step.** Clears session + local draft; warn if progress, never block. No speculative guest-gate bypass. |
| 12 Aug 2026 | 1.25 | **C17 — document versions at merge time.** Bump Architecture/Rules only after reading headers on `main`; date header + changelog to the merge date. |
| 12 Aug 2026 | 1.25 | **C15 amend — map status + `response_value`.** A `responded` row is not enough on its own; `no` / `some_of_them` must not render as Taken. A-29 learning retained. |
| 12 Aug 2026 | 1.24 | **C16 + D11 clarification — routine → check-in lifecycle.** UI-side same-day sync in elder TZ; never hard-DELETE routines (CASCADE FKs); never touch `sent_at` rows; no n8n changes for CRUD propagation. |
| 11 Aug 2026 | 1.23 | **C15 — check-in status: map DB→UI, then `formatCheckInStatus`.** From A-29 rescope: CSS capitalize is not a semantic fix; doctors must never see Track B vocabulary (`Reminded`, `Responded`, …). |
| 11 Aug 2026 | 1.22 | **C14 — discarded Supabase read errors look like empty data.** Every loader query must check and log `.error` with the table name. From A-36: `doctor_share_links` selected non-existent `created_at`; `(data ?? [])` hid 13 live tokens behind "No active share links." |
| 11 Aug 2026 | 1.21 | **C13 — cite both time-zone outages.** Extends the learning line to cover the 11 August `Arabian Standard Time (AST)` failure (18 hours after `Asia/India`, different user). Notes `TIMEZONE_OPTIONS` is now an offset-grouped quick-pick list, still not a membership oracle. |
| 11 Aug 2026 | 1.20 | **C13 — validate scheduler inputs at the point of entry.** Time zones must pass `isValidTimeZone()` (runtime `Intl.DateTimeFormat` check), not list membership. From the 33-minute Track B outage of 10 August 2026 (A-35 / `Asia/India`). |
| 10 Aug 2026 | 1.19 | **W8 — never edit an approved WhatsApp template in place.** Create a `_v2`, get it APPROVED, confirm via Template Audit (`PADE2m75e6xVGS2e`), then repoint the workflow. Caused by the 9–10 August 2026 medication outage: an in-place copy edit to `elderwise_ep_medication_checkin` put it into Meta review; sends failed with 132001 for ~22 hours (~1,400 WF-1 executions). Language codes are `en`, not `en_US`. |
| 8 Aug 2026 | 1.18 | **§6a — two findings added** from the WF-5 A-25 build. `ON CONFLICT` against a **partial** unique index must repeat the index predicate or the statement fails on every insert. A **POST to Supabase Storage 409s rather than overwriting**; deterministic object keys need `x-upsert: true`. |
| 8 Aug 2026 | 1.17 | **C12 + W7 from 8 August defects.** **C12** — when a shared Zod schema gains a required field, enumerate every `.safeParse(` / `.parse(` consumer before merge (`tsc` cannot see hand-built `unknown` payloads; Wave 2 `daysOfWeek` broke all three dashboard routine upserts). **W7** — `n8n/workflows/` JSON is a read-only snapshot; never re-import (rotates `webhookId` and can silently kill Meta inbound on WF-2). |
| 4 Aug 2026 | 1.16 | **C11 — verification console.** Fixed security surface: no free-text, SQL, `.rpc()`, read-path writes, or imports of `createAdminClient` / dashboard analytics / mappers; §9 grep block is the standing check (`Architecture.md` §11.2). |
| 4 Aug 2026 | 1.15 | **C10 added** — `src/`-directory projects must place Next.js root-convention files in `src/`; root placement compiles silently to nothing (`Architecture.md` A-32). |
| 4 Aug 2026 | 1.14 | **Sentry scope.** §11 Definition of Done: errors go to Sentry for Next.js, the n8n error workflow for Track B (`Architecture.md` §11.1, ruled 4 Aug 2026). |
| 4 Aug 2026 | 1.13 | **§6a — cancelled pass (4 Aug).** Mutually exclusive parallel branches (WF-3c); enum additions are frontend-breaking — deploy mapper before workflow writes. |
| 4 Aug 2026 | 1.12 | **§6a — five additions from voice pass (3–4 Aug).** Sub-workflow ID resolution; ordering-as-protection (WF-5); zero-row SELECT vs probe pattern; `alwaysOutputData` + IF pairing; enum-vs-text on `response_value`. |
| 3 Aug 2026 | 1.11 | **§6a — enum verification + one writer per state transition.** From all-domain pass debugging: `checkins.response_channel` is `button|voice` not `whatsapp`; missed transition must have a single owner (WF-3c). |
| 3 Aug 2026 | 1.10 | **§6a corrected.** Postgres guard applies to reads as well as writes — CTE-based SELECTs also return `{success: true}` on zero rows. Nested sub-workflows must be published to execute. `autoAssignedCredentials: []` on update means no new assignments, not dropped bindings. Team size → 10. |
| 3 Aug 2026 | 1.9 | **§6a n8n implementation rules** — pre-merge checklist from 3 Aug Track B debugging (webhookId rotation / UI-only; guard Postgres writes; empty `queryReplacement`; verify credentials; honour `parsed: false`; delivery-status callbacks). |
| 27 Jul 2026 | 1.8 | **D13** — applied migrations are immutable; corrections ship as new forward migrations only. |
| 26 Jul 2026 | 1.7 | D12 CHECK expression corrected to `cardinality(times) = 1` (aligned with Architecture v1.9 / A4.1 migration). |
| 26 Jul 2026 | 1.6 | **A4.** D12 — one time per medication row. W3 clarified: intentional non-sends (SOS skip rows; `not_required` mute) are logged/configured, not silent failures. No other rule changes. |
| 24 Jul 2026 | 1.5 | **Three rules from the 23–24 Jul build.** D11 draft hard-delete vs soft-delete history; SEC8 single admin module / never escalate past RLS; C9 no percentage on zero denominator. |
| 23 Jul 2026 | 1.4 | **Companion-doc references no longer pin version numbers.** `main` is the single source of truth; pinned cross-references forced edits to every other doc on each version bump and went stale silently. Refs now name the file only. Each document's own version remains in its header. |
| 22 Jul 2026 | 1.3 | **Docs ↔ front-end reconciliation.** Pointed domain naming (C6) at `Architecture.md` §5.5 glossary. Clarified D10: elder address remains mandatory when Local Buddy is optional; LCT SOS message carries address only when an LCT exists. |
| 14 Jul 2026 | 1.2 | **N5 added — the elderly person must consent, herself** (two-layer opt-in; silence is not consent; nothing scheduled until `consent_confirmed_at` is set). Old N5 (data isolation) becomes N6. D9/D10 added: consent is a hard gate; `elders.address` is NOT NULL. Forbidden list: messaging an unconfirmed elder; WhatsApp Flows. |
| 14 Jul 2026 | 1.1 | Added **§14 Security review regime** — a five-pass audit (secrets · PII flow · pre-deploy · deep logic · attacker's view) adapted from the Mayank Shah "5 Security Checks" and "7 Vulnerabilities of Vibe-Coded Apps" guides, **plus Pass 6: twelve ElderWise-specific attacks** (cross-family IDOR, forged SOS resolution, forged WhatsApp webhook, share-link abuse, service-role key leakage via n8n exports, voice-bucket exposure, elder enumeration, SOS spam, PII in Sentry, prompt injection via transcript, long-input DoS, ReDoS). Gate runs at MVP completion and before every version. X1 and X2 are release blockers. |
| 14 Jul 2026 | 1.0 | Initial rules. Codifies the five non-negotiables, scope discipline, AI-agent rules, architectural boundaries, database/n8n/security/code/copy standards, git workflow for 11 contributors, definition of done, and the forbidden list. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 4 August 2026.*
