# ElderWise — Architecture

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Programme** | AI Generalist Fellowship (AIGF) — Outskill, Cohort 7 · Capstone Project |
| **Team** | Group 7 (11 members) · Team Lead: Talal Baig |
| **Document** | Architecture.md — v1.14 |
| **Date** | 3 August 2026 |
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
| **P5** | **Build the simplest thing that satisfies the PRD.** ElderWise is an 11-person team on a 6-week clock. Every layer of indirection is a layer someone has to debug at 2am in a different timezone. |

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

**The critical read:** n8n and Next.js **never call each other**. Both talk to Supabase. This means the message-path team and the dashboard team can work in parallel without blocking, which is the whole point given 11 distributed people and a hard deadline.

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

This is written down explicitly because a team of 11 reading "RAG" in the flow diagram will otherwise go and build one. Do not build one. If a genuine semantic-retrieval need appears later (e.g. searching a corpus of voice-journal entries — a Could-have), it will be introduced deliberately, not by accident.

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

**`domain_configs`** — exactly three rows per elder: `medication`, `health`, `food`. **This is where "configurable per EP, per domain" lives.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum(`medication`,`health`,`food`) | UNIQUE with `elder_id` |
| `enabled` | boolean | the Enable toggle |
| `frequency` | jsonb | **Derived field** — the sorted union of times from routines that are both active (medications) / enabled and whose domain is enabled, refreshed on every routine write. Direct edits are overwritten on the next routine save. Shape e.g. `{"times": ["08:00","20:00"]}` (local times in the elder's tz). No fixed 3×/day (FR-ON-4). |
| `ct_notification` | enum(`every_interaction`,`only_missed`,`not_required`) | **Derived / deprecated (A4).** Not authoritative for Track B. Kept in sync from routine rows for backward compatibility until Robert removes the WF-6 dependency — see Track B action below. |
| `escalate_to` | enum(`care_partner`) | Only the CT escalates. LCT/Doctor are SOS-only. Enum kept for v2 headroom. |

> **A4 resolution — notify authority:** For medication, food, and health, **`notify_care_partner` on the routine row is authoritative** (`every_time` \| `only_missed` \| `not_required`). `domain_configs.ct_notification` is **derived/deprecated** — application may mirror a summary value, but n8n **must not** use it as the send decision. **Track B action (Robert):** update WF-6 (and any related branches) to read the owning routine's `notify_care_partner`, including `not_required` = total silence (no confirmation and no missed push; miss still recorded on the dashboard).

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
| `days_of_week` | text[] | **Unused** — not collected (see §5.6). |
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
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `meal_name` text · `meal_type` enum(**unused** — §5.6) · `check_in_time` time (local) · `start_date` date NOT NULL (app supplies **today in the elder's timezone**) · `end_date` date null (no longer collected — open-ended) · `days_of_week` text[] (**unused**) · `frequency` enum(**unused**) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 45) · `notes` text (**unused**) |

**`health_routines`** — one row per wellness check-in (FE `HealthRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `name` text · `type` enum(**unused** — §5.6) · `frequency` enum(**unused**) · `time` time (local) · `start_date` date NOT NULL (today in elder tz) · `end_date` date null (open-ended) · `days_of_week` text[] (**unused**) · `question` text (**unused**) · `answer_type` enum(**unused**) · `notify_care_partner` enum(`every_time`,`only_missed`,`not_required`) · `escalation_minutes` int (default 60) · `typical_bedtime` time null (**unused**) · `typical_wake_time` time null (**unused**) |

> **Escalation defaults differ by domain in the front end** (medication 30 min, food 45, health 60). These are **defaults**, editable per routine. The old blanket "30 across the board" is superseded.

> **Column asymmetry:** `medications` has both `active` and `enabled`; `food_routines` and `health_routines` have only `enabled`, so “pause” and “delete” are the same state for those two.

**`checkins`** — one row per scheduled check-in occurrence. The heart of the system.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum | |
| `scheduled_for` | timestamptz | Computed from `domain_configs.frequency` + elder tz → UTC. |
| `sent_at` | timestamptz | Must land within **±5 min** of `scheduled_for` (NFR-6). |
| `status` | enum(`scheduled`,`sent`,`reminded`,`responded`,`missed`) | |
| `response_channel` | enum(`button`,`voice`) | nullable |
| `response_value` | text | `yes` / `no` — for health & food |
| `responded_at` | timestamptz | |
| `reminder_sent_at` | timestamptz | the single 30-min resend |
| `missed_at` | timestamptz | |
| `escalated_at` | timestamptz | |
| `wa_message_id` | text | Meta's message ID — the join key for inbound webhooks |

Index: `(elder_id, domain, scheduled_for)` and `(status, scheduled_for)` — the reminder sweep depends on the second.

**`checkin_medication_items`** — supports the **dropdown** (M12): the EP selects *which* medicines were taken.

| Column | Type |
|---|---|
| `id` uuid PK · `checkin_id` uuid FK · `medication_id` uuid FK · `taken` boolean |

**`voice_replies`** — audio **and** transcript, both retained (M4a).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `checkin_id` | uuid FK | |
| `audio_path` | text | Supabase Storage object path — **never the file itself in a column** |
| `transcript` | text | |
| `confidence` | numeric | **Diagnostic only** — may hold Whisper `avg_logprob`. **Must not** gate the re-ask (see A-2 / WF-5). |
| `provider` | text | `openai_whisper` (column stays `text` — no enum migration) |
| `reask_count` | integer | default 0, max 1 |
| `created_at` | timestamptz | |

**`sos_events`**

> **SOS has two layers — do not confuse them.** See WF-4 and `Architecture.md` §5.5. **`sos_events.status` (`open` \| `resolved`) is the source of truth** for dispatch. Front-end SOS states (`active` \| `acknowledged` \| `resolved` \| `cancelled`) and the sequential demo cascade are a **display mapping** only — not a second workflow.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `triggered_at` | timestamptz | |
| `status` | enum(`open`,`resolved`) | **Exhausting all 4 nudges does not resolve it** — it stays `open` (FR-SOS-3c). |
| `nudges_sent` | integer | 0–4 |
| `resolved_by_role` | enum(`care_partner`,`local_caregiver`,`doctor`) | nullable |
| `resolved_by_id` | uuid | nullable |
| `resolved_channel` | enum(`whatsapp`,`dashboard`) | **Both paths must work** (M14b) |
| `resolved_at` | timestamptz | |

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
| `skipped` | *(no dedicated backend status)* | UI-only / future. Do not invent a schema value in this doc pass. |

Negative or partial medication answers that still count as a recorded response remain backend `responded`, with detail in `response_value` / `checkin_medication_items` — the UI may show a non-`taken` label for those cases without changing the backend enum.

### SOS status — display vs dispatch

| Layer | States / behaviour | Authority |
|---|---|---|
| **Display (front end)** | `active` \| `acknowledged` \| `resolved` \| `cancelled`; sequential visual cascade (Loved One → Care Partner → Local Buddy → Family Doctor) on a demo timer | Presentation only |
| **Dispatch (n8n / DB)** | `sos_events.status` = `open` \| `resolved`; parallel notify CT + LCT (if present) + Doctor (if present); 4 nudges, 2 min apart | **Source of truth** |

See WF-4 for the full dispatch rules. The display cascade must **not** replace Meeting-11 parallel dispatch.

### 5.6 Unused-column register (A4)

Columns that remain in the schema but are **not collected or relied on by product UI**. Do not treat them as live requirements. Prefer leaving them in place over drive-by drops unless a dedicated cleanup migration is approved.

| Table | Column(s) | Notes |
|---|---|---|
| `care_partners` | `address`, `secondary_contact` | Unused by any screen. |
| `elders` | `gender` | Collected nowhere. |
| `local_caregivers` | `action_plan` | Unused. |
| `medications` | `days_of_week` | Not collected by UI. |
| `food_routines` | `meal_type`, `frequency`, `days_of_week`, `notes` | Defaulted / unused. |
| `health_routines` | `type`, `frequency`, `days_of_week`, `question`, `answer_type`, `typical_bedtime`, `typical_wake_time` | Defaulted / unused. |

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
Supabase Auth — **email + password, and Google OAuth**. Session in an httpOnly cookie via the Supabase SSR client. `auth.uid()` is the root of every RLS policy.

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

**Nine n8n workflows** (as of the Track B build of **3 August 2026**). n8n constraints forced a split from the earlier six-/seven-workflow map: the Meta inbound webhook must stay on a thin shell, and response / reminder / missed work as separate cron or sub-workflows.

| Workflow | n8n ID | Trigger | Role |
|---|---|---|---|
| **WF-0** Consent Welcome Dispatch | `n1EcFnlIDRMB5MEi` | cron 5 min | Claims one elder awaiting welcome; sends `elderwise_ep_welcome` |
| **WF-1** Scheduler | `sqFa3XkYSEEVgPpC` | cron 1 min | Materialise then dispatch |
| **WF-2** Inbound Router | `oHSNqoskL0nOoOfo` | Meta webhook | **Thin router** — one Execute Sub-workflow node. Owns the Meta callback. |
| **WF-2a** Inbound Router (logic) | `Ne4rNaezpjn95UMM` | sub-workflow | All routing logic |
| **WF-3a** Response Handler | `j0CWtHYyzplmad09` | sub-workflow | Records medication button replies |
| **WF-3b** Reminder Sweep | `5P19E5CPhA14K6fo` | cron 1 min | One reminder after `escalation_minutes` |
| **WF-3c** Missed Sweep | `A3Z7yjrxLRZ6pI5r` | cron 1 min | Marks missed; escalates to WF-6 |
| **WF-4a** SOS Resolution Receiver | `jeNrf7b7ne3JX2Xu` | webhook | A2.7 dashboard → n8n stop-nudges |
| **WF-6** CT Notification Dispatch | `6I6OC7qJ5YhhUQxU` | sub-workflow | Templates 8 and 9 |

**Not yet built (Track B remaining):** **WF-4** SOS orchestrator (dispatch + nudges) · **WF-5** voice → STT. Specs below still describe intended behaviour.

> **⚠️ SAFETY RULE — Why WF-2 is thin.** `update_workflow` via the n8n API **rotates a trigger node's `webhookId` on every call**. Editing WF-2 through the API would change the Meta callback URL and **silently stop all inbound WhatsApp**. **WF-2 is edited in the n8n UI only.** All routing logic lives in **sub-workflows** (WF-2a and downstream), which have no webhook and are safe to update programmatically. See `Rules.md` §6a.

### WF-0 · Consent / welcome dispatch (`n1EcFnlIDRMB5MEi`)
- **Trigger:** cron, every **5 minutes**.
- **Selects / claims** one elder where `active = true` AND `consent_requested_at IS NULL` AND `consent_confirmed_at IS NULL` AND `consent_declined_at IS NULL`, via **`UPDATE … RETURNING … FOR UPDATE SKIP LOCKED`** (claim-then-send).
- Sends the welcome / consent template (`elderwise_ep_welcome` — see `Templates.md`).
- **Ordering is claim-then-send**, not send-then-mark. Rationale: a failed send leaves one elder unwelcomed (visible, fixable); a failed mark after a successful send would re-send every cron tick to an elderly person and risk the single WhatsApp Business account (**R1**).
- **WF-1 is unchanged** and still gates only on `consent_confirmed_at`. WF-0 does not schedule check-ins.

### WF-1 · Scheduler (`sqFa3XkYSEEVgPpC`)
- **Trigger:** cron, every minute.
- **Consent gate — the first check, before anything else:** skip any elder whose `consent_confirmed_at` is NULL. **An elder who has not confirmed in-channel is never sent a check-in.** A Meta opt-in requirement, and an ethical one (§9). Unchanged by B1.5 / WF-0.
- Reads `domain_configs` where `enabled = true`, computes the next due occurrence per elder per domain **in the elder's IANA timezone**, and materialises a `checkins` row (`status = scheduled`).
- Dispatches the WhatsApp template, sets `status = sent`, `sent_at`, `wa_message_id`.
- **Dispatch bound:** send only while `now() <= scheduled_for + escalation_minutes`. Beyond that window the check-in is written **`missed`** rather than sent — template 2 embeds the scheduled time, and a late send would read as "it's 10:00 AM, time for your medicines" at 5pm (**T4/T5**).
- **Restart-safety** comes from the `scheduled` → `sent` state machine, **not** a catch-up window that would send stale templates.
- **Must land within ±5 minutes of `scheduled_for` when it does send** (NFR-6).

### WF-2 · Inbound Router — thin shell (`oHSNqoskL0nOoOfo`)
- **Trigger:** Meta WhatsApp Cloud API webhook. **Owns the Meta callback URL.**
- **UI-only edits.** Never update this workflow via the n8n API (webhookId rotation — see safety rule above).
- Contains **one Execute Sub-workflow** node that hands the payload to **WF-2a**. No routing logic here.

### WF-2a · Inbound Router (logic) (`Ne4rNaezpjn95UMM`)
- **Trigger:** sub-workflow (called by WF-2).
- Resolves the sender's number → `elders.whatsapp_number` (indexed).
- Routes on payload type:
  - **Welcome confirmation** → set `elders.consent_confirmed_at`. Until this exists, nothing else is ever sent.
  - **Welcome decline** → set `elders.consent_declined_at`. **Terminal:** never schedule, never re-ask. [TBD — Talal] exact button / payload match for decline if not already locked in the live workflow.
  - **Button reply** (health / food Yes-No; medication *Yes, All* / *Some of them* / *Not Yet*) → **WF-3a**
  - **Medication = "Some of them"** — **scope reduction, ruled by Talal 3 August 2026:** the free-form interactive medicine list (`Templates.md` §7.1) is **not built**. The reply is recorded as `response_value = 'some_of_them'`, `status = responded`, and the Care Partner is notified (via WF-6 — see below). **Known gap:** we do **not** capture which medicines were taken — `checkin_medication_items` is populated only on *Yes, All*. Reason: the native WhatsApp node has no interactive-list message type; delivering one requires raw HTTP to the Graph API, which the team has ruled against. See open item **A-12**.
  - **Voice note** → WF-5 (STT) — **not built yet**
  - **SOS trigger** → WF-4 — **checked first and short-circuits everything else** (P2) — **orchestrator not built yet**; resolution path uses **WF-4a**
  - **SOS resolution reply** (from CT / LCT / Doctor) → WF-4 / WF-4a as applicable
  - **Delivery-status callbacks** (`statuses`, no `messages`) — normal inbound traffic; handle, do not treat as errors (`Rules.md` §6a)
  - **Unrecognised** → a gentle, plain-language re-prompt. Never a silent drop; never an error message an elderly person has to interpret.
- **Button-text matching must be case- and punctuation-insensitive.** Quick-reply webhooks return the label verbatim, and the approved labels are not what was drafted: `Yes, All` (not `Yes, all`), `Not Yet` (not `Not yet`), and food check-ins use **`Yes` / `No`** (not `Yes` / `Not yet`). Critically, `elderwise_sos_alert_ct` uses **`I Am Responding`** while `elderwise_sos_nudge` uses **`I'm Responding`** — the same action, two strings. Normalise before routing: lowercase, strip apostrophes and punctuation, collapse whitespace. **Never compare raw strings.** A case-sensitive match here is a silently dropped SOS resolution. Exact labels are listed in `Templates.md` §3.2.
- **A `No` on a food or health check-in is a recorded negative response** (backend `responded`), **not** a missed check-in. Do not route it down the missed path.

### WF-3a · Response Handler (`j0CWtHYyzplmad09`)
- **Trigger:** sub-workflow (from WF-2a).
- **On response:** write to `checkins` (+ `checkin_medication_items` for medication when *Yes, All*), set `status = responded`.
- Fire **WF-6** when the owning routine's `notify_care_partner` requires a CT notice (see WF-6).

### WF-3b · Reminder Sweep (`5P19E5CPhA14K6fo`)
- **Trigger:** cron, every minute.
- Find `checkins` where `status = sent` and `now() > sent_at + escalation_minutes` (read from the **routine** that owns the check-in — per-medicine / per-food / per-health, default 30/45/60).
- Send **exactly one** reminder → `status = reminded`, set `reminder_sent_at`. Skip CT push paths when `notify_care_partner = not_required`.

### WF-3c · Missed Sweep (`A3Z7yjrxLRZ6pI5r`)
- **Trigger:** cron, every minute.
- Find `checkins` where `status = reminded` and the delay has elapsed again → `status = missed`, set `missed_at`.
- If `notify_care_partner ≠ not_required`, escalate to the **CT only** (LCT and Doctor are never contacted on a missed check-in) → fire **WF-6**. If `not_required`, record the miss and send nothing.

### WF-4 · SOS orchestrator — **the critical path (P2)** — **not yet built**

> **SOS has two layers — do not confuse them.**
>
> **(A) SOS display layer (front end / presentation only).** The dashboard UI may show states `active | acknowledged | resolved | cancelled` and a sequential visual cascade (Loved One → Care Partner → Local Buddy → Family Doctor) that advances on a demo timer. This is presentation for the care-partner portal and demo UX. It is **not** the dispatch algorithm.
>
> **(B) SOS dispatch logic (backend / n8n — actual behaviour).** On trigger, notify **CT + LCT (if present) + Doctor (if present) in parallel, immediately**; then **4 nudges, 2 minutes apart**, to every unresolved recipient; any of CT / LCT / Doctor may resolve via **WhatsApp or dashboard**; if all 4 nudges exhaust with no resolution, the event **stays open** (never auto-closes). This is the Meeting-11 decision and must be preserved.
>
> **Source of truth:** `sos_events.status` is `open | resolved`. Front-end SOS states are a **display mapping** over that (and demo cascade metadata), not a second workflow.

- **Trigger:** SOS from WF-2a. Runs **immediately**; must never wait behind routine traffic.
- Creates `sos_events` (`status = open`), resolves the elder's care circle via a **relational lookup** of CT + optional LCT + optional Doctor (§3.1 — not RAG).
- Fans out WhatsApp messages **in parallel** to every contact that exists: **CT always**; **LCT only if a `local_caregivers` row exists**; **Doctor only if a `doctors` row exists and `whatsapp_number` is non-null**. Writes `sos_notifications` rows for every attempted send **and** every intentional skip.
- **Doctor with no WhatsApp number:** do **not** send. Insert `sos_notifications` with `status = skipped`, `skip_reason = no_whatsapp_number`, `wa_message_id` NULL, `sent_at` NULL, `created_at = now()`. This is auditable and is **not** a delivery failure (W3 — intentional non-sends are logged as skips).
- **Optional-contact variable substitution (mandatory).** Templates 10, 11 and 12 reference the Doctor and the Local Buddy, both of which are `0..1` per elder. Meta requires **every** positional variable on **every** send; a parameter cannot be omitted. When the contact does not exist, WF-4 supplies the literal string **`NA`**:
  - `elderwise_sos_alert_ct` — `{{3}}` (Buddy), `{{4}}` (Doctor)
  - `elderwise_sos_alert_lct` — `{{4}}` (Doctor name), `{{5}}` (Clinic)
  - `elderwise_sos_alert_doctor` — `{{4}}` (Buddy name), `{{5}}` (Buddy number)

  **This is a send-time substitution. The database is never written with placeholder rows.** `LEFT JOIN` + `COALESCE(..., 'NA')` when building parameters. Creating `NA` rows in `doctors` / `local_caregivers` was considered and **rejected** (28 July 2026): an absent row is the signal WF-4 dispatch, `sos_notifications.skip_reason`, the conditional `consent_data_sharing_at`, the Care Circle screen, and A4 Decision 6 all depend on. **Do not create placeholder rows.**

  **Source note:** `{{5}}` and `{{7}}` come from **`whatsapp_number`**. A4 dropped `phone_number` from every table.
- **SOS report link — n8n mints it (`{{3}}` of `elderwise_sos_alert_doctor`).** Ruled 28 July 2026. n8n **never** calls Next.js (P1), so the app cannot be asked at dispatch time. Order of operations:
  1. **Reuse before mint.** If a `doctor_share_links` row exists for that elder with `revoked_at` NULL and `expires_at > now()`, use it. Fewer live credentials in circulation.
  2. **Otherwise mint.** Generate a ≥32-byte random token, store its **SHA-256** hash, set `expires_at` to the §7.3 default of 30 days, set `created_by` to the elder's care partner, write with the service-role key.
  3. **Never block the alert (P2).** If both reuse and mint fail, send the template with `{{3}} = NA` and log the failure at Sentry P1. **A doctor receiving the alert without a link is vastly better than no alert because a token insert timed out.** The SOS message is the product; the link is an enhancement.

  The link resolves to `https://elder-wise-seven.vercel.app/share/{token}` over HTTPS. The §7.3 click-through gate already protects it from WhatsApp's link-preview crawler, so delivering it over WhatsApp is safe.
- If no LCT is set, SOS is still handled by the CT (always present).
- **Nudge loop: 4 nudges, 2 minutes apart** (M7). Each nudge goes to every recipient who has not yet resolved **and** who has a sendable channel.
- **Resolution — two paths, both must work (M14b):**
  1. **WhatsApp** — any recipient replies/taps to resolve → WF-2a routes it here.
  2. **Dashboard** — the CT (or Doctor via share link) resolves in the UI → a Next.js **route handler** writes `sos_events.status = 'resolved'` **and then fires an authenticated webhook to n8n (WF-4a)** so the nudge loop stops immediately, with no polling delay. This is the one documented exception to P1 (§1), taken because on the SOS path latency is the harm.
     - The webhook carries a **shared-secret header**; n8n rejects any call without it.
     - It is fired **server-side only**, from a route handler — never from the browser, or anyone could resolve anyone's SOS.
     - **The webhook is an optimisation, not the mechanism.** See the safety net below.
- **Safety net — the database remains the source of truth.** Before sending **every** nudge, WF-4 re-reads `sos_events.status` and aborts if it is `resolved`. If the webhook is dropped, delayed, or n8n restarts mid-sequence, the loop still stops on its own. A missed webhook must never mean a resolved SOS keeps pinging the doctor.
- On resolution: stop all nudges, record `resolved_by_role`, `resolved_by_id`, `resolved_channel`, `resolved_at`.
- **If all 4 nudges are exhausted with no resolution:** the nudge sequence ends and the SOS **remains `open`** on the dashboard until a human resolves it. It does not auto-close. It does not disappear.
- **Do not** replace this parallel dispatch with the front-end sequential cascade. The cascade is display-only (§5.5).

### WF-4a · SOS Resolution Receiver (`jeNrf7b7ne3JX2Xu`) — **built (A2.7)**
- **Trigger:** webhook from Next.js `POST /api/sos/resolve` after the dashboard write commits.
- Header: `X-ElderWise-Signature`. Body: `{ "sos_event_id": "<uuid>" }`.
- **Verifies only** — never writes. Stops the nudge loop when `sos_events.status` is already `resolved`. Contract: `.env.example` / A2.7.

### WF-5 · Voice reply → STT — **not yet built**
- Download the audio from the Meta media endpoint → store in the Supabase Storage bucket → write `voice_replies.audio_path`.
- Transcribe via **OpenAI Whisper** (OpenAI transcription API) → store `transcript`, `provider = openai_whisper`. Optional: store Whisper `avg_logprob` in `confidence` as a **diagnostic only**.
- **Answer derivation (OpenAI):** return `{"answer": "yes"|"no"|"unclear"}` (medication multi-select path superseded by A-12 scope reduction — [TBD — Talal] for voice medication answers). **Any value other than a clean yes/no triggers the single re-ask (P3).** Do **not** gate on ASR confidence — OpenAI transcription does not return a usable confidence threshold for this purpose (A-2).
- **Hand a clean yes/no to WF-3a and treat it exactly as a button tap.** A voice reply is a first-class response (M4a).
- **Unclear → do not guess (P3).** Re-ask once, in plain language (`reask_count` → 1). If the second attempt also fails, the check-in follows the normal missed path. **Never infer "yes" on a medication question from muddy audio.**

### WF-6 · CT Notification Dispatch (`6I6OC7qJ5YhhUQxU`)
- **Trigger:** sub-workflow (from WF-3a / WF-3c).
- **Authoritative setting:** the owning routine's `notify_care_partner` (`every_time` | `only_missed` | `not_required`) on `medications` / `food_routines` / `health_routines`.
- **`not_required`:** send **nothing** — no confirmation and no missed-routine WhatsApp. The check-in miss is still written to the DB and visible on the dashboard. Do not escalate a mute into a silent workflow failure.
- **`every_time`:** send template 8 (`elderwise_ct_interaction_notice`) on a recorded response. [TBD — Talal] exact when interaction vs missed templates fire for every domain.
- **`only_missed`:** send on miss (template 9). **Deviation, ruled by Talal 3 August 2026:** `only_missed` **also** notifies when `response_value = 'some_of_them'`, on the grounds that a partial dose is closer to a miss than to a clean yes. **This departs from the literal reading of `only_missed`.** Do not "fix" it back without a new ruling.
- **Period labels** for template `{{2}}` (`Morning` / `Afternoon` / `Evening` / `Night`): derived from the routine's local time in the elder's zone — **< 12:00 Morning**, **< 17:00 Afternoon**, **< 21:00 Evening**, else **Night**. Implemented 3 Aug 2026; **Sama has not signed off the wording** (A-11 closed as implemented, wording pending).
- **`domain_configs.ct_notification` is derived/deprecated** — do not use it as the send decision.
- On send: write `ct_notifications` with `wa_message_id`. Templates **8** and **9** only in this workflow.
- **WhatsApp only** in the MVP. SMS / email / push are Could-have (C8).

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
| **Scheduling** | Every check-in fires in the **elder's** local time. `domain_configs.frequency` holds **local wall-clock times**; WF-1 converts to UTC at materialisation, using the IANA zone so DST is handled by the database, not by arithmetic. |
| **Display (dashboard)** | Every timestamp renders in the **viewer's** (CT) timezone. |
| **Share page + PDF** | No reliable "viewer session" timezone for the clinician. Both the doctor **share page** and report **PDF bodies** render in the **elder's** IANA zone (stated once in a header/banner). PDF “generated on” line renders in the **CT's** zone and is explicitly labelled. *(A4: removes the former exception that rendered the share link in `doctors.timezone`.)* |
| **Doctor WhatsApp messages** | Same rule: **elder's** IANA zone. `doctors.timezone` is no longer collected and **must not** be used by WF-4. Applies to `elderwise_sos_alert_doctor` `{{2}}`, and to nudge/resolved timestamps sent to the doctor. |
| **Local Buddy messages** | **Elder's** zone — the LCT has no timezone column and inherits the elder's by design. |
| **Care Partner messages** | **Care partner's** zone (`care_partners.timezone`). Applies to templates 8, 9, 10 and to nudge/resolved timestamps sent to the CT. |
| **CT timezone write rule** | `care_partners.timezone` is set on **INSERT only** and never overwritten on subsequent sign-in. Detected browser timezone seeds the row at creation; after that the stored value wins. Reason: overwriting discarded the CT's explicit Settings choice and shifted the whole dashboard for anyone signing in while travelling — the product's core scenario. |
| **Never** | Never store a UTC offset. Never do timezone maths with `+03:00` style offsets. Never assume the CT and the EP share a timezone — the entire premise of this product is that they don't. |

---

## 11. Observability & error handling

**Sentry**, on both the Next.js app and the n8n workflows, **weighted toward the SOS path** (P2).

| Severity | What it covers |
|---|---|
| **P0 — page someone** | Any failure in WF-4 (SOS). A dropped SOS is the worst thing this system can do. |
| **P1** | Check-in not sent within the ±5-minute window · inbound webhook failures · STT hard failures · **WF-0 welcome send failures** (an elder who never receives a welcome is never scheduled — a silent total failure for that family) |
| **P2** | CT notification failures · dashboard errors |
| **P3** | Report generation, cosmetic |

**Additional requirements:**
- **Every attempted WhatsApp send is logged with its `wa_message_id`**, or it is not sent. An unlogged message is an untraceable one.
- **Intentional non-sends** (e.g. doctor SOS nudge with no WhatsApp number; routine `notify_care_partner = not_required`) are **not** silent failures — they are either a logged `sos_notifications` skip row or a configured mute with a recorded miss on the dashboard (Rules.md W3).
- n8n workflows have explicit **error branches**. A failed node must not silently end an execution — least of all in WF-4.
- The SOS path must degrade loudly, never quietly.

---

## 12. Repository & environments

### 12.1 Monorepo layout

```
elderwise/
├── app/                     # Next.js (App Router) — dashboard + onboarding
│   ├── (auth)/              # landing, signup, signin
│   ├── (dashboard)/         # dashboard, care circle, SOS history,
│   │                        # voice journal, reports, settings
│   ├── share/[token]/       # doctor read-only view (server-side only)
│   └── api/                 # route handlers
├── supabase/
│   ├── migrations/          # SQL — schema + RLS policies
│   └── seed.sql
├── n8n/
│   └── workflows/           # Exported JSON (nine live workflows + remaining) — version-controlled; export script owns this tree
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   └── Phases.md
├── .cursor/
│   └── rules/               # shared Cursor rules — all 11 build to one standard
└── README.md
```

**n8n workflows are exported to JSON and committed.** A workflow that exists only in one person's n8n UI is not part of the product.

### 12.2 Branching
Branch per member → PR → merge to a stable `main` (Akhil's directive). `main` is always demo-able. **Prerequisite: all 11 members need GitHub accounts** (open item OQ-7).

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

---

## 14. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **One WhatsApp Business account, no backup** (NFR-13) | The entire demo dies with it | Start template approval early; consider a second account as insurance. **Currently unmitigated.** |
| R2 | **Meta template approval lead time** | Blocks all EP messaging | Submit in Sprint 3. Owner: Talal. |
| R3 | **STT accuracy on elderly speech** — accents, background noise, frailty | A voice reply is a Must-have; misreads are dangerous | P3: never guess; re-ask once on `unclear` from answer derivation; fall through to missed. Provider = OpenAI Whisper (A-1 closed 2 Aug 2026). |
| R4 | **SOS reliability** | The most severe failure class in the system | P2; Sentry P0; explicit error branches; SOS never queues behind routine traffic. |
| R5 | **11 distributed contributors, 6 weeks** | Merge chaos, inconsistent quality | Branch-per-member; shared `.cursor/rules`; the n8n/Next.js split (P1) lets both halves proceed in parallel. |
| R6 | **Timezone bugs** | Reminders fire at the wrong hour — a silent, humiliating failure in a demo | §10. IANA only, UTC storage, elder-tz scheduling. |
| R7 | **Scope creep** | Both mentors flagged feature overload as this team's main risk | Must-have only. Should/Could do not enter the MVP without a team-lead decision. |
| R8 | **Leaked-password protection is a Pro-plan feature** | Security advisor shows a permanent `auth_leaked_password_protection` WARN on free tier | **Knowingly accepted for MVP** (Dev and Prod free tier). Compensating control: password length and complexity configured in Auth settings. |
| R9 | **PDF script coverage is Latin + Devanagari only** | Arabic-script names render unjoined and mis-ordered | `@react-pdf/renderer` performs no bidirectional text or Arabic contextual shaping. **Accepted for MVP.** |

---

## 15. Open items

| # | Item | Owner |
|---|---|---|
| A-1 | ~~**STT provider** — Google Speech-to-Text vs ElevenLabs.~~ — **CLOSED 2 August 2026 by Talal:** **OpenAI Whisper** (OpenAI transcription API). Rationale in §3. | Closed |
| A-2 | **Re-ask gate (FR-RH-2a) — rewritten 2 Aug 2026.** Not an ASR confidence threshold (OpenAI transcription does not return one). WF-5's OpenAI answer-derivation step must return `{"answer": "yes"|"no"|"unclear"}`; any value other than a clean yes/no triggers the single re-ask (P3). `voice_replies.confidence` may hold `avg_logprob` as a diagnostic but **must not** be the gate. Exact derivation prompt / schema details: [TBD — Talal]. | Talal / Ferdous |
| A-3 | **Demo-day readiness checklist** (replaces the old "availability target"): Meta templates approved · n8n instance up · **Supabase project not paused** (free-tier projects auto-pause after inactivity — this alone can kill the demo) · WhatsApp account healthy · full end-to-end rehearsal · a rehearsed fallback if a live message does not land on stage. | Talal |
| A-4 | ~~How WF-4 observes a dashboard-side SOS resolution~~ — **RESOLVED 14 Jul: authenticated webhook from the Next.js route handler → n8n** (fast path), **plus a status re-check before every nudge** (safety net). No polling, no Realtime subscription. | Closed |
| A-5 | **WhatsApp backup account** — R1 is currently unmitigated. | Talal |
| A-6 | Confirm all 11 members have GitHub accounts (blocks branch assignment). | Talal |
| A-7 | ~~**Dev project test accounts** — clean up before Demo Day.~~ — **CLOSED 26 Jul 2026.** Discharged by **Phases.md A4.0** (full public-table + Auth wipe at the start of the A4 migration window), which supersedes ad-hoc account cleanup. | Closed |
| A-8 | **A3.5 rate limiting is implemented but INACTIVE** — `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not configured on Vercel, so the limiter no-ops in Production. Fail-open by design, so nothing appears broken. | Talal |
| A-9 | **Track B — WF-6 notify authority** — Robert: stop reading `domain_configs.ct_notification`; honour per-routine `notify_care_partner` including `not_required`. | Robert |
| A-10 | **Template 12 `elderwise_sos_alert_doctor` is PENDING with Meta.** The only unapproved template and the demo's SOS story depends on it. Check daily. If rejected, the SOS demo still runs on templates 10/11/13/14 with the doctor leg shown as a logged `skipped` row. | Talal |
| A-11 | ~~**Period label derivation (B-3)**~~ — **CLOSED 3 August 2026 (implemented):** `< 12:00 Morning`, `< 17:00 Afternoon`, `< 21:00 Evening`, else `Night`, derived from the routine's local time in the elder's zone (WF-6). **Sama has not signed off the wording.** | Closed (wording: Sama) |
| A-12 | **Some of them does not capture which medicines were taken** — scope reduction 3 Aug 2026. Reply = `response_value = 'some_of_them'`, `status = responded`, CT notified. `checkin_medication_items` populated only on *Yes, All*. Native WhatsApp node has no interactive-list type; raw Graph HTTP ruled out. | Talal |
| A-13 | **`domain_configs` currently holds one row for the live elder, not the three §5.2 requires** — whatever creates them is not creating all three. | [TBD — Talal] |
| A-14 | **n8n SOS webhook secret is readable in plaintext in n8n execution history.** | [TBD — Talal] |

---

## 16. Change log

| Date | Version | Change |
|---|---|---|
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

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 27 July 2026.*
