# ElderWise — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Programme** | AI Generalist Fellowship (AIGF) — Outskill, Cohort 7 · Capstone Project |
| **Team** | Group 7 (10 members) · Team Lead: Talal Baig |
| **Document** | PRD.md — v1.12 |
| **Date** | 10 August 2026 |
| **Format** | AIGF Framework 9 (F9) PRD structure + technical build sections |
| **Audience** | Development team, Cursor, Claude Code |
| **Demo Day** | 29 August 2026 |
| **Status** | Baseline — open items tracked in §15 |

**Companion documents:** `Architecture.md` · `Rules.md` · `Phases.md` · `Templates.md`

**Source of truth:** Team sheet `1P8Wzs1iiKG1d32UgpbtTEjcaBswmSmkEL1b3q0ALyaY` (tabs: MoSCoW/components, "Bulding Phase of ElderWise") · Notion Living Reference `374dc973163181c587c3eeafc15b8b23`.

---

## 1. Overview & Executive Summary

ElderWise is a **care-coordination platform** that keeps a distant family member reliably informed about an ageing parent's daily wellbeing, without asking the elderly person to learn anything new.

The elderly person interacts **only through WhatsApp** — an app they already use and trust. ElderWise proactively checks in with them on a schedule the family configures, across three domains: **Medication**, **Health/wellness**, and **Food**. The elderly person replies with a simple tap (Yes/No via WhatsApp template buttons) or a voice reply. Every response is written to the database, surfaced on a **web dashboard** for the care partner, and — if a check-in is missed or an SOS is raised — escalated to the wider care circle.

Two things ElderWise deliberately is **not**:
- It is **not a medical device** and provides **no AI diagnosis**. It records facts and routes them to humans.
- It is **not another app for the elderly to install**. There is no elderly-facing app, wearable, or new device.

**Two systems, one product:**
1. **WhatsApp companion** (elderly-facing) — proactive reminders, Yes/No responses, SOS trigger.
2. **Care-partner web dashboard** (customer-facing) — onboarding, configuration, adherence analytics, SOS history, reports.

---

## 2. The Problem

### 2.1 Target user

Two distinct people, one product:

| | Who | Role |
|---|---|---|
| **End user** | The **Elderly Patient (EP)** — an ageing parent living alone or semi-independently, comfortable with WhatsApp but not with new apps or devices. | Uses the product daily. |
| **Primary user & buyer** | The **Care Partner (CT)** — an adult child or family caregiver, aged roughly 25–45, living in a different city or country from their parent, in full-time work. | Configures, monitors, and pays. |

This split is the central design constraint: **the person who uses the product is not the person who buys it.** Confirmed by both mentors (Anand: "the buyer is the care partner, not the elderly user"; Sukin: "make the UX genuinely easy for elderly users").

### 2.2 Problem statement

> **Adult children caring for an ageing parent from another city or country waste hours every week chasing basic reassurance — did she take her tablets, did he eat, did she sleep — because the only channels available are phone calls their parent may not answer and a parent's own habitual "I'm fine."**

### 2.3 Symptom

- Care partners call repeatedly and still cannot answer simple questions about the last 24 hours.
- Missed medication doses go unrecorded and unnoticed until they compound.
- Early warning signs (a bad night, a new pain, a skipped meal) are dismissed as "nothing" by the elderly person and never reach the family or the doctor.
- Emergencies are discovered late, because nobody was watching the small signals.
- Doctors receive anecdote at appointments, not a record.

### 2.4 Root cause (5-Why)

1. *Why doesn't the family know?* — Because the only signal is a phone call.
2. *Why is the phone call unreliable?* — Because it depends on the elderly person self-reporting accurately and the family calling at the right moment.
3. *Why don't they self-report accurately?* — Because they don't want to worry their children, and because they forget.
4. *Why isn't there a passive record?* — Because every existing solution requires the elderly person to adopt new technology (an app, a wearable, a device).
5. **Root cause → Existing eldercare tooling puts the technology burden on the person least able to carry it.** ElderWise inverts this: the technology burden sits with the care partner (a web dashboard), and the elderly person's surface area is a WhatsApp message they answer with one tap.

---

## 3. Core Human Deficit (F5)

**Primary deficit: TRUST.** The care partner cannot trust that their parent is safe today. ElderWise converts hope into evidence.

**Secondary deficit: TIME.** Hours per week spent chasing, calling, worrying, and reconstructing history for the doctor collapse into a glanceable dashboard.

---

## 4. Solution Statement & Wow Factor

### 4.1 Solution statement

> ElderWise runs scheduled, configurable check-ins with an elderly parent inside WhatsApp — medication, health, and food — captures their Yes/No or voice replies into a structured record, shows the care partner a live adherence dashboard, and escalates automatically to the care circle when a check-in is missed or an SOS is raised.

### 4.2 Wow factor

- **Zero adoption cost for the elderly person.** No app, no device, no login, no learning. The product lives inside a chat thread they already open every day.
- **The care circle is a graph, not a person.** Care Partner → Local Caregiver (optional) → Doctor (optional), each with a defined trigger. An SOS reaches everyone who can physically help within seconds — **CT always**; LCT and Doctor only if onboarded.
- **A record, not a rumour.** Weeks of check-ins become a downloadable, doctor-ready report — with no diagnosis and no interpretation, just facts.

---

## 5. Users, Roles & Permissions

| Code | Role | Interface | Normal notification | SOS notification | Dashboard access |
|---|---|---|---|---|---|
| **EP** | Elderly Patient | WhatsApp only | Receives all scheduled check-ins | Can trigger SOS | No |
| **CT** | Care Partner / Target Customer (**primary user, buyer**) | Web dashboard + WhatsApp | Yes — **configurable** (every time / only if missed / **not required**) | Yes | **Full** (owner) |
| **LCT** | Local Caregiver / **Local Buddy** (UI) — someone who does **not** live with the EP but is physically within reach in an emergency. **Optional at onboarding.** | WhatsApp | **Never** | Yes — **only if onboarded** | No |
| **DR** | Doctor (**optional**, gated behind explicit approval at onboarding) | WhatsApp + web dashboard (via share link) | **Never** | Yes — **only if a WhatsApp number was provided** | **Read-only, via a revocable share link — no account** (see M15) |

**Cardinality:** one CT **may manage multiple EPs** (1 → many). Each EP has exactly one CT (owner), **zero-or-one LCT** (optional — skippable per-card at onboarding; completable later from Settings), and zero-or-one Doctor (same). If no LCT is set, SOS is handled by the CT (always present). Vocabulary: see `Architecture.md` §5.5.

**Data isolation:** a CT must never see another CT's EP data. Enforced at the database layer (see `Architecture.md` — Row-Level Security).

**Front-end names for these roles:** the UI uses friendlier labels — **Loved One** (EP), **Care Partner** (CT), **Local Buddy** (LCT), **Family Doctor** (DR). Same entities throughout (`Architecture.md` §5.3 / §5.5).

---

## 6. MoSCoW Feature List (F6)

> Reflects the decisions of 14 July 2026 (auth, multi-timezone, multi-language, notification channels). The team sheet is being updated to match.

### 6.1 MUST HAVE — the working MVP

| # | Feature |
|---|---|
| M1 | **Onboarding — 4 steps.** (1) Get Started `/sign-up` (pre-auth) · (2) Care Circle · (3) Wellness Details · (4) Review. Completion screen is not a counted step. Care Circle holds four stacked cards: Care Partner, Loved One, Local Buddy (**skippable**), Doctor (**skippable**). |
| M2 | **Wellness Details** — three stacked cards (Medication, Food, Health), each with an Enable toggle and a per-item CT-notification setting (`every_time` \| `only_missed` \| `not_required`). Medication additionally captures name (with strength), dosage **quantity**, unit, one time, meal selection, and missed-dose alert minutes. |
| M3 | **WhatsApp Business API messaging** to the EP using **Meta-approved templates with Yes/No buttons** (feasibility confirmed — buttons are possible via templates). |
| M4 | **Response capture — text (Yes/No button) and voice reply** → written to the database. |
| M4a | **Voice-reply transcription (STT)** — voice replies are transcribed so the system can determine the answer accurately (Yes / No, or which medicine was taken) and act on it exactly as it would on a button tap. A voice reply is a **first-class response**, not a second-class one. Audio is retained alongside the transcript. |
| M5 | **Missed-response rule** — default: **one reminder after 30 minutes**; if still no reply → mark the check-in *missed* and **escalate to the Care Partner (CT)**. The escalation policy is **an editable configuration**, held **per EP, per domain**, set at onboarding and changeable in Settings. Escalation never reaches the LCT or Doctor — they remain **SOS-only**. |
| M6 | **Care-partner notifications** — configurable **per routine item**: Every Time · Only If Missed · **Not Required**. **WhatsApp only.** `Not Required` means **total silence** — no confirmation and no missed-routine push; the miss is still recorded and visible on the dashboard. Inline warning required when selected (three card-specific variants — see §7.1). |
| M7 | **SOS flow** — EP triggers → **immediately** notify CT + LCT (if present) + Doctor (if present) via WhatsApp + update dashboard. **WhatsApp-first: 4 nudges, 2 minutes apart**, stopping early if the SOS is resolved. |
| M8 | **Care-partner web dashboard** — daily adherence %, health, food, SOS panel, care-circle profile, daily summary, PDF report. |
| M9 | **Database** — per-domain schemas (Medication / Health / Food) + a separate SOS schema. |
| M10 | **Both process flows built** — normal reminder flow and SOS flow. |
| M11 | **Per-domain WhatsApp message templates** — food / medication / wellness / SOS. |
| M12 | **Medication response format** — the check-in message **names every scheduled medicine** in the body and offers **three options**: *Yes, all* · *Some of them* · *Not yet*. If the EP answers *Some of them*, a follow-up **dropdown list** lets her select which ones. *(Meta templates support only quick-reply/URL/phone buttons — a list cannot be the opening scheduled message. Verified against Meta docs, 14 Jul.)* |
| M13 | **Authentication** — CT signup/signin for the dashboard. *(Promoted from Won't-have → Must-have, 14 Jul 2026.)* |
| M14b | **SOS resolution** — any recipient (CT / LCT / Doctor) can resolve an SOS **either by replying on WhatsApp or by acting on the dashboard** (both channels supported). Resolving stops the nudge sequence and records who resolved it and when. |
| M16 | **Elder WhatsApp consent (opt-in)** — two layers (N5 gate). **(a)** At Review the CT must explicitly attest that the elderly person has agreed to receive ElderWise messages; the attestation, the attesting CT, and a timestamp are stored. **(b)** The elder must then **confirm in-channel** by responding to the welcome message. **No check-in is scheduled until (b) has happened.** WhatsApp requires recipient opt-in; a family member cannot consent on someone's behalf inside the channel. |
| M16a | **Additional Review consents** — captured separately at step 4: (1) medication-details accuracy + no-medical-advice acknowledgement (`consent_med_accuracy_at`); (2) data-sharing with named Doctor/Local Buddy when either was added (`consent_data_sharing_at` — **conditional**, omitted if both skipped); (3) Terms & Privacy re-confirmation (`consent_terms_at` + dated `consent_terms_version`, e.g. `2026-07-v1`). Each new consent is a nullable `timestamptz` alone — non-null **is** the consent. |
| M17 | **Elder address** — captured at onboarding and **mandatory** (even if Local Buddy is skipped). When an LCT exists, the SOS message to them must carry the address so they can physically reach the elder. |
| M15 | **Doctor share link** — read-only dashboard access for the Doctor via a **tokenised, revocable share link scoped to a single EP**. No doctor account, no password, no signup. Share-page timestamps render in the **elder's** timezone (same rule as PDF bodies). A full doctor login role is deferred to v2. |
| M14 | **Multi-timezone support** — independent timezones stored for **EP and CT**. The **LCT inherits the EP's timezone**. Doctor timezone is **not collected**; the doctor share page renders in the **elder's** zone. All schedules fire in the **EP's** local time; dashboard timestamps render in the **viewer's** (CT) timezone. *(Promoted to Must-have, 14 Jul 2026.)* |
| M18 | **Legal pages** — `/privacy` and `/terms` must accurately describe production data handling. **As of 26 Jul 2026 both pages are factually false and blocking** (see §12.4). Rewrite content is supplied separately for approval; do not invent copy. |

### 6.2 SHOULD HAVE (→ v2)

| # | Feature |
|---|---|
| S1 | Local Caregiver + Doctor as SOS-only recipients with a defined action plan; Doctor dashboard access. |
| S2 | Weekly / monthly trend analytics + downloadable week/month reports. |
| S3 | Editable per-domain message templates (CT-editable copy). |
| S4 | Response timelines on the dashboard (notification → response → resolution timestamps). |
| S5 | Escalation logic beyond the single resend (multi-step ladder post-missed-dose). |
| S6 | **Multi-language support** (MVP is English only). *(Added 14 Jul 2026.)* |

### 6.3 COULD HAVE (→ v3, tracked on the separate "Could have" sheet)

| # | Feature |
|---|---|
| C1 | Patient disease/condition profiling → condition-aware reminder logic. |
| C2 | **Voice-note health journaling** → free-form voice notes summarised into a doctor-ready journal (**no AI diagnosis**). *(Note: the underlying STT capability is now in the MVP as M4a — what remains Could-have is the free-form journaling, summarisation, and the live Voice Journal screen.)* In the MVP the Voice Journal screen is a **hard-coded demo placeholder** only. |
| C3 | Doctor-type differentiation (GP / physician / surgeon / specialist). |
| C4 | Multiple check types + multiple notification types. |
| C5 | Food-quality validation, photos. |
| C6 | Voice / phone-call escalation via SIP trunk. |
| C7 | WhatsApp number/username verification (parked — see §12.3). |
| C9 | **Full Doctor account** — own login, own role, own permissions matrix (MVP uses a share link instead). |
| C8 | **Additional notification channels to the CT** (SMS, email, push). *(Added 14 Jul 2026.)* |

### 6.4 WON'T HAVE — explicitly out of this MVP

| # | Feature | Note |
|---|---|---|
| W1 | GTM / monetisation / payment | Business-side only; no code. |
| W2 | Native mobile app | Web dashboard only. Sama's mobile prototype is being **converted to web**. |
| W3 | **AI medical diagnosis** | Hard constraint — see §12.1. |
| W4 | Voice / phone calls | WhatsApp-first only. |

> **Changed:** "User login / authentication" was previously listed as Won't-have. It is now **M13 (Must-have)**.

---

## 7. Functional Requirements

### 7.1 Onboarding (FR-ON)

Onboarding is **4 counted steps**. The completion screen is unchanged and is **not** a step.

| Step | Screen | Route / home |
|---|---|---|
| 1 | **Get Started** | `/sign-up` — **pre-auth**. Renders the same "Step 1 of 4" progress chrome as the wizard. **Must not** live inside the onboarding provider (no session yet). Shares the progress bar only — do not "fix" this by merging routes. |
| 2 | **Care Circle** | Onboarding wizard (post-auth) |
| 3 | **Wellness Details** | Onboarding wizard (post-auth) |
| 4 | **Review** | Onboarding wizard (post-auth) |

**Add-another Loved One:** an existing CT adding a second elder **never** sees step 1. Progress shows **Step 1 of 3 → 2 of 3 → 3 of 3** for Care Circle → Wellness Details → Review.

#### Step 2 — Care Circle (four cards, top to bottom)

| Card | Skippable | Fields |
|---|---|---|
| **Care Partner** | No | WhatsApp number (mandatory) · Timezone (mandatory). First name, last name, and email come from `/sign-up` and are **not** re-collected. No other CT fields in onboarding. |
| **Loved One** | No | WhatsApp (mandatory) · First Name · Last Name · Age · Timezone · Relationship with the Care Partner · Address — all mandatory. Age is a **stored snapshot** and does not self-update. |
| **Local Buddy** | Yes — "Skip for now" | First Name · Last Name · WhatsApp — mandatory **once the card is engaged**. Skipped card writes **no row**; completable later from Settings. |
| **Doctor** | Yes — "Skip for now" | First Name · Last Name · Clinic/Hospital (mandatory once engaged) · WhatsApp (**optional**). Skipped card writes no row. |

**Skip semantics:** fields inside a card are mandatory once engaged. Because the screen saves in one action, an absent buddy/doctor row after a successful Care Circle submit is a **deliberate skip** (not "not yet reached"). No draft skip flags.

**No non-WhatsApp phone numbers** are collected anywhere in product or schema.

#### Step 3 — Wellness Details (three cards: Medication, Food, Health)

Each card keeps its enable/disable toggle at the top.

**Medication** (per entry):
- Row 1: Medication Name (helper: include strength, e.g. "Metformin 500mg") · Dosage = **quantity per intake** (e.g. "1", "5") · Unit dropdown: `TAB` / `ML` / `CAP` / `DROPS` / `PUFF` / `UNIT`
- Row 2: Time (**one** time) · Start date · End date (optional)
- Row 3: Timing with meal (dropdown: Before meal / After meal) · Notify Care Partner (dropdown: Every time / Only if missed / Not required) · **Missed-dose escalation (minutes)** (number). When Notify is **Not required**, the escalation field stays visible but is **disabled** (value retained and persisted; Track B ignores it).
- **Removed:** "Add time". Two doses/day = duplicate the medication. **Kept:** enable toggle, Duplicate per entry, "Add medication"

**Food** (per meal, one row of three): Meal Name · Check-in Time · Notify Care Partner (dropdown, same three modes). No start/end dates collected. Toggle + "Add another meal" kept.

**Health** (per routine, one row of three): Routine Name · Check-in Time · Notify Care Partner (dropdown, same three modes). No start/end dates collected. Toggle + "Add health routine" kept.

#### `Not Required` (safety-relevant)

`Not Required` means **total silence**. The CT receives **no** confirmation notification and **no** missed-routine notification for that item. The miss is still recorded and still visible on the dashboard. `escalate_target` has exactly one value (`care_partner`) — silence means silence entirely.

When the CT selects **Not Required**, show an inline warning **beneath the notify row**, only while that mode is selected (no icon, no error styling). **Three distinct approved variants** — one per card; a card must never render another card's copy:

> **Medication:** You won't receive any alerts about this medication — including when a dose is missed. Missed doses still appear on your dashboard, but no one is notified at the time.

> **Food:** You won't receive any alerts about this meal — including when it's missed. Missed meals still appear on your dashboard, but no one is notified at the time.

> **Health:** You won't receive any alerts about this health routine — including when it's missed. Missed check-ins still appear on your dashboard, but no one is notified at the time.

#### Step 4 — Review (four consents)

| Consent | Storage | Required |
|---|---|---|
| Elder has agreed to receive ElderWise WhatsApp messages (N5 gate) | `consent_attested_by_ct` + `consent_attested_at` | Always — hard gate on activation |
| CT confirms medication details are accurate and understands ElderWise gives no medical advice | `consent_med_accuracy_at` | Always |
| CT consents to sharing health summaries with the named Doctor and Local Buddy | `consent_data_sharing_at` | **Only if** Doctor or Local Buddy was added |
| Terms & Privacy re-confirmed at the point of entering care data | `consent_terms_at` + `consent_terms_version` (dated string, e.g. `2026-07-v1`) | Always |

| ID | Requirement |
|---|---|
| FR-ON-1 | A CT completes the **4-step** flow above (Get Started → Care Circle → Wellness Details → Review). Step 1 is pre-auth; steps 2–4 are post-auth. |
| FR-ON-2 | Care Circle fields and skip semantics as specified in the Step 2 table. Names are **First Name / Last Name** everywhere. No gender field. No direct/non-WhatsApp phone numbers. |
| FR-ON-3 | Wellness Details fields as specified in the Step 3 section. Per-item CT notification includes `not_required`. |
| FR-ON-4 | **Frequency is fully configurable** via the times/check-in times on routine items, overridable in Settings. There is no fixed 3×/day schedule. Domain-level frequency on `domain_configs` is **derived** from those times (`Architecture.md`). |
| FR-ON-5 | Missed-dose / missed-routine alert delay is **per medication** (and equivalent escalation minutes on food/health routines), editable after onboarding. Escalation target remains the CT only. |
| FR-ON-5a | **Review consents** — all applicable consents in the Step 4 table. N5 attestation remains a hard gate. |
| FR-ON-5b | **In-channel confirmation.** After onboarding, ElderWise sends the elder a **welcome message** naming the business and its purpose. **No check-in may be scheduled until the elder responds to it.** An elder who never confirms is never messaged again beyond a single welcome. |
| FR-ON-6 | **Mandatory fields are kept to the minimum** to avoid onboarding drop-off. Local Buddy and Doctor are skippable; everything else on engaged cards is required. |
| FR-ON-7 | Adding the Doctor requires **explicit approval** by the CT (existing `approved_by_ct`). |
| FR-ON-8 | WhatsApp numbers are captured as **numbers only, with no verification step** (see §12.3). Doctor WhatsApp may be left blank; SOS then skips the doctor nudge and logs the skip (`Architecture.md` WF-4). |
| FR-ON-9 | A CT can onboard and manage **multiple EPs**. Add-another flow skips step 1; progress is **Step N of 3**. |

### 7.2 Reminder engine (FR-RE)

| ID | Requirement |
|---|---|
| FR-RE-1 | A scheduler fires check-ins per enabled domain, per EP, at the configured frequency, **in the EP's local timezone**. |
| FR-RE-2 | Each check-in dispatches a Meta-approved WhatsApp template message to the EP's number. |
| FR-RE-3 | Medication check-ins **name every scheduled medicine in the message body** and offer three buttons: *Yes, all* · *Some of them* · *Not yet*. Choosing *Some of them* triggers a follow-up **dropdown list** of that EP's medicines for multi-select. Health and Food check-ins use **Yes/No** buttons. |
| FR-RE-4 | Message copy is warm, plain, and short. Elderly-facing UX simplicity is the single highest-priority design constraint (Sukin's directive). |
| FR-RE-5 | The EP may respond by **tapping a button** or by **sending a voice reply**. Both are accepted for Yes/No-equivalent answers. |

### 7.3 Response handling & escalation (FR-RH)

| ID | Requirement |
|---|---|
| FR-RH-1 | Inbound responses are parsed and written to the relevant domain record with a timestamp. |
| FR-RH-2 | Voice replies are **transcribed (STT)**, and the answer (Yes / No, or the medicine selection) is derived from the transcript with high accuracy. The system then takes exactly the same action it would on a button tap. Both the audio and the transcript are retained. |
| FR-RH-2a | If a voice reply cannot be confidently interpreted, the system must **not** guess. It re-asks the EP once in plain language; failing that, the check-in follows the normal missed-response path. |
| FR-RH-3 | If no response is received, **one reminder is sent after 30 minutes** (configurable). |
| FR-RH-4 | If there is still no response after the reminder, the check-in is marked **missed** and the configured escalation runs — **escalation target = the CT**. The LCT and Doctor are **never** contacted on a missed check-in; they are SOS-only. |
| FR-RH-5 | The CT is notified per the **owning routine's** `notify_care_partner`: **every time**, **only if missed**, or **not required** (total silence — see §7.1). Channel = **WhatsApp only**. |
| FR-RH-6 | The dashboard updates in near-real-time on every response and every missed check-in. |

### 7.4 SOS (FR-SOS)

> **SOS has two layers — do not confuse them.**
>
> **(A) SOS display layer (front end / presentation only).** The dashboard UI may show states `active | acknowledged | resolved | cancelled` and a sequential visual cascade (Loved One → Care Partner → Local Buddy → Family Doctor) that advances on a demo timer. This is presentation for the care-partner portal and demo UX. It is **not** the dispatch algorithm.
>
> **(B) SOS dispatch logic (backend / n8n — actual behaviour).** On trigger, notify **CT + LCT (if present) + Doctor (if present) in parallel, immediately**; then **4 nudges, 2 minutes apart**, to every unresolved recipient; any of CT / LCT / Doctor may resolve via **WhatsApp or dashboard**; if all 4 nudges exhaust with no resolution, the event **stays open** (never auto-closes). This is the Meeting-11 decision and must be preserved.
>
> **Source of truth:** `sos_events.status` is `open | resolved`. Front-end SOS states are a **display mapping** over that (and demo cascade metadata), not a second workflow. Vocabulary: `Architecture.md` §5.5.

| ID | Requirement |
|---|---|
| FR-SOS-1 | The EP can raise an SOS from WhatsApp at any time (outside the check-in schedule). |
| FR-SOS-2 | An SOS agent assembles the contact set and message context via a **relational lookup** of the elder's care circle in the database (CT + optional LCT + optional Doctor) — **not RAG / not embeddings** (`Architecture.md` §3.1). |
| FR-SOS-3 | The SOS is dispatched via WhatsApp **immediately** (no batching, no delay, no queue behind routine traffic) to **CT always**, plus **LCT if onboarded**, plus **Doctor if onboarded**, **in parallel**. **When an LCT exists, their message carries the elder's address** (M17). If no LCT is set, SOS is still handled by the CT. |
| FR-SOS-3a | **Nudges: 4 in total, 2 minutes apart**, sent to every recipient who has not yet resolved the SOS. The sequence stops early the moment the SOS is resolved. |
| FR-SOS-3b | **Resolution:** any one of CT, LCT (if present), or Doctor (if present) can resolve an SOS, **via a WhatsApp reply or via the dashboard** — both paths must work. Resolving stops the nudge sequence and records the resolving party and the timestamp. |
| FR-SOS-3c | If all 4 nudges are exhausted with no resolution, the nudge sequence ends and the SOS remains **open / unresolved** on the dashboard SOS panel until a human resolves it. |
| FR-SOS-4 | The dashboard SOS panel updates immediately; the event is written to SOS History. Display states and the sequential cascade are presentation only — see the two-layer note above. |
| FR-SOS-5 | Voice-call escalation (SIP trunk) is **out of scope** for the MVP. |
| FR-SOS-6 | The SOS path is the highest-reliability path in the system. Failures here are the most severe class of defect. |

### 7.5 Dashboard & reports (FR-DB)

| ID | Requirement |
|---|---|
| FR-DB-1 | Landing page — product details + Signup / Signin. |
| FR-DB-2 | Dashboard — Medication history (percentage + history), Health, Food, SOS summary; filter by Days / Months / Years / custom timeline. |
| FR-DB-3 | Edit Profile ("Loved One") — EP name card → Food Routine profile, Medication profile, Wellness profile; Save/Submit. |
| FR-DB-4 | Care Circle — Local Buddy (definition + action plan) and Doctor. The CT can **issue and revoke the Doctor's read-only share link** from this screen. |
| FR-DB-5 | SOS History — list of triggered SOS events with timeline + filters; Get Report. |
| FR-DB-6 | Voice Journal — **hard-coded demo placeholder** for the MVP: voice summary cards with timeline and filter. Not wired to live data. |
| FR-DB-7 | Reports — dropdown by timeline (Medication / Food / Wellness / SOS history) + Download (PDF). |
| FR-DB-8 | Personal Profile / Settings — first/last name, **timezone**, change password, WhatsApp; **frequency and escalation overrides**. No non-WhatsApp phone capture. Local Buddy / Doctor may be completed here if skipped at onboarding. |
| FR-DB-9 | Home button in header and footer on every page. |
| FR-DB-10 | Where a CT manages multiple EPs, the dashboard scopes to one EP at a time via a selector. |

---

## 8. Process Flows

### 8.1 Flow 1 — Normal reminder

```
Onboarding
   → DB (per-domain records written)
   → Agent schedule trigger (fires in EP's timezone, at configured frequency)
   → WhatsApp template message to EP (Yes/No buttons | medication dropdown)
   → EP response (button tap or voice reply)
        ├── Response received → DB → WhatsApp notification to CT (per config) → Update dashboard
        └── No response → wait 30 min → 1 reminder
                 ├── Response received → DB → notify CT → Update dashboard
                 └── Still no response → mark MISSED → run escalation policy (per EP, per domain)
                                          → escalate to CT (LCT/Doctor NOT contacted — SOS-only)
                                          → Update dashboard
```

### 8.2 Flow 2 — SOS

```
EP triggers SOS (WhatsApp)
   → SOS Agent
   → DB (relational lookup — assemble care circle + context; not RAG)
   → Dispatch WhatsApp message IMMEDIATELY, in parallel, to every contact that exists:
        ├── Care Partner (CT) — always
        ├── Local Caregiver (LCT) — only if onboarded
        └── Doctor — only if onboarded **and** a WhatsApp number is present
             (no number → nudge skipped and logged; not a delivery failure)
   → 4 nudges, 2 minutes apart, to every recipient who has not resolved
   → Resolved by ANY of CT / LCT / Doctor — via WhatsApp reply OR dashboard action
        → nudges stop immediately; resolver + timestamp recorded
   → If all 4 nudges exhausted with no resolution → SOS stays OPEN on the dashboard
   → Update dashboard (SOS panel + SOS History)
        (UI may show active|acknowledged|resolved|cancelled + a demo cascade —
         presentation only; sos_events.status open|resolved is source of truth)
```

> Display vs dispatch: see §7.4 and `Architecture.md` §5.5 / WF-4. Do **not** treat the front-end sequential cascade as the real notify order.

---

## 9. Data Model (logical)

The physical schema, keys, and Row-Level Security policies belong in `Architecture.md`. This section states the **logical shape agreed by the team** (Ferdous, schema lead).

### 9.1 Per-domain records — Medication / Health / Food

One record structure per domain, each carrying:

`EP Name · EP WhatsApp No · EP {Domain} Details · Frequency of {Domain} · Answers (Yes/No | medicine selection) · CT Name · CT WhatsApp · CT Notification Frequency · Local CT Name · Local CT WhatsApp No · Local CT Frequency (when to message) · Message Formatting`

Medication additionally carries **medicine name (incl. strength), one time, dosage quantity, unit, meal timing, and notify mode**.

### 9.2 SOS record (separate)

`EP WhatsApp No · CT Name · CT WhatsApp · Local CT Name · Local CT WhatsApp No · DR Name · DR WhatsApp No (nullable) · Message Formatting`

No non-WhatsApp phone numbers on the SOS record.

### 9.3 Additional MVP requirements on the data model

- **Timezone** fields for EP and CT (LCT inherits EP's). Doctor share view uses the **elder's** timezone.
- **Escalation / notify configuration** — held **per routine** (`notify_care_partner` including `not_required`). Authoritative for Track B. `domain_configs.ct_notification` is derived/deprecated (`Architecture.md`).
- **Auth / user identity** for the CT, with **one CT → many EPs**. Names are `first_name` / `last_name` on care partners, elders, local caregivers, and doctors.
- **Doctor share-link tokens** — scoped to one EP, revocable.
- **Elder WhatsApp consent** — CT attestation (who, when) **and** in-channel confirmation timestamp (M16). Scheduling is gated on the latter.
- **Review consents** — `consent_med_accuracy_at`, conditional `consent_data_sharing_at`, `consent_terms_at` + `consent_terms_version` (M16a).
- **Elder address** — mandatory (M17). **Age** and **relationship_to_care_partner** — mandatory snapshots on the elder.
- **SOS resolution** — resolver identity, channel (WhatsApp | dashboard), and timestamp per SOS event; open/resolved state. Skipped doctor nudges recorded on `sos_notifications` with status `skipped`.
- **Voice replies** — stored audio **and** its transcript, linked to the check-in they answer.
- Every check-in must be individually addressable (sent / responded / reminded / missed) with timestamps.

> **Note for the build team:** the flat, spreadsheet-shaped schema above is the *agreed logical model*, carried over from the Google-Sheet-as-demo-DB stage. It denormalises contact details into every domain row. `Architecture.md` will normalise this into a proper relational Supabase schema (contacts stored once, referenced by foreign key) **without changing any of the fields or behaviour specified here.**

---

## 10. Screen Inventory (care-partner portal)

| # | Screen | Contents |
|---|---|---|
| 1 | **Landing** | Product details · Signup · Signin |
| 1a | **Get Started** (`/sign-up`) | Step 1 of 4 — account creation (pre-auth progress chrome only) |
| 1b | **Onboarding wizard** | Steps 2–4: Care Circle · Wellness Details · Review (+ completion, not counted) |
| 2 | **Dashboard** | Medication history (% + history) · Health · Food · SOS summary · filters (Days/Months/Years/Timeline) · Get Report |
| 3 | **Edit Profile — "Loved One"** | EP name card → Food Routine profile · Medication profile · Wellness profile · Save |
| 4 | **Care Circle** | Local Buddy · Doctor (complete-later if skipped at onboarding) |
| 5 | **SOS History** | SOS events with timeline · filters · Get Report |
| 6 | **Voice Journal** | Hard-coded demo cards with timeline + filter *(placeholder — Could-have feature)* |
| 7 | **Reports** | Timeline dropdown (Medication / Food / Wellness / SOS) · Download |
| 8 | **Personal Profile / Settings** | First/last name · timezone · change password · WhatsApp · frequency + escalation overrides |
| 9 | **Privacy / Terms** | `/privacy` · `/terms` — **currently factually false; rewrite blocking** (see §12.4) |

Global: Home button in header and footer.

**Design ownership:** Sama (UI/UX). Mobile prototype → **converted to web**.

---

## 11. Tech Stack (F1)

Locked in Meeting 12 (7 July 2026).

| Layer | Choice |
|---|---|
| **Front-end** | Next.js (App Router) + Tailwind + shadcn/ui, built in **Cursor** |
| **Back-end / API** | Cursor (application logic connecting WhatsApp ↔ n8n ↔ DB ↔ dashboard) |
| **Database / Auth / Storage** | **Supabase** (Postgres, Auth, Storage, RLS) |
| **Automation / agents** | **n8n** (schedule triggers, reminder dispatch, response handling, SOS routing) — Robert; three servers ready |
| **Messaging** | **WhatsApp Business API** (Meta-approved templates with Yes/No buttons) — Talal is the account holder |
| **AI / LLM** | Reminder agent, SOS care-circle assembly (**relational lookup**, not RAG), message generation |
| **Speech-to-text** | **OpenAI Whisper** (OpenAI transcription API) — **locked 2 August 2026 by Talal**; in use in WF-5. Supersedes the earlier Google STT / ElevenLabs shortlist, and the prior "Whisper is not the choice" wording is withdrawn. Used for voice-reply transcription (M4a). Rationale in `Architecture.md` §3 (A-1). |
| **Repo** | **GitHub** — branch per member → merge to stable `main` |
| **Deployment** | Vercel (front-end) |
| **Dev tooling** | Cursor · **Claude Code** (under exploration) |
| **Design** | Claude / Stitch → Cursor |

Rationale, versions, and integration details are specified in `Architecture.md`.

---

## 12. Non-Functional Requirements & Constraints

### 12.1 Hard product constraints (non-negotiable)

| # | Constraint |
|---|---|
| NFR-1 | **ElderWise is a care-coordination tool, not a medical device.** It must never diagnose, interpret symptoms, or give medical advice. It records facts and routes them to humans. |
| NFR-2 | **No conversational voice-companion bot.** Decided twice by the team. |
| NFR-3 | **The elderly-facing UX must remain radically simple** — a WhatsApp message answered with one tap or a short voice reply. Nothing may be added to the EP's surface area without a decision by the team lead. |
| NFR-4 | **No new app or device for the elderly person.** WhatsApp only. |

### 12.2 Quality attributes

| # | Requirement | Target |
|---|---|---|
| NFR-5 | **SOS delivery** — dispatched **immediately** on trigger. The SOS path must be the most reliable path in the system and must never queue behind routine reminder traffic. | Immediate |
| NFR-5a | **SOS nudge cadence** — 4 nudges, 2 minutes apart, to every unresolved recipient; stops early on resolution. | 4 × 2 min |
| NFR-6 | **Scheduled check-in accuracy** — routine check-ins fire within an acceptable window of the configured time, in the EP's timezone. | **±5 minutes** |
| NFR-7 | **Data isolation** — a care partner can only ever see their own EPs' data. | Enforced by RLS. Non-negotiable. |
| NFR-8 | **Dashboard freshness** — responses and SOS events appear on the dashboard without a manual refresh. | Near-real-time |
| NFR-9 | **Language** | English only in the MVP (multi-language → v2). |
| NFR-10 | **Demo-day readiness** — replaces an uptime SLA, which would be theatre for a capstone. Requires: Meta templates approved · n8n up · **Supabase project not paused** (free-tier projects auto-pause on inactivity) · WhatsApp account healthy · end-to-end rehearsal completed · a rehearsed fallback if a live message does not land on stage. | Checklist, owned by Talal |

### 12.3 Environmental constraints

| # | Constraint |
|---|---|
| NFR-11 | **No WhatsApp number verification.** WhatsApp's username / number-masking rollout undermines number-based verification (flagged by Reema Akhtar). The MVP proceeds with the number only; the field is labelled "WhatsApp Details". Verification is deferred to Could-have (C7). |
| NFR-12 | **WhatsApp Business templates require Meta approval.** Template creation and approval lead time is a schedule risk and must be started early (owner: Talal). |
| NFR-13 | Only **one** WhatsApp Business account is integrated (Talal's). There is **no backup account**. This is a single point of failure for the whole demo. |
| NFR-14 | The team is **11 people, geographically distributed** across GMT+2 to GMT+10. Parallel work must be possible without blocking. |
| NFR-15 | **Hard deadline: Demo Day, 29 August 2026.** |

### 12.4 Privacy Policy and Terms — **blocking**

`/privacy` and `/terms` on `main` are **factually false**, not merely stale. Privacy currently states data is held in browser localStorage with no cloud backend. Terms currently state passwords are stored locally. In production, data lives in **Supabase** and passwords are in **Supabase Auth**.

**Status:** rewrite is **blocking** for honest Review-step Terms & Privacy consent (M16a / M18). Content will be supplied for approval — **do not draft it in this pass.**

**Naming / legal posture (no entity):** pages name **ElderWise**, a **non-commercial capstone project** by **AIGF Cohort 7 Group 7**, operated by the project team. There is **no registered company** (do not write "Corp" or any corporate suffix). **No governing-law clause** — state plainly that **no legal entity exists** and **no service contract is offered**. Contact: **elderwise0@gmail.com**.

**`consent_terms_version`:** a **dated version string** (e.g. `2026-07-v1`) so each Review consent record points at the **exact** Privacy/Terms text it was given against. Bump the string whenever either page’s approved text changes.

The rewrite **must** disclose:

- This is a **demonstration / capstone project** — **do not enter real personal health information**.
- Accounts and data **may be deleted at any time without notice** (including full resets such as A4.0).
- ElderWise is **not** a HIPAA covered entity or business associate.
- Per N1 / SEC7: **not** a medical device; provides **no** medical advice.
- Data residency: Supabase **ap-northeast-2 (Seoul)**; Upstash Redis **us-east-1**; Vercel edge network.
- The four consents captured at Review, and the dated `consent_terms_version` each was given against.

---

## 13. Out of Scope

Everything in §6.4 (Won't-have), plus:
- Payment, billing, subscription, and any monetisation code.
- Native iOS/Android applications.
- AI medical diagnosis or clinical decision support of any kind.
- Voice/phone-call channels (SIP trunk) — including for SOS.
- Any interface for the elderly person other than WhatsApp.

---

## 14. Version Planning (F9 §6)

| Version | Content | Target |
|---|---|---|
| **MVP (v1)** | All **Must-have** features (§6.1) — the demoable product. | **29 August 2026 (Demo Day)** |
| **v2** | All **Should-have** features (§6.2) — incl. multi-language, richer analytics, multi-step escalation. | Post-Demo Day |
| **v3** | All **Could-have** features (§6.3) — incl. live voice journaling, condition profiling, extra channels, SIP escalation. | Post-Demo Day |

Demo Day ships the **MVP**. Should- and Could-have items are not permitted to enter the MVP scope without an explicit decision by the team lead (both mentors flagged feature overload as the team's main risk).

---

## 15. Open Questions & Assumptions

| # | Item | Status | Owner |
|---|---|---|---|
| OQ-1 | ~~Escalation target~~ — **RESOLVED 14 Jul: escalate to the CT.** LCT and Doctor remain SOS-only. | Closed | Talal |
| OQ-2 | ~~Escalation config granularity~~ — **RESOLVED 14 Jul: per EP, per domain.** | Closed | Talal |
| OQ-2a | ~~SOS nudge rule~~ — **RESOLVED 14 Jul: WhatsApp-first, 4 nudges, 2-minute gap** (consistent with the Meeting-11 team decision). Delivery is immediate. | Closed | Talal |
| OQ-2b | ~~SOS resolution mechanism~~ — **RESOLVED 14 Jul: both WhatsApp reply and dashboard action.** | Closed | Talal |
| OQ-3 | ~~Check-in accuracy window~~ — **RESOLVED 14 Jul: ±5 minutes** (NFR-6). ~~Demo-window availability~~ — **RESOLVED 14 Jul: replaced by a demo-day readiness checklist** (NFR-10). | Closed | Talal |
| OQ-4 | ~~Doctor auth~~ — **RESOLVED 14 Jul: revocable, tokenised, read-only share link scoped to one EP.** No account. Full doctor login → v2. | Closed | Talal |
| OQ-5 | ~~Voice reply handling~~ — **RESOLVED 14 Jul: voice replies ARE transcribed in the MVP.** The answer must be determined accurately and acted on exactly as a button tap would be. STT is therefore a **Must-have** (M4a), not a Could-have. | Closed | Talal |
| OQ-5b | ~~**STT provider** — shortlisted to Google Speech-to-Text or ElevenLabs.~~ — **CLOSED 2 August 2026 by Talal: OpenAI Whisper**, in use in WF-5. See `Architecture.md` §3 / A-1. **The confidence threshold remains unset by design** — WF-5's re-ask path is gated on answer-derivation returning `unclear`, not on an ASR confidence score; `voice_replies.confidence` is diagnostic only. | Closed | Talal |
| OQ-6 | Ownership of the separate "Could have" sheet. | **Open** | Team |
| OQ-7 | Confirm all 10 members have GitHub accounts (blocks branch assignment). | **Open** | Talal |
| OQ-8 | Team sheet to be updated to reflect the four MoSCoW changes of 14 Jul 2026 (auth → Must, multi-timezone → Must, multi-language → Should, extra channels → Could). | In progress | Talal |

---

## 16. Change Log

| Date | Version | Change |
|---|---|---|
| 10 Aug 2026 | 1.12 | **STT locked to OpenAI Whisper; OQ-5b closed; member count 11 → 10.** §11 Speech-to-text and OQ-5b brought in line with `Architecture.md` §3 / A-1 (locked 2 August 2026; stale since then). Confidence threshold is unset by design — re-ask gated on answer-derivation `unclear`, not ASR score. Header team size and OQ-7 corrected to **10 members** following Patrick Correya's departure. |
| 27 Jul 2026 | 1.11 | **§7.1 Not Required warning copy — three card-specific variants** (medication / food / health). Medication row 3 uses Timing + Notify dropdowns + Missed-dose escalation (minutes); escalation disabled (not hidden) when `not_required`. Food/Health are one row of three with Notify dropdowns. |
| 26 Jul 2026 | 1.10 | **§9 / §12.4 correction.** Remove "ElderWise Corp" — no registered entity; name ElderWise as AIGF Cohort 7 Group 7 non-commercial capstone; no governing-law / no service contract. Rewrite must disclose demo-only PHI warning, A4.0-style deletion without notice, not HIPAA CE/BA, N1/SEC7, data residency. `consent_terms_version` = dated string (e.g. `2026-07-v1`). |
| 26 Jul 2026 | 1.9 | **A4 — Onboarding restructure.** 8-step wizard → **4 steps** (Get Started pre-auth + Care Circle + Wellness Details + Review). First/Last name everywhere; non-WhatsApp phones removed. Care Circle skip semantics; Wellness field lists; dosage = quantity; one time per medication. M6 gains **Not Required** (total silence) + warning-copy placeholder. Four Review consents (M16a). Privacy/Terms flagged factually false and blocking (§12.4 / M18). Doctor share TZ → elder zone (M14/M15). Add-another progress = Step N of 3. |
| 23 Jul 2026 | 1.8 | **Companion-doc references no longer pin version numbers.** `main` is the single source of truth; pinned cross-references forced edits to every other doc on each version bump and went stale silently. Refs now name the file only. Each document's own version remains in its header. |
| 22 Jul 2026 | 1.7 | **Docs ↔ front-end reconciliation.** Documented **SOS as two layers** (display vs dispatch) in §7.4 / §8.2 — Meeting-11 parallel dispatch preserved; FE cascade is presentation only. **Local Buddy / LCT made optional** at onboarding; SOS always notifies CT; LCT alert conditional; elder address still mandatory. Removed stale **RAG** wording (FR-SOS-2, §8.2, §11) — care circle is a relational lookup. Pointed vocabulary at `Architecture.md` §5.5. |
| 22 Jul 2026 | 1.6 | **Reconciled with Sama's front-end build.** Escalation/notification granularity moved from per-EP-per-domain to **per-routine** (adopting the finer-grained front-end model). Added front-end ↔ role-code mapping (Loved One=EP, Care Partner=CT, Local Buddy=LCT, Family Doctor=DR) and flagged front-end fields that are v2/Could-have stubs. Front-end gaps to be patched by Cursor are specified in `patch_frontend.md`: elder consent (M16), elder address (M17), medication two-step response (M12), Google OAuth, buddy/doctor "added" acknowledgement. |
| 14 Jul 2026 | 1.5 | Three changes forced by Meta platform rules (verified against live Meta docs): **M12 restated** — templates cannot carry a dropdown, so the medication check-in names all scheduled medicines in the body with three buttons (*Yes, all* / *Some of them* / *Not yet*), with the dropdown as a follow-up; **M16 added — elder consent**, a two-layer opt-in (CT attestation + in-channel confirmation), with **no check-in scheduled until the elder confirms**; **M17 added — elder address**, mandatory, because the SOS message to the Local Caregiver must say where to go. |
| 14 Jul 2026 | 1.4 | NFR-10 changed from an (unmeasurable) availability target to a **demo-day readiness checklist**. |
| 14 Jul 2026 | 1.3 | Fourth round: STT provider shortlisted to **Google Speech-to-Text or ElevenLabs** (final pick pending); scheduled check-in accuracy window set to **±5 minutes** (NFR-6). |
| 14 Jul 2026 | 1.2 | Third round: **SOS = WhatsApp-first, 4 nudges, 2-minute gap** (restores the Meeting-11 team rule; immediate first dispatch); SOS resolvable via **WhatsApp reply or dashboard** (both); **voice replies ARE transcribed** — STT promoted to Must-have (M4a), a voice reply is a first-class response and drives the same action as a button tap; low-confidence transcripts trigger one plain-language re-ask rather than a guess. |
| 14 Jul 2026 | 1.1 | Second round: escalation target = CT (LCT/Doctor stay SOS-only); escalation config is **per EP, per domain**; Doctor access = **revocable tokenised read-only share link**, no account (full doctor login → v2); voice replies **stored, not transcribed** in the MVP (raises OQ-5a); **SOS delivery = immediate**, nudges **every 5 min until acknowledged** by CT/LCT/Doctor (supersedes the Meeting-11 "3–4 nudges" rule — needs team ratification); SOS acknowledgement added as M14b. |
| 14 Jul 2026 | 1.0 | Initial PRD. Resolved ten open conflicts: auth → Must-have; frequency fully configurable per domain (onboarding + settings override); voice reply → Must-have, voice journaling → Could-have (hard-coded placeholder in MVP); medication response = dropdown; escalation = editable config, default 1 reminder @ 30 min → escalate; WhatsApp Yes/No template buttons confirmed feasible; CT notifications = WhatsApp only; cardinality = 1 CT → many EPs; English-only MVP with multi-language → Should-have; multi-timezone (EP/CT/DR, LCT inherits EP) → Must-have; version planning = MVP/v2/v3 mapped to Must/Should/Could. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 26 July 2026.*
