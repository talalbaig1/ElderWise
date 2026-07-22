# ElderWise — Architecture

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Programme** | AI Generalist Fellowship (AIGF) — Outskill, Cohort 7 · Capstone Project |
| **Team** | Group 7 (11 members) · Team Lead: Talal Baig |
| **Document** | Architecture.md — v1.3 |
| **Date** | 14 July 2026 |
| **Audience** | Development team, Cursor, Claude Code |
| **Companion docs** | `PRD.md` (v1.3) · `Rules.md` · `Phases.md` |

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
                                           │  Google STT / ElevenLabs │◀── n8n
                                           │  OpenAI                  │◀── n8n
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
| **Speech-to-text** | **Google Speech-to-Text** *or* **ElevenLabs** — final pick pending (OQ-5b) | Voice replies are Must-have (M4a) and must be transcribed accurately. **Whisper is explicitly not the choice.** |
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
  elders ───────┼── 1:1  ── local_caregivers
    │           ├── 0..1 ── doctors
    │           ├── 1:many ── doctor_share_links
    │           ├── 1:many ── medications
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
| `full_name` | text | |
| `email` | text | |
| `whatsapp_number` | text | E.164. No verification (NFR-11). |
| `phone_number` | text | |
| `timezone` | text | IANA, e.g. `Asia/Riyadh` |
| `address` | text | nullable |
| `secondary_contact` | jsonb | nullable (Settings) |
| `created_at` | timestamptz | |

**`elders`** — the Elderly Patient (EP). **One CT → many EPs.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `care_partner_id` | uuid FK → `care_partners.id` | **The isolation key.** |
| `first_name`, `surname` | text | |
| `gender` | text | |
| `whatsapp_number` | text UNIQUE | E.164. The inbound-webhook lookup key — **must be indexed**. |
| `timezone` | text | IANA. **All schedules fire in this timezone** (M14). |
| `address` | text **NOT NULL** | **Mandatory** (M17). The Local Caregiver's SOS message carries it — they exist to physically reach her. |
| `consent_attested_by_ct` | boolean | The CT's onboarding attestation (M16a). |
| `consent_attested_at` | timestamptz | |
| `consent_confirmed_at` | timestamptz | **The elder's in-channel confirmation** (M16b). **NULL ⇒ schedule nothing.** |
| `active` | boolean | |
| `created_at` | timestamptz | |

**`local_caregivers`** — LCT. SOS-only. **Inherits the elder's timezone** (no `timezone` column, by design).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK UNIQUE · `full_name` text · `whatsapp_number` text · `phone_number` text · `action_plan` text · `created_at` timestamptz |

**`doctors`** — optional, SOS-only + read-only dashboard.

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK UNIQUE · `full_name` text · `whatsapp_number` text · `phone_number` text · `address` text · `timezone` text · `approved_by_ct` boolean · `created_at` timestamptz |

**`doctor_share_links`** — tokenised read-only access (M15). No doctor account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | **Scoped to one elder.** |
| `token_hash` | text | Store a hash, never the raw token. |
| `created_by` | uuid FK → `care_partners.id` | |
| `expires_at` | timestamptz | nullable |
| `revoked_at` | timestamptz | nullable — revocation is a Must-have |
| `last_accessed_at` | timestamptz | |

**`domain_configs`** — exactly three rows per elder: `medication`, `health`, `food`. **This is where "configurable per EP, per domain" lives.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `domain` | enum(`medication`,`health`,`food`) | UNIQUE with `elder_id` |
| `enabled` | boolean | the Enable toggle |
| `frequency` | jsonb | **Fully configurable** (FR-ON-4). Local times in the elder's tz, e.g. `{"times": ["08:00","20:00"]}`. No fixed 3×/day. |
| `ct_notification` | enum(`every_interaction`,`only_missed`) | M6 |
| `escalate_to` | enum(`care_partner`) | Only the CT escalates. LCT/Doctor are SOS-only. Enum kept for v2 headroom. |

> **Reconciled with the front end (22 Jul):** the front end models **`escalationMinutes` and `notifyCarePartner` per individual routine** (per medication, per food routine, per health routine) — finer-grained than one setting per domain, and a genuine improvement. **We adopt the front-end model.** `reminder_delay_minutes` (default 30) and `notify_care_partner` therefore live on each routine row (`medications`, `food_routines`, `health_routines` below), **not** on `domain_configs`. `domain_configs` retains the domain-level `enabled` toggle and the shared `frequency`/`ct_notification` defaults, which individual routines may override.

**`medications`** — one row per medicine. Field names reconciled with the front-end `Medication` type (22 Jul).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `elder_id` | uuid FK | |
| `enabled` | boolean | per-medicine toggle (FE `enabled`) |
| `name` | text | brand name — generics differ by country |
| `dosage` | text | numeric-as-text, e.g. `500` |
| `dosage_unit` | text | e.g. `mg` (FE `dosageUnit`) |
| `times` | text[] | local wall-clock, elder tz |
| `days_of_week` | text[] | FE `daysOfWeek` |
| `start_date` | date | |
| `end_date` | date | nullable |
| `timing_preference` | enum(`before_food`,`after_food`,`no_preference`) | FE `timingPreference` |
| `instructions` | text | nullable |
| `notify_care_partner` | enum(`every_time`,`only_missed`) | **per-medicine** (M6) — FE `notifyCarePartner` |
| `escalation_minutes` | integer | **per-medicine**, default 30, min 5 max 240 (FE `escalationMinutes`) |
| `active` | boolean | |

**`food_routines`** — one row per meal check-in (FE `FoodRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `meal_name` text · `meal_type` enum(`breakfast`,`lunch`,`dinner`,`snack`,`custom`) · `check_in_time` time (local) · `start_date` date · `end_date` date null · `days_of_week` text[] · `frequency` enum(`daily`,`weekly`,`custom`) · `notify_care_partner` enum · `escalation_minutes` int (default 45) · `notes` text |

**`health_routines`** — one row per wellness check-in (FE `HealthRoutine`).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `enabled` bool · `name` text · `type` enum(`sleep`,`blood_pressure`,`blood_sugar`,`water_intake`,`exercise`,`mood`,`weight`,`general_wellness`,`custom`) · `frequency` enum(`daily`,`every_2_days`,`weekly`,`custom`) · `time` time (local) · `start_date` date · `end_date` date null · `days_of_week` text[] · `question` text · `answer_type` enum(`yes_no`,`number`,`mood`,`short_text`) · `notify_care_partner` enum · `escalation_minutes` int (default 60) · `typical_bedtime` time null · `typical_wake_time` time null |

> **Escalation defaults differ by domain in the front end** (medication 30 min, food 45, health 60). These are **defaults**, editable per routine. The old blanket "30 across the board" is superseded.

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
| `confidence` | numeric | Drives the re-ask decision (FR-RH-2a) |
| `provider` | text | `google_stt` \| `elevenlabs` |
| `reask_count` | integer | default 0, max 1 |
| `created_at` | timestamptz | |

**`sos_events`**

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

**`sos_notifications`** — one row per (recipient × nudge).

| Column | Type |
|---|---|
| `id` uuid PK · `sos_event_id` uuid FK · `recipient_role` enum · `recipient_id` uuid · `nudge_index` int (0–3) · `wa_message_id` text · `sent_at` timestamptz · `delivered_at` timestamptz |

**`ct_notifications`** — the care-partner notification trail (Sukin's must-have).

| Column | Type |
|---|---|
| `id` uuid PK · `elder_id` uuid FK · `care_partner_id` uuid FK · `type` enum(`interaction`,`missed`) · `checkin_id` uuid FK nullable · `wa_message_id` text · `sent_at` timestamptz |

**`message_templates`** — per-domain WhatsApp copy (M11).

| Column | Type | Notes |
|---|---|---|
| `id` uuid PK · `elder_id` uuid FK **nullable** | | `NULL` = system default |
| `domain` enum(`medication`,`health`,`food`,`sos`) | | |
| `language` text | | `en` only in the MVP (NFR-9) |
| `meta_template_name` text | | The Meta-approved template it maps to |
| `body` text | | |

**`voice_journal_entries`** — **hard-coded demo placeholder only** (FR-DB-6). Table exists so the screen has a shape to render; it is **not populated by the live message path** in the MVP.

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

- CT issues the link from the Care Circle screen → a cryptographically random token is generated, **hashed**, and stored in `doctor_share_links`. The raw token is shown **once** and lives only in the URL.
- The doctor opens `/{share}/{token}`. A Next.js **server component / route handler** hashes the incoming token, looks it up, rejects if revoked or expired, and renders a read-only view of that one elder.
- **All data fetching for this route happens server-side.** No Supabase client is ever handed to the doctor's browser.
- CT can revoke at any time — sets `revoked_at`, and the link dies on the next request.

---

## 8. The message path (n8n)

Six workflows. Each is a separate n8n workflow so they can be built, tested, and broken independently.

### WF-1 · Scheduler
- **Trigger:** cron, every minute.
- **Consent gate — the first check, before anything else:** skip any elder whose `consent_confirmed_at` is NULL. **An elder who has not confirmed in-channel is never sent a check-in.** A Meta opt-in requirement, and an ethical one (§9).
- Reads `domain_configs` where `enabled = true`, computes the next due occurrence per elder per domain **in the elder's IANA timezone**, and materialises a `checkins` row (`status = scheduled`).
- Dispatches the WhatsApp template, sets `status = sent`, `sent_at`, `wa_message_id`.
- **Must land within ±5 minutes of `scheduled_for`** (NFR-6). A one-minute cron gives ~4 minutes of headroom for retries.

### WF-2 · Inbound webhook router
- **Trigger:** Meta WhatsApp Cloud API webhook.
- Resolves the sender's number → `elders.whatsapp_number` (indexed).
- Routes on payload type:
  - **Welcome confirmation** (the elder's first-ever response) → set `elders.consent_confirmed_at`. Until this exists, nothing else is ever sent.
  - **Button reply** (health / food Yes-No; medication *Yes, all* / *Some of them* / *Not yet*) → WF-3
  - **Medication = "Some of them"** → the 24-hour window is now open → send a **free-form interactive list** of that elder's medicines for multi-select → WF-3
  - **Voice note** → WF-5 (STT)
  - **SOS trigger** → WF-4 — **checked first and short-circuits everything else** (P2)
  - **SOS resolution reply** (from CT / LCT / Doctor) → WF-4
  - **Unrecognised** → a gentle, plain-language re-prompt. Never a silent drop; never an error message an elderly person has to interpret.

### WF-3 · Response handler, reminder & escalation
- **On response:** write to `checkins` (+ `checkin_medication_items` for medication), set `status = responded`. Fire WF-6 if the CT's config is `every_interaction`.
- **Reminder sweep (cron):** find `checkins` where `status = sent` and `now() > sent_at + escalation_minutes` (read from the **routine** that owns the check-in — per-medicine / per-food / per-health, default 30/45/60). Send **exactly one** reminder → `status = reminded`, set `reminder_sent_at`.
- **Missed sweep (cron):** find `checkins` where `status = reminded` and the delay has elapsed again → `status = missed`, set `missed_at`, run the escalation from `domain_configs` → **escalate to the CT only** (LCT and Doctor are never contacted on a missed check-in) → fire WF-6.

### WF-4 · SOS orchestrator — **the critical path (P2)**
- **Trigger:** SOS from WF-2. Runs **immediately**; must never wait behind routine traffic.
- Creates `sos_events` (`status = open`), resolves the elder's care circle (CT + LCT + Doctor) — **a relational lookup, not RAG** (§3.1).
- Fans out WhatsApp messages to all three in parallel; writes `sos_notifications` rows.
- **Nudge loop: 4 nudges, 2 minutes apart** (M7). Each nudge goes to every recipient who has not yet resolved.
- **Resolution — two paths, both must work (M14b):**
  1. **WhatsApp** — any recipient replies/taps to resolve → WF-2 routes it here.
  2. **Dashboard** — the CT (or Doctor via share link) resolves in the UI → a Next.js **route handler** writes `sos_events.status = 'resolved'` **and then fires an authenticated webhook to n8n** so the nudge loop stops immediately, with no polling delay. This is the one documented exception to P1 (§1), taken because on the SOS path latency is the harm.
     - The webhook carries a **shared-secret header**; n8n rejects any call without it.
     - It is fired **server-side only**, from a route handler — never from the browser, or anyone could resolve anyone's SOS.
     - **The webhook is an optimisation, not the mechanism.** See the safety net below.
- **Safety net — the database remains the source of truth.** Before sending **every** nudge, WF-4 re-reads `sos_events.status` and aborts if it is `resolved`. If the webhook is dropped, delayed, or n8n restarts mid-sequence, the loop still stops on its own. A missed webhook must never mean a resolved SOS keeps pinging the doctor.
- On resolution: stop all nudges, record `resolved_by_role`, `resolved_by_id`, `resolved_channel`, `resolved_at`.
- **If all 4 nudges are exhausted with no resolution:** the nudge sequence ends and the SOS **remains `open`** on the dashboard until a human resolves it. It does not auto-close. It does not disappear.

### WF-5 · Voice reply → STT
- Download the audio from the Meta media endpoint → store in the Supabase Storage bucket → write `voice_replies.audio_path`.
- Transcribe (Google STT or ElevenLabs) → store `transcript`, `confidence`, `provider`.
- Derive the answer (Yes / No, or the medicine selection) from the transcript, using OpenAI where a plain string match is insufficient.
- **Hand the answer to WF-3 and treat it exactly as a button tap.** A voice reply is a first-class response (M4a).
- **Low confidence → do not guess (P3).** Re-ask once, in plain language (`reask_count` → 1). If the second attempt also fails, the check-in follows the normal missed path. **Never infer "yes" on a medication question from muddy audio.**

### WF-6 · CT notification dispatch
- Sends the WhatsApp notification to the CT per `domain_configs.ct_notification` (`every_interaction` | `only_missed`).
- Writes `ct_notifications`.
- **WhatsApp only** in the MVP. SMS / email / push are Could-have (C8).

---

## 9. WhatsApp Business API

**Meta WhatsApp Cloud API, direct.** Not Twilio.

| Item | Detail |
|---|---|
| **Account** | One WhatsApp Business account (Talal's). **No backup exists — this is a single point of failure for the entire demo** (NFR-13). |
| **Templates** | All business-initiated (scheduled) messages **must** be Meta-approved templates. **Templates support only quick-reply, URL and phone-number buttons — max 3. They cannot carry an interactive list/dropdown.** *(Verified against Meta's live docs, 14 Jul 2026.)* |
| **The 24-hour window** | Once the user messages us, we may send **free-form** messages — **including interactive lists** — for 24 hours, **with no Meta approval needed**. This is how the medication dropdown is delivered: the template (3 buttons, every scheduled medicine named in the body) opens the window; the list follows only if she answers *Some of them*. |
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
| **Timezones held** | `elders.timezone`, `care_partners.timezone`, `doctors.timezone` — all **IANA** strings (`Asia/Kolkata`, not `+05:30`). |
| **LCT** | **Has no timezone column.** Inherits the elder's, by design. |
| **Scheduling** | Every check-in fires in the **elder's** local time. `domain_configs.frequency` holds **local wall-clock times**; WF-1 converts to UTC at materialisation, using the IANA zone so DST is handled by the database, not by arithmetic. |
| **Display** | Every timestamp renders in the **viewer's** timezone (the CT's on the dashboard; the doctor's on the share link). |
| **Never** | Never store a UTC offset. Never do timezone maths with `+03:00` style offsets. Never assume the CT and the EP share a timezone — the entire premise of this product is that they don't. |

---

## 11. Observability & error handling

**Sentry**, on both the Next.js app and the n8n workflows, **weighted toward the SOS path** (P2).

| Severity | What it covers |
|---|---|
| **P0 — page someone** | Any failure in WF-4 (SOS). A dropped SOS is the worst thing this system can do. |
| **P1** | Check-in not sent within the ±5-minute window · inbound webhook failures · STT hard failures |
| **P2** | CT notification failures · dashboard errors |
| **P3** | Report generation, cosmetic |

**Additional requirements:**
- **Every WhatsApp send is logged with its `wa_message_id`**, or it is not sent. An unlogged message is an untraceable one.
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
│   └── workflows/           # WF-1..WF-6 exported JSON — version-controlled
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

### 12.4 Secrets

| Secret | Lives where | Never |
|---|---|---|
| Supabase **service-role key** | n8n credentials + Vercel server env | **Never** in a browser, never in `NEXT_PUBLIC_*`, never in a client component |
| Supabase anon key | Vercel public env | (safe by design — RLS protects it) |
| Meta WhatsApp token | n8n credentials | anywhere else |
| **n8n SOS-resolution webhook secret** | Vercel server env + n8n | Never `NEXT_PUBLIC_*`; never client-side |
| OpenAI / STT keys | n8n credentials | client-side |
| Doctor share tokens | Hashed in the DB; raw token exists only in the URL | Stored raw. Ever. |

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
| R3 | **STT accuracy on elderly speech** — accents, background noise, frailty | A voice reply is a Must-have; misreads are dangerous | P3: never guess; re-ask once; fall through to missed. Provider pick still open (OQ-5b). |
| R4 | **SOS reliability** | The most severe failure class in the system | P2; Sentry P0; explicit error branches; SOS never queues behind routine traffic. |
| R5 | **11 distributed contributors, 6 weeks** | Merge chaos, inconsistent quality | Branch-per-member; shared `.cursor/rules`; the n8n/Next.js split (P1) lets both halves proceed in parallel. |
| R6 | **Timezone bugs** | Reminders fire at the wrong hour — a silent, humiliating failure in a demo | §10. IANA only, UTC storage, elder-tz scheduling. |
| R7 | **Scope creep** | Both mentors flagged feature overload as this team's main risk | Must-have only. Should/Could do not enter the MVP without a team-lead decision. |

---

## 15. Open items

| # | Item | Owner |
|---|---|---|
| A-1 | **STT provider** — Google Speech-to-Text vs ElevenLabs. Final pick. | Talal / Ferdous |
| A-2 | **STT confidence threshold** that triggers the single re-ask (FR-RH-2a). | Talal / Ferdous |
| A-3 | **Demo-day readiness checklist** (replaces the old "availability target"): Meta templates approved · n8n instance up · **Supabase project not paused** (free-tier projects auto-pause after inactivity — this alone can kill the demo) · WhatsApp account healthy · full end-to-end rehearsal · a rehearsed fallback if a live message does not land on stage. | Talal |
| A-4 | ~~How WF-4 observes a dashboard-side SOS resolution~~ — **RESOLVED 14 Jul: authenticated webhook from the Next.js route handler → n8n** (fast path), **plus a status re-check before every nudge** (safety net). No polling, no Realtime subscription. | Closed |
| A-5 | **WhatsApp backup account** — R1 is currently unmitigated. | Talal |
| A-6 | Confirm all 11 members have GitHub accounts (blocks branch assignment). | Talal |

---

## 16. Change log

| Date | Version | Change |
|---|---|---|
| 22 Jul 2026 | 1.3 | **Reconciled with Sama's front-end build.** Adopted the front end's **per-routine** escalation/notification model (finer-grained than per-domain) — `escalation_minutes` + `notify_care_partner` now live on `medications`, `food_routines`, `health_routines` (defaults 30/45/60), not on `domain_configs`. Expanded the three routine tables to match the front-end types exactly. Added §5.3 (front-end ↔ schema naming map: Loved One=EP, Care Partner=CT, Local Buddy=LCT, Family Doctor=DR) and §5.4 (v2/Could-have front-end stubs the MVP backend must NOT build: extra notification channels, voice-journal AI fields, quiet hours, rich health answer types). |
| 14 Jul 2026 | 1.2 | Meta platform rules verified against live docs. `elders` gains **`address` (NOT NULL)**, **`consent_attested_by_ct` / `consent_attested_at`**, **`consent_confirmed_at`**. **WF-1 now gates on consent** — NULL means nothing is ever scheduled for that elder. WF-2 routes the welcome confirmation and the medication *Some of them* → free-form interactive list. §9 records that templates cannot carry a list, that the 24-hour window can, and that Meta requires recipient opt-in. WhatsApp Flows logged as a v2 path, explicitly not now. |
| 14 Jul 2026 | 1.1 | SOS dashboard-resolution mechanism settled: **authenticated server-side webhook, Next.js → n8n** (fast path) **plus a `sos_events.status` re-check before every nudge** (safety net; the DB remains the source of truth). Recorded as the single documented exception to P1. A-3 reframed from an availability target to a demo-day readiness checklist. |
| 14 Jul 2026 | 1.0 | Initial architecture. Decisions taken: **Meta WhatsApp Cloud API direct** (not Twilio); **OpenAI** for LLM; **n8n owns the entire message path, Next.js owns the dashboard, they meet only at the database**; **n8n cron is the only scheduler** (no pg_cron); **no RAG / pgvector anywhere** — the "RAG" in the team's flow diagrams was a naming slip for a relational lookup, now formally corrected; **Supabase Auth with email+password and Google OAuth**; **Sentry** for error tracking, weighted to the SOS path; **Supabase free tier, Dev + Prod projects**; single self-hosted n8n instance. Denormalised spreadsheet-shaped schema normalised into relational tables with no change to fields or behaviour. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 14 July 2026.*
