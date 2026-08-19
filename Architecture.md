# ElderWise — Architecture

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Programme** | AI Generalist Fellowship (AIGF) — Outskill, Cohort 7 · Capstone Project |
| **Team** | Group 7 (10 members) · Team Lead: Talal Baig |
| **Document** | Architecture.md — v1.53 |
| **Date** | 19 August 2026 |
| **Audience** | Development team, Cursor, Claude Code |
| **Companion docs** | `PRD.md` · `Rules.md` · `Phases.md` · `Templates.md` |

> This document describes **how ElderWise is built**. `PRD.md` describes **what it does**. Where the two disagree, `PRD.md` wins and this document is wrong and must be fixed.

---

## 1. Architectural principles

Five rules govern every decision below. They are not negotiable without a decision from the team lead.

| # | Principle |
|---|---|
| **P1** | **The message path and the dashboard are two separate systems that meet only at the database.** n8n owns everything that touches WhatsApp. Next.js owns everything a human clicks. **Two documented exceptions**, both authenticated **server-side** webhooks after a write has committed: (1) SOS resolution from the dashboard → WF-4a (§8); (2) waitlist signup → WF-8 (§8). The database remains the source of truth. A webhook failure must not fail the user's request. n8n **never** calls Next.js. |
| **P2** | **The SOS path is sacred.** It is the highest-reliability path in the system. It never queues behind routine reminder traffic, and a failure in it is the most severe class of defect in this codebase. |
| **P3** | **Never guess on behalf of an elderly person.** If the system cannot determine an answer with confidence, it asks again in plain language. It does not infer, assume, or default. |
| **P4** | **Data isolation is enforced at the database, not in application code.** Row-Level Security is the boundary. Application bugs must not be able to leak one family's data to another. |
| **P5** | **Build the simplest thing that satisfies the PRD.** ElderWise is a 10-person team on a 6-week clock. Every layer of indirection is a layer someone has to debug at 2am in a different timezone. |

---

## 2. System context

```
┌──────────────────┐                        ┌──────────────────────────┐
│  Elderly Patient │◀──── WhatsApp ───────▶│  Meta WhatsApp Cloud API │
│      (EP)        │      (only channel)    └────────────┬─────────────┘
└──────────────────┘                                     │ webhooks / send
                                                         ▼
┌──────────────────┐                        ┌──────────────────────────┐
│  Care Partner    │◀──── WhatsApp ────────▶│         n8n              │
│      (CT)        │                        │  (self-hosted)           │
│                  │                        │  ALL message-path logic  │
│                  │                        │  schedulers · reminders  │
│                  │                        │  escalation · SOS · STT  │
│                  │                        └────────────┬─────────────┘
│                  │                                     │ read / write
│                  │        HTTPS                        ▼
│                  │◀───────────────────▶  ┌──────────────────────────┐
└──────────────────┘                       │        Supabase          │
                                           │  Postgres · Auth · RLS   │
┌──────────────────┐                       │  Storage · Realtime      │
│ Local Caregiver  │◀──── WhatsApp ───────▶└────────────▲─────────────┘
│  (LCT, SOS only) │                                    │ read / write
└──────────────────┘                                    │
                                           ┌────────────┴─────────────┐
┌──────────────────┐      HTTPS            │   Next.js (Vercel)       │
│     Doctor       │◀────────────────────▶ │  Dashboard · Onboarding  │
│ (SOS + read-only │   (share link)        │  Settings · Reports      │
│   share link)    │                       └──────────────────────────┘
└──────────────────┘
                                           ┌──────────────────────────┐
                                           │  OpenAI (LLM + Whisper)  │◀── n8n
                                           │  Sentry                  │◀── both
                                           └──────────────────────────┘
```

**The critical read:** n8n and Next.js **never call each other**. Both talk to Supabase. This means the message-path team and the dashboard team can work in parallel without blocking, which is the whole point given 10 distributed people and a hard deadline.

---

## 3. Technology decisions and why

| Layer | Choice | Rationale |
|---|---|---|
| **Messaging** | **Meta WhatsApp Cloud API (direct)** | Not Twilio. Twilio adds a layer, a cost, and a second place templates can break. Interactive Yes/No buttons and list/dropdown replies are native and cleaner on the Cloud API. Twilio would earn its place only for SMS/voice fallback, which is Could-have (C8, C6). |
| **Automation / message path** | **n8n** (self-hosted) | Robert has servers ready. The message path is inherently event- and timer-driven, which is n8n's home turf. It is also the layer most of the team can contribute to without deep coding. |
| **Database / Auth / Storage** | **Supabase** (Postgres) | ElderWise's data is strongly relational (care partner → elders → check-ins / SOS / medications). Postgres + RLS gives data isolation as a database guarantee rather than an application hope. Auth, Storage, and Realtime in the same product removes three integrations. |
| **Front-end + app backend** | **Next.js (App Router) + Tailwind + shadcn/ui**, on **Vercel** | Locked in Meeting 12. Server components + route handlers cover the dashboard's needs without a separate API service. |
| **LLM** | **OpenAI** | For message generation and interpreting free-text/transcribed replies. |
| **Speech-to-text** | **OpenAI (Whisper via the OpenAI transcription API)** | Voice replies are Must-have (M4a). **Superseded 2 August 2026 by Talal** (was: Google STT vs ElevenLabs; prior wording that Whisper was not the choice is withdrawn). Rationale: MVP is English-only (NFR-9) so multi-language coverage is a v2 benefit; n8n has a native OpenAI node whereas Google STT would require raw HTTP with service-account JWT signing; one fewer vendor in Security Gate Pass 2. |
| **Scheduling** | **n8n cron only** | Not pg_cron. Two schedulers is a bug factory — and worse, a bug factory where the bug is "Mum didn't get her reminder." |
| **Error tracking** | **Sentry** | Weighted toward the SOS path. See §11. |
| **Repo** | **GitHub**, monorepo, branch-per-member | Akhil's directive. See §12. |
| **Vector store / RAG** | **NONE** | See §3.1. |

### 3.1 There is no RAG in ElderWise

The team's earlier flow diagrams say *"SOS → Agent → DB (RAG)"*. **This was a naming slip, now formally corrected.**

What actually happens is: given an EP's WhatsApp number, look up their care circle (CT, LCT, Doctor) and their message templates. That is a **relational lookup on an indexed foreign key** — a `SELECT ... JOIN ... WHERE elder_id = $1`. It is not semantic search, it is not retrieval-augmented generation, and it does not need embeddings.

**Therefore, in the MVP there is: no pgvector, no vector store, no embedding pipeline, no RAG.**

This is written down explicitly because a team of 10 reading "RAG" in the flow diagram will otherwise go and build one. Do not build one. If a genuine semantic-retrieval need appears later (e.g. searching a corpus of voice-journal entries — a Could-have), it will be introduced deliberately, not by accident.

---

## 4. Component responsibilities

### 4.1 n8n — owns the entire message path

| Owns | Does **not** own |
|---|---|
| Scheduling and firing check-ins | Any UI |
| Sending all WhatsApp messages (EP, CT, LCT, Doctor) | Onboarding forms |
| Receiving all WhatsApp webhooks | Dashboard reads |
| Parsing button replies and dropdown selections | Auth / sessions |
| Downloading and transcribing voice replies (STT) | Report generation |
| The 30-minute reminder and missed-response logic | |
| Escalation to the CT | |
| The full SOS orchestration and nudge sequence | |
| CT notification dispatch | |
| Writing all message-path outcomes to Supabase | |

### 4.2 Next.js — owns everything a human clicks

| Owns | Does **not** own |
|---|---|
| Landing page, signup, signin (Supabase Auth) | Any WhatsApp interaction |
| Onboarding wizard (4 contact groups + 3 sub-forms) | Any scheduling or timer |
| Dashboard (adherence, health, food, SOS panel) | Sending any message |
| Care Circle, Edit Profile, SOS History, Voice Journal, Reports, Settings | STT |
| Doctor share-link issuing and revocation | |
| Doctor read-only view (token-gated) | |
| SOS resolution **from the dashboard** (writes state; n8n observes it and stops nudging) | |
| PDF report generation | |

### 4.3 Supabase — the only thing both sides touch

Postgres tables (§5) · Auth (§7) · Storage bucket for voice audio · Realtime for live dashboard updates · RLS as the isolation boundary (§6).

---

## 5. Data model

> The team's agreed logical schema (see `PRD.md` §9) is spreadsheet-shaped: it repeats CT / LCT contact details inside every domain row, a legacy of the Google-Sheet-as-demo-DB stage. That shape is **denormalised** — the same phone number stored in three places goes stale in three places. Below it is normalised into proper relational tables. **Every field and every behaviour from the PRD is preserved; only the storage shape changes.**

### 5.1 Entity relationships

```
auth.users (Supabase)
    │ 1:1
care_partners ──┐
    │ 1:many    │
  elders ───────┼── 0..1 ── local_caregivers   (optional — skippable at onboarding)
    │           ├── 0..1 ── doctors
    │           ├── 1:many ── doctor_share_links
    │           ├── 1:many ── medications
    │           ├── 1:many ── food_routines
    │           ├── 1:many ── health_routines
    │           ├── 1:many ── domain_configs   (exactly 3: medication | health | food)
    │           ├── 1:many ── message_templates
    │           ├── 1:many ── checkins ──┬── 1:many ── checkin_medication_items
    │           │                        └── 0..1  ── voice_replies
    │           ├── 1:many ── voice_journals
    │           ├── 1:many ── sos_events ── 1:many ── sos_notifications
    │           └── 1:many ── ct_notifications

waitlist   (no FKs, no path to auth.users — public signups; see §5.2 / §6.1)
```

### 5.2 Tables

**`care_partners`** — the primary user and account owner.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `first_name` | text **NOT NULL** | From `/sign-up`. Replaces `full_name`. |
| `last_name` | text **NOT NULL** | From `/sign-up`. Replaces `full_name`. |
| `email` | text | |
| `whatsapp_number` | text | E.164. No verification (NFR-11). |
| `timezone` | text | IANA, e.g. `Asia/Riyadh` |
| `address` | text | nullable — **unused** (see §5.6) |
| `secondary_contact` | jsonb | nullable — **unused** (see §5.6) |
| `created_at` | timestamptz | |

> **Dropped (A4):** `full_name`, `phone_number`. No non-WhatsApp phone capture. Do not reintroduce a `full_name` split heuristic in mappers.

**`elders`** — the Elderly Patient (EP). **One CT → many EPs.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `care_partner_id` | uuid FK → `care_partners.id` | **The isolation key.** |
| `first_name`, `last_name` | text | `surname` **renamed** to `last_name` (A4). |
| `age` | smallint **NOT NULL** | `CHECK (age BETWEEN 1 AND 120)`. **Stored snapshot** — does not self-update. |
| `relationship_to_care_partner` | text **NOT NULL** | New (A4). No prior column; UI previously hardcoded blank. |
| `gender` | text | **Unused** — not collected (see §5.6). |
| `whatsapp_number` | text UNIQUE | E.164. The inbound-webhook lookup key — **must be indexed**. |
| `timezone` | text | IANA. **All schedules fire in this timezone** (M14). |
| `address` | text **NOT NULL** | **Mandatory** (M17), even if Local Buddy is skipped. When an LCT exists, their SOS message carries it — they exist to physically reach her. |
| `consent_attested_by_ct` | boolean | The CT's onboarding attestation (M16a / N5). |
| `consent_attested_at` | timestamptz | |
| `consent_confirmed_at` | timestamptz | **The elder's in-channel confirmation** (M16b). **NULL ⇒ schedule nothing.** |
| `consent_requested_at` | timestamptz | **When WF-0 claimed the elder for welcome** (B1.5 / WF-0). **NULL = not yet claimed.** Set by claim-then-send (`UPDATE … RETURNING … FOR UPDATE SKIP LOCKED`) **before** the Meta send. Non-NULL suppresses re-claim — without this, a cron re-sends the welcome every tick to a silent elder (R1). |
| `consent_declined_at` | timestamptz | **Elder declined in-channel** (B1.5 / WF-2). **Terminal:** never schedule, never re-ask. Distinct from silence (`consent_requested_at` set, both confirmation and decline still NULL). |
| `consent_med_accuracy_at` | timestamptz | nullable — non-null **is** the consent (Review). |
| `consent_data_sharing_at` | timestamptz | nullable — conditional if Doctor or Local Buddy added. |
| `consent_terms_at` | timestamptz | nullable — Terms & Privacy re-confirm at Review. |
| `consent_terms_version` | text | nullable — **dated** policy version consented to (e.g. `2026-07-v1`). Must match the Privacy/Terms text shown at Review; bump when approved page text changes. |
| `active` | boolean | **Onboarding draft flag:** `false` while the wizard is in progress, `true` on finish. **All product reads filter `active = true`**, so a draft never appears in the dashboard, list, or selector. **At most one draft per care partner.** Discarding a draft is a **hard DELETE**, not a soft delete: `elders.whatsapp_number` is globally UNIQUE, so a soft-deleted draft would permanently lock that number against every care partner — including a sibling caring for the same parent. Safe because a draft has no history (`consent_confirmed_at` is null, nothing was scheduled, children cascade). **Product Loved One removal is also a hard DELETE** (Talal, 17 August 2026) — see §5.8. **Contrast:** routine deletion is soft precisely because a routine's history must survive when the elder remains. |
| `created_at` | timestamptz | |

**Consent lifecycle (welcome message) — four states.** Columns: (`consent_requested_at`, `consent_confirmed_at`, `consent_declined_at`).

| `requested` | `confirmed` | `declined` | Meaning |
|---|---|---|---|
| NULL | NULL | NULL | WF-0 claims the row, then sends the welcome template |
| set | NULL | NULL | Awaiting reply — send nothing (do not re-send welcome) |
| set | set | NULL | Confirmed — WF-1 may schedule check-ins |
| set | NULL | set | Declined — **terminal**; never schedule, never re-ask |

**`local_caregivers`** — LCT / Local Buddy. SOS-only. **Optional at onboarding** (per-card Skip). **Inherits the elder's timezone** (no `timezone` column, by design). If no LCT is set, SOS is handled by the Care Partner (CT is always present); LCT WhatsApp notification is **conditional** on a row existing. Elder `address` remains **NOT NULL** regardless. Absent row after Care Circle submit = deliberate skip.

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK UNIQUE · `first_name` text NOT NULL · `last_name` text NOT NULL · `whatsapp_number` text · `action_plan` text (**unused** — §5.6) · `created_at` timestamptz |

> **Dropped (A4):** `full_name`, `phone_number`.

**`doctors`** — optional, SOS-only + read-only dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK UNIQUE | |
| `first_name` | text **NOT NULL** | Replaces `full_name`. |
| `last_name` | text **NOT NULL** | Replaces `full_name`. |
| `whatsapp_number` | text | **Nullable** (A4). If null, SOS skips the doctor nudge and logs `sos_notifications.status = skipped` / `skip_reason = no_whatsapp_number`. |
| `clinic_name` | text **NOT NULL** | Renamed from `address` (that column already stored clinic name in practice). |
| `timezone` | text | **Still present** but **no longer collected** at onboarding. Share page must **not** use it for display — render in the **elder's** timezone (§10). May be null on new rows. |
| `approved_by_ct` | boolean | |
| `created_at` | timestamptz | |

> **Dropped (A4):** `full_name`, `phone_number`.

**`doctor_share_links`** — tokenised read-only access (M15). No doctor account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | **Scoped to one elder.** |
| `token_hash` | text | **SHA-256** of the raw token (never store raw). See §7.3 for why not bcrypt/argon2. |
| `created_by` | uuid FK → `care_partners.id` | |
| `sos_event_id` | uuid FK → `sos_events.id` · nullable · `ON DELETE SET NULL` | **Null = Care Partner issued from the dashboard. Non-null = minted by WF-4 for that SOS event.** Partial unique index `doctor_share_links_one_active_cp_link` caps live dashboard-issued links at one per elder (`revoked_at IS NULL AND sos_event_id IS NULL`). SOS-minted links are uncapped. |
| `expires_at` | timestamptz | **Always set on create** (default 30 days). Open-ended links are forbidden. |
| `revoked_at` | timestamptz | nullable — revocation is a Must-have |
| `last_accessed_at` | timestamptz | |

> There is **no `created_at`** on this table — do not select it. Order CT lists by `expires_at`.

**`domain_configs`** — exactly three rows per elder: `medication`, `health`, `food`. **Derived cache only** — written by Next.js `syncDomainConfig()` after every routine save; **not read by workflows or the dashboard** (Talal, 3 August 2026).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum(`medication`,`health`,`food`) | UNIQUE with `elder_id` |
| `enabled` | boolean | **Derived** — mirrors whether any schedulable routine exists in that domain |
| `frequency` | jsonb | **Derived field** — the sorted union of times from routines that are `active = true` AND `enabled = true` (all three domains), refreshed on create / edit / soft-delete. **Not resynced on pause/resume** (`setRoutineEnabled`) — the cache may lag `enabled`. That is deliberate: no SQL node in any of the 24 committed workflows queries `domain_configs`, and WF-6 derives `notify_mode` from the routine tables (`COALESCE(MIN(m/f/h.notify_care_partner))`, A-9). Do not "fix" the staleness and do not start reading `domain_configs`. Direct edits are overwritten on the next full routine save. Shape e.g. `{"times": ["08:00","20:00"]}` (local times in the elder's tz). No fixed 3×/day (FR-ON-4). |
| `ct_notification` | enum(`every_interaction`,`only_missed`,`not_required`) | **Derived / deprecated (A4).** Not authoritative for Track B. May still be mirrored from routine rows for backward compatibility; **WF-6 does not read it** (built 3 Aug on per-routine `notify_care_partner` — A-9 closed). |
| `escalate_to` | enum(`care_partner`) | Only the CT escalates. LCT/Doctor are SOS-only. Enum kept for v2 headroom. |

> **Authority (Talal, 3 August 2026; two-column amendment 12 August 2026):** **Dispatch is live only when `enabled = true` AND `active = true`.** `enabled` is the Care Partner's pause switch; `active` is the soft-delete tombstone — **never reuse a user-facing field as a tombstone.** **`notify_care_partner` on the routine row is authoritative** for CT notification (`every_time` \| `only_missed` \| `not_required`). `domain_configs` is a **derived cache** — workflows **must not** read it for scheduling or notify decisions. **Done:** WF-6 (`6I6OC7qJ5YhhUQxU`) reads the owning routine's `notify_care_partner` via check-in FKs, including `not_required` = total silence (no confirmation and no missed push; miss still recorded on the dashboard). A-9 closed. **A-13 closed as non-issue:** missing rows were never why food and health were silent; all three rows now exist from normal use.

> **Enum migration ordering (Postgres):** `ALTER TYPE … ADD VALUE 'not_required'` **cannot** be used in the same transaction that references the new value. Enum additions for `notify_care_partner_mode` and `ct_notification_mode` **must** ship in their **own migration file(s), ahead of** any migration that writes or checks `not_required`.

**`medications`** — one row per medicine. Field names reconciled with the front-end `Medication` type (22 Jul); A4 semantics below.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `enabled` | boolean | **Pause switch** (FE `enabled`). Dispatch stops; the routine stays visible marked Inactive. |
| `name` | text | Include **strength** in the name (e.g. `Metformin 500mg`). |
| `dosage` | text | **Quantity per intake** (e.g. `1`, `5`) — not strength. |
| `dosage_unit` | text | Free text (UI dropdown: `TAB` / `ML` / `CAP` / `DROPS` / `PUFF` / `UNIT`). **No enum / CHECK** — dropdown may widen without a migration. |
| `times` | text[] | local wall-clock, elder tz. **`CHECK (cardinality(times) = 1)`** — one time per row; two doses/day = two medication rows (Rules.md D12). Use `cardinality`, not `array_length`: `array_length('{}', 1)` is NULL and CHECK treats NULL as pass, so the column default `'{}'` would not be rejected. |
| `days_of_week` | text[] | **Schedulable days** — empty array means every day. WF-1 / WF-1b / WF-1c honour this column (locale-independent `extract(dow …)` + explicit day-name array — not `to_char`, so a Supabase locale change cannot silently break scheduling). |
| `start_date` | date | |
| `end_date` | date | nullable |
| `timing_preference` | enum(`before_food`,`after_food`,`no_preference`) | UI offers `before_food` / `after_food` only. `no_preference` remains in the enum but is **unselectable**. Do not drop the enum value. |
| `instructions` | text | nullable |
| `notify_care_partner` | enum(`every_time`,`only_missed`,`not_required`) | **Authoritative** per-medicine (M6). |
| `escalation_minutes` | integer | **per-medicine**, default 30, min 5 max 240 (FE `escalationMinutes`) — UI label: "Alert Care Partner if not taken within (minutes)". |
| `active` | boolean | **Tombstone.** Soft-delete sets `active = false` AND `enabled = false`. Hidden from the product list; history kept. |

**`food_routines`** — one row per meal check-in (FE `FoodRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool (**pause**) · `active` bool (**tombstone**, default true) · `meal_name` text · `meal_type` enum(**unused** — §5.6) · `check_in_time` time (local) · `start_date` date NOT NULL (app supplies **today in the elder's timezone**) · `end_date` date null (no longer collected — open-ended) · `days_of_week` text[] (empty = every day; honoured by WF-1b) · `frequency` enum(**unused** by schedulers — app writes `daily`) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 45) · `notes` text (**unused**) |

**`health_routines`** — one row per wellness check-in (FE `HealthRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool (**pause**) · `active` bool (**tombstone**, default true) · `name` text · `type` enum(**unused** — §5.6) · `frequency` enum(**unused** by schedulers — app writes `daily`) · `time` time (local) · `start_date` date NOT NULL (today in elder tz) · `end_date` date null (open-ended) · `days_of_week` text[] (empty = every day; honoured by WF-1c) · `question` text (**unused**) · `answer_type` enum(**unused**) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 60) · `typical_bedtime` time null (**unused**) · `typical_wake_time` time null (**unused**) |

> **Escalation defaults differ by domain in the front end** (medication 5 min, food 45, health 60). These are **defaults**, editable per routine. The old blanket "30 across the board" is superseded. **New routines default to `notify_care_partner = every_time` in all three domains**, and their time defaults to **now in the elder's timezone plus two minutes** (`ROUTINE_DEFAULT_TIME_OFFSET_MINUTES` = 2). Two minutes of lead time stops a live-demo create from materialising into a slot that has already passed and being swept to missed without dispatch; it is short enough not to feel like a delay.

> **Two-column model — all three domains (Talal, 12 August 2026).** `enabled` = the Care Partner's pause switch. Dispatch stops; the routine **stays visible** in the routine list with the switch off and an **Inactive** marker. `active` = the tombstone. Soft-delete sets `active = false` AND `enabled = false`; the routine leaves the active list; history is preserved. **An inactive (paused) routine in any domain must be shown, marked inactive — never hidden.** **Never reuse a user-facing field as a tombstone.** PR #19 had reused `enabled` as the food/health tombstone; a paused routine then vanished from the list while remaining alive (`active = true`). That conflation is closed. **Expected side effect:** food/health rows already at `enabled = false` (backfilled `active = true`) reappear in testers' lists marked Inactive — that is intended, not a regression.

> **Routine list order (product behaviour, all three domains):** active (`enabled = true`) first, then inactive; within each group, ascending alert time (`medications.times[0]` / `food_routines.check_in_time` / `health_routines.time`, hour zero-padded for compare); stable tiebreak by name. Shared comparator: `src/lib/routines/sort.ts`. A test case will assert this order.

> **Routine delete is soft only (Talal, 12 August 2026).** Never hard-DELETE a food or health routine — `checkins_food_routine_id_fkey` / `checkins_health_routine_id_fkey` are **`ON DELETE CASCADE`** and would wipe historical check-ins. Soft-delete = `active = false` AND `enabled = false` on all three domains. A true hard-delete needs a migration (SET NULL or RESTRICT) and is out of Demo Day scope.

**UI-side same-day check-in sync (Talal, 12 August 2026):** routine CRUD in Next.js (`src/lib/data/routine-checkin-sync.ts`, called from the three dashboard upserts / soft-deletes) propagates to **today's** `checkins` using the **elder's** IANA timezone — never the browser's. Slot expression matches WF-1 / WF-1b / WF-1c:

```
((now() AT TIME ZONE elder.timezone)::date + routine.wall_time)
  AT TIME ZONE elder.timezone
```

Multiple routines in the same domain are legitimate — **do not** collapse or dedupe by domain or meal name. Rules:

1. **Create** — if the routine is due today (`enabled` and `active`, start/end window, `days_of_week`) and the elder is active + consented, INSERT `status=scheduled` at that slot; skip if a row already occupies the slot.
2. **Update** — (a) today's row is `scheduled` and `sent_at IS NULL` → UPDATE `scheduled_for` to the new slot (never a second row); (b) today's row already has `sent_at` (or is responded/missed/cancelled) and the wall clock moved → INSERT a `cancelled` + `cancelled_at` row at the **new** slot so the materialiser's `NOT EXISTS` guard suppresses a duplicate send; surface to the CT that the change applies from tomorrow; (c) today no longer matches / routine **paused** (`enabled = false`) → delete today's unsent `scheduled` only; leave sent rows alone.
3. **Soft-delete** — set `active = false` AND `enabled = false`; delete only `status=scheduled AND sent_at IS NULL` from today onward for that routine (medication: only slots not still required by another live medicine).

**Never modify a check-in with `sent_at` set.** No n8n workflow changes for this behaviour — Track B materialisers remain the overnight / cron path; the UI closes the same-day gap.

**`checkins`** — one row per scheduled check-in occurrence. The heart of the system.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum | `medication` \| `food` \| `health` |
| `food_routine_id` | uuid FK → `food_routines` | nullable · `ON DELETE CASCADE` · set for `domain = food` |
| `health_routine_id` | uuid FK → `health_routines` | nullable · `ON DELETE CASCADE` · set for `domain = health` |
| `scheduled_for` | timestamptz | Computed from the owning routine's local time + elder tz → UTC at materialisation. |
| `sent_at` | timestamptz | Must land within **±5 min** of `scheduled_for` (NFR-6). |
| `status` | enum(`scheduled`,`sent`,`reminded`,`responded`,`missed`,`cancelled`) | Sixth value **`cancelled`** added **4 August 2026** — routine disabled while check-in still open; set by WF-3c cancel branch. |
| `response_channel` | enum(`button`,`voice`) | nullable |
| `response_value` | text | `yes` / `no` — for health & food |
| `responded_at` | timestamptz | |
| `reminder_sent_at` | timestamptz | the single escalation resend |
| `missed_at` | timestamptz | |
| `cancelled_at` | timestamptz | nullable · set when `status = cancelled` |
| `escalated_at` | timestamptz | |
| `wa_message_id` | text | Meta's message ID — join key for inbound webhooks and food/health response attribution |

**Asymmetry (Talal, 3 August 2026):** medication **aggregates** several medicines into one check-in and links through `checkin_medication_items`; food and health are **1:1** with their routine row. Two nullable FKs were chosen over a polymorphic `routine_id` so referential integrity is real and illegal states cannot be stored.

**Constraints & indexes** (migration `20260803120000` + **4 Aug 2026 cancelled pass**):
- **`checkin_status` enum** — sixth value `cancelled`. Applied **4 August 2026 as two separate migrations**: Postgres will not let a statement use an enum value added in the same transaction, and `apply_migration` wraps each file in one transaction. Migration 1: `ALTER TYPE … ADD VALUE 'cancelled'`. Migration 2: `ALTER TABLE checkins ADD COLUMN cancelled_at timestamptz` and any writes referencing `cancelled`.
- **`checkins_domain_routine_consistent` CHECK** — domain must match which FK is set (medication: both FKs null; food: `food_routine_id` set; health: `health_routine_id` set).
- **Partial unique indexes** — one open row per elder per medication slot / per food routine / per health routine (three indexes). **`checkins_medication_slot_uniq`** is `UNIQUE (elder_id, scheduled_for) WHERE domain = 'medication'`. A **`cancelled` row still occupies its slot** — disabling and re-enabling a routine the same day will **not** restore that day's check-in (A-28; ruled acceptable).
- **`checkins_wa_message_id_idx`** — lookup for `context.id` attribution (food, health, and reminder overwrite path).

Index: `(elder_id, domain, scheduled_for)` and `(status, scheduled_for)` — the reminder and missed sweeps depend on the second.

**`checkin_medication_items`** — supports the **dropdown** (M12): the EP selects *which* medicines were taken.

| Column | Type |
|---|---|
| `id` uuid PK · `checkin_id` uuid FK · `medication_id` uuid FK · `taken` boolean |

**`voice_replies`** — audio **and** transcript, both retained (M4a).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `checkin_id` | uuid FK | |
| `media_id` | text | **Meta's media identifier — the idempotency key** (A-25). Nullable; the ten pre-existing rows predate the column. Backed by a **partial** unique index `voice_replies_media_id_key ON (media_id) WHERE media_id IS NOT NULL`, so historical NULLs do not collide. |
| `audio_path` | text | Supabase Storage object path in bucket **`voice-notes`** — **never a URL**. Path shape `{elder_id}/{checkin_id}/{media_id}.ogg`. Signed URLs on demand only. Path shape changed from `{unix_ms}` to `{media_id}` on 8 August 2026 (A-25) so a redelivery overwrites the same object instead of accumulating orphans. |
| `transcript` | text | |
| `confidence` | numeric | **Diagnostic only** — may hold Whisper `avg_logprob`. **Must not** gate the re-ask (see A-2 / WF-5). |
| `provider` | text | `openai_whisper` (column stays `text` — no enum migration) |
| `reask_count` | integer | default 0, max 1 |
| `created_at` | timestamptz | |

> **`ON CONFLICT` against this index must carry the index predicate** — `ON CONFLICT (media_id) WHERE media_id IS NOT NULL DO NOTHING`. Postgres cannot infer a partial unique index from a bare conflict target; without the `WHERE` clause the statement fails at runtime with *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*. Proven against this database on 8 August 2026.

**`sos_events`**

> **SOS has two layers — do not confuse them.** See WF-4 and `Architecture.md` §5.5. **`sos_events.status` (`open` \| `resolved`) is the source of truth** for dispatch. Front-end SOS states (`active` \| `acknowledged` \| `resolved` \| `cancelled`) and the sequential demo cascade are a **display mapping** only — not a second workflow.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `triggered_at` | timestamptz | |
| `status` | enum(`open`,`resolved`) | **Exhausting all three nudges (after the initial alert) does not resolve it** — it stays `open` (FR-SOS-3c). |
| `nudges_sent` | integer | **0–3** — counts **nudge rounds only**, not the initial alert |
| `resolved_by_role` | enum(`care_partner`,`local_caregiver`,`doctor`) | nullable. **No `elder` value.** An elder `cancel` (WF-10) leaves this NULL (`PostDemoEnhancements.md` PD-23). |
| `resolved_by_id` | uuid | nullable |
| `resolved_channel` | enum(`whatsapp`,`dashboard`) | **Both paths must work** (M14b) |
| `resolved_at` | timestamptz | |

> **Round numbering — do not confuse the two columns.** `sos_notifications.nudge_index` is `0–3`, where `0` is the initial alert and `1–3` are the nudges. `sos_events.nudges_sent` is `0–3` and counts **nudges only**, never the alert. An event that has dispatched its alert and nothing else has `nudges_sent = 0` and one `sos_notifications` row per recipient at `nudge_index = 0`. Enforced by migration `20260803100000`.

**`sos_notifications`** — one row per (recipient × nudge), including **intentional skips**.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sos_event_id` | uuid FK | |
| `recipient_role` | enum | |
| `recipient_id` | uuid | |
| `nudge_index` | int (0–3) | |
| `status` | enum(`sent`,`failed`,`skipped`) **NOT NULL**, **no DEFAULT** | Caller must set explicitly. Consistency enforced by `sos_notifications_status_fields_consistent` (below). |
| `skip_reason` | text | nullable; required when `skipped`; first value `no_whatsapp_number` when doctor has no channel. |
| `wa_message_id` | text | Required when `sent`; **NULL** when `skipped` (W3). |
| `sent_at` | timestamptz | **Nullable**, no DEFAULT. Required when `sent`; **NULL** when `skipped` or `failed`. |
| `delivered_at` | timestamptz | nullable |
| `created_at` | timestamptz **NOT NULL DEFAULT now()** | Audit time for skips and sends alike. |

**`sos_notifications_status_fields_consistent` CHECK:**

| `status` | `wa_message_id` | `sent_at` | `skip_reason` |
|---|---|---|---|
| `sent` | NOT NULL | NOT NULL | NULL |
| `skipped` | NULL | NULL | NOT NULL |
| `failed` | *(unconstrained)* | NULL | NULL |

**`ct_notifications`** — the care-partner notification trail (Sukin's must-have).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `care_partner_id` uuid FK · `type` enum(`interaction`,`missed`) · `checkin_id` uuid FK nullable · `wa_message_id` text · `sent_at` timestamptz |

> No `read_at` column, so mark-read is disabled in the UI. **Open decision:** add the column, or defer to v2.

**`message_templates`** — per-domain WhatsApp copy (M11).

| Column | Type | Notes |
|---|---|---|
| `id` uuid PK · `elder_id` uuid FK **nullable** | | `NULL` = system default |
| `domain` enum(`medication`,`health`,`food`,`sos`) | | |
| `language` text | | `en` only in the MVP (NFR-9) |
| `meta_template_name` text | | The Meta-approved template it maps to |
| `body` text | | |

**`voice_journals`** — unprompted voice notes (not check-in replies). Created 17 August 2026. Distinct from `voice_replies`, which are always attached to a check-in.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK → `elders.id` | |
| `media_id` | text UNIQUE | **Idempotency key** against Meta redelivery — same pattern as `voice_replies.media_id`. |
| `audio_path` | text | Object in private bucket `voice-notes`: `{elder_id}/journal/{media_id}.ogg`. Distinct prefix from check-in replies (`{elder_id}/{checkin_id}/{media_id}.ogg`). |
| `duration_seconds` | numeric | **Always NULL.** Meta's inbound audio payload carries `id`, `mime_type` and `sha256` — no duration. Known limitation, not a defect (`PostDemoEnhancements.md` PD-20). |
| `transcript` | text | Whisper. |
| `ai_summary` | text | From the WF-9 classifier. |
| `mood` | text | Constrained to `positive`, `calm`, `tired`, `lonely`, `concerned`, `neutral`. |
| `themes` | text | |
| `attention_flag` | boolean | Raised when classification cannot be read (C21). |
| `provider` | text | |
| `recorded_at` | timestamptz | |
| `created_at` | timestamptz | |
| `urgency` | text | Constrained to `emergency`, `attention`, `none`. |

**RLS:** enabled. Three policies for `authenticated` — select, update, delete — each `EXISTS (SELECT 1 FROM elders e WHERE e.id = voice_journals.elder_id AND e.care_partner_id = auth.uid())`. **No insert policy.** n8n writes over the Postgres credential (bypasses RLS).

**`storage.objects` has zero RLS policies.** The `voice-notes` bucket is unreadable by `anon` and `authenticated`. Any playback must be signed server-side.

**`voice_journal_entries`** — **never created.** Do not invent this name. Live table is `voice_journals`. The Voice Journal **dashboard screen** remains a placeholder (FR-DB-6); ingest is live.

**`waitlist`** — public marketing signups. **No foreign keys and no dependents.** n8n reads and stamps it over the Postgres credential (bypasses RLS).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Generated in `POST /api/waitlist` via `crypto.randomUUID()` and inserted explicitly. Not `gen_random_uuid()` at the database, and **not** read back via `RETURNING` (§6.1). |
| `full_name` | text NOT NULL | |
| `email` | text NOT NULL | **No unique constraint.** Duplicate emails are permitted at the database. Whether to add one is an **open decision** (`PostDemoEnhancements.md` PD-19) — do not treat uniqueness as settled. |
| `phone` | text NOT NULL | |
| `whatsapp` | text NOT NULL | |
| `caring_for` | text | nullable; `parent` \| `spouse` \| `other` |
| `location` | text | nullable |
| `consent` | boolean NOT NULL | Must be `true`. The insert policy `WITH CHECK`s this. |
| `source` | text NOT NULL | default `web` |
| `created_at` | timestamptz NOT NULL | default `now()` |
| `notified_at` | timestamptz | nullable. Set by WF-8 after the confirmation email sends. NULL = not yet notified (replayable). |

**`deletion_events`** — append-only record of hard deletes (Loved One removal, Care Partner account delete, leftover `voice-notes` objects swept by WF-11). **Deliberately carries no foreign keys:** none to `elders`, because the referenced row is what was destroyed; none to `auth.users`, because that chain is `ON DELETE CASCADE` and would erase the audit along with the account. Live on 17 August 2026. RLS enabled with **zero policies**; `anon` and `authenticated` revoked. Session-client inserts fail. Writes use the service-role client (Next.js `createAdminClient()` after ownership is proven, or n8n's Postgres credential).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `source` | text NOT NULL | `app` (Loved One hard delete) · `account` (Care Partner account delete) · `wf11` (scheduled sweep). CHECK. |
| `elder_id` | uuid | nullable. Copied, not referenced. |
| `elder_first_name` | text | nullable. From the ownership select, before the row is gone. |
| `care_partner_id` | uuid | nullable. Copied from the session `user.id`. Not an FK. |
| `rows_deleted` | jsonb | default `{}`. Table → count, counted **server-side before** the DELETE. Never from the request body. |
| `storage_keys` | text[] | default `{}`. Keys the Storage API actually removed. |
| `storage_remaining` | int | default 0. From the post-removal prefix re-list. **`0` = re-listed and verified empty. `-1` = the storage sweep threw; the count is unknown.** Do not write `0` when the sweep failed. |
| `note` | text | nullable |
| `created_at` | timestamptz | default `now()` |

`DELETE /api/loved-ones/[id]` inserts `source = 'app'` **after** the verification re-list. `DELETE /api/account` inserts `source = 'account'` — one row per elder plus a summary row (`elder_id` NULL, note names the elder count). If that insert fails, the request still returns success — the rows are already gone. WF-11 is the backstop: 15-minute cron, own row with `source = 'wf11'`.

---

## 5.3 Front-end ↔ schema naming map

The front end uses friendly UI labels; the schema and the rest of the docs use role codes. **Same entities, different names** — the build must treat these as identical.

| Front-end name | Docs / schema | Role code |
|---|---|---|
| **Loved One** | Elderly Patient | **EP** |
| **Care Partner** | Care Partner / Target Customer | **CT** |
| **Local Buddy** | Local Caregiver | **LCT** |
| **Family Doctor** | Doctor | **DR** |

Field-name convention: the front end is `camelCase` (`whatsappNumber`, `escalationMinutes`); the database is `snake_case` (`whatsapp_number`, `escalation_minutes`). The API/data layer maps between them.

## 5.4 Front-end concepts that are v2 / Could-have stubs — do NOT build the backend for these yet

The front-end type model defines several fields ahead of scope. They are allowed to exist as **typed stubs** so the UI compiles, but **no backend, workflow, or table should be built for them in the MVP** unless listed as Must-have.

| Front-end concept | Status | Note |
|---|---|---|
| `NotificationMethod` = `sms` / `email` / `push` | **Could-have (C8)** | MVP is **WhatsApp only**. The enum may exist; only `whatsapp` is wired. |
| `VoiceJournalEntry.transcript` / `aiSummary` / `mood` / `themes` | **Ingest live (17 Aug 2026)** | Unprompted voice is stored in `voice_journals` (WF-9). The dashboard Voice Journal screen remains a placeholder (FR-DB-6). Voice **reply** transcription for check-ins is M4a / WF-5 → `voice_replies`. |
| `UserSettings` WhatsApp quiet hours / daily digest | **Out of scope** | Not in the PRD. Render if present, but no backend. |
| `HealthRoutine.answerType` = `number` / `mood` / `short_text` | **Should/Could** | MVP health check-ins are **Yes/No** (`yes_no`). Richer answer types are later. |
| `SOSEvent.averageResponseMinutes`, `callsMade` | Demo/analytics | Not core MVP logic. |
| `dateOfBirth`, `gender` on Loved One | Optional | Collected if offered; not required by any MVP workflow. |
| Persisted `reports` entity / report history | **Do not build** | There is no `reports` table. `/reports` generates PDF and CSV on demand from check-in data. The Loved One **Reports** tab is an entry point to that page with the current Loved One selected — not a list of stored report rows. History of generated files is post-demo (`PostDemoEnhancements.md` PD-27). |

## 5.5 Canonical glossary

**One vocabulary, two surfaces.** Front-end UI labels and docs/schema role codes name the same entities. Prefer the role code in schema, n8n, and migrations; prefer the UI label in product copy. When they differ, this section is the source of truth. Other docs should point here rather than inventing parallel mappings.

### Roles

| Front-end / UI | Docs / schema | Role code | Notes |
|---|---|---|---|
| **Loved One** | Elderly Patient | **EP** | WhatsApp-only end user. Never logs into the dashboard. |
| **Care Partner** | Care Partner / Target Customer | **CT** | Primary user and buyer. Always present. Owns the dashboard. |
| **Local Buddy** | Local Caregiver | **LCT** | SOS-only. **Optional at onboarding** (per-card Skip — no `skipLocalBuddy` draft flag). If absent, SOS is handled by the CT. |
| **Family Doctor** | Doctor | **DR** | Optional. SOS (only if `whatsapp_number` present) + read-only share link. No account in the MVP. |

Field-name convention remains: front end `camelCase` ↔ database `snake_case` (see §5.3).

### Check-in status — UI display vs backend source of truth

The front end (`CheckInStatus`) and the database (`checkins.status`) use different enums. **Backend `checkins.status` is the source of truth for the message path.** UI statuses are a **display mapping** over it. Do not invent new schema values to match UI labels one-for-one without a migration decision.

| UI (`CheckInStatus`) | Backend (`checkins.status`) | Relation |
|---|---|---|
| `upcoming` | `scheduled` | Not yet due / not yet fired. |
| `pending` | `sent` | Check-in dispatched; awaiting reply. |
| `delayed` | `reminded` | One reminder already sent; still waiting. |
| `taken` | `responded` | Affirmative answer (`response_value` `yes` / `yes_all`). |
| `answered_no` | `responded` | Negative or partial answer (`no` / `some_of_them`; defensive `not_yet`). **In the adherence denominator with no credit** — same weight as a miss, own pie slice. Label **"Answered no"** (not "Not taken") — shared across domains; a health `no` is a fact, not a diagnosis (N1). |
| `missed` | `missed` | Direct match — no reply after the reminder path. |
| `cancelled` | `cancelled` | Direct match — routine disabled while check-in was still open; not a miss and not a skip. **Out of adherence numerator and denominator** (Case 118). |
| `skipped` | *(no dedicated backend status)* | UI-only — elder skipped it. **Different meaning from `cancelled`.** Do not conflate. |

**Mapping (Talal, 12 August 2026):** `checkInStatusToUi(status, response_value)` — never map all `responded` to `taken`. Unrecognised `response_value` on a `responded` row → `taken` + log. List surfaces render `formatCheckInStatusWithResponse` so the CT sees e.g. `Answered no · some of them` (status drives maths; response text keeps the sentence true). No separate `partial` UI status — `some_of_them` is `answered_no`.

### Viewer “today” vs elder materialisation day

Dashboard range bounds (including “today” and custom date+time) use the **Care Partner’s** IANA timezone (`viewerTimeZone`). Check-ins are **materialised in the elder’s** timezone. When CT and elder zones differ, the same `scheduled_for` instant can fall on different calendar days for each — **accepted; do not reconcile in the UI.**

### SOS status — display vs dispatch

| Layer | States / behaviour | Authority |
|---|---|---|
| **Display (front end)** | `active` \| `acknowledged` \| `resolved` \| `cancelled`; sequential visual cascade (Loved One → Care Partner → Local Buddy → Family Doctor) on a demo timer | Presentation only |
| **Dispatch (n8n / DB)** | `sos_events.status` = `open` \| `resolved`; notify CT + LCT (if present) + Doctor (if present); **1 alert + 3 nudges** (2 min apart); `nudges_sent` 0–3 | **Source of truth** |

See WF-4 for the full dispatch rules. The display cascade must **not** replace Meeting-11 parallel dispatch.

### 5.6 Unused-column register (A4)

Columns that remain in the schema but are **not collected or relied on by product UI**. Do not treat them as live requirements. Prefer leaving them in place over drive-by drops unless a dedicated cleanup migration is approved.

| Table | Column(s) | Notes |
|---|---|---|
| `care_partners` | `address`, `secondary_contact` | Unused by any screen. |
| `elders` | `gender` | Collected nowhere. |
| `local_caregivers` | `action_plan` | Unused. |
| `food_routines` | `meal_type`, `frequency`, `notes` | Defaulted / unused. |
| `health_routines` | `type`, `frequency`, `question`, `answer_type`, `typical_bedtime`, `typical_wake_time` | Defaulted / unused. |

`doctors.timezone` is **not** in this register — the column still exists and is readable, but onboarding **stops collecting** it and the share page must render in the **elder's** timezone (§10).

### 5.7 Care Circle write model (A4)

Care Circle is **one screen** that writes `care_partners`, draft `elders` (`active = false`), and optionally `local_caregivers` / `doctors`. Supabase JS has no multi-statement transaction.

**Decided approach:** a Postgres RPC `save_care_circle_draft` (name may vary) with **`SECURITY INVOKER`** so RLS still applies as the calling CT. One transaction:

1. Upsert `care_partners` (WhatsApp + timezone; names from Auth / existing row — not re-collected on this screen).
2. Insert/update draft `elders` with required Loved One fields (`active = false`).
3. Insert `local_caregivers` / `doctors` only when that card was engaged; skipped cards write **no row**. Doctor rows insert with **`approved_by_ct = false`** (FR-ON-7 — explicit CT approval). Review sets `approved_by_ct = true` in the **same write** that sets `consent_data_sharing_at` (when Doctor was added).
4. Any error → full rollback (no orphan elder, no permanent `whatsapp_number` UNIQUE lock).

Draft discard remains **hard DELETE** (D11). Product activation (`active = true`) and Review consents remain later in the wizard. New columns inherit existing table RLS; re-verify policies after migration (`Phases.md` GATE A4).

### 5.8 Product Loved One hard delete (Talal, 17 August 2026)

Soft-deleting a product elder was proposed and **rejected**. `DELETE /api/loved-ones/[id]` removes the elder row; every child row follows via FK `ON DELETE CASCADE`. No migration was required — cascade and RLS were already correct.

`storage.objects` has **zero RLS policies**, so the database cascade cannot remove objects in `voice-notes`. The route therefore:

1. Proves ownership with the **session** client (`elders` select under RLS). Another family's id → **404**, not 403. Unauthenticated → **401**.
2. Collects `audio_path` from `voice_journals` and from `voice_replies` joined through `checkins` **while the rows still exist**.
3. Counts every child table **server-side** (scalar `count(*)` subselects / inner-join counts). Dialog numbers are not read.
4. Deletes the elder under RLS (`DELETE … RETURNING id`; `if (!data)` per C19).
5. **Only then** constructs `createAdminClient()` and calls the Storage API (`voice-notes.remove`), never `DELETE FROM storage.objects`.
6. Prefix-sweeps `{elder_id}/` (including `journal/` and each `{checkin_id}/` folder) for objects the database did not know about.
7. Re-lists the prefix. Leftovers are logged; the request still succeeds.
8. Inserts `deletion_events` (`source = 'app'`) with the server counts, the keys actually removed, and `storage_remaining`. Insert failure is logged; the HTTP response is still success. **WF-11** (Track B, 15-minute cron) is the leftover-object backstop and writes its own row with `source = 'wf11'`.

**Accepted race:** a Loved One deleted in the seconds between a scheduler send node firing and the row disappearing can receive one final WhatsApp check-in. WF-1 / WF-1b / WF-1c do not crash; the terminal `UPDATE` matches zero rows and stops. Documented, not fixed.

The only UI entry point is the Loved Ones list dialog. A delete control on `/loved-ones/[id]` is deferred (`PostDemoEnhancements.md` PD-24).

### 5.9 Care Partner account delete (Talal, 17 August 2026)

Purpose: **re-onboarding**. After deletion the same person must be able to sign up again with the **same email** and onboard elders on the **same WhatsApp numbers**. `elders.whatsapp_number` is a plain UNIQUE with no tombstone — only a hard delete frees the number.

`care_partners.id` is the **only** public FK to `auth.users`, `ON DELETE CASCADE`. That chain reaches elders and every descendant. Therefore **one** `auth.admin.deleteUser()` removes the account and every child row. Do not write per-table deletes. `deletion_events.care_partner_id` has no FK, so audit rows survive.

`DELETE /api/account`:

1. Session `getUser()`. No user → **401**.
2. Request body email must match the session email (case-insensitive, trimmed). Mismatch → **400**. Nothing is deleted.
3. **Admin client.** Collect every elder id for this Care Partner (including `active = false`), per-elder cascade counts (admin — `watchdog_alerts` has no authenticated SELECT), and every `audio_path` from `voice_journals` and `voice_replies`. Once the auth user is gone these are unrecoverable (`Rules.md` SEC12).
4. `auth.admin.deleteUser(user.id)`.
5. Storage API remove of collected keys, then `{elder_id}/` prefix sweep per elder. Leftovers logged; request still succeeds — **WF-11** is the backstop.
6. `deletion_events` `source = 'account'`: one row per elder, plus a summary row (`elder_id` NULL). Insert failure is logged, not returned.

UI: Settings → Account, last card after Sign out. Confirm button disabled until the typed email matches.

## 6. Data isolation (RLS) — P4

Every **family-data** table above carries a path to `care_partners.id`. RLS is enabled on **all** of them, with policies of the form:

```sql
-- Example: elders
alter table elders enable row level security;

create policy "CT reads own elders" on elders
  for select using (care_partner_id = auth.uid());

create policy "CT writes own elders" on elders
  for all using (care_partner_id = auth.uid())
       with check (care_partner_id = auth.uid());

-- Example: a child table (checkins) — isolation via the elder
create policy "CT reads own checkins" on checkins
  for select using (
    exists (select 1 from elders e
            where e.id = checkins.elder_id
              and e.care_partner_id = auth.uid())
  );
```

**Rules:**
- RLS is enabled on every table. No exceptions. A table without RLS is a data breach with a delay fuse.
- **n8n uses the service-role key** and therefore bypasses RLS. This is deliberate — n8n is trusted infrastructure, not a user session. The service-role key **must never leave the n8n server or the Next.js server runtime**. It is never sent to a browser.
- **The Doctor share link does not use RLS.** A token is not a session and `auth.uid()` is null. Instead: a Next.js **server-side** route validates the token hash, checks `revoked_at` and `expires_at`, resolves it to exactly one `elder_id`, and queries with the service-role key **scoped to that elder only**. The token never reaches the database and the browser never gets a Supabase key. (See §7.3.)
- **`waitlist` and `deletion_events` are the exceptions to “path to `care_partners.id`”.** Waitlist: §6.1. Deletion events: no FKs by design (§5.2) so the audit survives the elder and the account.

### 6.1 Public unauthenticated writes (`waitlist`)

This is the first table in ElderWise that accepts writes from visitors who are not signed in.

**Policy (one only):** `waitlist_public_insert` — `FOR INSERT TO anon, authenticated WITH CHECK (consent = true)`. No SELECT, UPDATE, or DELETE policy exists for `anon` or `authenticated`. A client-role `SELECT` returns 0 rows even when rows are present — verified 17 August 2026. The signup list is not readable from the browser.

**Why the policy names both `anon` and `authenticated`:** a signed-in Care Partner posting the public form carries the `authenticated` role, not `anon`. An `anon`-only policy silently rejects them (`Rules.md` SEC9). Verified: insert as `anon` succeeds; insert as `authenticated` succeeds.

**Request path:** browser → `POST /api/waitlist` → rate limit (`elderwise:rl:waitlist`, 8 per 10 minutes per IP, **fail-open**) → Zod validation → route-generated `crypto.randomUUID()` → anon insert **with no `RETURNING`** → fire-and-forget WF-8 webhook → `{ ok: true, id }`. Public UI: `/waitlist` and `WaitlistSection` on the landing page (above `FinalCta`).

**Why there is no `RETURNING`:** under an insert-only policy, `INSERT … RETURNING` raises **Postgres error 42501**. Verified by probe on 17 August 2026. Adding a SELECT policy to make `RETURNING` work would make the signup list readable and reintroduce email enumeration. The id is therefore generated in the route and passed in the insert payload. Do not "fix" this by adding a SELECT policy (`Rules.md` D14).

**n8n after commit:** Next.js POSTs to `N8N_WAITLIST_WEBHOOK_URL` with `X-ElderWise-Signature` and body `{ "waitlist_id": "<uuid>" }` **after** the insert commits. A webhook failure is logged to Sentry and **must not fail the user's request** — the row is already saved and WF-8 can be replayed (rows with `notified_at IS NULL`).

---

## 7. Authentication

### 7.1 Care Partner
Supabase Auth — **email + password only**. Session in an httpOnly cookie via the Supabase SSR client. `auth.uid()` is the root of every RLS policy.

> **D-8 · Google OAuth withdrawn from the MVP (Talal Baig, 10 August 2026).** This reverses the earlier ruling (open item C1) that Google sign-in was a go for Demo Day. Simple email + password is sufficient for the MVP; the work is deferred to `PostDemoEnhancements.md` **PD-9**.
>
> **Why this is a redesign and not a configuration task — do not attempt to "just add a callback route".** Authentication and onboarding are currently one coupled flow. `postAuthPath()` in `src/lib/auth-routing.ts` can express exactly two states: `/dashboard` if the Care Partner owns an active elder, `/onboarding` otherwise. The `care_partners` profile row is created by `ensureCarePartnerProfile()` (`src/lib/data/ensure-care-partner.ts`), which is idempotent and runs on both sign-up and first sign-in — **but only when invoked from the two form submit handlers, and only because those handlers can supply `fullName` and `timeZone`.** An OAuth callback has neither a form nor those two inputs.
>
> OAuth therefore introduces a third state that routing cannot express: **authenticated, no profile row.** That state fails *silently*, because `countOwnActiveElders()` returns `0` on error — a missing profile is indistinguishable from a brand-new user. The blast radius is wider than the post-auth redirect: `hasOwnProductElder()` is consumed at three points in `src/components/auth/route-guards.tsx` and again in `src/app/(app)/layout.tsx`, so an affected user would be bounced from `/dashboard` to `/onboarding` on every app-layout render.
>
> Adding Google sign-in requires **separating authentication from onboarding**: a profile-creation path that does not depend on form input, a third routing state, and a gate that distinguishes "no profile" from "no elder". See PD-9.

**Onboarding exit (Talal, 12 August 2026):** a Care Partner with no product elder is correctly held on `/onboarding`, and `/sign-in` (`RequireGuest`) bounces any live session back into that path. The wizard shell therefore exposes **Sign out** on every step (including care-circle, where Back is disabled): clear the Supabase session, clear the local onboarding draft so the next account does not inherit a half-filled form, then navigate to `/sign-in`. Warn when local progress exists; never block the exit. Do not auto-purge `care_partners` rows on abandon. The related `countOwnActiveElders` `if (error) return 0` footgun is deferred as **PD-15**.

### 7.2 Elderly Patient
**None.** The EP never authenticates and never logs into anything. Their identity is their WhatsApp number, resolved on the inbound webhook. This is the entire premise of the product — do not add a login for the elder under any circumstances.

### 7.3 Doctor
**No account.** A tokenised, revocable, read-only share link scoped to a single elder (M15).

- CT issues the link from the Care Circle screen → a cryptographically random token (**≥32 bytes**) is generated, **hashed with SHA-256**, and stored in `doctor_share_links`. The raw token is shown **once** and lives only in the URL. **Not bcrypt/argon2:** the token must be looked up **by its hash**, and a per-row-salted password hash makes that impossible. SHA-256 is correct here because the token is high-entropy random, not a user-chosen password.
- **Default expiry 30 days, always set on create.** An open-ended link is a permanent credential sitting in someone's WhatsApp history.
- The doctor opens `/share/{token}`. A Next.js **server component** hashes the incoming token, looks it up, rejects if revoked or expired, and scopes every query to that one `elder_id`.
- **Click-through gate:** `/share/{token}` renders neutral copy first; clinical data loads only after human interaction. Reason: link-preview crawlers (WhatsApp, Slack, Signal, email scanners) fetch any URL a CT sends and would otherwise receive health data with nobody clicking. Supported by `noindex`/`nofollow`, no OG or Twitter meta tags, `Disallow: /share/` in `robots.txt`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`.
- **Doctor *share page* allowlist:** elder name, check-in history (UI-mapped statuses), active medication routines, SOS events (`triggered_at`, `status`, `resolved_at`, `resolved_by_role`, `resolved_channel`, derived response time), and a **deterministic summary strip** (overall + per-domain counts for medication / food / health over a stated calendar window — default last 30 days). **Excluded from the page:** `sos_notifications`, `resolved_by_id`, CT and Local Buddy contact details, phone numbers. Reason: the event is clinical; the dispatch log is operational and carries third-party identifiers. Check-in rows are scoped by **calendar window**, not a global row limit — so one domain cannot starve another. **No LLM** on this path.
- **⚠️ This allowlist scopes the share page only — not the SOS channel.** The approved template `elderwise_sos_alert_doctor` deliberately carries the **Local Buddy's and Care Partner's names and WhatsApp numbers** to the doctor (`{{4}}`–`{{7}}`), because during an active emergency the doctor may need to reach a human immediately and a read-only page cannot be dialled. **Ruled 28 July 2026 (Talal).** The two surfaces differ on purpose: the share page is ambient and long-lived, the SOS message is transient and consented-to. Both are covered by the Review `consent_data_sharing_at` consent, which is required whenever a Doctor or Local Buddy is added. Do not "fix" the inconsistency by stripping the template — it was approved by Meta in this form.
- Similarly, `elderwise_sos_alert_lct` discloses the **Doctor's name and clinic** to the Local Buddy (`{{4}}`/`{{5}}`), under the same consent and the same reasoning.
- Rate limited to **20 requests per minute per platform IP** (`x-vercel-forwarded-for`; fall back to `x-forwarded-for` locally), **fail-open** — see §12.5.
- **All data fetching for this route happens server-side.** No Supabase client is ever handed to the doctor's browser.
- CT can revoke at any time — sets `revoked_at`, and the link dies on the next request.

---

## 8. The message path (n8n)

The n8n instance carried **24 workflows** as of 17 August 2026: 21 operational (including WF-7 Dispatch Watchdog, WF-8 Waitlist Confirmation Dispatch, WF-9 Voice Journal Ingest and WF-10 SOS Cancel Handler), the shared Error Workflow, and two read-only utilities (Template Audit, Credential Check). Verified by full enumeration. **WF-11** (voice-notes sweep) was added the same day as Loved One hard delete; it is on this map and writes `deletion_events`. (22 as of earlier 17 August 2026 after WF-8; 21 as of 11 August 2026; prior working map said twenty as of 9 August 2026; sixteen as of 4 August 2026 — gaps were incomplete documentation, not missing builds.)

| Workflow | n8n ID | Trigger | Role |
|---|---|---|---|
| **WF-0** Consent Welcome Dispatch | `n1EcFnlIDRMB5MEi` | cron 5 min | Claims one elder awaiting welcome; sends `elderwise_ep_welcome` |
| **WF-1** Medication Scheduler | `sqFa3XkYSEEVgPpC` | cron 1 min | Materialise + dispatch medication check-ins; honours `days_of_week` |
| **WF-1b** Food Scheduler | `J0HQ47OKo21whK9G` | cron 1 min | Materialise + dispatch food check-ins, one per `food_routines` row |
| **WF-1c** Health Scheduler | `2HgbXGM0Z5XQArf1` | cron 1 min | Materialise + dispatch health check-ins, one per `health_routines` row |
| **WF-2** Inbound Router | `oHSNqoskL0nOoOfo` | Meta webhook | **Thin router** — one Execute Sub-workflow node. Owns the Meta callback. |
| **WF-2a** Inbound Router (logic) | `Ne4rNaezpjn95UMM` | sub-workflow | All routing logic incl. `food_health_response` and `voice_note` |
| **WF-3a** Medication Response Handler | `j0CWtHYyzplmad09` | sub-workflow | Records medication button replies |
| **WF-3b** Reminder Sweep (All Domains) | `5P19E5CPhA14K6fo` | cron 1 min | One reminder after `escalation_minutes` — **all three domains** (templates 2/5/6 by domain) |
| **WF-3c** Missed Sweep (All Domains) | `A3Z7yjrxLRZ6pI5r` | cron 1 min | **Sole owner** of the `missed` transition **and** the `cancelled` transition (orphan cleanup); two parallel branches off one trigger |
| **WF-3d** Food & Health Response Handler | `Mx035ogWEoY1MEdU` | sub-workflow | Records food/health `Yes`/`No`; calls WF-6 with `notification_type=interaction` |
| **WF-5** Voice Reply → STT | `IC6oR4fuQd2VMkfQ` | sub-workflow | Whisper + LLM gate; voice storage; re-ask once |
| **WF-4** SOS Orchestrator | `HSEp1YhQFHjga9qa` | sub-workflow | Create/reuse `sos_events`, load care circle, mint share link, dispatch templates 10/11/12 at `nudge_index 0`, acknowledge the elder |
| **WF-4a** SOS Resolution Receiver | `jeNrf7b7ne3JX2Xu` | webhook | A2.7 dashboard → n8n stop-nudges |
| **WF-4b** SOS Resolution Handler | `jh2P2gibpCsnyhoy` | sub-workflow | WhatsApp resolution path — attribute, write, call WF-4c |
| **WF-4c** SOS Resolution Broadcast | `Baydb7saYNyAayMC` | sub-workflow | Template 14 to every recipient of a `sent` alert |
| **WF-4d** SOS Nudge Sweep | `EY36qDhdv5FqfL0W` | **cron 1 min** | Nudge rounds 1–3, template 13 |
| **WF-6** Care Partner Notifications (All Domains) | `6I6OC7qJ5YhhUQxU` | sub-workflow | Templates 8 and 9 |
| **WF-7** Dispatch Watchdog | `8G8s8dNSVySDbPpm` | cron 5 min | Alerts when a check-in was never sent (A-30); once per check-in via `watchdog_alerts` |
| **WF-8** Waitlist Confirmation Dispatch | `V9VTNaLGJkFGUTFN` | webhook | Email confirmation after a public waitlist insert (`POST /webhook/elderwise-waitlist`) |
| **WF-9** Voice Journal Ingest | `2KWtzSH22fTNxed9` | sub-workflow | Unprompted voice → `voice_journals`; `urgency = emergency` calls WF-4 |
| **WF-10** SOS Cancel Handler | `CPDmCJh8e1WO8Sod` | sub-workflow | Elder whole-message `cancel` resolves an open SOS (Option A) |
| **WF-11** Voice-notes sweep | — | cron 15 min | Orphan objects in `voice-notes`; writes `deletion_events` with `source='wf11'`. n8n ID lands with the next export cron. |
| **Error Workflow** | `uvBstI6J42nNhIYz` | error trigger | Shared Track B failure path → Telegram + Gmail (§11.1) |
| **Template Audit** (read-only) | `PADE2m75e6xVGS2e` | Manual, inactive | Utility — not on the message path |
| **Credential Check** (read-only) | `5nVL2BdvqeX2i0AU` | Manual, inactive | Verifies both Supabase credentials (Postgres query + Storage bucket listing) |

**Track B message-path workflows: built** (4 August 2026). **WF-7 Dispatch Watchdog built** (10–11 August 2026). **WF-8 Waitlist Confirmation Dispatch built** (17 August 2026) — email only; WhatsApp confirmation pending Meta approval of `elderwise_wl_confirmation`. **WF-9 Voice Journal Ingest and WF-10 SOS Cancel Handler built** (17 August 2026). **WF-11** Voice-notes sweep (Track B, Claude) — 15-minute cron; leftover objects after Loved One hard delete (§5.8); writes `deletion_events`. **Remaining:** open items A-31, A-34, A-35; accepted MVP items A-5 / A-14 / A-17–A-19 / A-22 / A-24; `some_of_them` fourth gate output accepted as A-12.
> **Three defects fixed this evening (3 Aug 2026) — record as defects, not design intent:**
>
> 1. **`days_of_week` was ignored (medication).** WF-1's materialise query never referenced the column, so a Monday/Wednesday/Friday medication fired **every day**. Fixed in all three scheduler queries (WF-1, WF-1b, WF-1c). Empty array means every day; the day name is derived locale-independently from `extract(dow …)` and an explicit array, not `to_char`.
> 2. **A check-in could be marked missed with nobody told.** WF-1, WF-1b and WF-1c each marked overdue `scheduled` rows `missed` **without calling WF-6**, while WF-3c marked `reminded` rows *and* escalated. They also raced. **WF-3c is now the single owner** and handles both paths — reminded-and-silent, and never-dispatched. The never-dispatched case is exactly when the Care Partner most needs to know, and it was silent.
> 3. **WF-6 would have notified a muted routine.** `notify_mode` came from `LEFT JOIN medications` alone, so for food or health every join returned NULL and `COALESCE(…, 'every_time')` sent anyway — including for a routine explicitly set to `not_required`, contradicting the warning text the Care Partner was shown at onboarding. WF-6 now reads `notify_care_partner` per domain via the check-in FKs.

> **⚠️ SAFETY RULE — Why WF-2 is thin.** `update_workflow` via the n8n API **rotates a trigger node's `webhookId` on every call**. Editing WF-2 through the API would change the Meta callback URL and **silently stop all inbound WhatsApp**. **WF-2 is edited in the n8n UI only.** All routing logic lives in **sub-workflows** (WF-2a and downstream), which have no webhook and are safe to update programmatically. See `Rules.md` §6a.

### WF-0 · Consent / welcome dispatch (`n1EcFnlIDRMB5MEi`)
- **Trigger:** cron, every **5 minutes**.
- **Selects / claims** one elder where `active = true` AND `consent_requested_at IS NULL` AND `consent_confirmed_at IS NULL` AND `consent_declined_at IS NULL`, via **`UPDATE … RETURNING … FOR UPDATE SKIP LOCKED`** (claim-then-send).
- Sends the welcome / consent template (`elderwise_ep_welcome` — see `Templates.md`).
- **Ordering is claim-then-send**, not send-then-mark. Rationale: a failed send leaves one elder unwelcomed (visible, fixable); a failed mark after a successful send would re-send every cron tick to an elderly person and risk the single WhatsApp Business account (**R1**).
- **WF-1 is unchanged** and still gates only on `consent_confirmed_at`. WF-0 does not schedule check-ins.

### WF-1 · Medication Scheduler (`sqFa3XkYSEEVgPpC`)
- **Scope:** `domain = 'medication'`.
- **Trigger:** cron, every minute.
- **Consent gate — the first check, before anything else:** skip any elder whose `consent_confirmed_at` is NULL. **An elder who has not confirmed in-channel is never sent a check-in.** A Meta opt-in requirement, and an ethical one (§9). Unchanged by B1.5 / WF-0.
- Reads **enabled, active medications** for each consented elder — **does not read `domain_configs`**. Computes the next due occurrence per elder **in the elder's IANA timezone**, honouring **`days_of_week`** (empty array = every day), and materialises a `checkins` row (`status = scheduled`).
- Dispatches the WhatsApp template, sets `status = sent`, `sent_at`, `wa_message_id`.
- **Dispatch bound:** send only while `now() <= scheduled_for + escalation_minutes`. Beyond that window the row stays `scheduled` for **WF-3c** to mark missed — WF-1 **does not** mark overdue rows missed (defect fixed 3 Aug 2026).
- **Restart-safety** comes from the `scheduled` → `sent` state machine, **not** a catch-up window that would send stale templates.
- **Must land within ±5 minutes of `scheduled_for` when it does send** (NFR-6).

### WF-1b · Food Scheduler (`J0HQ47OKo21whK9G`)
- **Scope:** `domain = 'food'`. One check-in per enabled `food_routines` row.
- **Trigger:** cron, every minute. Same consent gate and `days_of_week` rules as WF-1.
- Materialises with `food_routine_id` set; dispatches template 4; does **not** mark missed — **WF-3c** owns that transition.
- **Postgres `connectionTimeout`:** `Materialise Due Food Check-ins` is set to **15** seconds (OBSERVED 9 August 2026), raised from 10 after the connection-timeout failures of 8 August.

### WF-1c · Health Scheduler (`2HgbXGM0Z5XQArf1`)
- **Scope:** `domain = 'health'`. One check-in per enabled `health_routines` row.
- **Trigger:** cron, every minute. Same consent gate and `days_of_week` rules as WF-1.
- Materialises with `health_routine_id` set; dispatches template 3 (v2 pending — see `Templates.md`); does **not** mark missed — **WF-3c** owns that transition.

### WF-2 · Inbound Router — thin shell (`oHSNqoskL0nOoOfo`)
- **Trigger:** Meta WhatsApp Cloud API webhook. **Owns the Meta callback URL.**
- **UI-only edits.** Never update this workflow via the n8n API (webhookId rotation — see safety rule above).
- Contains **one Execute Sub-workflow** node that hands the payload to **WF-2a**. No routing logic here.

### WF-2a · Inbound Router (logic) (`Ne4rNaezpjn95UMM`)
- **Trigger:** sub-workflow (called by WF-2).
- Resolves the sender's number → `elders.whatsapp_number` (indexed).
- Routes on payload type:
  - **Welcome confirmation** → set `elders.consent_confirmed_at`. Until this exists, nothing else is ever sent (except SOS — see below).
  - **Welcome decline** → set `elders.consent_declined_at`. **Terminal for check-ins:** never schedule, never re-ask. Proven on real WhatsApp **3 August 2026:** button `No, thank you` normalises to `no thank you` (lowercase, strip apostrophes and punctuation, collapse whitespace) and sets `consent_declined_at`.
  - **Button reply** (medication *Yes, All* / *Some of them* / *Not Yet*) → **WF-3a**.
  - **Button reply** (food / health *Yes* / *No*) → **`food_health_response`** route → **WF-3d**.
  - **Medication = "Some of them"** — **scope reduction, ruled by Talal 3 August 2026:** the free-form interactive medicine list (`Templates.md` §7.1) is **not built**. The reply is recorded as `response_value = 'some_of_them'`, `status = responded`, and the Care Partner is notified (via WF-6 — see below). **Known gap:** we do **not** capture which medicines were taken — `checkin_medication_items` is populated only on *Yes, All*. Reason: the native WhatsApp node has no interactive-list message type; delivering one requires raw HTTP to the Graph API, which the team has ruled against. See open item **A-12**.
  - **Voice note** → **`voice_note`** route when `message_type === 'audio'` **and** a `media_id` is present, inside the **consented** block alongside `med_response` and `food_health_response`. **Parse Inbound Message** emits `media_id` from `msg.audio?.id`. Calls **WF-5** with **`waitForSubWorkflow: false`** — WF-5 takes ~6–7 s; holding Meta's callback that long invites a retry (same reasoning as WF-4). **Built and proven end to end 4 August 2026.** WF-5 decides whether the audio is a check-in reply or a journal entry (§8 WF-5 / WF-9).
  - **SOS trigger** → **WF-4** — **checked first and short-circuits everything else** (P2). The elder's message must normalise to exactly `sos` or `help` — **whole-message exact match**, case-insensitive, **not** a contains-match. A contains-match would fire a three-person emergency on *"can you help me with my tablets?"*. **Ruled by Talal, 3 August 2026.** **SOS fires regardless of consent state**, including an elder who has declined — deliberate carve-out from N5: she is the sender, and the alerts go to her care circle, not to her. **Ruled by Talal, 3 August 2026.**
  - **SOS cancel** → **`sos_cancel`** route → **WF-10**. Checked **after** `sos_trigger` and **before** `sos_resolution`. Gated on `db.found === true` and whole-message exact match on `text_norm` === `cancel` (same normalisation as SOS / help — `Rules.md` C22). Nodes: `SOS Cancel?` and `Call WF-10`. **Built 17 August 2026.**
  - **SOS resolution reply** → **WF-4b** (WhatsApp path). Matched on **four** button labels, not two (table below). Dashboard path → **WF-4a**.
  - **Delivery-status callbacks** (`statuses`, no `messages`) — normal inbound traffic; handle, do not treat as errors (`Rules.md` §6a)
  - **Unrecognised** → a gentle, plain-language re-prompt. Never a silent drop; never an error message an elderly person has to interpret.
- **SOS resolution labels — all four must resolve to the same SOS resolution.** Matching only two previously documented labels would silently discard the Buddy's and the Doctor's resolutions — two of the three recipients unable to stop a live emergency.

| Template | Recipient | Button | Normalised |
|---|---|---|---|
| 10 `elderwise_sos_alert_ct` | CT | `I Am Responding` | `i am responding` |
| 11 `elderwise_sos_alert_lct` | Buddy | `I'm on my way` | `im on my way` |
| 12 `elderwise_sos_alert_doctor` | Doctor | `Acknowledge` | `acknowledge` |
| 13 `elderwise_sos_nudge` | all three | `I'm Responding` | `im responding` |

- **Normalisation (load-bearing order):** lowercase → **strip apostrophes first** → strip remaining punctuation → collapse whitespace. Apostrophe-stripping must run **before** the non-alphanumeric replace, or `I'm on my way` becomes `i m on my way` and the match fails. **Never compare raw strings.** Exact labels: `Templates.md` §3.2.
- **Resolution is attributed by `context.id`, never by sender number.** An inbound quick-reply carries `context.id` = the wamid of the message it replies to. Join it to `sos_notifications.wa_message_id` to get the exact `recipient_role`, `recipient_id` and which nudge round was answered. Sender-number lookup is ambiguous whenever one person holds more than one role, and is a fallback only — on ambiguity, log and do not guess (P3). Verified live on 3 August: three replies from one number resolved to three distinct roles.
- **A `No` on a food or health check-in is a recorded negative response** (backend `responded`), **not** a missed check-in. Do not route it down the missed path.
- **Food and health response attribution:** bare `Yes` / `No` cannot be told apart by text alone. Attribute by **`context.id` → `checkins.wa_message_id`** — the same mechanism proven on the SOS path against `sos_notifications`. **WF-3b's food and health reminders overwrite `checkins.wa_message_id`** with the reminder's wamid, so a reply quoting the reminder still attributes correctly. Medication deliberately does **not** use this path — it is matched by distinctive button text through **WF-3a**, which was left untouched.

### WF-3a · Medication Response Handler (`j0CWtHYyzplmad09`)
- **Scope:** `domain = 'medication'` **only**.
- **Trigger:** sub-workflow (from WF-2a).
- **On response:** write to `checkins` (+ `checkin_medication_items` when *Yes, All*), set `status = responded`.
- Fire **WF-6** when the owning routine's `notify_care_partner` requires a CT notice (see WF-6).

> Guard present (F-7 / D-9 closed 9 August 2026). Record Response → Response Written? (IF on `!!$json.checkin_id`) → true: Notify Care Partner (WF-6); false: Check-in Already Closed (NoOp). Verified on live workflow version `d9016665`. Needed because the CTE query uses scalar subqueries in the outer SELECT, so a zero-row UPDATE returns one row of NULLs, not `[]` — without the guard WF-6 would be invoked with `checkin_id` NULL. Satisfies `Rules.md` §6a. The equivalent guard on the food/health side (WF-3d) was observed firing in production in execution 56991, 9 August 2026.

### WF-3b · Reminder Sweep (All Domains) (`5P19E5CPhA14K6fo`)
- **Scope:** **all three domains** — templates **2** (medication), **5** (food), **6** (health) by domain.
- **Trigger:** cron, every minute.
- Find `checkins` where `status = sent` and `now() > sent_at + escalation_minutes` (read from the **owning routine** — medication via `checkin_medication_items`, food via `food_routine_id`, health via `health_routine_id`).
- Send **exactly one** reminder → `status = reminded`, set `reminder_sent_at`, **overwrite `wa_message_id`** for food/health (attribution — see WF-2a). Skip CT push paths when `notify_care_partner = not_required`.

### WF-3c · Missed Sweep (All Domains) (`A3Z7yjrxLRZ6pI5r`)
- **Scope:** **all three domains**. **Sole owner of the `missed` transition** (defect fix 3 Aug 2026) **and sole owner of the `cancelled` transition** (orphan cleanup — 4 Aug 2026).
- **Trigger:** cron, every minute. **Two parallel branches** off the same schedule trigger:
  1. **Mark Missed And Collect** — routines that **are enabled** (`enabled = true`; medication also requires `active = true`). Marks missed on both paths:
     - **`reminded`** and still silent after the delay elapses again.
     - **`scheduled`** and never dispatched past the dispatch window (never-dispatched — the case the Care Partner most needs to know about).
     - Sets `status = missed`, `missed_at`. If `notify_care_partner ≠ not_required`, escalate to the **CT only** (LCT and Doctor are never contacted on a missed check-in) → fire **WF-6**. If `not_required`, record the miss and send nothing.
  2. **Cancel Orphaned Check-ins** — routines that are **not** enabled (or, for medication, no longer have an active medicine in the slot). Sets `status = cancelled`, `cancelled_at`. **Nothing runs downstream** of the cancel node — no WF-6, no guard needed; `cancelled_count` exists only for the execution log.

- **One writer preserved structurally:** the two selection sets are **mutually exclusive by construction** — missed branch selects enabled routines; cancel branch selects disabled ones. Each UPDATE re-checks status, so a mid-run flag flip is safe in either execution order (`Rules.md` §6a).

- **Defect fixed (4 Aug 2026):** before this branch, an open check-in whose routine was disabled could **never terminate**. WF-1 dispatch, WF-3b reminder and WF-3c missed all filter `enabled = true`, and WF-3c missed only handled `status IN ('reminded','scheduled')` — so a check-in sitting at **`sent`** when the routine was disabled was **stranded permanently**.
- **Proven live 4 August:** check-in `4af31e90` (Panadol 10:00, routine disabled) was stranded at `scheduled`, then **cancelled within 60 s** of the branch going live; three enabled check-ins were untouched.

- **Selection predicates by domain:**
  - **Medication** — `NOT EXISTS` against the **time slot**, not a simple `enabled = false` test, because a medication check-in has **no FK to a medication** — it is slot-scoped. The predicate covers disabled, soft-deleted (`active = false`), hard-deleted, and time-changed in one condition.
  - **Food / health** — use `food_routine_id` / `health_routine_id` FKs. All three domains now have **`enabled` (pause) and `active` (tombstone)**. Soft-delete sets both, so the cancel branch (not-enabled) still matches.

### WF-3d · Food & Health Response Handler (`Mx035ogWEoY1MEdU`)
- **Scope:** `domain = 'food'` and `domain = 'health'`.
- **Trigger:** sub-workflow (from WF-2a `food_health_response` route).
- Attribute inbound `Yes`/`No` by **`context.id` → `checkins.wa_message_id`** (see WF-2a).
- Write `status = responded`, `response_value`, `responded_at`, `response_channel = button`.
- Calls **WF-6** with `notification_type=interaction` after recording, so an `every_time` food or health routine actually notifies the Care Partner. **WF-6 still applies the `not_required` mute.**
- **Zero-row guard:** a CTE / write matching zero open check-ins can return `{success:true}`; an explicit `Response Written?` gate terminates at `No Open Check-in For This Reply` so no duplicate CT notification and no data change.
- **Proven live 9 August 2026** in execution `56991` — a second button tap on a food check-in produced a zero-row write returning `{success:true}`, which that guard caught.

### WF-4 · SOS Orchestrator (`HSEp1YhQFHjga9qa`) — **built 3 August 2026** — **the critical path (P2)**

> **SOS has two layers — do not confuse them.**
>
> **(A) SOS display layer (front end / presentation only).** The dashboard UI may show states `active | acknowledged | resolved | cancelled` and a sequential visual cascade (Loved One → Care Partner → Local Buddy → Family Doctor) that advances on a demo timer. This is presentation for the care-partner portal and demo UX. It is **not** the dispatch algorithm.
>
> **(B) SOS dispatch logic (backend / n8n — actual behaviour).** On trigger, notify **CT + LCT (if present) + Doctor (if present)**; then **three nudges, 2 minutes apart** (`nudge_index` 1–3); any of CT / LCT / Doctor may resolve via **WhatsApp or dashboard**; if all three nudges exhaust with no resolution, the event **stays open** (never auto-closes). Meeting-11 parallel intent is preserved; measured implementation is sequential (~4 s) — see below.
>
> **Source of truth:** `sos_events.status` is `open | resolved`. Front-end SOS states are a **display mapping** over that (and demo cascade metadata), not a second workflow.

- **Trigger:** SOS from WF-2a (whole-message `sos` / `help`) **and** from **WF-9** when a journal classifier returns `urgency = emergency`. Runs **immediately**; must never wait behind routine traffic. **Idempotent** — reuses an open `sos_events` row rather than minting a second event.
- Create or reuse an open `sos_events` row (`status = open`), load the elder's care circle via a **relational lookup** of CT + optional LCT + optional Doctor (§3.1 — not RAG).
- **Elder acknowledgement (free-form).** On trigger, send the `Templates.md` §7.3 message to the elder. It is **free-form, not a template** — her own SOS message opens the 24-hour customer service window. **`NA` must never appear in it** (four variants; T3).
- Dispatch templates **10 / 11 / 12** at **`nudge_index 0`** (the **initial alert** — **not a nudge**). Recipients: **CT always**; **LCT only if a `local_caregivers` row exists**; **Doctor only if a `doctors` row exists and `whatsapp_number` is non-null**. Writes `sos_notifications` rows for every attempted send **and** every intentional skip.
- **Doctor with no WhatsApp number:** do **not** send. Insert `sos_notifications` with `status = skipped`, `skip_reason = no_whatsapp_number`, `wa_message_id` NULL, `sent_at` NULL, `created_at = now()`. This is auditable and is **not** a delivery failure (W3 — intentional non-sends are logged as skips).
- **Optional-contact variable substitution (mandatory).** Templates 10, 11 and 12 reference the Doctor and the Local Buddy, both of which are `0..1` per elder. Meta requires **every** positional variable on **every** send; a parameter cannot be omitted. When the contact does not exist, WF-4 supplies the literal string **`Not on Record`** (supersedes the 28 July literal `NA` — ruled **11 August 2026**):
  - `elderwise_sos_alert_ct` — `{{3}}` (Buddy), `{{4}}` (Doctor)
  - `elderwise_sos_alert_lct` — `{{4}}` (Doctor name), `{{5}}` (Clinic)
  - `elderwise_sos_alert_doctor` — `{{4}}` (Buddy name), `{{5}}` (Buddy number)

  **This is a send-time substitution. The database is never written with placeholder rows.** `LEFT JOIN` + `COALESCE(..., 'Not on Record')` when building parameters (WF-4 node **Load Care Circle**: `lct_name_na`, `lct_number_na`, `dr_name_na`, `dr_clinic_na`). Creating placeholder rows in `doctors` / `local_caregivers` was considered and **rejected** (28 July 2026): an absent row is the signal WF-4 dispatch, `sos_notifications.skip_reason`, the conditional `consent_data_sharing_at`, the Care Circle screen, and A4 Decision 6 all depend on. **Do not create placeholder rows.**

  **Source note:** `{{5}}` and `{{7}}` come from **`whatsapp_number`**. A4 dropped `phone_number` from every table.

> **D-10 · Absent Buddy/Doctor substitution is `Not on Record`; conditional `_v2` templates rejected for Demo Day (Talal Baig, 11 August 2026).** Changing the COALESCE literal is live on WF-4 (`HSEp1YhQFHjga9qa`, published `activeVersionId 51ea29fe`). Conditional `_v2` templates that would omit the absent person from the prose were **specified and then rejected** the same day — not because of copy preference, but because **each conditional leg needs an IF plus a duplicate WhatsApp send node inside WF-4 on the P0 SOS path**, with **18 days to Demo Day** and **110 of 122 test cases still unrun**. That is scheduling risk on the emergency orchestrator, not a wording objection. **Accepted defect, eyes open:** templates 10 and 12 will read e.g. "Local Buddy Not on Record … have also been alerted", which still asserts that a non-existent person was notified. Real fix deferred to `PostDemoEnhancements.md` **PD-12** (`_v2` bodies + conditional routing). Template 11 is unaffected (label:value structure).
- **SOS report link — always mint (`{{3}}` of `elderwise_sos_alert_doctor`).** Ruled 28 July 2026 (mint at SOS time); **reuse-before-mint struck 3 August 2026** — impossible because `doctor_share_links` stores `token_hash` only (SHA-256); §7.3 / SEC2 state the raw token exists once, in the URL. A hash cannot be reversed into a link. Order of operations:
  1. **Always mint.** Generate ≥32 random bytes, store the SHA-256 hash, set `expires_at` to the §7.3 default of 30 days, set `created_by` to the elder's care partner, set **`sos_event_id` to the SOS event being orchestrated** (so the dashboard can label origin and distinguish from Care-Partner-issued links), write with the service-role key. n8n **never** calls Next.js (P1).
  2. **Never block the alert (P2).** If the mint fails, send template 12 with `{{3}} = NA` and log the failure at Sentry P1. **A doctor receiving the alert without a link is vastly better than no alert because a token insert timed out.**

  **Implementation note:** `pgcrypto` lives in the **`extensions`** schema on this project — `gen_random_bytes` and `digest` **must be schema-qualified** or they fail at runtime.

  The link resolves to `https://elder-wise-seven.vercel.app/share/{token}` over HTTPS. The §7.3 click-through gate already protects it from WhatsApp's link-preview crawler, so delivering it over WhatsApp is safe.
- If no LCT is set, SOS is still handled by the CT (always present).
- **Nudge model (corrected 3 August 2026 — ruled by Talal):**
  - `nudge_index 0` = the **initial alert**. **The alert is not a nudge.**
  - `nudge_index 1, 2, 3` = **three nudges**, 2 minutes apart (WF-4d).
  - **Four rounds total: one alert plus three nudges.**
  - `sos_events.nudges_sent` counts **nudge rounds only, 0–3**.
  - Reason: `sos_notifications.nudge_index` carries `CHECK (nudge_index >= 0 AND nudge_index <= 3)`. A fifth round would have been rejected by the constraint mid-SOS.
- **Dispatch timing — requirement vs observed.** The requirement remains "notify CT + optional LCT + optional Doctor immediately." **Observed on the live run of 3 August:** CT `09:15:17.97`, Buddy `09:15:19.15`, Doctor `09:15:22.05` — n8n executes branches **sequentially**, about **4 seconds** end to end. Recorded as observed behaviour; do not change the requirement.
- **Resolution — three paths:**
  1. **WhatsApp (care circle)** — any recipient replies/taps to resolve → WF-2a → **WF-4b** → **WF-4c**.
  2. **Dashboard** — the CT (or Doctor via share link) resolves in the UI → a Next.js **route handler** writes `sos_events.status = 'resolved'` **and then fires an authenticated webhook to n8n (WF-4a)** so the nudge loop stops immediately, with no polling delay. This is the one documented exception to P1 (§1), taken because on the SOS path latency is the harm.
     - The webhook carries a **shared-secret header**; n8n rejects any call without it.
     - It is fired **server-side only**, from a route handler — never from the browser, or anyone could resolve anyone's SOS.
     - **The webhook is an optimisation, not the mechanism.** See the safety net below.
  3. **Elder cancel (Option A, ruled 17 August 2026)** — consented elder sends whole-message `cancel` → WF-2a `sos_cancel` → **WF-10**. `sos_status` has only `open` and `resolved` — there is no `cancelled`. WF-10 therefore sets `status = 'resolved'`, `resolved_channel = 'whatsapp'`, and leaves `resolved_by_role` NULL, then calls **WF-4c**. Accepted cost vs a new enum value and a new Meta template.
- **Safety net — the database remains the source of truth.** Before sending **every** nudge, WF-4d re-reads `sos_events.status` and aborts if it is `resolved`. If the webhook is dropped, delayed, or n8n restarts mid-sequence, the loop still stops on its own. A missed webhook must never mean a resolved SOS keeps pinging the doctor.
- On resolution: stop all nudges, record `resolved_by_role`, `resolved_by_id`, `resolved_channel`, `resolved_at`.
- **If all three nudges are exhausted with no resolution:** the nudge sequence ends and the SOS **remains `open`** on the dashboard until a human resolves it. It does not auto-close. It does not disappear.
- **Do not** replace this dispatch with the front-end sequential cascade. The cascade is display-only (§5.5).

### WF-4a · SOS Resolution Receiver (`jeNrf7b7ne3JX2Xu`) — **built (A2.7)**
- **Trigger:** webhook from Next.js `POST /api/sos/resolve` after the dashboard write commits.
- Header: `X-ElderWise-Signature`. Body: `{ "sos_event_id": "<uuid>" }`.
- **Verifies only** — never writes. Stops the nudge loop when `sos_events.status` is already `resolved`. Contract: `.env.example` / A2.7. Does **not** send template 14 — see WF-4c.

### WF-4b · SOS Resolution Handler (`jh2P2gibpCsnyhoy`) — **built 3 August 2026**
- **Trigger:** sub-workflow from WF-2a on a matching SOS resolution button.
- Attribute by `context.id` → `sos_notifications.wa_message_id` (see WF-2a). Write resolution fields on `sos_events`. Call **WF-4c**.

### WF-4c · SOS Resolution Broadcast (`Baydb7saYNyAayMC`) — **built 3 August 2026**
- **Trigger:** sub-workflow (from WF-4b on WhatsApp resolution; from WF-10 on elder cancel; also after dashboard resolution so both channels get the broadcast).
- Sends **template 14** (`elderwise_sos_resolved`) to every recipient that received a **`sent`** alert, on **both** channels. Previously nobody sent it: WF-4a verifies only, and Next.js cannot send WhatsApp (B3).
- Resolver lookup **LEFT JOINs** `resolved_by_role`. An elder cancel leaves that column NULL, so the template's actor falls back to **`Someone`** — *"Someone stood the alert down."* Accepted cost of Option A (17 August 2026); adding an `elder` enum value would also need an elder branch here (PD-23).
- **Does not deduplicate by phone number.** One person holding several care-circle roles receives one message per role (PD-21). Deliberately not changed before Demo Day — this workflow is on the live SOS path.
- **Guard:** a CTE SELECT returning zero rows emits `{success:true}`, so an **explicit gate sits before the send** (`Rules.md` §6a).
- **Known gap (A-18):** template 14 sends cannot be logged under current schema constraints — see §15.

### WF-4d · SOS Nudge Sweep (`EY36qDhdv5FqfL0W`) — **built 3 August 2026**
- **Trigger:** cron, every minute.
- Finds open SOS events due for the next nudge round; sends template **13** for `nudge_index` 1–3; increments `nudges_sent` (0–3). Max **3** nudge rounds, **2 minutes** apart. Re-reads `sos_events.status` before every send (safety net).
- **Must guard CTE-based SELECT results** (`Rules.md` §6a) — same zero-row `{success:true}` pattern as WF-4c; zero due rows must not run the WhatsApp node.
- **Postgres `connectionTimeout`:** `Find Due Nudge Recipients` is set to **20** seconds (OBSERVED 9 August 2026), raised from 10 after the connection-timeout failures of 8 August.

### WF-5 · Voice Reply → STT (`IC6oR4fuQd2VMkfQ`) — **built 4 August 2026**

- **Trigger:** sub-workflow (from WF-2a `voice_note` route). **`waitForSubWorkflow: false`** on the WF-2a call.
- **WF-5 owns the split.** A voice note *with* an open check-in is a check-in reply → `voice_replies`. A voice note *without* one is a journal entry → **WF-9** / `voice_journals`. Only WF-5 knows whether a check-in is open.
- **Ordering:** **Resolve Check-in still runs before any media fetch** on the check-in-reply branch. That used to mean *"an elder with no open check-in never has audio stored."* **Superseded 17 August 2026 (Talal):** unprompted voice **is** downloaded, transcribed, classified by an LLM and stored indefinitely. The false branch of `Open Check-in Found?` now goes **`→ Build Journal Payload → Call WF-9`**. The old nodes `Find Elder For Re-prompt` and `Send No Check-in Reply` still sit on the canvas but **nothing connects into them** — dead; the elder no longer receives *"I don't have anything to check with you right now."*
- **Idempotency (A-25, closed 8 August 2026) — check-in-reply path only.** `media_id` is the dedup key, checked at three layers. **(1) Early exit:** `Already Processed?` (`SELECT EXISTS`, `alwaysOutputData: true`) → `New Delivery?` sits between `Open Check-in Found?` **(true)** and `Get Media URL`; a redelivery terminates at the `Duplicate Delivery - Ignored` NoOp before any Meta media fetch, storage write, or Whisper call. **(2) Insert dedup:** `Record Voice Reply` carries `ON CONFLICT (media_id) WHERE media_id IS NOT NULL DO NOTHING`; a conflict returns zero rows and the existing `Voice Reply Stored?` guard halts the chain, so no duplicate CT notification. **(3) Deterministic object key:** the upload path ends in `{media_id}.ogg` with an `x-upsert: true` header, so a concurrent race overwrites rather than 409s or orphans. Journal redelivery is deduped in WF-9 via `voice_journals.media_id` UNIQUE — the A-25 early exit is **not** on the false branch.
- **Chain (open check-in):** WhatsApp `mediaUrlGet` → authenticated HTTP download → upload to private Supabase bucket **`voice-notes`** (25 MB max, MIME-restricted to audio types) → **OpenAI Whisper** → LLM gate returning `yes` | `no` | `unclear`.
- **On `yes` / `no`:** update `checkins` with `response_channel = 'voice'`, write `voice_replies`, call **WF-6** when notify rules require it.
- **On `unclear`:** send **one** free-form re-ask and increment `voice_replies.reask_count`. A **second** unclear does **not** re-ask — the check-in follows the missed path. **Re-ask cap proven 4 August 2026** (see `Phases.md` B3.1 correction).
- **UI-maintained:** WF-5's two **HTTP Request** nodes lose their credentials on every SDK update — treat WF-5 as **effectively UI-maintained** for credential binding. Confirmed again on both SDK writes of 8 August 2026 — `Download Audio` and `Upload To Voice Notes Bucket` were reported skipped by credential auto-assignment on each write and re-bound by hand.

#### Voice → medication mapping (load-bearing)

The LLM gate emits three values; medication has three **different** stored values. **Record Voice Response** maps by domain, reading `c.domain` from the row being updated:

| Domain | Gate output | `response_value` written |
|---|---|---|
| **medication** | `yes` | `yes_all` |
| **medication** | `no` | `not_yet` |
| **medication** | other | `unknown` |
| **food / health** | `yes` / `no` | passes through unchanged |

**Status rule (mirrors WF-3a):** a medication **`not_yet` does NOT close the check-in** — `status` is preserved so the reminder still arms. **`checkin_medication_items` CTE is replicated verbatim** from WF-3a, so a voice `yes_all` populates the medicines exactly as the button does.

**Why this mattered:** `checkins.response_value` is plain **TEXT with no CHECK and no enum**. Writing a bare `'yes'` on a medication check-in would have been accepted silently, WF-6's `status_label` CASE would have fallen through to **"Recorded"** instead of **"Taken"**, and `checkin_medication_items` would have stayed empty.

**Remaining gap — `some_of_them` unreachable by voice:** the gate has no fourth output, so medication-by-voice is **all-or-nothing**. A spoken *"I took some of them"* returns `unclear` and spends the single re-ask. Deliberate; a fourth output is a **feature decision**, not a sync fix. Cross-reference **A-12**.

#### Voice storage

| Property | Value |
|---|---|
| **Bucket** | `voice-notes` — private, 25 MB, MIME-restricted to audio types |
| **Object path (check-in reply)** | `{elder_id}/{checkin_id}/{media_id}.ogg` |
| **Object path (journal)** | `{elder_id}/journal/{media_id}.ogg` |
| **`voice_replies.audio_path` / `voice_journals.audio_path`** | Object key inside `voice-notes` — **never a URL**; signed URLs on demand. `storage.objects` has **zero RLS policies** — unreadable and undeletable by `anon` and `authenticated`. Playback: `GET /api/voice-journal/[id]/audio`. Elder delete: `DELETE /api/loved-ones/[id]` (collect paths, then Storage API + prefix sweep; §5.8). Orphans: **WF-11**. |

### WF-6 · Care Partner Notifications (All Domains) (`6I6OC7qJ5YhhUQxU`)
- **Trigger:** sub-workflow (from WF-3a / WF-3c / WF-3d / **WF-5**).
- **Authoritative setting:** the owning routine's `notify_care_partner` (`every_time` | `only_missed` | `not_required`) — read **per domain via check-in FKs** (`checkin_medication_items` → `medications`; `food_routine_id` → `food_routines`; `health_routine_id` → `health_routines`). **Do not** `LEFT JOIN medications` alone for all domains (defect fixed 3 Aug 2026).
- **`not_required`:** send **nothing** — no confirmation and no missed-routine WhatsApp. The check-in miss is still written to the DB and visible on the dashboard. Do not escalate a mute into a silent workflow failure.
- **`every_time`:** send template 8 (`elderwise_ct_interaction_notice`) on a recorded response.
- **`only_missed`:** send on miss (template 9). **Deviation, ruled by Talal 3 August 2026:** `only_missed` **also** notifies when `response_value = 'some_of_them'`, on the grounds that a partial dose is closer to a miss than to a clean yes. **This departs from the literal reading of `only_missed`.** Do not "fix" it back without a new ruling.
- **Period labels** for template `{{2}}` (`Morning` / `Afternoon` / `Evening` / `Night`): derived from the routine's local time in the elder's zone — **< 12:00 Morning**, **< 17:00 Afternoon**, **< 21:00 Evening**, else **Night**. Implemented 3 Aug 2026; **wording signed off by Sama, 10 Aug 2026 — retained as built** (A-11).
- **`domain_configs.ct_notification` is derived/deprecated** — do not use it as the send decision. WF-6 never depended on it (A-9 closed).
- On send: write `ct_notifications` with `wa_message_id`. Templates **8** and **9** only in this workflow.
- **WhatsApp only** in the MVP. SMS / email / push are Could-have (C8).

### WF-7 · Dispatch Watchdog (`8G8s8dNSVySDbPpm`)
- **Trigger:** schedule, every **5 minutes**. Published, `activeVersionId f0423f2a`.
- Satisfies the §11 P1 that previously had no reporter (**A-30**). Chain: **Every 5 Minutes → Find Overdue Dispatches → Alert Telegram → Alert Email → Mark Alerted.**
- `Find Overdue Dispatches` aggregates check-ins that are **past due and were never sent** — `sent_at IS NULL`, `cancelled_at IS NULL`, elder active and consented, `scheduled_for` more than 15 minutes ago — anti-joined against `public.watchdog_alerts` so each check-in is reported **exactly once, ever**. It returns `array_agg(c.id)` alongside the summary so the marking step knows what to stamp.

Design points, all deliberate:

- **The predicate keys on `sent_at IS NULL`, not `status = 'scheduled'`.** WF-3c sweeps a check-in to `missed` after the owning routine's `escalation_minutes`, which is as low as 5 for some elders — a status-based predicate would lose the row before a 15-minute alarm could see it. "Never sent" stays true regardless of what WF-3c has done.
- **`Mark Alerted` runs last, after both sends.** If Telegram or Gmail fails, the rows stay unmarked and are retried next run. The design fails towards alerting twice, never towards silence.
- **`HAVING count(*) > 0`** means a quiet system returns **zero rows** rather than one row containing a zero. A plain SELECT with no rows correctly halts the chain, so no guard IF is needed and no alert is sent.
- **Superseded design:** an earlier version used a 2-hour window instead of the `watchdog_alerts` table. It worked but re-alerted every 5 minutes for the life of the window. Replaced 11 August 2026.

Verified: manual execution `76386` returned `[]` and halted at the query (quiet path) after the rework; the same predicate without the anti-join returns 35 rows across 8 elders, which is what the seed exists to suppress.

**Known gap:** WF-7 detects check-ins **created but never sent**. It cannot detect **materialisation failure**, where no row is created at all — the 10 August time-zone outage (**A-35**) produced no rows to be overdue and WF-7 was correctly silent. That failure mode is a node error and is covered by the error workflow instead.

### WF-8 · Waitlist Confirmation Dispatch (`V9VTNaLGJkFGUTFN`) — **built 17 August 2026, active**

- **Trigger:** webhook from Next.js `POST /api/waitlist` after the insert commits. Path: `POST /webhook/elderwise-waitlist`. Header: `X-ElderWise-Signature`. Body: `{ "waitlist_id": "<uuid>" }`. Production URL: `https://vmi3189816.contaboserver.net/webhook/elderwise-waitlist`.
- **Webhook-bearing** — edit in the n8n UI only (`Rules.md` §6a / W7). Do not re-import the JSON export.
- **Chain:** Webhook → Load Waitlist Row → Row Found? → Already Notified? → Send Confirmation Email (Gmail) → Stamp `notified_at` → 200. Unknown id → 404. Already notified (`notified_at` set) → 200 with no resend.
- **Email only.** The WhatsApp branch is **not built** — blocked on Meta approval of `elderwise_wl_confirmation` (`Templates.md`). Do not document WhatsApp confirmation as delivered.
- n8n reads and writes `public.waitlist` over the Postgres credential (bypasses RLS). Next.js never sends the email.

### WF-9 · Voice Journal Ingest (`2KWtzSH22fTNxed9`) — **built 17 August 2026, active**

- **Trigger:** sub-workflow. **No webhook.** Called by **WF-5** when an inbound voice note has **no open check-in**. WF-5 owns that decision.
- **Unprompted voice is a journal entry.** A voice note *with* an open check-in is a check-in reply (WF-5 → `voice_replies`). A voice note *without* one is a journal entry (this workflow → `voice_journals`). Ruled by Talal, 17 August 2026 — the earlier safeguard that *"an elder with no open check-in never has audio stored"* is **superseded**. Unprompted voice **is** downloaded, transcribed, classified by an LLM and stored indefinitely.
- **Chain:** `Valid media_id?` → Resolve Elder → `Already Journalled?` (early exit on `media_id`) → Get Media URL → Download Audio → Upload to `voice-notes` at `{elder_id}/journal/{media_id}.ogg` → Whisper (`Transcribe Journal`) → one `gpt-4o-mini` call (`Classify Journal`, `json_object`) → `Normalise Classification` → `Record Voice Journal` → `Emergency?`.
- **Classification.** One Responses API call returning `mood`, `themes`, `summary`, `urgency`. **Shape trap (cost a full test round on 17 August):** the payload sits at `output[0].content[0].text`. With `json_object` format n8n hands that field back as an **object, not a string**. Reading `raw.content` or `raw.output` silently yields defaults. The normaliser must accept object or string and **reject arrays** (`Rules.md` C20 / C21).
- **Escalation.** `urgency = emergency` calls **WF-4**, which is idempotent (reuses an open `sos_event`) and sends the elder acknowledgement itself, so WF-9 **deliberately sends no acknowledgement on that branch**. `attention` and `none` get the journal acknowledgement from WF-9 (`Templates.md` §7.6).
- **This is not reliable emergency detection.** It is an LLM reading a transcript. SOS by keyword (`sos`, `help`) remains the reliable path. This framing must survive into the demo narrative.
- **Idempotency:** `voice_journals.media_id` UNIQUE. Duplicate Meta redelivery terminates at `Duplicate Delivery - Ignored`.
- **`duration_seconds` is always NULL** — Meta's inbound audio payload has `id`, `mime_type` and `sha256`, not duration (PD-20). Known limitation, not a defect.

### WF-10 · SOS Cancel Handler (`CPDmCJh8e1WO8Sod`) — **built 17 August 2026, active**

- **Trigger:** sub-workflow. Called by **WF-2a** when a consented elder sends the whole message `cancel` (`sos_cancel` route — after `sos_trigger`, before `sos_resolution`; `db.found === true`; exact match on `text_norm`).
- **Option A (ruled 17 August 2026).** `sos_status` is `open | resolved` only — there is no `cancelled`. An elder's `cancel` therefore sets `status = 'resolved'`, `resolved_channel = 'whatsapp'`, and leaves `resolved_by_role` NULL. WF-4c's resolver lookup LEFT JOINs that column and falls back to `'Someone'`, so the care circle is told *"Someone"* stood the alert down. Accepted cost; the alternative required a new enum value and a new Meta template (PD-23).
- **Chain:** Resolve Open SOS → `Open SOS Found?` → Mark SOS Resolved → `Resolution Written?` (zero-row UPDATE emits `{success:true}` — gate before broadcast) → Call WF-4c → Send Cancel Acknowledgement. No open event → Find Elder For Nothing-To-Cancel → Send Nothing To Cancel. Both elder replies are free-form inside the 24-hour window (`Templates.md` §7.7 / §7.8).
- **Verified end to end on 17 August 2026 (live handset):** journal classification correct across five transcripts; past-tense guard held (`"I fell last week"` → `attention`, no SOS); emergency fired with three care-circle notifications all `sent`; cancel resolved in 18 seconds; medication button and voice-reply-to-check-in paths both unaffected.

### WF-11 · Voice-notes sweep — **Track B, 15-minute cron**

- **Trigger:** cron, every **15 minutes**. n8n ID is not in the 17 August export; it will land with the hourly export cron. Do not invent one.
- **Role:** remove orphan objects in `voice-notes` that the dashboard hard-delete left behind (or that never had a database row). Writes `deletion_events` with `source = 'wf11'`.
- **Not Track A.** Do not reimplement this sweep in Next.js.

### Credential Check — read-only utility (`5nVL2BdvqeX2i0AU`)
- **Trigger:** Manual. **Inactive** — not on the message path.
- Verifies both Supabase credentials: a Postgres query plus a Storage bucket listing.
- Companion utility: **Template Audit** (`PADE2m75e6xVGS2e`) — also Manual / inactive / read-only.

---

## 9. WhatsApp Business API

**Meta WhatsApp Cloud API, direct.** Not Twilio.

| Item | Detail |
|---|---|
| **Account** | One WhatsApp Business account (Talal's). **No backup exists — this is a single point of failure for the entire demo** (NFR-13). |
| **Templates** | All business-initiated (scheduled) messages **must** be Meta-approved templates. **Templates support only quick-reply, URL and phone-number buttons — max 3. They cannot carry an interactive list/dropdown.** *(Verified against Meta's live docs, 14 Jul 2026.)* |
| **The 24-hour window** | Once the user messages us, we may send **free-form** messages — **including interactive lists** — for 24 hours, **with no Meta approval needed**. **MVP scope reduction (Talal, 3 Aug 2026):** the *Some of them* interactive medicine list (`Templates.md` §7.1) is **not built** — see §8 WF-2a / A-12. The 24-hour window remains available for other free-form traffic (e.g. re-ask). |
| **Opt-in** | **Meta requires recipient opt-in before any template is sent.** Two-layer model (M16): the CT attests at onboarding (off-channel opt-in, which Meta permits), then the elder confirms in-channel via the welcome message. **`consent_confirmed_at` NULL ⇒ WF-1 schedules nothing.** |
| **Templates needed** | Medication check-in (with medicine list/dropdown) · Health check-in (Yes/No) · Food check-in (Yes/No) · Reminder (×3 domains) · Missed-check-in notice to CT · Interaction notice to CT · SOS alert (CT / LCT / Doctor) · SOS nudge · SOS resolved confirmation · Re-ask prompt (unclear voice reply). |
| **Approval lead time** | A **schedule risk**. Template submission and Meta approval must start in Sprint 3, not the week before Demo Day. Owner: Talal. |
| **Verification** | **None.** WhatsApp's number/username-masking rollout undermines number verification (Reema's flag). Numbers are captured as-is (NFR-11). |
| **Webhook** | Single inbound webhook → n8n (WF-2). Must verify Meta's signature. |

---

## 10. Timezone handling (M14) — get this wrong and the product is broken

| Rule | |
|---|---|
| **Storage** | All timestamps are `timestamptz`, stored in **UTC**. Always. |
| **Timezones held** | `elders.timezone`, `care_partners.timezone` — **IANA** strings (`Asia/Kolkata`, not `+05:30`). `doctors.timezone` may still exist on the row but is **not collected** and **must not** drive share-page display. |
| **LCT** | **Has no timezone column.** Inherits the elder's, by design. |
| **Scheduling** | Every check-in fires in the **elder's** local time. Schedulers read **routine rows** (`medications`, `food_routines`, `health_routines`) — **not `domain_configs`**. `domain_configs.frequency` is a **derived cache** for the dashboard only. WF-1 / WF-1b / WF-1c convert local wall-clock times to UTC at materialisation, using the IANA zone so DST is handled by the database, not by arithmetic. |
| **Display (dashboard)** | Every timestamp renders in the **viewer's** (CT) timezone. |
| **Share page + PDF** | No reliable "viewer session" timezone for the clinician. Both the doctor **share page** and report **PDF bodies** render in the **elder's** IANA zone (stated once in a header/banner). PDF “generated on” line renders in the **CT's** zone and is explicitly labelled. *(A4: removes the former exception that rendered the share link in `doctors.timezone`.)* |
| **Doctor WhatsApp messages** | Same rule: **elder's** IANA zone. `doctors.timezone` is no longer collected and **must not** be used by WF-4. Applies to `elderwise_sos_alert_doctor` `{{2}}`, and to nudge/resolved timestamps sent to the doctor. |
| **Local Buddy messages** | **Elder's** zone — the LCT has no timezone column and inherits the elder's by design. |
| **Care Partner messages** | **Care partner's** zone (`care_partners.timezone`). Applies to templates 8, 9, 10 and to nudge/resolved timestamps sent to the CT. |
| **CT timezone write rule** | `care_partners.timezone` is set on **INSERT only** and never overwritten on subsequent sign-in. Detected browser timezone seeds the row at creation; after that the stored value wins. Reason: overwriting discarded the CT's explicit Settings choice and shifted the whole dashboard for anyone signing in while travelling — the product's core scenario. |
| **Never** | Never store a UTC offset. Never do timezone maths with `+03:00` style offsets. Never assume the CT and the EP share a timezone — the entire premise of this product is that they don't. |

---

## 11. Observability & error handling

**Sentry**, on the **Next.js app**. Building it is a **P2** task; the events it watches include **P0**. The table below classifies **events by severity**, not the build task — the two were previously conflated in this heading. *(Ambiguity resolved 4 August 2026, Talal.)*

| Severity | What it covers |
|---|---|
| **P0 — page someone** | Any failure in WF-4 (SOS). A dropped SOS is the worst thing this system can do. |
| **P1** | Check-in not sent within the ±5-minute window · inbound webhook failures · STT hard failures · **WF-0 welcome send failures** (an elder who never receives a welcome is never scheduled — a silent total failure for that family) |
| **P2** | CT notification failures · dashboard errors |
| **P3** | Report generation, cosmetic |

### 11.1 Coverage as built (ruled 4 August 2026, Talal)

**Sentry covers the Next.js app only. Track B failures are covered by `ElderWise Error Workflow` (`uvBstI6J42nNhIYz` → Telegram + Gmail), registered as the `errorWorkflow` on every ElderWise workflow.** Piping n8n into Sentry was considered and **deferred**, not rejected — see A-31.

| Event | Reported by |
|---|---|
| Any WF-4 / WF-4a–4d failure (**P0**) | n8n error workflow → Telegram + Gmail |
| Inbound webhook · STT hard failure · WF-0 welcome failure (**P1**) | n8n error workflow |
| Check-in not sent within ±5 min (**P1**) | **WF-7 Dispatch Watchdog** — Telegram + Gmail, 15-minute grace, once per check-in (§8) |
| `/api/sos/resolve` or `/api/sos/trigger` failure (**P1**, SOS path) | **Sentry** |
| CT notification failure (**P2**) | n8n error workflow |
| Dashboard errors (**P2**) · report generation (**P3**) | **Sentry** |

> **Known limitation — a check-in that was never sent is still swept to `missed`, and the Care Partner is still notified (D-9, accepted 10 August 2026).** WF-3c transitions on elapsed schedule alone; it does not consult `sent_at`. WF-6 then sends `elderwise_ct_missed_notice`, whose approved body asserts "We sent a reminder and haven't heard back" as fixed template copy. Where a dispatch failed, that statement is false and the adherence record is wrong. Observed 9–10 August 2026 across eight medication check-ins during a Meta template review. The cause is not template-specific: rate limiting, a rotated credential, an invalid handset number, or the WhatsApp account itself going down (R1 / A-5) produce the same state. **Accepted for the MVP** — WF-3c is the sole owner of the `missed` transition, no terminal state is defined for a never-sent check-in, and the remedy carries more risk than the defect while the test run is incomplete. Deferred as **PD-10** (suppress the notice in WF-6) and **PD-11** (record the failure cause, which A-30 also needs). Since 10 August 2026, WF-7 alerts on the underlying condition — a check-in that was never sent — although the Missed Notice itself remains uncorrected until PD-10.

> Materialisation failure (a scheduler query throwing, so no check-in rows are created at all) is **not** covered by WF-7 — it produces no rows to be overdue. It surfaces as a node error via the error workflow. See A-35.

**Consequence to hold in mind:** the P0 tier is served by a push notification with no grouping, no state, and no history. A high-frequency error on a one-minute cron will bury a real alert in Telegram — the WF-4d zero-row case in `Rules.md` §6a would have fired ~1,400 times a day. If that ever happens in practice, revisit A-31 rather than muting the channel.

**Scrubbing is a prerequisite, not a follow-up.** `Rules.md` §14.3 **X9** applies in full to the Next.js half on its own. In particular `/share/[token]` carries a **live doctor share token in the URL path**, and the Sentry SDK attaches request URLs to server-side events by default. Configure `sendDefaultPii: false` and a `beforeSend` scrubber **in the same commit as the SDK install**, never after.

**Installed and verified 4 August 2026** (`@sentry/nextjs` 10.69.0, PR #4, merge `7194c5b`). Server and edge runtimes only — **no client SDK, no `NEXT_PUBLIC_SENTRY_DSN`**. `Sentry.init` lives in `src/sentry.server.config.ts` and `src/sentry.edge.config.ts`, registered through `src/instrumentation.ts`; scrubbing in `src/sentry.scrub.ts`. Settings: `sendDefaultPii: false`, `tracesSampleRate: 0` (no performance tracing), `enabled` gated on `SENTRY_DSN` so a missing DSN disables the SDK rather than erroring. Source maps upload at build time via `withSentryConfig`.

**Scrubbing proven against a live event**, not asserted: a deliberate error containing a fake share token and an E.164 number arrived in Sentry as `/share/[redacted]` and `[redacted-number]`. **Known tradeoff:** the phone pattern `\+?\d{9,15}` will also redact a 13-digit millisecond timestamp if one appears in an error string. Accepted — Sentry stamps its own time on every event.

**`sentry.edge.config.ts` is active.** Middleware is registered at `src/middleware.ts` (A-32 closed 8 August 2026), so the Next.js edge runtime runs and this config loads. Edge error tracking has been live since that closure; A-32 remains a historical cross-reference only, not a live blocker.

**Additional requirements:**
- **Every attempted WhatsApp send is logged with its `wa_message_id`**, or it is not sent. An unlogged message is an untraceable one.
- **Intentional non-sends** (e.g. doctor SOS nudge with no WhatsApp number; routine `notify_care_partner = not_required`) are **not** silent failures — they are either a logged `sos_notifications` skip row or a configured mute with a recorded miss on the dashboard (Rules.md W3).
- n8n workflows have explicit **error branches**. A failed node must not silently end an execution — least of all in WF-4.
- The SOS path must degrade loudly, never quietly.

### 11.2 Verification console (delivered 4 August 2026, Talal)

A **read-only witness** for approved testers — not part of the dashboard analytics layer. Lets nine testers confirm database rows required by the test catalogue without Supabase dashboard access, service-role keys, or free-text input.

**Route placement.** `src/app/verify/` with its own layout — **deliberately outside** the `(app)` route group. The `(app)` group redirects to `/onboarding` when no active elder exists and wraps children in `AppDataProvider` / `loadAppData`; placing the console there would couple it to the very data layer it is meant to check independently.

**Approval gate (`console_access`).** Testers reuse their existing Care Partner Supabase Auth session. On top of that, a row in `console_access` is required: self-request only (`INSERT` forces `approved_at`, `approved_by`, and `revoked_at` NULL); **approval is admin-side only** (team lead sets `approved_at` in the Supabase table editor — no admin UI). Revocation takes effect on the next request without re-login. Migration: `supabase/migrations/20260804130000_console_access.sql` (written in repo; apply manually).

**Closed registry.** All table and column names live in `src/lib/verify/registry.ts` as a hard-coded `CheckId` union. Requests supply a `checkId` looked up in that object; PostgREST `.select()` only — no SQL strings, no `.rpc()`. The read executor never writes; the only console `.insert()` is the access-request path in `src/app/api/verify/request/route.ts`.

**RLS is the access control.** The console uses the caller's authenticated session (`createClient()` from `src/lib/supabase/server.ts`), not `createAdminClient()`. Row visibility is whatever RLS permits for that care partner. Ownership helpers on the API routes are belt-and-braces; they do not replace RLS.

**Feature flag.** `VERIFY_CONSOLE_ENABLED` is **server-only** (never `NEXT_PUBLIC_*`), default **`false`**. When not `"true"`, `/verify` and all `/api/verify/*` routes return **404** (not 403). Production and `.env.example` keep the flag off.

**Replay script.** `scripts/verify-console-phase4.mjs` — §9 behavioural tests (ten scenarios + env for preview / flag-off base).

**Known limitations (not bugs):**

| Case | Limitation |
|---|---|
| **40** | A `ct_notifications` row with a **wrong `care_partner_id`** is **invisible under RLS** — the console shows zero rows, indistinguishable from a true absence. That assertion cannot be delegated to testers; it stays with the team lead. **D-9 is closed**; the RLS blind spot remains a console limitation. |
| **115** / **`notification_ownership`** | The check is retained for catalogue mapping but **can only ever return zero rows** here: live RLS on `ct_notifications` requires both `care_partner_id = auth.uid()` and elder ownership, so a mismatched row is never visible to the caller. A zero-row result is **not evidence** of correctness. |

---

## 12. Repository & environments

### 12.1 Monorepo layout

```
elderwise/
├── src/
│   └── app/                 # Next.js (App Router) — dashboard + onboarding
│       ├── (public)/        # marketing, sign-in, sign-up
│       ├── (app)/           # dashboard, care circle, SOS, voice journal,
│       │                    # reports, settings, profile
│       ├── onboarding/      # onboarding wizard
│       ├── verify/          # verification console (outside (app); flag-gated)
│       ├── share/[token]/   # doctor read-only view (server-side only)
│       └── api/             # route handlers (incl. SOS resolve / trigger)
├── supabase/
│   ├── migrations/          # SQL — schema + RLS policies
│   └── seed.sql
├── n8n/
│   └── workflows/           # Exported JSON — version-controlled; export cron owns this tree
├── PRD.md                   # Spec — repository root (not docs/)
├── Architecture.md
├── Rules.md
├── Phases.md
├── Templates.md
├── PostDemoEnhancements.md  # Deferred work after Demo Day
├── .cursor/
│   └── rules/               # shared Cursor rules — all 10 build to one standard
└── README.md
```

**n8n workflows are exported to JSON and committed.** A workflow that exists only in one person's n8n UI is not part of the product.

**n8n export cron.** An hourly cron job on the Contabo VPS exports every ElderWise workflow from the live n8n instance into `n8n/workflows/*.json` and commits to `main`. This produces `chore(n8n): export N workflow(s)` commits outside the docs-first flow; **this is intended and must not be changed.**

The flow is **one-directional: n8n → repo.** The live n8n instance is the source of truth for workflow definitions; `n8n/workflows/*.json` is its committed record and is safe to read from. **Re-importing these files into n8n is forbidden** (Rules **W7**) — it rotates `webhookId` values and silently kills inbound WhatsApp traffic.

**Merge consequence:** because this cron commits to `main` roughly hourly, any branch may go behind `main` between opening and merging. Always use a normal three-way merge; a rebase-force would revert the exported workflow JSON.

### 12.2 Branching
Branch per member → PR → merge to a stable `main` (Akhil's directive). `main` is always demo-able. **Prerequisite: all 10 members need GitHub accounts** (open item A-6).

### 12.3 Environments

| Environment | Supabase | n8n | Next.js |
|---|---|---|---|
| **Dev** | Supabase project #1 (free tier) | Same self-hosted instance, dev workflows | Vercel preview deployments |
| **Prod** | Supabase project #2 (free tier) | Same self-hosted instance, prod workflows | Vercel production |

Supabase free tier allows **2 active projects** — exactly Dev + Prod. **A single self-hosted n8n instance** serves both (Talal's server or one of Robert's — functionally interchangeable), with dev and prod workflows kept separate inside it and pointed at different Supabase projects.

**Dev project note (`rls_auto_enable`):** the Dev Supabase project carries an out-of-band **SECURITY DEFINER** event-trigger function `public.rls_auto_enable()`, which auto-enables RLS on new `public` tables. It was created outside migrations and is therefore **not** reproduced by the migration history — it must be **recreated manually** when the Prod project is stood up, or **omitted** (the migrations enable RLS explicitly and do not depend on it). `EXECUTE` has been revoked from `PUBLIC`, `anon`, and `authenticated`.

### 12.4 Secrets

| Secret | Lives where | Never |
|---|---|---|
| Supabase **service-role key** | n8n credentials + Vercel server env | **Never** in a browser, never in `NEXT_PUBLIC_*`, never in a client component |
| Supabase anon key | Vercel public env | (safe by design — RLS protects it) |
| Meta WhatsApp token | n8n credentials | anywhere else |
| **n8n SOS-resolution webhook secret** | Vercel server env + n8n | Never `NEXT_PUBLIC_*`; never client-side |
| **n8n waitlist webhook URL + secret** | Vercel server env + n8n (`N8N_WAITLIST_WEBHOOK_URL` / `_SECRET`) | Never `NEXT_PUBLIC_*`; never client-side |
| OpenAI / STT keys | n8n credentials | client-side |
| Doctor share tokens | Hashed in the DB; raw token exists only in the URL | Stored raw. Ever. |

### 12.5 Security posture (as built)

- **The service-role key appears in exactly one Next.js module:** `src/lib/supabase/admin.ts`. Importers: doctor share-link server paths, `GET /api/voice-journal/[id]/audio` (sign after session RLS), `DELETE /api/loved-ones/[id]` (storage remove and `deletion_events` insert after session RLS), `DELETE /api/account` (collect, `deleteUser`, storage, audit after session `getUser`). Every other app data path uses the anon key with the user's session so RLS applies. (n8n still holds the service-role key as trusted infrastructure — unchanged from §6.) The admin client is constructed **only after** ownership is proven with the session client (`Rules.md` SEC11).
- **Rate limiting is fail-open by design.** If the limiter is unreachable, misconfigured, or unset, the request proceeds and a warning is logged. The share token and the user session are the real access controls; a limiter outage must not stop a doctor reading a share or a CT downloading a PDF. Do not harden to fail-closed.
- **The PDF route verifies elder ownership before generating.** A report is health data leaving the system. Cap: **5 requests per minute per user id**.
- **Supabase Auth “IP address forwarding” is Off** (recorded, not changed). Auth's per-IP quotas may not key on the end-user IP behind Vercel.

---

## 13. What this architecture deliberately does not have

| Not present | Why |
|---|---|
| **RAG / pgvector / embeddings** | The lookups are relational. See §3.1. |
| **Twilio** | Meta Cloud API direct. Twilio returns only if SMS/voice fallback (C6, C8) is ever built. |
| **pg_cron** | n8n owns all scheduling. |
| **A mobile app** | Web only. Sama's mobile prototype is being converted to web. |
| **Any login for the elderly person** | The premise of the product. |
| **Any AI diagnosis or clinical inference** | Hard constraint (NFR-1). ElderWise records facts and routes them to humans. |
| **A doctor account / role system** | Share link in the MVP; full account is v2 (C9). |
| **A microservices split** | 10 people, 6 weeks. Two systems and one database. |
| **WhatsApp Flows** | Flows **can** be sent as templates without an open 24-hour window — a genuine path to multi-select outside the window. But it is an entire additional Meta surface to learn, build, and get approved. **v2. Not now.** |

### Known limitations

> **Account-scoped Care Partner contact (D-4).** `care_partners.whatsapp_number` and `care_partners.timezone` are one row per Care Partner account, keyed by auth uid. Every Loved One under that account resolves Care Partner notifications through that single row. Changing it changes routing for all of them. There is no per-elder override column anywhere in the schema.

---

## 14. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **One WhatsApp Business account, no backup** (NFR-13) | The entire demo dies with it | Start template approval early; consider a second account as insurance. **Currently unmitigated.** |
| R2 | **Meta template approval lead time** | Blocks all EP messaging | Submit in Sprint 3. Owner: Talal. |
| R3 | **STT accuracy on elderly speech** — accents, background noise, frailty | A voice reply is a Must-have; misreads are dangerous | P3: never guess; re-ask once on `unclear` from answer derivation; fall through to missed. Provider = OpenAI Whisper (A-1 closed 2 Aug 2026). |
| R4 | **SOS reliability** | The most severe failure class in the system | P2; Sentry P0; explicit error branches; SOS never queues behind routine traffic. |
| R5 | **10 distributed contributors, 6 weeks** | Merge chaos, inconsistent quality | Branch-per-member; shared `.cursor/rules`; the n8n/Next.js split (P1) lets both halves proceed in parallel. |
| R6 | **Timezone bugs** | Reminders fire at the wrong hour — a silent, humiliating failure in a demo | §10. IANA only, UTC storage, elder-tz scheduling. |
| R7 | **Scope creep** | Both mentors flagged feature overload as this team's main risk | Must-have only. Should/Could do not enter the MVP without a team-lead decision. |
| R8 | **Leaked-password protection is a Pro-plan feature** | Security advisor shows a permanent `auth_leaked_password_protection` WARN on free tier | **Knowingly accepted for MVP** (Dev and Prod free tier). Compensating control: password length and complexity configured in Auth settings. |
| R9 | **PDF script coverage is Latin + Devanagari only** | Arabic-script names render unjoined and mis-ordered | `@react-pdf/renderer` performs no bidirectional text or Arabic contextual shaping. **Accepted for MVP.** |

---

## 15. Open items

Items deferred to after Demo Day (29 August 2026) are held in **`PostDemoEnhancements.md`**, with the reasoning for each deferral. **A-33** and **A-23** are closed here and remain tracked as **PD-6** and **PD-8**. **A-37** and **A-38** are closed here and remain tracked as **PD-13** and **PD-14**. **PD-9** (Google OAuth / D-8), **PD-10** and **PD-11** (never-sent check-ins / D-9; feeds a real A-30 detector, now built as WF-7), **PD-12** (SOS `_v2` + conditional WF-4 routing / D-10), and **PD-15** (`countOwnActiveElders` error→0) are also recorded there.

| # | Item | Owner |
|---|---|---|
| A-1 | ~~**STT provider** — Google Speech-to-Text vs ElevenLabs.~~ — **CLOSED 2 August 2026 by Talal:** **OpenAI Whisper** (OpenAI transcription API). Rationale in §3. | Closed |
| A-2 | ~~**Re-ask gate (FR-RH-2a).**~~ — **RESOLVED 3 August 2026.** Gate is decided: WF-5's OpenAI answer-derivation step returns `{"answer": "yes"|"no"|"unclear"}`; anything other than a clean yes/no triggers the single re-ask (P3). `voice_replies.confidence` may hold `avg_logprob` as a diagnostic but **must not** be the gate. Exact prompt text is a build-time detail for WF-5, not an open architectural decision — write it during the WF-5 build. | Resolved (prompt: Talal during WF-5) |
| A-3 | **Demo-day readiness checklist** (replaces the old "availability target"): Meta templates approved · n8n instance up · **Supabase project not paused** (free-tier projects auto-pause after inactivity — this alone can kill the demo) · WhatsApp account healthy · full end-to-end rehearsal · a rehearsed fallback if a live message does not land on stage. | Talal |
| A-4 | ~~How WF-4 observes a dashboard-side SOS resolution~~ — **RESOLVED 14 Jul: authenticated webhook from the Next.js route handler → n8n** (fast path), **plus a status re-check before every nudge** (safety net). No polling, no Realtime subscription. | Closed |
| A-5 | **WhatsApp backup account** — R1 is currently unmitigated. **Accepted by ruling, 10 Aug 2026.** No WhatsApp backup account before Demo Day. **R1 remains live and unmitigated** and is the single point of failure for the 29th. | Talal |
| A-6 | ~~Confirm all 10 members have GitHub accounts (blocks branch assignment).~~ — **CLOSED 10 Aug 2026 — superseded.** Branch-per-member was never adopted; `main` is the sole branch and only Talal and Cursor push. *(PRD OQ-7 closes with it.)* | Closed |
| A-7 | ~~**Dev project test accounts** — clean up before Demo Day.~~ — **CLOSED 26 Jul 2026.** Discharged by **Phases.md A4.0** (full public-table + Auth wipe at the start of the A4 migration window), which supersedes ad-hoc account cleanup. | Closed |
| A-8 | ~~**A3.5 rate limiting is implemented but INACTIVE**~~ — **CLOSED 10 Aug 2026 — the item was stale, not the configuration.** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both present in Vercel, Sensitive, scoped **Production and Preview**, added 24 July. The limiter is active in production. Note: `checkRateLimit` fails open *silently*, so a wrong or missing credential is externally indistinguishable from a working one — the only tell is the absence of `[rate-limit] ... unset` and `failed to init Upstash` in runtime logs. | Closed |
| A-9 | ~~**Track B — WF-6 notify authority**~~ — **CLOSED 3 August 2026.** WF-6 (`6I6OC7qJ5YhhUQxU`) was built fresh reading the owning routine's `notify_care_partner` from the start. The `domain_configs.ct_notification` dependency never existed in the built system. | Closed |
| A-10 | ~~**Template 12 `elderwise_sos_alert_doctor` PENDING.**~~ — **CLOSED 2 August 2026.** Approved by Meta, verified via Graph API; recorded in `Templates.md` v1.6 (OT-8 closed). **All 14 templates approved.** | Closed |
| A-11 | ~~**Period label derivation (B-3)**~~ — **CLOSED 3 August 2026 (implemented):** `< 12:00` Morning · `< 17:00` Afternoon · `< 21:00` Evening · else Night, derived in the elder's zone. **Wording signed off by Sama, 10 Aug 2026 — retained as built.** | Closed |
| A-12 | ~~**Some of them does not capture which medicines were taken**~~ — **CLOSED 10 Aug 2026 — accepted scope reduction.** Reasoning already in §8. Reply = `response_value = 'some_of_them'`, `status = responded`, CT notified. `checkin_medication_items` populated only on *Yes, All*. Native WhatsApp node has no interactive-list type; raw Graph HTTP ruled out. | Closed |
| A-13 | ~~**`domain_configs` row count**~~ — **CLOSED 3 August 2026 (non-issue).** Missing rows were never why food and health were silent. `domain_configs` is a derived cache; **`routine.enabled` is authoritative**. All three rows now exist from normal use. | Closed |
| A-14 | **n8n SOS webhook secret is readable in plaintext in n8n execution history.** **Accepted for the MVP, 10 Aug 2026.** Secrets remain readable in n8n execution history. Remediation (reducing per-workflow execution-data retention) deferred to after Demo Day **on the explicit basis that execution history is currently the primary diagnostic tool** — the 9–10 August medication outage was diagnosed entirely from it. Trade recorded deliberately. | Talal |
| A-15 | ~~**Elder timezone / number mismatch.**~~ — **CLOSED 3 August 2026.** The live elder record is a test persona operated by Talal on a second handset he holds. The Pakistani `+92` number and the `Asia/Riyadh` timezone are both correct and both his; the handset is physically in Riyadh. No scheduling error exists. | Closed |
| A-16 | ~~**Health and food domains unbuilt.**~~ — **CLOSED 3 August 2026 (evening).** All three care domains built and verified on real WhatsApp (health 19:15, food 19:30, `No` → `responded` / `response_value = 'no'`, CT interaction notice naming "Dinner" one second later). | Closed |
| A-20 | ~~**`message_templates` table is stale and disagrees with Meta.**~~ — **CLOSED 10 Aug 2026 — table dropped.** `public.message_templates` held an abandoned per-elder-copy design (M11) that never shipped; nothing in `src/` or any workflow read it. Its only consumer — the row-count line in the read-only Credential Check workflow (`5nVL2BdvqeX2i0AU`) — was repointed to `public.checkins` in the n8n UI **before** the drop. Verified after: absent from `information_schema`; Credential Check returns a clean row (`checkins: 126`) with the storage check still passing, confirming credentials survived. | Closed |
| A-21 | ~~**Two onboarding write paths disagree on `frequency`.**~~ — **CLOSED 3 August 2026 (evening).** Dashboard upserts aligned to `"daily"` to match onboarding writers. | Closed |
| A-17 | **Raw doctor share tokens are stored in plaintext in n8n execution history.** WF-4 returns the raw token from Postgres to build the URL, so it is readable by anyone with instance access, who can then open the patient report. Same class as A-14. **Accepted for the MVP, 10 Aug 2026.** Secrets remain readable in n8n execution history. Remediation deferred to after Demo Day on the explicit basis that execution history is currently the primary diagnostic tool. | Talal |
| A-18 | **Template 14 sends cannot be logged, so W3 cannot be satisfied for the resolution broadcast.** `sos_notifications` is constrained to `nudge_index` 0–3 for alerts and nudges; `ct_notifications.type` is `interaction \| missed` only. There is no table that can hold a resolution-broadcast send. **Accepted, 10 Aug 2026.** W3 cannot be satisfied for the resolution broadcast. Logging gap, not a delivery gap. | Talal |
| A-19 | **The n8n error workflow forwards raw error content to Telegram and Gmail.** It interpolates `execution.error.message` and `error.messages[0]`, which on the SOS path can carry query parameters including phone numbers and record IDs. X9 requires scrubbing before error reporting is switched on. **Accepted for the MVP, 10 Aug 2026.** The error workflow continues to forward raw error content to Telegram and Gmail. Recipients are the Team Lead's own channels. | Talal |
| A-22 | **Voice upload uses service-role key via n8n Header Auth**, bypassing RLS on an instance shared with ~26 personal workflows. Pass 2 item alongside A-14 and A-17. **Accepted for the MVP, 10 Aug 2026.** Secrets remain readable in n8n execution history. Remediation deferred to after Demo Day on the explicit basis that execution history is currently the primary diagnostic tool. | Talal |
| A-23 | ~~**Audio retention undecided.**~~ — **CLOSED here 10 Aug 2026 — tracked as PD-8.** Retention deferred, not decided. Proposed 30 days; nothing currently deletes objects in `voice-notes`. | Closed |
| A-24 | **`consent_confirmed_at` covers daily check-ins, not storing recordings of the elder's voice.** Separate consent may be needed for voice retention — undecided. **Accepted, 10 Aug 2026**, on the basis that **every elder record is a team-operated test persona, not a member of the public. This acceptance does not survive a real user.** The clean long-term remedy is transcribe-and-delete rather than retain, which would also dissolve A-23 and part of A-22. | Talal |
| A-25 | ~~**WF-5 is NOT idempotent.**~~ — **CLOSED 8 August 2026.** `voice_replies.media_id` + partial unique index (applied by Talal); WF-5 gained a three-layer dedup — early exit before any media fetch, `ON CONFLICT` on insert, and a deterministic `{media_id}.ogg` object key with `x-upsert`. Published as `activeVersionId 83a6a60e` and verified against the live workflow. | Closed |
| A-26 | ~~**Voice note with no open check-in is silent to the elder.**~~ — **CLOSED 8 August 2026** (Claude / Track B, F-7): WF-5 sent a reply on the no-open-check-in path. **Retired 17 August 2026:** that reply is unreachable; the false branch now calls WF-9. The two old nodes remain on the canvas with nothing connecting into them. | Closed |
| A-27 | ~~**The ≤60 s window.**~~ — **CLOSED 10 Aug 2026 — accepted deviation** (ruled 4 Aug). WF-3a, WF-3d and WF-5 resolve check-ins by elder + status and do **not** filter on routine `enabled`. Between a routine being disabled and WF-3c cancelling the orphan, a reply is still accepted. Closing it would require a slot-match join in three resolvers for a one-minute window. | Closed |
| A-28 | ~~**`checkins_medication_slot_uniq` slot occupancy.**~~ — **CLOSED 10 Aug 2026 — accepted.** `UNIQUE (elder_id, scheduled_for) WHERE domain = 'medication'`. A **`cancelled` row still occupies its slot**, so disabling and re-enabling a routine the same day will **not** restore that day's check-in. Recorded so it is not rediscovered as a bug. | Closed |
| A-29 | ~~**Frontend `statusBreakdown` divergence + raw labels.**~~ — **RESCOPED / FIXED 11 Aug 2026.** Original note mixed two defects. **(1) Vocabulary, not casing:** the share page applied CSS `capitalize`, so DB `cancelled` already rendered as "Cancelled"; the real harm was never running `checkInStatusToUi`, so doctors saw DB words (`Responded` / `Reminded` / `Sent` / `Scheduled`) instead of UI labels (`Taken` / `Delayed` / `Pending` / `Upcoming`). **"Reminded" was the priority** — opaque to a clinician. PDF had no capitalize and showed truly lowercase raw DB values. **(2) Dual `statusBreakdown`:** dashboard dropped `cancelled`; reports counted it but omitted it from the pie. Fixed: map at `load-share-data` source; single `formatCheckInStatus` for share / PDF / CSV / print; one shared breakdown that counts `cancelled` and never discards an unrecognised status silently. **`adherence()` unchanged** — `cancelled` stays out of numerator and denominator. **Cancelled pie-slice ruled out 11 Aug 2026:** the chart is adherence composition (Taken / Delayed / Missed only), not all-activity; a Cancelled slice would mix "never expected" with scored outcomes and drift from the adherence % beside it. Silent exclusion fixed by labelling + caption (cancelled count always; pending if non-zero) — Architecture v1.40. | Closed |
| **A-30** | ~~**The ±5-minute dispatch P1 is reported by nothing.**~~ — **CLOSED 10 Aug 2026 — detector built.** See §8 WF-7 and §11. | Closed |
| **A-31** | **n8n → Sentry deferred (4 Aug 2026).** One HTTP Request node on `uvBstI6J42nNhIYz` would put every Track B failure into Sentry with severity from the failing workflow's name. Deferred as unnecessary at current volume. If revisited: the DSN lives in an n8n **header-auth credential**, never in a node URL — the hourly export strips credentials, not URLs, and a DSN in a URL reaches the public repo within the hour. Payload must be a hand-built envelope (workflow name, node name, execution ID, timestamp, error class) — **never** `execution.error.message`, which is A-19. **Remains deferred.** The Telegram + Gmail error channel was **confirmed working by the Team Lead on 10 August 2026**, twice within twelve hours (the medication template outage and the time-zone outage) — this was the condition attached to deferring. | Talal |
| A-32 | ~~**`middleware.ts` has never run in production.**~~ — **CLOSED 8 August 2026 by Talal Baig.** Moved to `src/middleware.ts`. **Both verification checks passed**, including check 2 — the 70-minute tab-close test confirming a session survives access-token expiry. (Originally: root placement under a `src/` project left `.next/server/middleware-manifest.json` empty, so `supabase.auth.getUser()` session refresh never ran; newly runs on `/share/[token]` as well.) | Closed |
| **A-33** | ~~**Redelivery after check-in closure produces a spurious elder message.**~~ — **CLOSED here 10 Aug 2026 — tracked as PD-6.** P3. The A-25 early exit sits *after* `Resolve Check-in`. **17 August 2026:** the A-26 reply is retired; the false branch now calls WF-9. A redelivery after closure may ingest as a journal entry (`voice_journals.media_id` UNIQUE) rather than the old reply. The early-exit ordering issue remains on PD-6. | Closed |
| **A-34** | **The tracked migration history no longer describes the live database.** `supabase/migrations/` is tracked on `main`. Applied live and still absent from the tree: `voice_replies.media_id` plus its partial unique index (A-25, 8 Aug — the index is what makes WF-5 idempotent), and `DROP TABLE public.message_templates` (A-20, 10 Aug). The initial-schema migration still creates `message_templates`. A rebuild from the repo today would produce a schema containing a table that no longer exists and lacking the index WF-5 depends on. `watchdog_alerts` (11 Aug) is captured — see `20260811060000_watchdog_alerts.sql`. Needs either catch-up migration files for the two outstanding changes, or a recorded acceptance that migrations are not the schema source of truth. | Talal |
| **A-35** | **An invalid IANA time zone on a single elder halts every scheduler.** WF-1 / WF-1b / WF-1c apply `AT TIME ZONE e.timezone` across all elders in one query, so one bad value throws for the whole batch and nothing materialises for any family. Occurred 10 August 2026: `Asia/India` was typed into a free-text field at 16:17 UTC and Track B stopped for 33 minutes until the row was corrected by hand; all three workflows recovered on the next tick with no workflow change. Four of that elder's check-ins were permanently lost and later swept to `missed`. Guardrails added in the front end and server actions the same day. **Second occurrence, 11 August 2026.** A different Care Partner set a different elder's zone to `Arabian Standard Time (AST)` — a Windows display name, not an IANA identifier — and WF-3c (Missed Sweep) began failing every minute with the same class of error. Corrected to `Asia/Riyadh`; all schedulers recovered on the next tick. **Two independent users in under 24 hours, each entering something entirely reasonable-looking** (a plausible-but-nonexistent IANA name, then a clock label copied from an operating system). This is a field-design failure, not user carelessness, and it raises the weight of the residual risk: the front-end and server-action guardrails shipped in PR #11 close the entry paths that caused both incidents, but **validation remains application-side only**. A database-level trigger on `elders.timezone` and `care_partners.timezone` is the only thing that would make the schedulers safe against a direct SQL write, a seed script, or a future import path. Ruling pending. **11 August 2026 — dropdown narrowed.** The time-zone select now offers only the 65 curated offset-labelled zones plus any stored value not among them. The full 418-entry IANA fallback was removed as unusable without search. **Validation is unchanged and remains a runtime `Intl` check, not list membership** — the curated list is a convenience surface only. A searchable combobox over the full list is a post-demo improvement. | Talal |
| **A-36** | **Doctor share links were invisible in the dashboard, so issued tokens could not be revoked.** `load-app-data.ts` selected `created_at` from `doctor_share_links`, which has `created_by` — the query errored on every load, `shareRes.error` was never checked, and `(shareRes.data ?? [])` turned the failure into an empty list. The list had been empty for every elder since the feature shipped; `tsc` could not see it (loosely-typed row, Rules C12 / C14). Observed 11 Aug 2026: 13 active unrevoked links across three elders, nine minted by WF-4 during SOS testing — WF-4 mints a fresh link on every SOS and nothing revokes them before their 30-day expiry. Fixed 11 Aug: column corrected, errors logged, full list rendered with origin labels and revoke controls, `sos_event_id` added so dashboard-issued and SOS-minted links are distinguishable, and a partial unique index caps live dashboard-issued links at one per elder. Pre-existing links revoked in bulk before the index was created. **Not addressed:** SOS-minted links still live 30 days and are uncapped by design; revoking them on `sos_events.resolved_at` was considered and deferred rather than touch the SOS path before Demo Day. Cross-ref **PD-14** (was A-38). | Talal |
| **A-37** | ~~**Care Circle share-link list overstates "live" vs the reveal path (carried from PR #12 §E.6).**~~ — **ASSESSED AND DEFERRED 11 Aug 2026 — tracked as PD-13.** Reveal rejects expired tokens (`revoked_at` **and** `expires_at`). A-36 taught `activeLinks` / header revoke to use `isActiveShareLink` (revoked + expiry), but the Care Circle list empty-state and row membership still key off `unrevokedLinks` (`!revokedAt` only) — expired-unrevoked rows remain listed (labelled "(expired)"), and the empty copy still says "No active share links" only when none are unrevoked. **Measurement (11 Aug 2026):** 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued. Filter mismatch is real but not observable until 10 September 2026. | Closed |
| **A-38** | ~~**No elder-wide server-side cap on concurrent unrevoked share links (carried from PR #12 §E.7).**~~ — **ASSESSED AND DEFERRED 11 Aug 2026 — tracked as PD-14.** A-36 added `doctor_share_links_one_active_cp_link` for dashboard-issued only (`revoked_at IS NULL AND sos_event_id IS NULL`). SOS-minted links remain uncapped by design (A-36 Not addressed). Nothing limits total concurrent unrevoked credentials per elder across both origins. **Measurement (11 Aug 2026):** 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued. | Closed |
| E3 | ~~Something auto-commits `chore(n8n): export N workflow(s)` to `main` outside the docs-first flow.~~ — **CLOSED 9 August 2026. Not a defect.** Identified as a deliberate hourly export cron on the Contabo VPS. Ruled by Talal: leave as is. Documented in §12.1. | Closed |
| D2 | ~~Prove the Sentry alert rule fires.~~ — **CLOSED 8 August 2026.** A real alert was received and confirmed by Talal. | Closed |

---

## 16. Change log

| Date | Version | Change |
|---|---|---|
| 19 Aug 2026 | 1.53 | **No persisted reports entity.** Loved One Reports tab is an entry point to on-demand `/reports` generation (check-in history). Do not add a `reports` table. Onboarding re-seeds Care Partner WhatsApp + timezone from `care_partners` whenever that row exists, not only `?mode=additional`. |
| 17 Aug 2026 | 1.51 | **Care Partner account delete.** `DELETE /api/account`: collect elders / counts / audio paths with the admin client, then one `auth.admin.deleteUser()` (the cascade root). `deletion_events` `source='account'` — one row per elder plus a summary. Re-onboarding with the same email and WhatsApp numbers is the purpose. |
| 17 Aug 2026 | 1.50 | **`deletion_events` + WF-11 on the map.** Append-only audit of hard deletes; no FKs to `elders` or `auth.users` (CASCADE would erase the audit). App insert is service-role after the storage re-list; failure does not fail the request. WF-11 (15-minute cron, `source='wf11'`) is the leftover-object backstop. |
| 17 Aug 2026 | 1.49 | **Product Loved One hard delete.** `DELETE /api/loved-ones/[id]`: session RLS then Storage API + `{elder_id}/` prefix sweep (`storage.objects` has no RLS, so cascade cannot clear `voice-notes`). Soft delete rejected (Talal). Accepted scheduler race documented. WF-11 is the leftover-object backstop. Profile-page delete control → PD-24. |
| 17 Aug 2026 | 1.48 | **Voice journal + SOS cancel.** Workflow map 22 → **24**: WF-9 (`2KWtzSH22fTNxed9`) ingest to `voice_journals`; WF-10 (`CPDmCJh8e1WO8Sod`) elder `cancel` (Option A: `resolved`, `resolved_by_role` NULL → WF-4c *"Someone"*). WF-5 false branch → WF-9; unprompted voice **is** stored (Talal, 17 Aug — prior "never has audio stored" safeguard superseded). Classifier is not reliable emergency detection. E2E on live handset 17 Aug. |
| 17 Aug 2026 | 1.47 | **Waitlist + WF-8.** `public.waitlist` (no FKs; insert-only RLS; route-generated id; no `RETURNING` — 42501). `POST /api/waitlist` → WF-8 (`V9VTNaLGJkFGUTFN`, email only). Workflow map 21 → **22**. Public unauthenticated writes recorded as §6.1. P1: second Next.js→n8n webhook exception. Email uniqueness still open (PD-19). |
| 14 Aug 2026 | 1.46 | **Routine create defaults for qualifier run.** New dashboard/onboarding routines: time = now in elder TZ (`ROUTINE_DEFAULT_TIME_OFFSET_MINUTES` = 0), `notify_care_partner = every_time`, medication escalation 5 min (food 45 / health 60 unchanged). `startDate` uses `todayInTimeZone`, not UTC `toISOString`. Postgres `escalation_minutes` column default remains 30. |
| 13 Aug 2026 | 1.45 | **Routine list order + pause does not resync `domain_configs`.** Lists sort active-first, then alert time, then name. `setRoutineEnabled` skips `syncDomainConfig` on purpose — no workflow SQL reads that table; WF-6 uses routine `notify_care_partner` (A-9). Do not "fix" the lag. |
| 13 Aug 2026 | 1.44 | **Pause vs soft-delete (two-column, all domains).** `enabled` = pause (stays visible, Inactive); `active` = tombstone. Ruling: Talal, 12 August 2026. Food/health gain `active` (mirroring medications). Closed the PR #19 conflation that hid paused routines. No n8n changes. |
| 12 Aug 2026 | 1.43 | **Onboarding Sign out exit.** Wizard shell exposes Sign out on every step; clears session + local draft, then `/sign-in`. Warns when local progress exists; never blocks. `countOwnActiveElders` error→0 deferred as PD-15. |
| 12 Aug 2026 | 1.42 | **A1 — `answered_no` + CP-timezone day bounds.** UI maps `responded`+`no`/`some_of_them` → `answered_no` (in adherence denom, no credit; own pie slice). List surfaces show response text beside status. Dashboard “today”/custom bounds use Care Partner IANA TZ; elder materialisation day divergence documented, not reconciled. |
| 12 Aug 2026 | 1.41 | **Routine → check-in lifecycle (UI-side).** Next.js propagates food / health / medication CRUD to today's `checkins` using the elder TZ and the WF-1* slot expression; soft-delete only (CASCADE FKs forbid hard DELETE); disabled routines hidden from the active list; CT notice when today's send already went out. No n8n changes. |
| 11 Aug 2026 | 1.40 | **Adherence pie labelling — no Cancelled slice.** Dashboard and Reports status pies are adherence composition (Taken / Delayed / Missed only); `adherence()` / `checkInStatusBreakdown` / slice values unchanged. Title and caption make the exclusion explicit (cancelled count always; pending if non-zero). Closes the A-29 open on whether to add a Cancelled slice — ruled out. Charts mounted on dashboard and reports (previously computed, never rendered). |
| 11 Aug 2026 | 1.39 | **A-37 and A-38 assessed and deferred → PD-13 / PD-14.** Measurement recorded: 3 unrevoked links, 0 expired, 0 expiring before Demo Day, earliest expiry 10 September 2026, max 2 per elder, 2 SOS-minted / 1 dashboard-issued. Care Circle "active" filter vs reveal (A-37) and elder-wide unrevoked-link cap (A-38) close here; tracked in `PostDemoEnhancements.md`. |
| 11 Aug 2026 | 1.38 | **A-29 rescope + Case 87 share summary.** A-29 corrected: share defect was DB→UI vocabulary (not casing); PDF was truly raw lowercase. Shared `formatCheckInStatus` + unified `statusBreakdown`; share loader uses a 30-day calendar window with mapped statuses and a deterministic summary strip (§7.3). Cancelled pie-slice still pending Talal ruling. |
| 11 Aug 2026 | 1.37 | **PR #12 §E residuals carried into open items.** Investigation-only PR closed without merge; still-open findings recorded as **A-37** (Care Circle list empty-state/membership still keys off `!revokedAt` / `unrevokedLinks`, so expired-unrevoked rows remain listed vs reveal) and **A-38** (no elder-wide server-side cap on concurrent unrevoked share links; dashboard-issued capped by A-36 index only). §7.3 allowlist drift flagged in that PR needs re-check against the rewritten §7.3 text from PR #14, not the old wording. |
| 11 Aug 2026 | 1.36 | **D-10 — `Not on Record` substitution; conditional `_v2` rejected for Demo Day.** WF-4 Load Care Circle COALESCE defaults for absent Buddy/Doctor change from `NA` to `Not on Record` (live). Conditional `_v2` templates rejected on **scheduling risk** (IF + duplicate WhatsApp send nodes on the P0 SOS path; 18 days to Demo Day; 110/122 cases unrun) — not a copy preference. Accepted prose defect on templates 10/12 recorded; real fix → PD-12. |
| 11 Aug 2026 | 1.35 | **A-36 — Doctor share links invisible since ship.** Root cause: `load-app-data.ts` selected non-existent `created_at` (table has `created_by`); errors swallowed into empty list. Fixed select + error logging; Care Circle list/revoke/origin labels; hard-delete Buddy/Doctor (doctor delete revokes active links first); `sos_event_id` + partial unique index for one live dashboard-issued link per elder; WF-4 mint documented to carry `sos_event_id`. |
| 11 Aug 2026 | 1.34 | **Time-zone dropdown narrowed to the curated 65.** Removed the raw full-IANA third group from `TimeZoneSelect`; `preserveLegacy` now keys only on absence from the curated list so unlisted stored zones (e.g. `Asia/Calcutta`, `Africa/Accra`) still surface under "Current (not in the list)". Validation unchanged — runtime `Intl`, not membership. Recorded on A-35. |
| 11 Aug 2026 | 1.33 | **A-35 second outage + offset-grouped time-zone quick picks.** A-35 records a second failure 18 hours later (`Arabian Standard Time (AST)`, Windows display name) from a different user — field-design failure, not carelessness; residual risk of application-only validation restated with weight. `TIMEZONE_OPTIONS` expanded to an offset-ordered IANA list (65 entries; labels carry UTC offsets, stored values remain IANA names) so Rwanda / South Africa / Pakistan zones appear in quick picks without scrolling the full list. |
| 10–11 Aug 2026 | 1.32 | **Open-item sweep + WF-7 + time-zone outage recorded.** Ten items closed (A-6, A-8, A-11 wording, A-12, A-20 table dropped, A-23→PD-8, A-27, A-28, A-30 detector, A-33→PD-6). Six accepted with reasoning appended (A-5, A-14/A-17/A-22, A-18, A-19, A-24, A-31 remains deferred with confirmed Telegram/Gmail channel). **A-34** and **A-35** opened. **WF-7 Dispatch Watchdog** documented in §8 (`8G8s8dNSVySDbPpm`, map **21** workflows), including the 11 August rework to once-only alerting via `watchdog_alerts`. §11 P1 row now reports via WF-7; D-9 note extended; materialisation-failure gap recorded (A-35). |
| 10 Aug 2026 | 1.31 | **Google OAuth withdrawn from the MVP (D-8); never-sent check-ins accepted as a known limitation (D-9).** §7.1 corrected — auth is email + password only; the earlier "and Google OAuth" wording is withdrawn along with open item C1. The auth/onboarding coupling recorded inline in §7.1 with its reasoning: `ensureCarePartnerProfile` depends on `fullName` + `timeZone` supplied by a form submit handler, so an OAuth callback produces an unroutable third state (authenticated, no profile row) that fails silently via `countOwnActiveElders`'s `0`-on-error return, across four call sites. Deferred to `PostDemoEnhancements.md` PD-9. `Phases.md` A3.1 corrected — it falsely marked Google OAuth complete. "Continue with Google" removed from the sign-in and sign-up UI. **§11:** a check-in that was never delivered is still swept to `missed` and still triggers the Care Partner Missed Notice, whose template copy asserts a reminder was sent — observed 9–10 Aug across eight medication check-ins during a Meta template review, and reachable by any dispatch failure, not only template ones. Accepted for the MVP by ruling; deferred as PD-10 (WF-6 guard) and PD-11 (persist the send-failure cause, which a real A-30 detector also requires). **Rules W-series:** approved WhatsApp templates must never be edited in place — see `Rules.md` v1.19. |
| 9 Aug 2026 | 1.30 | **Workflow map completed and two items closed.** Full enumeration found 20 workflows against 16 in the working map; WF-3d (Food/Health Response Handler), WF-4c (SOS Resolution Broadcast), WF-4d (SOS Nudge Sweep) and the read-only Credential Check utility documented in §8. WF-3d's zero-row guard verified live in execution 56991. **E3 closed — not a defect:** the `chore(n8n): export` commits are a deliberate hourly cron on the Contabo VPS, now documented; the flow is one-directional n8n → repo and re-import remains forbidden under Rules W7. **D2 closed** — Sentry alert rule proven by a real firing. Postgres connection timeouts raised from 10 s to 15 s (WF-1b materialise) and 20 s (WF-4d nudge select) after the 8 August failures. Two stale passages corrected: §8 WF-3a no longer describes the unguarded WF-6 call as an open P1 (guard verified on version `d9016665`; F-7 / D-9 closed), and §5.6 no longer lists `days_of_week` as uncollected — it is collected by all six routine forms (D-1) and honoured by WF-1/1b/1c. Test-catalogue finding F-1 can be retired. |
| 9 Aug 2026 | 1.29 | **Post-demo deferral register created.** `PostDemoEnhancements.md` v1.0 records PD-1 to PD-8 — routine-table timestamps, fabricated `createdAt`/`updatedAt` in `mappers.ts`, C3 scope correction, D-7 revisit, the dashboard `ALL_DAYS` fallback, A-33, E2 and A-23 — deferred by ruling of the Team Lead on the basis that no item has a user-facing consumer and the remedies carry more risk than the defects while the test run is incomplete. **T-1 closed: no defect found** — all six routine forms verified against D-1 on 8 August; the reported Monday-only default was a tester setup artefact, not a code path. |
| 8 Aug 2026 | 1.28 | **A-25 closed — WF-5 voice-note idempotency.** §5.2 `voice_replies` gains `media_id` (partial unique index `WHERE media_id IS NOT NULL`); `audio_path` shape changed `{unix_ms}` → `{media_id}`. §8 WF-5: three-layer dedup documented (early exit before any media fetch; `ON CONFLICT (media_id) WHERE media_id IS NOT NULL DO NOTHING`; deterministic object key with `x-upsert: true`). `Derive Answer` discriminator made explicit (`resource: text` / `operation: response`) after runtime evidence confirmed the Responses API path — no behaviour change. Published `activeVersionId 83a6a60e`, verified against the live workflow. **A-33 opened:** redelivery arriving after check-in closure still reaches the no-open-check-in reply, because the early exit sits after `Resolve Check-in` (P3). |
| 8 Aug 2026 | 1.27 | **A-32 closed** (Talal Baig, 8 August 2026): middleware registered at `src/middleware.ts`; both verification checks passed, including the 70-minute tab-close / access-token-expiry survival test. §11.1 Sentry edge note corrected — `sentry.edge.config.ts` is active (no longer described as dead code pending A-32). |
| 8 Aug 2026 | 1.26 | **Wave 2 frontend + wellbeing vocabulary.** Sama (8 Aug): status vocabulary locked — `stable`→Doing well · `attention`→Needs attention · `urgent`→Urgent · `unknown`→No data yet (pill + Loved Ones filter). **D-5 / F-4** wellbeing derived in app code from SOS + recent missed check-ins (not stored). **F-1** day-of-week wired into all six routine forms (Cases 17/18). **F-1a / D-2** writers stop emitting `frequency: 'custom'`. **F-4c / D-7** mapper stops fabricating `elders.updatedAt` from `created_at`. **Track B (Claude, same day):** WF-5 consent predicate (F-8), no-open-check-in reply closing **A-26** (F-7), error-workflow binding (F-9). **Namespace:** Wave 1/2 decision refs renamed **R-1…R-7 → D-1…D-7** so they do not collide with §14 Risks `R1`–`R9`. |
| 8 Aug 2026 | 1.25 | **Wave 1 / Wave 2 decisions recorded** (Talal Baig, 8 August 2026). **D-1** day-of-week on all six routine forms (default all seven; WF-1/1b/1c already honour `days_of_week`) — Wave 2. **D-2** `food_routines.frequency` / `health_routines.frequency` retained but reserved; writers must stop emitting `'custom'`; no migration before Demo Day (Case 21 inert, 7 Aug). **D-3** `/onboarding?mode=additional` Care Partner card read-only + Settings link — Wave 2. **D-4** per-elder Care Partner WhatsApp out of MVP scope; account-scoped contact recorded as known limitation (§13). **D-5** wellbeing status derived in app code (reuse `src/lib/sos.ts` rule); labels pending Sama — Wave 2. **D-6** `WellbeingStatus` type authoritative over filter labels (`stable`/`attention`/`urgent`); remove laundering `as` cast — Wave 1. **D-7** `elders.updated_at` not added; mapper stops presenting `created_at` as `updatedAt` — Wave 2. *(Refs originally published as R-1…R-7; renamed to D-1…D-7 in v1.26 to avoid collision with §14 Risks.)* |
| 4 Aug 2026 | 1.24 | **Verification console delivered.** New §11.2: `src/app/verify/` outside `(app)`; `console_access` approval gate (admin-side only); closed `CheckId` registry; RLS-scoped reads; `VERIFY_CONSOLE_ENABLED` server-only default false; Case 40 and Case 115 / `notification_ownership` limitations. §12.1 layout updated. |
| 4 Aug 2026 | 1.23 | **Sentry installed.** §11.1: as-built record — server/edge only, no client SDK, scrubbing proven against a live event, phone-regex tradeoff recorded, edge config dead until A-32. A-32 opened: root `middleware.ts` never registered, so Supabase session refresh has never run in production. |
| 4 Aug 2026 | 1.22 | **Sentry scope ruled.** §11 heading ambiguity resolved (P2 = build task, table = event severity). New §11.1: Sentry covers Next.js only; Track B stays on the n8n error workflow; per-event coverage table; X9 scrubbing named as a prerequisite with the `/share/[token]` leak vector. A-30 (±5-min P1 unreported) and A-31 (n8n→Sentry deferred) opened. |
| 4 Aug 2026 | 1.21 | **Cancelled check-ins + orphan cleanup.** §5.2: `checkin_status` +`cancelled`, `cancelled_at`; two-migration reason. §8: WF-3c second branch (Cancel Orphaned Check-ins); stranded-`sent` defect; medication NOT EXISTS slot predicate. A-27–A-29 opened. Frontend `25114ed` noted. |
| 4 Aug 2026 | 1.20 | **WF-5 built (voice reachability).** §8: WF-2a `voice_note` route; WF-5 `IC6oR4fuQd2VMkfQ`; voice→medication mapping; `voice-notes` bucket; renames (WF-3a/3b/6). WF-3a WF-6 guard defect (P1). A-22–A-26 opened. |
| 3 Aug 2026 | 1.19 | **All-domain pass (evening).** Fifteen-workflow map: +WF-1b/1c/3d; WF-1 renamed Medication Scheduler (`days_of_week` honoured; overdue miss removed); WF-3b/3c all domains; WF-3c sole missed owner; WF-6 reads notify via check-in FKs; WF-2a `food_health_response`. Three defects recorded (§8). §5.2 `checkins` FKs + migration `20260803120000`. `domain_configs` = derived cache only; A-13/A-16 closed. A-20 opened; A-21 closed (frequency aligned). |
| 3 Aug 2026 | 1.18 | **A-15 closed.** Live elder is Talal's test persona on a second handset in Riyadh; `+92` number and `Asia/Riyadh` timezone are both correct — no scheduling error. |
| 3 Aug 2026 | 1.17 | **Round 2 doc pass.** §5.2 round-numbering note (`nudge_index` vs `nudges_sent`). Migration `20260803100000` (file only) tightens `nudges_sent` bound 0–3. |
| 3 Aug 2026 | 1.16 | **WF-4 SOS build.** Thirteen-workflow map (WF-4 / 4b / 4c / 4d + existing). Nudge count corrected: alert + 3 nudges (`nudge_index` 0 = alert; `nudges_sent` 0–3). Share-link reuse struck (hash-only). Four resolution labels + `context.id` attribution. Elder ack free-form; template 14 via WF-4c. Sequential ~4 s dispatch observed. A-17/A-18/A-19 opened. Remaining Track B workflow: **WF-5 only**. |
| 3 Aug 2026 | 1.15 | **Correction pass.** A-10 closed (template 12 approved 2 Aug — all 14). A-9 closed (WF-6 never used `ct_notification`). A-2 resolved (gate decided; prompt is WF-5 build detail). §8 medication-only scope on WF-1/3a/3b/3c; decline normalisation recorded (no TBD). §12.1 monorepo corrected (`src/app/`, specs at repo root incl. `Templates.md`). Team size unified to **10**. A-14 owned by Talal; A-15/A-16 opened. Footer → 3 Aug. |
| 3 Aug 2026 | 1.14 | **Track B build of 3 Aug — nine-workflow map.** §8 rewritten: WF-0/1/2/2a/3a/3b/3c/4a/6 with n8n IDs; WF-2 thin-router safety rule (API `update_workflow` rotates webhookId); WF-0 claim-then-send; WF-1 dispatch bound to `scheduled_for + escalation_minutes`; *Some of them* list not built (A-12); WF-6 `only_missed` also notifies on `some_of_them` (Talal ruling); period labels closed (A-11). A-13/A-14 opened. WF-4 SOS orchestrator and WF-5 still not built. |
| 2 Aug 2026 | 1.13 | **B1.5 consent lifecycle + STT decision.** §3 / §2: STT = **OpenAI Whisper** (supersedes Google/ElevenLabs; prior "Whisper is not the choice" withdrawn — Talal, 2 Aug). §5.2 `elders`: `consent_requested_at` / `consent_declined_at` + four-state table; `voice_replies.provider` = `openai_whisper`; `confidence` diagnostic-only. §8: **WF-0** welcome dispatch (cron; set `consent_requested_at` with the send); WF-2 decline → `consent_declined_at` (terminal); WF-1 still gates on `consent_confirmed_at` only; WF-5 re-ask gated on answer-derivation `unclear`, not ASR confidence. §11: WF-0 send failures = P1. A-1 closed; A-2 rewritten. Migration file only — not applied by agents. |
| 28 Jul 2026 | 1.12 | **SOS path reconciled to the templates Meta approved** (WABA `1495493002256968`, Graph API 28 Jul). §7.3 doctor allowlist **rescoped to the share page only**; the SOS channel deliberately carries CT/Buddy names and WhatsApp numbers to the doctor, and the Doctor's name/clinic to the Buddy — ruled 28 Jul, covered by `consent_data_sharing_at`. §8 WF-4 gains **`NA` send-time substitution** for absent Doctor/Buddy (DB never written with placeholder rows — explicitly rejected) and the **SOS share-link reuse-or-mint** path with fail-open-to-`NA` (P2: never block the alert). §8 WF-2 gains **case- and punctuation-insensitive button matching** (`I Am Responding` vs `I'm Responding`; food buttons are `Yes`/`No`). §10 states doctor/buddy/CT message timezones explicitly. A-10 (template 12 pending), A-11 (period label) opened. |
| 27 Jul 2026 | 1.11 | **§5.7 FR-ON-7.** Care Circle draft inserts Doctor with `approved_by_ct = false`; Review sets `true` with `consent_data_sharing_at`. |
| 27 Jul 2026 | 1.10 | **Corrected `voice_journal_entries`.** Table is **not** created in the MVP — journal screen renders empty state (`load-app-data.ts`). Prior wording caused A4.0 wipe to abort treating a non-existent table as present. |
| 26 Jul 2026 | 1.9 | **A4.1 Pass 1 revision.** `medications.times` CHECK uses `cardinality(times) = 1` (not `array_length` — NULL pass on `'{}'`). `sos_notifications.status` has no DEFAULT; document `sos_notifications_status_fields_consistent` CHECK (`sent` / `skipped` / `failed` field rules). |
| 26 Jul 2026 | 1.8 | **`consent_terms_version`** documented as a dated string (e.g. `2026-07-v1`) tied to exact Privacy/Terms text at Review (`PRD.md` §12.4). |
| 26 Jul 2026 | 1.7 | **A4 — schema alignment & Track B contract.** `first_name`/`last_name` replace `full_name`; drop `phone_number`; elders: `last_name`, `age`, `relationship_to_care_partner`, Review consent columns; doctors: nullable WA, `clinic_name`, stop collecting timezone; meds: dosage=quantity, `times` length=1, `not_required` notify mode; enum ADD VALUE ordering; §5.6 unused register; §5.7 Care Circle `SECURITY INVOKER` RPC; `sos_notifications` skip status + `created_at` / nullable `sent_at`; WF-4 doctor skip branch; WF-6 per-routine authority (`domain_configs.ct_notification` derived/deprecated — A-9 Robert); §10 share page uses elder TZ (doctor-TZ exception removed); A-7 closed → discharged by Phases A4.0 wipe. |
| 24 Jul 2026 | 1.6 | **Docs ↔ built product (23–24 Jul).** Elders draft/`active` + hard-delete draft vs soft-delete history; derived `domain_configs.frequency`; routine column asymmetry; `ct_notifications` mark-read open decision. §7.3: SHA-256 share tokens, 30-day expiry, click-through gate, doctor allowlist, fail-open IP rate limit. §10: PDF elder-tz exception; CT/doctor timezone INSERT-only. §12.5: single admin module, fail-open limiter, PDF ownership, Auth IP-forwarding Off. Risks/open: leaked-password WARN accepted (R8); Arabic PDF limitation (R9); Dev test-account cleanup (A-7); Upstash unset so A3.5 limiter inactive in Production (A-8). |
| 23 Jul 2026 | 1.5 | **Companion-doc references no longer pin version numbers.** `main` is the single source of truth; pinned cross-references forced edits to every other doc on each version bump and went stale silently. Refs now name the file only. Each document's own version remains in its header. Phase A2.1 applied on the Dev project. §5.1 ER diagram corrected to include `food_routines` and `health_routines`. §12.3 records the out-of-band `rls_auto_enable()` event trigger and its Prod implication. No schema decisions changed — `domain_configs` remains the 7 columns of v1.4. |
| 22 Jul 2026 | 1.4 | **Docs ↔ front-end reconciliation.** Added **§5.5 Canonical glossary** (roles + check-in UI↔backend status map + SOS display vs dispatch). Documented **SOS as two layers**: front-end display (`active`/`acknowledged`/`resolved`/`cancelled` + demo cascade) vs n8n dispatch (parallel CT + optional LCT + optional Doctor; 4 nudges / 2 min; `sos_events.status` = `open`\|`resolved` is source of truth). **Local Buddy / LCT made optional** at onboarding (`local_caregivers` 0..1); SOS always notifies CT; LCT alert conditional. Elder address remains mandatory. |
| 22 Jul 2026 | 1.3 | **Reconciled with Sama's front-end build.** Adopted the front end's **per-routine** escalation/notification model (finer-grained than per-domain) — `escalation_minutes` + `notify_care_partner` now live on `medications`, `food_routines`, `health_routines` (defaults 30/45/60), not on `domain_configs`. Expanded the three routine tables to match the front-end types exactly. Added §5.3 (front-end ↔ schema naming map: Loved One=EP, Care Partner=CT, Local Buddy=LCT, Family Doctor=DR) and §5.4 (v2/Could-have front-end stubs the MVP backend must NOT build: extra notification channels, voice-journal AI fields, quiet hours, rich health answer types). |
| 14 Jul 2026 | 1.2 | Meta platform rules verified against live docs. `elders` gains **`address` (NOT NULL)**, **`consent_attested_by_ct` / `consent_attested_at`**, **`consent_confirmed_at`**. **WF-1 now gates on consent** — NULL means nothing is ever scheduled for that elder. WF-2 routes the welcome confirmation and the medication *Some of them* → free-form interactive list. §9 records that templates cannot carry a list, that the 24-hour window can, and that Meta requires recipient opt-in. WhatsApp Flows logged as a v2 path, explicitly not now. |
| 14 Jul 2026 | 1.1 | SOS dashboard-resolution mechanism settled: **authenticated server-side webhook, Next.js → n8n** (fast path) **plus a `sos_events.status` re-check before every nudge** (safety net; the DB remains the source of truth). Recorded as the single documented exception to P1. A-3 reframed from an availability target to a demo-day readiness checklist. |
| 14 Jul 2026 | 1.0 | Initial architecture. Decisions taken: **Meta WhatsApp Cloud API direct** (not Twilio); **OpenAI** for LLM; **n8n owns the entire message path, Next.js owns the dashboard, they meet only at the database**; **n8n cron is the only scheduler** (no pg_cron); **no RAG / pgvector anywhere** — the "RAG" in the team's flow diagrams was a naming slip for a relational lookup, now formally corrected; **Supabase Auth with email+password and Google OAuth**; **Sentry** for error tracking, weighted to the SOS path; **Supabase free tier, Dev + Prod projects**; single self-hosted n8n instance. Denormalised spreadsheet-shaped schema normalised into relational tables with no change to fields or behaviour. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 9 August 2026.*
