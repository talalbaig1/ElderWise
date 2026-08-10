# ElderWise — Architecture

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Programme** | AI Generalist Fellowship (AIGF) — Outskill, Cohort 7 · Capstone Project |
| **Team** | Group 7 (10 members) · Team Lead: Talal Baig |
| **Document** | Architecture.md — v1.31 |
| **Date** | 10 August 2026 |
| **Audience** | Development team, Cursor, Claude Code |
| **Companion docs** | `PRD.md` · `Rules.md` · `Phases.md` · `Templates.md` |

> This document describes **how ElderWise is built**. `PRD.md` describes **what it does**. Where the two disagree, `PRD.md` wins and this document is wrong and must be fixed.

---

## 1. Architectural principles

Five rules govern every decision below. They are not negotiable without a decision from the team lead.

| # | Principle |
|---|---|
| **P1** | **The message path and the dashboard are two separate systems that meet only at the database.** n8n owns everything that touches WhatsApp. Next.js owns everything a human clicks. **One documented exception:** Next.js fires an authenticated server-side webhook to n8n when an SOS is resolved from the dashboard (§8, WF-4) — because on the SOS path, latency is the harm. The database remains the source of truth even there. n8n **never** calls Next.js. |
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
    │           ├── 1:many ── sos_events ── 1:many ── sos_notifications
    │           └── 1:many ── ct_notifications
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
| `active` | boolean | **Onboarding draft flag:** `false` while the wizard is in progress, `true` on finish. **All product reads filter `active = true`**, so a draft never appears in the dashboard, list, or selector. **At most one draft per care partner.** Discarding a draft is a **hard DELETE**, not a soft delete: `elders.whatsapp_number` is globally UNIQUE, so a soft-deleted draft would permanently lock that number against every care partner — including a sibling caring for the same parent. Safe because a draft has no history (`consent_confirmed_at` is null, nothing was scheduled, children cascade). **Contrast:** routine deletion is soft precisely because history must survive. |
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
| `expires_at` | timestamptz | **Always set on create** (default 30 days). Open-ended links are forbidden. |
| `revoked_at` | timestamptz | nullable — revocation is a Must-have |
| `last_accessed_at` | timestamptz | |

**`domain_configs`** — exactly three rows per elder: `medication`, `health`, `food`. **Derived cache only** — written by Next.js `syncDomainConfig()` after every routine save; **not read by workflows or the dashboard** (Talal, 3 August 2026).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum(`medication`,`health`,`food`) | UNIQUE with `elder_id` |
| `enabled` | boolean | **Derived** — mirrors whether any schedulable routine exists in that domain |
| `frequency` | jsonb | **Derived field** — the sorted union of times from routines that are both active (medications) / enabled and whose domain is enabled, refreshed on every routine write. Direct edits are overwritten on the next routine save. Shape e.g. `{"times": ["08:00","20:00"]}` (local times in the elder's tz). No fixed 3×/day (FR-ON-4). |
| `ct_notification` | enum(`every_interaction`,`only_missed`,`not_required`) | **Derived / deprecated (A4).** Not authoritative for Track B. May still be mirrored from routine rows for backward compatibility; **WF-6 does not read it** (built 3 Aug on per-routine `notify_care_partner` — A-9 closed). |
| `escalate_to` | enum(`care_partner`) | Only the CT escalates. LCT/Doctor are SOS-only. Enum kept for v2 headroom. |

> **Authority (Talal, 3 August 2026):** **`routine.enabled` (and `medications.active`) is authoritative** for whether a routine is live. **`notify_care_partner` on the routine row is authoritative** for CT notification (`every_time` \| `only_missed` \| `not_required`). `domain_configs` is a **derived cache** — workflows **must not** read it for scheduling or notify decisions. **Done:** WF-6 (`6I6OC7qJ5YhhUQxU`) reads the owning routine's `notify_care_partner` via check-in FKs, including `not_required` = total silence (no confirmation and no missed push; miss still recorded on the dashboard). A-9 closed. **A-13 closed as non-issue:** missing rows were never why food and health were silent; all three rows now exist from normal use.

> **Enum migration ordering (Postgres):** `ALTER TYPE … ADD VALUE 'not_required'` **cannot** be used in the same transaction that references the new value. Enum additions for `notify_care_partner_mode` and `ct_notification_mode` **must** ship in their **own migration file(s), ahead of** any migration that writes or checks `not_required`.

**`medications`** — one row per medicine. Field names reconciled with the front-end `Medication` type (22 Jul); A4 semantics below.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `enabled` | boolean | per-medicine toggle (FE `enabled`) |
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
| `active` | boolean | |

**`food_routines`** — one row per meal check-in (FE `FoodRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `meal_name` text · `meal_type` enum(**unused** — §5.6) · `check_in_time` time (local) · `start_date` date NOT NULL (app supplies **today in the elder's timezone**) · `end_date` date null (no longer collected — open-ended) · `days_of_week` text[] (empty = every day; honoured by WF-1b) · `frequency` enum(**unused** by schedulers — app writes `daily`) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 45) · `notes` text (**unused**) |

**`health_routines`** — one row per wellness check-in (FE `HealthRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `name` text · `type` enum(**unused** — §5.6) · `frequency` enum(**unused** by schedulers — app writes `daily`) · `time` time (local) · `start_date` date NOT NULL (today in elder tz) · `end_date` date null (open-ended) · `days_of_week` text[] (empty = every day; honoured by WF-1c) · `question` text (**unused**) · `answer_type` enum(**unused**) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 60) · `typical_bedtime` time null (**unused**) · `typical_wake_time` time null (**unused**) |

> **Escalation defaults differ by domain in the front end** (medication 30 min, food 45, health 60). These are **defaults**, editable per routine. The old blanket "30 across the board" is superseded.

> **Column asymmetry:** `medications` has both `active` and `enabled`; `food_routines` and `health_routines` have only `enabled`, so “pause” and “delete” are the same state for those two.

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
| `resolved_by_role` | enum(`care_partner`,`local_caregiver`,`doctor`) | nullable |
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

**`voice_journal_entries`** — **not created in the MVP.** The Voice Journal screen is a hard-coded demo placeholder (FR-DB-6) that renders an **empty state**. There is no `public.voice_journal_entries` table in migrations; `load-app-data.ts` always returns an empty `voiceJournals` array. Do not invent this table or assume it exists in wipe/seed scripts.

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
| `VoiceJournalEntry.transcript` / `aiSummary` / `mood` / `themes` | **Could-have (C2)** | Voice **journaling** is a hard-coded demo screen. (Note: voice **reply** transcription for check-ins **is** Must-have — M4a — a different feature.) |
| `UserSettings` WhatsApp quiet hours / daily digest | **Out of scope** | Not in the PRD. Render if present, but no backend. |
| `HealthRoutine.answerType` = `number` / `mood` / `short_text` | **Should/Could** | MVP health check-ins are **Yes/No** (`yes_no`). Richer answer types are later. |
| `SOSEvent.averageResponseMinutes`, `callsMade` | Demo/analytics | Not core MVP logic. |
| `dateOfBirth`, `gender` on Loved One | Optional | Collected if offered; not required by any MVP workflow. |

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
| `taken` | `responded` | Affirmative / completed answer recorded (e.g. yes, medicines taken). |
| `missed` | `missed` | Direct match — no reply after the reminder path. |
| `cancelled` | `cancelled` | Direct match — routine disabled while check-in was still open; not a miss and not a skip. |
| `skipped` | *(no dedicated backend status)* | UI-only — elder skipped it. **Different meaning from `cancelled`.** Do not conflate. |

Negative or partial medication answers that still count as a recorded response remain backend `responded`, with detail in `response_value` / `checkin_medication_items` — the UI may show a non-`taken` label for those cases without changing the backend enum.

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

## 6. Data isolation (RLS) — P4

Every table above carries a path to `care_partners.id`. RLS is enabled on **all** of them, with policies of the form:

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

### 7.2 Elderly Patient
**None.** The EP never authenticates and never logs into anything. Their identity is their WhatsApp number, resolved on the inbound webhook. This is the entire premise of the product — do not add a login for the elder under any circumstances.

### 7.3 Doctor
**No account.** A tokenised, revocable, read-only share link scoped to a single elder (M15).

- CT issues the link from the Care Circle screen → a cryptographically random token (**≥32 bytes**) is generated, **hashed with SHA-256**, and stored in `doctor_share_links`. The raw token is shown **once** and lives only in the URL. **Not bcrypt/argon2:** the token must be looked up **by its hash**, and a per-row-salted password hash makes that impossible. SHA-256 is correct here because the token is high-entropy random, not a user-chosen password.
- **Default expiry 30 days, always set on create.** An open-ended link is a permanent credential sitting in someone's WhatsApp history.
- The doctor opens `/share/{token}`. A Next.js **server component** hashes the incoming token, looks it up, rejects if revoked or expired, and scopes every query to that one `elder_id`.
- **Click-through gate:** `/share/{token}` renders neutral copy first; clinical data loads only after human interaction. Reason: link-preview crawlers (WhatsApp, Slack, Signal, email scanners) fetch any URL a CT sends and would otherwise receive health data with nobody clicking. Supported by `noindex`/`nofollow`, no OG or Twitter meta tags, `Disallow: /share/` in `robots.txt`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`.
- **Doctor *share page* allowlist:** elder name, check-in history, active routines, and SOS events (`triggered_at`, `status`, `resolved_at`, `resolved_by_role`, `resolved_channel`, derived response time). **Excluded from the page:** `sos_notifications`, `resolved_by_id`, CT and Local Buddy contact details, addresses, phone numbers. Reason: the event is clinical; the dispatch log is operational and carries third-party identifiers.
- **⚠️ This allowlist scopes the share page only — not the SOS channel.** The approved template `elderwise_sos_alert_doctor` deliberately carries the **Local Buddy's and Care Partner's names and WhatsApp numbers** to the doctor (`{{4}}`–`{{7}}`), because during an active emergency the doctor may need to reach a human immediately and a read-only page cannot be dialled. **Ruled 28 July 2026 (Talal).** The two surfaces differ on purpose: the share page is ambient and long-lived, the SOS message is transient and consented-to. Both are covered by the Review `consent_data_sharing_at` consent, which is required whenever a Doctor or Local Buddy is added. Do not "fix" the inconsistency by stripping the template — it was approved by Meta in this form.
- Similarly, `elderwise_sos_alert_lct` discloses the **Doctor's name and clinic** to the Local Buddy (`{{4}}`/`{{5}}`), under the same consent and the same reasoning.
- Rate limited to **20 requests per minute per platform IP** (`x-vercel-forwarded-for`; fall back to `x-forwarded-for` locally), **fail-open** — see §12.5.
- **All data fetching for this route happens server-side.** No Supabase client is ever handed to the doctor's browser.
- CT can revoke at any time — sets `revoked_at`, and the link dies on the next request.

---

## 8. The message path (n8n)

The n8n instance carried **20 workflows** as of 9 August 2026: 17 operational, the shared Error Workflow, and two read-only utilities (Template Audit, Credential Check). Verified by full enumeration. (Prior working map said sixteen as of 4 August 2026 — WF-5 voice → STT proven that date; the gap was incomplete documentation, not missing builds.)

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
| **Error Workflow** | `uvBstI6J42nNhIYz` | error trigger | Shared Track B failure path → Telegram + Gmail (§11.1) |
| **Template Audit** (read-only) | `PADE2m75e6xVGS2e` | Manual, inactive | Utility — not on the message path |
| **Credential Check** (read-only) | `5nVL2BdvqeX2i0AU` | Manual, inactive | Verifies both Supabase credentials (Postgres query + Storage bucket listing) |

**Track B message-path workflows: built** (4 August 2026). **Remaining:** open items A-22–A-24, A-27–A-31, A-33; `some_of_them` fourth gate output (A-12).

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
  - **Voice note** → **`voice_note`** route when `message_type === 'audio'` **and** a `media_id` is present, inside the **consented** block alongside `med_response` and `food_health_response`. **Parse Inbound Message** emits `media_id` from `msg.audio?.id`. Calls **WF-5** with **`waitForSubWorkflow: false`** — WF-5 takes ~6–7 s; holding Meta's callback that long invites a retry (same reasoning as WF-4). **Built and proven end to end 4 August 2026.**
  - **SOS trigger** → **WF-4** — **checked first and short-circuits everything else** (P2). The elder's message must normalise to exactly `sos` or `help` — **whole-message exact match**, case-insensitive, **not** a contains-match. A contains-match would fire a three-person emergency on *"can you help me with my tablets?"*. **Ruled by Talal, 3 August 2026.** **SOS fires regardless of consent state**, including an elder who has declined — deliberate carve-out from N5: she is the sender, and the alerts go to her care circle, not to her. **Ruled by Talal, 3 August 2026.**
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
  - **Food / health** — use `food_routine_id` / `health_routine_id` FKs. `food_routines` and `health_routines` have **`enabled` only**; only **`medications`** has **`active`**.

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

- **Trigger:** SOS from WF-2a. Runs **immediately**; must never wait behind routine traffic.
- Create or reuse an open `sos_events` row (`status = open`), load the elder's care circle via a **relational lookup** of CT + optional LCT + optional Doctor (§3.1 — not RAG).
- **Elder acknowledgement (free-form).** On trigger, send the `Templates.md` §7.3 message to the elder. It is **free-form, not a template** — her own SOS message opens the 24-hour customer service window. **`NA` must never appear in it** (four variants; T3).
- Dispatch templates **10 / 11 / 12** at **`nudge_index 0`** (the **initial alert** — **not a nudge**). Recipients: **CT always**; **LCT only if a `local_caregivers` row exists**; **Doctor only if a `doctors` row exists and `whatsapp_number` is non-null**. Writes `sos_notifications` rows for every attempted send **and** every intentional skip.
- **Doctor with no WhatsApp number:** do **not** send. Insert `sos_notifications` with `status = skipped`, `skip_reason = no_whatsapp_number`, `wa_message_id` NULL, `sent_at` NULL, `created_at = now()`. This is auditable and is **not** a delivery failure (W3 — intentional non-sends are logged as skips).
- **Optional-contact variable substitution (mandatory).** Templates 10, 11 and 12 reference the Doctor and the Local Buddy, both of which are `0..1` per elder. Meta requires **every** positional variable on **every** send; a parameter cannot be omitted. When the contact does not exist, WF-4 supplies the literal string **`NA`**:
  - `elderwise_sos_alert_ct` — `{{3}}` (Buddy), `{{4}}` (Doctor)
  - `elderwise_sos_alert_lct` — `{{4}}` (Doctor name), `{{5}}` (Clinic)
  - `elderwise_sos_alert_doctor` — `{{4}}` (Buddy name), `{{5}}` (Buddy number)

  **This is a send-time substitution. The database is never written with placeholder rows.** `LEFT JOIN` + `COALESCE(..., 'NA')` when building parameters. Creating `NA` rows in `doctors` / `local_caregivers` was considered and **rejected** (28 July 2026): an absent row is the signal WF-4 dispatch, `sos_notifications.skip_reason`, the conditional `consent_data_sharing_at`, the Care Circle screen, and A4 Decision 6 all depend on. **Do not create placeholder rows.**

  **Source note:** `{{5}}` and `{{7}}` come from **`whatsapp_number`**. A4 dropped `phone_number` from every table.
- **SOS report link — always mint (`{{3}}` of `elderwise_sos_alert_doctor`).** Ruled 28 July 2026 (mint at SOS time); **reuse-before-mint struck 3 August 2026** — impossible because `doctor_share_links` stores `token_hash` only (SHA-256); §7.3 / SEC2 state the raw token exists once, in the URL. A hash cannot be reversed into a link. Order of operations:
  1. **Always mint.** Generate ≥32 random bytes, store the SHA-256 hash, set `expires_at` to the §7.3 default of 30 days, set `created_by` to the elder's care partner, write with the service-role key. n8n **never** calls Next.js (P1).
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
- **Resolution — two paths, both must work (M14b):**
  1. **WhatsApp** — any recipient replies/taps to resolve → WF-2a → **WF-4b** → **WF-4c**.
  2. **Dashboard** — the CT (or Doctor via share link) resolves in the UI → a Next.js **route handler** writes `sos_events.status = 'resolved'` **and then fires an authenticated webhook to n8n (WF-4a)** so the nudge loop stops immediately, with no polling delay. This is the one documented exception to P1 (§1), taken because on the SOS path latency is the harm.
     - The webhook carries a **shared-secret header**; n8n rejects any call without it.
     - It is fired **server-side only**, from a route handler — never from the browser, or anyone could resolve anyone's SOS.
     - **The webhook is an optimisation, not the mechanism.** See the safety net below.
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
- **Trigger:** sub-workflow (from WF-4b on WhatsApp resolution; also after dashboard resolution so both channels get the broadcast).
- Sends **template 14** (`elderwise_sos_resolved`) to every recipient that received a **`sent`** alert, on **both** channels. Previously nobody sent it: WF-4a verifies only, and Next.js cannot send WhatsApp (B3).
- **Guard:** a CTE SELECT returning zero rows emits `{success:true}`, so an **explicit gate sits before the send** (`Rules.md` §6a).
- **Known gap (A-18):** template 14 sends cannot be logged under current schema constraints — see §15.

### WF-4d · SOS Nudge Sweep (`EY36qDhdv5FqfL0W`) — **built 3 August 2026**
- **Trigger:** cron, every minute.
- Finds open SOS events due for the next nudge round; sends template **13** for `nudge_index` 1–3; increments `nudges_sent` (0–3). Max **3** nudge rounds, **2 minutes** apart. Re-reads `sos_events.status` before every send (safety net).
- **Must guard CTE-based SELECT results** (`Rules.md` §6a) — same zero-row `{success:true}` pattern as WF-4c; zero due rows must not run the WhatsApp node.
- **Postgres `connectionTimeout`:** `Find Due Nudge Recipients` is set to **20** seconds (OBSERVED 9 August 2026), raised from 10 after the connection-timeout failures of 8 August.

### WF-5 · Voice Reply → STT (`IC6oR4fuQd2VMkfQ`) — **built 4 August 2026**

- **Trigger:** sub-workflow (from WF-2a `voice_note` route). **`waitForSubWorkflow: false`** on the WF-2a call.
- **Ordering constraint (load-bearing):** **Resolve Check-in runs before any media fetch.** An elder with no open check-in never has audio downloaded or stored. That ordering — not the WF-2a consent gate alone — is the real safeguard. Reordering would remove the protection silently (`Rules.md` §6a).
- **Idempotency (A-25, closed 8 August 2026).** `media_id` is the dedup key, checked at three layers. **(1) Early exit:** `Already Processed?` (`SELECT EXISTS`, `alwaysOutputData: true`) → `New Delivery?` sits between `Open Check-in Found?` and `Get Media URL`; a redelivery terminates at the `Duplicate Delivery - Ignored` NoOp before any Meta media fetch, storage write, or Whisper call. **(2) Insert dedup:** `Record Voice Reply` carries `ON CONFLICT (media_id) WHERE media_id IS NOT NULL DO NOTHING`; a conflict returns zero rows and the existing `Voice Reply Stored?` guard halts the chain, so no duplicate CT notification. **(3) Deterministic object key:** the upload path ends in `{media_id}.ogg` with an `x-upsert: true` header, so a concurrent race overwrites rather than 409s or orphans.
- **Chain:** WhatsApp `mediaUrlGet` → authenticated HTTP download → upload to private Supabase bucket **`voice-notes`** (25 MB max, MIME-restricted to audio types) → **OpenAI Whisper** → LLM gate returning `yes` | `no` | `unclear`.
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
| **Object path** | `{elder_id}/{checkin_id}/{media_id}.ogg` |
| **`voice_replies.audio_path`** | Bucket-prefixed key — **never a URL**; signed URLs on demand |

### WF-6 · Care Partner Notifications (All Domains) (`6I6OC7qJ5YhhUQxU`)
- **Trigger:** sub-workflow (from WF-3a / WF-3c / WF-3d / **WF-5**).
- **Authoritative setting:** the owning routine's `notify_care_partner` (`every_time` | `only_missed` | `not_required`) — read **per domain via check-in FKs** (`checkin_medication_items` → `medications`; `food_routine_id` → `food_routines`; `health_routine_id` → `health_routines`). **Do not** `LEFT JOIN medications` alone for all domains (defect fixed 3 Aug 2026).
- **`not_required`:** send **nothing** — no confirmation and no missed-routine WhatsApp. The check-in miss is still written to the DB and visible on the dashboard. Do not escalate a mute into a silent workflow failure.
- **`every_time`:** send template 8 (`elderwise_ct_interaction_notice`) on a recorded response.
- **`only_missed`:** send on miss (template 9). **Deviation, ruled by Talal 3 August 2026:** `only_missed` **also** notifies when `response_value = 'some_of_them'`, on the grounds that a partial dose is closer to a miss than to a clean yes. **This departs from the literal reading of `only_missed`.** Do not "fix" it back without a new ruling.
- **Period labels** for template `{{2}}` (`Morning` / `Afternoon` / `Evening` / `Night`): derived from the routine's local time in the elder's zone — **< 12:00 Morning**, **< 17:00 Afternoon**, **< 21:00 Evening**, else **Night**. Implemented 3 Aug 2026; **Sama has not signed off the wording** (A-11 closed as implemented, wording pending).
- **`domain_configs.ct_notification` is derived/deprecated** — do not use it as the send decision. WF-6 never depended on it (A-9 closed).
- On send: write `ct_notifications` with `wa_message_id`. Templates **8** and **9** only in this workflow.
- **WhatsApp only** in the MVP. SMS / email / push are Could-have (C8).

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
| Check-in not sent within ±5 min (**P1**) | **Nothing** — see A-30 |
| `/api/sos/resolve` or `/api/sos/trigger` failure (**P1**, SOS path) | **Sentry** |
| CT notification failure (**P2**) | n8n error workflow |
| Dashboard errors (**P2**) · report generation (**P3**) | **Sentry** |

> **Known limitation — a check-in that was never sent is still swept to `missed`, and the Care Partner is still notified (D-9, accepted 10 August 2026).** WF-3c transitions on elapsed schedule alone; it does not consult `sent_at`. WF-6 then sends `elderwise_ct_missed_notice`, whose approved body asserts "We sent a reminder and haven't heard back" as fixed template copy. Where a dispatch failed, that statement is false and the adherence record is wrong. Observed 9–10 August 2026 across eight medication check-ins during a Meta template review. The cause is not template-specific: rate limiting, a rotated credential, an invalid handset number, or the WhatsApp account itself going down (R1 / A-5) produce the same state. **Accepted for the MVP** — WF-3c is the sole owner of the `missed` transition, no terminal state is defined for a never-sent check-in, and the remedy carries more risk than the defect while the test run is incomplete. Deferred as **PD-10** (suppress the notice in WF-6) and **PD-11** (record the failure cause, which A-30 also needs).

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
| OpenAI / STT keys | n8n credentials | client-side |
| Doctor share tokens | Hashed in the DB; raw token exists only in the URL | Stored raw. Ever. |

### 12.5 Security posture (as built)

- **The service-role key appears in exactly one Next.js module:** `src/lib/supabase/admin.ts`, imported only by the doctor share-link server paths. Every other app data path uses the anon key with the user's session so RLS applies. (n8n still holds the service-role key as trusted infrastructure — unchanged from §6.)
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

Items deferred to after Demo Day (29 August 2026) are held in **`PostDemoEnhancements.md`**, with the reasoning for each deferral. Items **A-33** and **A-23** appear there as **PD-6** and **PD-8**; they remain open here and are not closed by being scheduled. **PD-9** (Google OAuth / D-8), **PD-10** and **PD-11** (never-sent check-ins / D-9; feeds a real A-30 detector) are also recorded there.

| # | Item | Owner |
|---|---|---|
| A-1 | ~~**STT provider** — Google Speech-to-Text vs ElevenLabs.~~ — **CLOSED 2 August 2026 by Talal:** **OpenAI Whisper** (OpenAI transcription API). Rationale in §3. | Closed |
| A-2 | ~~**Re-ask gate (FR-RH-2a).**~~ — **RESOLVED 3 August 2026.** Gate is decided: WF-5's OpenAI answer-derivation step returns `{"answer": "yes"|"no"|"unclear"}`; anything other than a clean yes/no triggers the single re-ask (P3). `voice_replies.confidence` may hold `avg_logprob` as a diagnostic but **must not** be the gate. Exact prompt text is a build-time detail for WF-5, not an open architectural decision — write it during the WF-5 build. | Resolved (prompt: Talal during WF-5) |
| A-3 | **Demo-day readiness checklist** (replaces the old "availability target"): Meta templates approved · n8n instance up · **Supabase project not paused** (free-tier projects auto-pause after inactivity — this alone can kill the demo) · WhatsApp account healthy · full end-to-end rehearsal · a rehearsed fallback if a live message does not land on stage. | Talal |
| A-4 | ~~How WF-4 observes a dashboard-side SOS resolution~~ — **RESOLVED 14 Jul: authenticated webhook from the Next.js route handler → n8n** (fast path), **plus a status re-check before every nudge** (safety net). No polling, no Realtime subscription. | Closed |
| A-5 | **WhatsApp backup account** — R1 is currently unmitigated. | Talal |
| A-6 | Confirm all 10 members have GitHub accounts (blocks branch assignment). | Talal |
| A-7 | ~~**Dev project test accounts** — clean up before Demo Day.~~ — **CLOSED 26 Jul 2026.** Discharged by **Phases.md A4.0** (full public-table + Auth wipe at the start of the A4 migration window), which supersedes ad-hoc account cleanup. | Closed |
| A-8 | **A3.5 rate limiting is implemented but INACTIVE** — `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not configured on Vercel, so the limiter no-ops in Production. Fail-open by design, so nothing appears broken. | Talal |
| A-9 | ~~**Track B — WF-6 notify authority**~~ — **CLOSED 3 August 2026.** WF-6 (`6I6OC7qJ5YhhUQxU`) was built fresh reading the owning routine's `notify_care_partner` from the start. The `domain_configs.ct_notification` dependency never existed in the built system. | Closed |
| A-10 | ~~**Template 12 `elderwise_sos_alert_doctor` PENDING.**~~ — **CLOSED 2 August 2026.** Approved by Meta, verified via Graph API; recorded in `Templates.md` v1.6 (OT-8 closed). **All 14 templates approved.** | Closed |
| A-11 | ~~**Period label derivation (B-3)**~~ — **CLOSED 3 August 2026 (implemented):** `< 12:00 Morning`, `< 17:00 Afternoon`, `< 21:00 Evening`, else `Night`, derived from the routine's local time in the elder's zone (WF-6). **Sama has not signed off the wording.** | Closed (wording: Sama) |
| A-12 | **Some of them does not capture which medicines were taken** — scope reduction 3 Aug 2026. Reply = `response_value = 'some_of_them'`, `status = responded`, CT notified. `checkin_medication_items` populated only on *Yes, All*. Native WhatsApp node has no interactive-list type; raw Graph HTTP ruled out. | Talal |
| A-13 | ~~**`domain_configs` row count**~~ — **CLOSED 3 August 2026 (non-issue).** Missing rows were never why food and health were silent. `domain_configs` is a derived cache; **`routine.enabled` is authoritative**. All three rows now exist from normal use. | Closed |
| A-14 | **n8n SOS webhook secret is readable in plaintext in n8n execution history.** | Talal |
| A-15 | ~~**Elder timezone / number mismatch.**~~ — **CLOSED 3 August 2026.** The live elder record is a test persona operated by Talal on a second handset he holds. The Pakistani `+92` number and the `Asia/Riyadh` timezone are both correct and both his; the handset is physically in Riyadh. No scheduling error exists. | Closed |
| A-16 | ~~**Health and food domains unbuilt.**~~ — **CLOSED 3 August 2026 (evening).** All three care domains built and verified on real WhatsApp (health 19:15, food 19:30, `No` → `responded` / `response_value = 'no'`, CT interaction notice naming "Dinner" one second later). | Closed |
| A-20 | **`message_templates` table is stale and disagrees with Meta.** Lists `elderwise_sos_alert_ct` with 2 variables where Meta has 4, `_lct` with 2 where Meta has 5, and `_doctor` with 2 where Meta has 7. Nothing reads it today, but it will eventually give someone a confident wrong answer. Reconcile against the Graph API or drop the table. | Talal |
| A-21 | ~~**Two onboarding write paths disagree on `frequency`.**~~ — **CLOSED 3 August 2026 (evening).** Dashboard upserts aligned to `"daily"` to match onboarding writers. | Closed |
| A-17 | **Raw doctor share tokens are stored in plaintext in n8n execution history.** WF-4 returns the raw token from Postgres to build the URL, so it is readable by anyone with instance access, who can then open the patient report. Same class as A-14. | Talal |
| A-18 | **Template 14 sends cannot be logged, so W3 cannot be satisfied for the resolution broadcast.** `sos_notifications` is constrained to `nudge_index` 0–3 for alerts and nudges; `ct_notifications.type` is `interaction \| missed` only. There is no table that can hold a resolution-broadcast send. Needs a schema decision or a recorded acceptance. | Talal |
| A-19 | **The n8n error workflow forwards raw error content to Telegram and Gmail.** It interpolates `execution.error.message` and `error.messages[0]`, which on the SOS path can carry query parameters including phone numbers and record IDs. X9 requires scrubbing before error reporting is switched on. Raise at Security Gate Pass 2. | Talal |
| A-22 | **Voice upload uses service-role key via n8n Header Auth**, bypassing RLS on an instance shared with ~26 personal workflows. Pass 2 item alongside A-14 and A-17. | Talal |
| A-23 | **Audio retention undecided.** Proposed 30 days; nothing currently deletes objects in `voice-notes`. | Talal |
| A-24 | **`consent_confirmed_at` covers daily check-ins, not storing recordings of the elder's voice.** Separate consent may be needed for voice retention — undecided. | Talal |
| A-25 | ~~**WF-5 is NOT idempotent.**~~ — **CLOSED 8 August 2026.** `voice_replies.media_id` + partial unique index (applied by Talal); WF-5 gained a three-layer dedup — early exit before any media fetch, `ON CONFLICT` on insert, and a deterministic `{media_id}.ogg` object key with `x-upsert`. Published as `activeVersionId 83a6a60e` and verified against the live workflow. | Closed |
| A-26 | ~~**Voice note with no open check-in is silent to the elder.**~~ — **CLOSED 8 August 2026** (Claude / Track B, F-7): WF-5 sends a reply on the no-open-check-in path. | Closed |
| A-27 | **The ≤60 s window.** WF-3a, WF-3d and WF-5 resolve check-ins by elder + status and do **not** filter on routine `enabled`. Between a routine being disabled and WF-3c cancelling the orphan, a reply is still accepted. **ACCEPTED DEVIATION** (Talal, 4 Aug 2026) — closing it would require a slot-match join in three resolvers for a one-minute window. | Talal |
| A-28 | **`checkins_medication_slot_uniq` slot occupancy.** `UNIQUE (elder_id, scheduled_for) WHERE domain = 'medication'`. A **`cancelled` row still occupies its slot**, so disabling and re-enabling a routine the same day will **not** restore that day's check-in. Ruled acceptable; recorded so it is not rediscovered as a bug. | Talal |
| A-29 | **Frontend `statusBreakdown` divergence + raw labels.** `report-analytics.ts` counts `cancelled` explicitly; `dashboard-analytics.ts` drops it (its `Record<string, number>` has no else branch for `cancelled`). Same concept, different behaviour on two screens. Share page and PDF render the raw lowercase DB status `cancelled` rather than a formatted label. **`adherence()` in both files** builds numerator and denominator from an explicit inclusion filter (`taken \| missed \| delayed`) — **`cancelled` is excluded from both automatically**; left deliberately unchanged (commit `25114ed`). | Talal |
| **A-30** | **The ±5-minute dispatch P1 is reported by nothing.** A late or never-sent check-in is not a node error, so the n8n error workflow never fires, and Next.js cannot see it. §11 lists it as P1 and nothing satisfies that. Pre-dates this ruling; made visible by it. Needs a detector or a recorded acceptance. | Talal |
| **A-31** | **n8n → Sentry deferred (4 Aug 2026).** One HTTP Request node on `uvBstI6J42nNhIYz` would put every Track B failure into Sentry with severity from the failing workflow's name. Deferred as unnecessary at current volume. If revisited: the DSN lives in an n8n **header-auth credential**, never in a node URL — the hourly export strips credentials, not URLs, and a DSN in a URL reaches the public repo within the hour. Payload must be a hand-built envelope (workflow name, node name, execution ID, timestamp, error class) — **never** `execution.error.message`, which is A-19. | Talal |
| A-32 | ~~**`middleware.ts` has never run in production.**~~ — **CLOSED 8 August 2026 by Talal Baig.** Moved to `src/middleware.ts`. **Both verification checks passed**, including check 2 — the 70-minute tab-close test confirming a session survives access-token expiry. (Originally: root placement under a `src/` project left `.next/server/middleware-manifest.json` empty, so `supabase.auth.getUser()` session refresh never ran; newly runs on `/share/[token]` as well.) | Talal |
| **A-33** | **Redelivery after check-in closure produces a spurious elder message.** The A-25 early exit sits *after* `Resolve Check-in`. If a redelivery arrives once the original check-in has already closed, `Resolve Check-in` returns zero rows, `Open Check-in Found?` goes false, and the elder receives the no-open-check-in reply (A-26) instead of silent suppression — the dedup is never consulted on that path. Fix would be to move `Already Processed?` ahead of `Resolve Check-in`, directly after `Valid media_id?`; the node depends only on `media_id` from the trigger, so it does not need check-in context. Costs one more SDK cycle and another HTTP credential re-bind. **P3 — a confusing message, not data corruption.** | Talal |
| E3 | ~~Something auto-commits `chore(n8n): export N workflow(s)` to `main` outside the docs-first flow.~~ — **CLOSED 9 August 2026. Not a defect.** Identified as a deliberate hourly export cron on the Contabo VPS. Ruled by Talal: leave as is. Documented in §12.1. | Closed |
| D2 | ~~Prove the Sentry alert rule fires.~~ — **CLOSED 8 August 2026.** A real alert was received and confirmed by Talal. | Closed |

---

## 16. Change log

| Date | Version | Change |
|---|---|---|
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
