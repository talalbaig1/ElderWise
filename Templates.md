# ElderWise — Message Templates

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Team** | AIGF Cohort 7 · Group 7 · Team Lead: Talal Baig |
| **Document** | Templates.md — v1.16 |
| **Date** | 25 August 2026 |
| **Purpose** | Every message ElderWise sends. **Reconciled against the live Meta WABA — this document now records what Meta actually approved, not what was drafted.** |
| **WABA** | `1495493002256968` · display number **966503330619** |
| **Owner** | Talal (submission) · Sama + Reema (copy & tone) |
| **Status** | 17 UTILITY templates **APPROVED** + 1 MARKETING template **APPROVED** in the WABA. |
| **Companion docs** | `PRD.md` · `Architecture.md` · `Rules.md` · `Phases.md` |

> **⚠️ Authority note.** §4–6 below are **transcribed verbatim from the Meta Graph API**
> (`GET /v23.0/1495493002256968/message_templates`, re-verified 25 August 2026 via audit
> workflow `PADE2m75e6xVGS2e` execution `237026`). Where this document and Meta disagree,
> **Meta wins** and this document is wrong. Do not edit the body text here to make it read
> better — edit it in Meta first, accept the re-review, then transcribe the result back.

---

## 1. Read this first — platform findings

> ✅ Verified against Meta's live WhatsApp Business Platform documentation on 14 July 2026
> (via Context7), and against the live WABA on **28 July 2026** (statuses re-verified 2 August 2026). Meta changes these rules;
> re-verify before submitting anything new.

### 1.1 The medication dropdown cannot be a template — RESOLVED, and it held up

Business-initiated messages must be approved templates. **Templates support only quick
reply, URL and phone-number buttons — max 3. There is no list/dropdown button type.**
Interactive lists exist only as free-form messages inside the 24-hour customer-service
window.

The resolution — three buttons, every scheduled medicine named in the body — **survived
Meta review**. `elderwise_ep_medication_checkin` is approved with exactly the
three buttons and the `{{3}}` medicine list as designed. Live approved body (post
9 August copy edit): `Hi *{{1}}* — it's *{{2}}*, time for your medicines: *{{3}} *Did you take them?`
(**Known cosmetic defect:** the bold run closes as `*{{3}} *` — asterisk after a space —
so `{{3}}` will not render bold; approved with this flaw; fix needs `_v2` under Rules W8.)

```
1. TEMPLATE (approved, business-initiated)
   "Hi Fatima — it's 8:00 AM, time for your medicines:
    Amlodipine, Metformin, Aspirin Did you take them?"
   [ Yes, All ]   [ Some of them ]   [ Not Yet ]
                    │
                    ▼  any tap OPENS the 24-hour window
2. FREE-FORM INTERACTIVE LIST  (no Meta approval needed)
   Sent ONLY if she answered "Some of them"
   → multi-select list of her medicines
```

### 1.2 Elder opt-in — two-layer consent, unchanged

| Layer | What happens | Stored |
|---|---|---|
| **(a) CT attestation** — off-channel opt-in, which Meta permits | At Review the CT ticks the attestation. Onboarding cannot complete without it. | `consent_attested_by_ct`, `consent_attested_at` |
| **(b) In-channel confirmation** — the real gate | `elderwise_ep_welcome` names the business and purpose. The elder taps to confirm. | `consent_confirmed_at` |

> **🔒 The hard rule: `consent_confirmed_at` NULL ⇒ nothing is ever scheduled.**
> WF-1 checks this before anything else. Silence is not consent.

### 1.3 Elder address — mandatory, carried in template 11

`elders.address` is NOT NULL (M17) and appears as `{{3}}` in `elderwise_sos_alert_lct`.
The Local Buddy exists to physically reach her; without the address they cannot.

### 1.4 Platform constraints

| | |
|---|---|
| **Category** | **17 UTILITY + 1 MARKETING** (`elderwise_wl_confirmation`). Not all UTILITY. |
| **Language** | **`en`** on all 18 ElderWise templates. **Not `en_US`.** Sending `en_US` fails. (Meta's `hello_world` sample in this account *is* `en_US` — that is the trap.) |
| **Headers** | **All 18 carry a static TEXT header** (added during submission). No header variables, so **no header parameter object is required** in the send payload. |
| **Buttons** | Max 3, quick-reply only in this set. Labels are listed verbatim in §4–6 — see §3.2. |
| **Variables** | Positional `{{n}}`. **Every variable must be supplied on every send.** There is no way to omit one — see §3.3. |
| **24-hour window** | Once the elder sends us anything, free-form messages (including interactive lists) are allowed for 24 hours with no approval. |

---

## 2. Copy rules

From `Rules.md` §9.

| # | Rule |
|---|---|
| T1 | **Warm, short, plain.** Never clinical, never bureaucratic. |
| T2 | **One question per message.** Never two. |
| T3 | **No error codes, no technical terms, no tool names.** Ever. |
| T4 | **No diagnosis, no judgement, no alarm.** |
| T5 | **Read every line aloud, imagining your own parent receiving it at 8am.** If you wince, rewrite it. |
| T6 | Use the elder's **first name**. Never "user", never "patient". |

### 2.1 Known accepted copy defects

Logged so they are not rediscovered as new findings. **Both are live in approved templates.
Neither is being fixed before Demo Day** — editing an approved template returns it to
review, and the SOS set must not be disturbed.

| Template | Defect | Ruling |
|---|---|---|
| `elderwise_ep_food_reminder` | Body opens **"Hay *{{1}}*"** — typo for "Hi". A T5 violation shipped. | **Accepted for demo** (Talal, 28 Jul). Fix post-demo. |
| `elderwise_ep_health_reminder` | Body ends **"Are you feeling well today?👍"** — an emoji appended to a question. OT-6 was still open. | **Superseded 7 Aug 2026.** `elderwise_ep_health_reminder_v2` drops the trailing 👍. Template 6 stays in the account but is no longer sent once WF-3b switches. |
| `elderwise_ep_health_reminder_v2` | Body reads **"reminder about your health check *{{2}}*"**. With `{{2}} = health_routines.name` (e.g. `BP check`) this renders as "your health check BP check earlier" — a stutter. | **Accepted as-is** (Talal, 7 Aug). Rewording means a fresh Meta review cycle on a template that just cleared. Fix post-demo. |

---

## 3. Template registry — live status

Retrieved from Meta **25 August 2026** via the read-only audit workflow `PADE2m75e6xVGS2e` (execution `237026`). **18 templates APPROVED** (17 UTILITY + 1 MARKETING).

| # | Template name | Audience | Status | Vars | Buttons | Meta template ID |
|---|---|---|---|---|---|---|
| 1 | `elderwise_ep_welcome` | Elder | ✅ APPROVED | 2 | `Yes, that's fine` · `No, thank you` | `1570002504537382` |
| 2 | `elderwise_ep_medication_checkin` | Elder | ✅ APPROVED | 3 | `Yes, All` · `Some of them` · `Not Yet` | `1350421319938779` |
| 3 | `elderwise_ep_health_checkin` | Elder | ✅ APPROVED | 1 | `Yes` · `No` | `1346690020990894` |
| 4 | `elderwise_ep_food_checkin` | Elder | ✅ APPROVED | 2 | `Yes` · `No` | `27095485663462531` |
| 5 | `elderwise_ep_medication_reminder` | Elder | ✅ APPROVED | 3 | `Yes, All` · `Some of them` · `Not Yet` | `1236555055217203` |
| 6 | `elderwise_ep_health_reminder` | Elder | ✅ APPROVED | 1 | `Yes` · `No` | `2078212969431571` |
| 7 | `elderwise_ep_food_reminder` | Elder | ✅ APPROVED | 2 | `Yes` · `No` | `1509495867123853` |
| 8 | `elderwise_ct_interaction_notice` | Care Partner | ✅ APPROVED | 4 | none | `1380438020687088` |
| 9 | `elderwise_ct_missed_notice` | Care Partner | ✅ APPROVED | 3 | none | `3121885814676749` |
| 10 | `elderwise_sos_alert_ct` | Care Partner | ✅ APPROVED | 4 | `I Am Responding` | `1289025163308840` |
| 11 | `elderwise_sos_alert_lct` | Local Buddy | ✅ APPROVED | **5** | `I'm on my way` | `1372423371082977` |
| 12 | `elderwise_sos_alert_doctor` | Doctor | ✅ APPROVED | **7** | `Acknowledge` | `2431697744021678` |
| 13 | `elderwise_sos_nudge` | CT / LCT / DR | ✅ APPROVED | 2 | `I'm Responding` | `2044073236223703` |
| 14 | `elderwise_sos_resolved` | CT / LCT / DR | ✅ APPROVED | 3 | none | `1380761780602851` |
| 15 | `elderwise_ep_health_checkin_v2` | Elder | ✅ APPROVED | 2 | `Yes` · `No` | `1736094100935290` |
| 16 | `elderwise_ep_health_reminder_v2` | Elder | ✅ APPROVED | 2 | `Yes` · `No` | `1057601289992008` |
| 17 | `elderwise_ct_interaction_notice_v2` | Care Partner | ✅ APPROVED | 4 | none | `2568978943542289` |
| 18 | `elderwise_wl_confirmation` | Waitlist registrant (`wl`) | ✅ APPROVED (MARKETING) | 1 | none | `1629319865429272` |

Row 18 is **MARKETING**. Every other ElderWise row is **UTILITY**.

**Also present in the account:** `hello_world` (Meta's sample, `en_US`). Not ours, not used,
harmless. Do not delete it — it is Meta's connectivity test message.

### 3.0a Waitlist confirmation — ✅ APPROVED (MARKETING)

**`elderwise_wl_confirmation`.** Submitted 17 August 2026. **Approved as MARKETING.** Meta template ID `1629319865429272`. 1 variable. No buttons. Purpose: waitlist signup confirmation.

**Header:** `ElderWise Waiting List Welcomes You`

> Hello {{1}}, thank you for joining the ElderWise waitlist. We'll message you here as soon as early access opens.

The recipient is a waitlist registrant — neither an elder (`ep`) nor a care partner (`ct`). This introduces a **fourth audience prefix** `wl`. Existing prefixes in this document: `ep`, `ct`, `sos`.

WF-8 currently sends **email only**. The WhatsApp branch is no longer blocked by template approval. **The WhatsApp branch is not built.**

### 3.0 Health v2 pair — ✅ APPROVED 7 August 2026

**Submitted 3 August 2026, approved by Meta and verified live 7 August 2026.** New names, not edits — templates **3** and **6** were never touched and remain APPROVED in the account. Both v2 templates are `UTILITY`, language **`en`**, and keep `Yes` / `No` buttons byte-identical to v1, so §3.2 matching and the WF-2a / WF-3x response routing are unaffected.

| Name | Meta ID | Header (static TEXT) | Vars | Body |
|---|---|---|---|---|
| `elderwise_ep_health_checkin_v2` | `1736094100935290` | `Health Checkin` | 2 | Hello *{{1}}* — it's time for your *{{2}}*. Are you feeling well today? |
| `elderwise_ep_health_reminder_v2` | `1057601289992008` | `Health Reminder` | 2 | Hi *{{1}}*, reminder about your health check *{{2}}* earlier — no rush at all. Are you feeling well today? |

> **⚠️ v1.10 recorded both bodies without the bold markers and recorded no headers.** Meta approved `*{{1}}*` and `*{{2}}*` on **both** templates, and both carry a static TEXT header. The rows above are the transcription from the live Graph API; v1.10 was wrong on both counts.

**Static headers need no n8n parameter.** All 18 ElderWise templates in this WABA carry a TEXT header with no variables. The existing WhatsApp nodes send `bodyParameters` only and have always worked, so the v2 swap adds no header component.

**Cutover — the two nodes that send these.** Neither needs a query change; both source queries already emit `routine_name`.

| Workflow | Node | From | To |
|---|---|---|---|
| WF-1c `2HgbXGM0Z5XQArf1` | `Send Health Check-in` | `elderwise_ep_health_checkin\|en` · 1 param | `elderwise_ep_health_checkin_v2\|en` · 2 params |
| WF-3b `5P19E5CPhA14K6fo` | `Send Health Reminder` | `elderwise_ep_health_reminder\|en` · 1 param | `elderwise_ep_health_reminder_v2\|en` · 2 params |

**Do not delete templates 3 and 6** until a v2 send has landed on a real handset with `{{2}}` rendering the routine name correctly.

**Why (health check-in):** templates 3 and 6 carry only `{{1}}`, so a health check-in cannot name the routine — an elder with two health routines receives identical messages for both. Food does not have this problem; template 4 carries `{{2}} = meal_name`.

**Why (reminder wording differs from the original draft):** Meta classified *"I didn't hear back"* as a re-engagement prompt and therefore **MARKETING** rather than **UTILITY**. The approved phrasing states the fact without the re-engagement framing. **Reusable finding — avoid re-engagement language in UTILITY templates.**

### 3.1 Variable-count drift from v1.4 — the two that changed

Templates 11 and 12 were **submitted with more variables than v1.4 documented**. Both are
on the SOS path.

| Template | v1.4 documented | Live on Meta | Added |
|---|---|---|---|
| `elderwise_sos_alert_lct` | 3 | **5** | `{{4}}` Doctor name · `{{5}}` Hospital/Clinic |
| `elderwise_sos_alert_doctor` | 3 | **7** | `{{3}}` Patient report link · `{{4}}` Buddy name · `{{5}}` Buddy number · `{{6}}` CP name · `{{7}}` CP number |

Consequences are handled in §3.3 (Not on Record substitution), §3.4 (share link), and in
`Architecture.md` §7.3 / §8 WF-4.

### 3.2 🚨 Button labels — exact strings, and why case matters

Inbound quick-reply webhooks return the **button text verbatim**. Matching on the wrong
case silently fails to route, and on the SOS path that is a dropped emergency.

| Template | Button labels (exact) |
|---|---|
| `elderwise_ep_welcome` | `Yes, that's fine` · `No, thank you` |
| `elderwise_ep_medication_checkin` | `Yes, All` · `Some of them` · `Not Yet` |
| `elderwise_ep_medication_reminder` | `Yes, All` · `Some of them` · `Not Yet` |
| `elderwise_ep_health_checkin` | `Yes` · `No` |
| `elderwise_ep_health_reminder` | `Yes` · `No` |
| `elderwise_ep_health_checkin_v2` | `Yes` · `No` |
| `elderwise_ep_health_reminder_v2` | `Yes` · `No` |
| `elderwise_ep_food_checkin` | `Yes` · `No` |
| `elderwise_ep_food_reminder` | `Yes` · `No` |
| `elderwise_sos_alert_ct` | `I Am Responding` |
| `elderwise_sos_alert_lct` | `I'm on my way` |
| `elderwise_sos_alert_doctor` | `Acknowledge` |
| `elderwise_sos_nudge` | `I'm Responding` |

> **⚠️ Four SOS resolution labels — all must resolve to the same SOS resolution.**
> `I Am Responding` (template 10) · `I'm on my way` (template 11) · `Acknowledge` (template 12) ·
> `I'm Responding` (template 13). Matching only the CT/nudge pair silently discards the Buddy's
> and the Doctor's resolutions — two of three recipients unable to stop a live emergency.
>
> **Track B rule (B-1):** WF-2a **must not** match button text case-sensitively. Normalise
> before routing: lowercase → **strip apostrophes first** → strip remaining punctuation →
> collapse whitespace. Apostrophe-stripping must run **before** the non-alphanumeric replace,
> or `I'm on my way` becomes `i m on my way` and the match fails. Then `i am responding`,
> `im on my way`, `acknowledge`, and `im responding` all resolve. Never compare raw strings.

> **⚠️ Food buttons are `Yes` / `No`, not `Yes` / `Not yet`** as v1.4 documented. A "No" on
> a food check-in is a recorded negative response (backend `responded`), **not** a missed
> check-in. Do not route it down the missed path.

### 3.3 🚨 "Not on Record" substitution — mandatory, at send time only

Meta requires **every** positional variable on **every** send. Templates 10, 11 and 12
reference the Doctor and the Local Buddy, **both of which are optional** (`0..1` per elder,
per-card Skip at onboarding — A4 Decision 6).

**Ruling (Talal, 28 July 2026; literal updated 11 August 2026):**

> When a Doctor or Local Buddy does not exist, WF-4 supplies the literal string
> **`Not on Record`** for their variables. **The database is not touched.** No placeholder
> rows are created.

The 28 July ruling specified the literal **`NA`**. That literal is **superseded**
(11 August 2026): WF-4 node **Load Care Circle** (`HSEp1YhQFHjga9qa`) now uses
`COALESCE(..., 'Not on Record')` for `lct_name_na`, `lct_number_na`, `dr_name_na`, and
`dr_clinic_na`. Everything else about the ruling stands.

**This is a send-time substitution, not a schema change.** Writing placeholder rows into
`doctors` / `local_caregivers` was considered and **rejected**, because an absent row is
the signal the rest of the system depends on:

- WF-4 dispatch keys on row existence (`Architecture.md` §8 WF-4)
- `sos_notifications.skip_reason` would misreport "no WhatsApp number" for a contact that
  was never added
- Review's `consent_data_sharing_at` is conditional on a Doctor or Buddy existing
- The Care Circle screen would render a fake contact as real
- A4 Decision 6 (per-card Skip) would become meaningless

**Implementation:** `LEFT JOIN` + `COALESCE(..., 'Not on Record')` when building template
parameters for absent Buddy / Doctor fields.

| Template | Variable | "Not on Record" when |
|---|---|---|
| 10 `sos_alert_ct` | `{{3}}` Local Buddy | no `local_caregivers` row |
| 10 `sos_alert_ct` | `{{4}}` Doctor | no `doctors` row |
| 11 `sos_alert_lct` | `{{4}}` Doctor name | no `doctors` row |
| 11 `sos_alert_lct` | `{{5}}` Hospital/Clinic | no `doctors` row |
| 12 `sos_alert_doctor` | `{{3}}` Patient report | share link unavailable — see §3.4 (**still `NA`**) |
| 12 `sos_alert_doctor` | `{{4}}` Buddy name | no `local_caregivers` row |
| 12 `sos_alert_doctor` | `{{5}}` Buddy number | no `local_caregivers` row |

> **Accepted demo defect (11 August 2026).** Templates 10 and 12 contain prose that still
> asserts an absent person was notified (e.g. "Local Buddy Not on Record … have also been
> alerted"). Eyes open for Demo Day — the real fix is new `_v2` bodies plus conditional
> routing in WF-4 (`PostDemoEnhancements.md` PD-12). Template 11's label:value structure
> absorbs any substitution cleanly.

> **Note on `{{5}}` and `{{7}}`.** A4 **dropped `phone_number` from every table.** These
> variables are sourced from **`whatsapp_number`**. Do not go looking for `phone_number` —
> it no longer exists.

### 3.4 The `{{3}}` patient report link (template 12)

Template 12 now carries a report link. Nothing previously minted one at SOS time — A2.6
built share links as a **CT-initiated dashboard action** only.

**Ruling (Talal, 28 July 2026): n8n mints it.** Reasoning and full rules in
`Architecture.md` §8 WF-4. Summary (reuse-before-mint **struck 3 August 2026** — only
`token_hash` is stored; a hash cannot be reversed into a link):

1. **Always mint** — n8n generates a ≥32-byte token, stores the SHA-256 hash, sets the
   §7.3 default 30-day expiry, writes the row with the service-role key. n8n **never** calls
   Next.js (P1). `pgcrypto` lives in the **`extensions`** schema — schema-qualify
   `gen_random_bytes` / `digest`.
2. **Never block the alert** — if minting fails, send template 12 with `{{3}} = NA` and log
   it. P2: an alert without a link beats no alert.

The approved sample value is `http://elderwise.app/report/fatima`. **That is a sample
only.** The real link is `https://elder-wise-seven.vercel.app/share/{token}` — HTTPS, and
protected by the §7.3 click-through gate against WhatsApp's link-preview crawler.

### 3.5 Variable → data source map (the Track B contract)

| Template | Var | Source | Timezone |
|---|---|---|---|
| 1 welcome | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `care_partners.first_name` | — |
| 2 med check-in | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | scheduled time, `h:mm AM/PM` | **elder** |
| | `{{3}}` | comma-joined `medications.name` for that time (name carries strength) | — |
| 3 health check-in | `{{1}}` | `elders.first_name` | — |
| 4 food check-in | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `food_routines.meal_name` | — |
| 5 med reminder | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | period label — **derived**, see below | **elder** |
| | `{{3}}` | comma-joined `medications.name` | — |
| 6 health reminder | `{{1}}` | `elders.first_name` | — |
| 7 food reminder | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `food_routines.meal_name` | — |
| 8 interaction | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | routine label + period, e.g. `Medication (Morning)` | — |
| | `{{3}}` | status, e.g. `Taken` | — |
| | `{{4}}` | `checkins.responded_at` | **care partner** |
| 9 missed | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | routine label | — |
| | `{{3}}` | `checkins.scheduled_for` | **care partner** |
| 10 SOS → CT | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `sos_events.triggered_at` | **care partner** |
| | `{{3}}` | Buddy full name **or `Not on Record`** | — |
| | `{{4}}` | Doctor full name **or `Not on Record`** | — |
| 11 SOS → LCT | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `sos_events.triggered_at` | **elder** (LCT inherits elder tz) |
| | `{{3}}` | `elders.address` | — |
| | `{{4}}` | Doctor full name **or `Not on Record`** | — |
| | `{{5}}` | `doctors.clinic_name` **or `Not on Record`** | — |
| 12 SOS → DR | `{{1}}` | `elders.first_name` + `last_name` | — |
| | `{{2}}` | `sos_events.triggered_at` | **elder** (see below) |
| | `{{3}}` | share link **or `NA`** — §3.4 | — |
| | `{{4}}` | Buddy full name **or `Not on Record`** | — |
| | `{{5}}` | `local_caregivers.whatsapp_number` **or `Not on Record`** | — |
| | `{{6}}` | `care_partners.first_name` + `last_name` | — |
| | `{{7}}` | `care_partners.whatsapp_number` | — |
| 13 nudge | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | original `sos_events.triggered_at` | recipient's (per role, as above) |
| 14 resolved | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | resolver's first name | — |
| | `{{3}}` | `sos_events.resolved_at` | recipient's (per role, as above) |
| 15 health check-in v2 | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `health_routines.name` | — |
| 16 health reminder v2 | `{{1}}` | `elders.first_name` | — |
| | `{{2}}` | `health_routines.name` | — |

> **Doctor timezone (B-2).** `doctors.timezone` is **no longer collected** (A4) and must not
> drive display. Doctor-facing timestamps render in the **elder's** IANA zone, matching the
> share page and PDF convention (`Architecture.md` §10).

> **Period label (B-3) — implemented 3 Aug 2026; wording signed off by Sama, 10 August 2026.** Templates 5 and 8 need
> `Morning` / `Afternoon` / `Evening` / `Night`. **No column stores this.** WF-6 derives
> it from the routine's local time in the elder's zone: `< 12:00` Morning, `< 17:00`
> Afternoon, `< 21:00` Evening, else Night. **These four strings are now the expected result, not provisional.**

---

## 4. Elder-facing templates — as approved

> Bodies below are verbatim from Meta. `*asterisks*` are WhatsApp bold and are part of the
> approved text.

### 1 · `elderwise_ep_welcome` — ✅ APPROVED
**Header:** `Welcome` · **Category:** UTILITY · **Sent:** once, at onboarding

> Hello {{1}} 👋 This is *ElderWise*. Your family, {{2}}, has asked us to check in with you each day — simple questions about your medicines and how you're feeling. No app to install. Just reply here whenever we ask. Is that alright with you? Tap below and we'll begin.

**Samples:** `Fatima` · `Ahmed` · **Buttons:** `Yes, that's fine` · `No, thank you`

**🔒 This message is the consent gate (M16b).**
- `Yes, that's fine` → set `consent_confirmed_at`. **Only now** may check-ins be scheduled.
- `No, thank you` → **never messaged again**, CT informed. **Built** (OT-7 closed 3 Aug 2026).
- **No response** → nothing further is ever sent. Not a reminder, not a second welcome.

---

### 2 · `elderwise_ep_medication_checkin` — ✅ APPROVED
**Header:** `Medication Checkin`

> Hi *{{1}}* — it's *{{2}}*, time for your medicines: *{{3}} *Did you take them?

**Known cosmetic defect (approved as-is):** the bold run closes as `*{{3}} *` (asterisk after a space), so `{{3}}` will not render bold as intended. Under **Rules W8** it cannot be corrected in place; a fix needs `elderwise_ep_medication_checkin_v2`. Ruled: leave it, record it, revisit after Demo Day — do not file as a tester defect.

**Samples:** `Fatima` · `8:00 AM` · `Amlodipine, Metformin, Aspirin`
**Buttons:** `Yes, All` · `Some of them` · `Not Yet`

- `Yes, All` → every medicine in `{{3}}` recorded taken. One tap. The common path.
- `Some of them` → recorded as `response_value = 'some_of_them'`, status responded; CT notified. **MVP scope reduction (Talal, 3 Aug 2026):** free-form interactive list (§7.1) is **not built** — which medicines were taken is not captured.
- `Not Yet` → recorded not taken; the reminder is armed at `escalation_minutes`.

---

### 3 · `elderwise_ep_health_checkin` — ✅ APPROVED
**Header:** `Health Checkin`

> Hello {{1}} — just a quick check. Are you feeling well today?

**Samples:** `Fatima` · **Buttons:** `Yes` · `No`
**Note:** a **voice note** is an equally valid reply (M4a) — transcribed and treated exactly like a button tap.

---

### 4 · `elderwise_ep_food_checkin` — ✅ APPROVED
**Header:** `Food Checkin`

> Hello *{{1}}*— have you had your *{{2}}* today?

**Samples:** `Fatima` · `Lunch` · **Buttons:** `Yes` · `No`

---

### 5 · `elderwise_ep_medication_reminder` — ✅ APPROVED
**Header:** `Medication Reminder`

> Hi *{{1}}*, just a gentle reminder about your *{{2}}* medicines: *{{3}}* Have you had a chance to take them?

**Samples:** `Fatima` · `Morning` · `Amlodipine, Metformin, Aspirin`
**Buttons:** `Yes, All` · `Some of them` · `Not Yet`

---

### 6 · `elderwise_ep_health_reminder` — ✅ APPROVED
**Header:** `Health Reminder`

> Hi *{{1}}*, I didn't hear back earlier — no rush at all. Are you feeling well today?👍

**Samples:** `Fatima` · **Buttons:** `Yes` · `No`
*(Trailing 👍 — known accepted defect, §2.1.)*

---

### 7 · `elderwise_ep_food_reminder` — ✅ APPROVED
**Header:** `Food Reminder`

> Hay *{{1}}*, just checking again — have you managed to have your *{{2}}* or not?

**Samples:** `Fatima` · `Lunch` · **Buttons:** `Yes` · `No`
*("Hay" — known accepted defect, §2.1. Do not silently correct it here; the approved text is what sends.)*

---

### 15 · `elderwise_ep_health_checkin_v2` — ✅ APPROVED
**Header:** `Health Checkin` · **Supersedes template 3**

> Hello *{{1}}* — it's time for your *{{2}}*. Are you feeling well today?

**Samples:** `Fatima` · `BP Check` · **Buttons:** `Yes` · `No`
**Why:** template 3 carries only `{{1}}`, so an elder with two health routines received identical messages for both. `{{2}}` names the routine.
**Note:** a **voice note** is an equally valid reply (M4a) — transcribed and treated exactly like a button tap.

---

### 16 · `elderwise_ep_health_reminder_v2` — ✅ APPROVED
**Header:** `Health Reminder` · **Supersedes template 6**

> Hi *{{1}}*, reminder about your health check *{{2}}* earlier — no rush at all. Are you feeling well today?

**Samples:** `Fatima` · `BP Check` · **Buttons:** `Yes` · `No`
**Why the wording differs from the original draft:** Meta classified *"I didn't hear back"* as a re-engagement prompt and therefore **MARKETING** rather than **UTILITY**. The approved phrasing states the fact without the re-engagement framing. **Reusable finding — avoid re-engagement language in UTILITY templates.**
*("your health check {{2}}" stutter — known accepted defect, §2.1. Do not silently correct it here; the approved text is what sends.)*

---

## 5. Care-circle templates — as approved

### 8 · `elderwise_ct_interaction_notice` — ✅ APPROVED
**Header:** `ElderWise Update` · **Sent when** the owning routine's `notify_care_partner = every_time`

> Hi, this is to update you about
> Your Loved one *{{1}}*
> Regarding: *{{2}}*
> Status: *{{3}}*
> Recorded at *{{4}}*
> Hope this helps 💚

**Samples:** `Fatima` · `Medication (Morning)` · `Taken` · `8:04 AM, 14 Jul` · **Buttons:** none

**Do not send** when `notify_care_partner = not_required` — total silence.
`domain_configs.ct_notification` is derived/deprecated; **do not key sends off it** (A-9).

---

### 9 · `elderwise_ct_missed_notice` — ✅ APPROVED
**Header:** `Missed Notice` · **Sent** on escalation, only when `notify_care_partner` is `every_time` or `only_missed`. **Never** when `not_required`.

> Hi, Your Loved one *{{1}}* hasn't responded. *{{2}}* was due at *{{3}}*. We sent a reminder and haven't heard back. You may want to check in with him/her.

**Samples:** `Fatima` · `Morning Medication` · `8:00 am` · **Buttons:** none
**Tone check:** states *what happened*, never *what it means*. No diagnosis, no risk language (N1, T4).

---

### 17 · `elderwise_ct_interaction_notice_v2` — ✅ APPROVED
**Header:** `Update` · **APPROVED BUT NOT IN USE.** WF-6 sends `elderwise_ct_interaction_notice` (v1). v2 differs from v1 only in header text.

> Hi, this is to update you about
> Your Loved one *{{1}}* 
> Regarding: *{{2}}*
> Status: *{{3}}*
> Recorded at *{{4}}*
> Hope this helps 💚

**Samples:** `Fatima` · `Medication (Morning)` · `Taken` · `8:04 AM, 14 Jul`
**Buttons:** none

---

## 6. SOS templates — the most important messages in the product

### 10 · `elderwise_sos_alert_ct` — ✅ APPROVED
**Header:** `SOS Alert` · **Sent:** immediately on SOS, always (the CT is always present)

> 🚨 EMERGENCY ALERT 🚨
> Your Loved one *{{1}}* has raised an SOS.
> *Time*: {{2}}
> *Local Buddy* {{3}} and Doctor {{4}} have also been alerted.
> Please respond as soon as you can.

**Samples:** `Fatima` · `2:14 PM` · `Ahmed (local caregiver)` · `Dr. Rao`
**Buttons:** `I Am Responding` ← **resolves the SOS**, stops all nudges (M14b)
**`{{3}}` / `{{4}}` → `Not on Record`** when absent (§3.3).

---

### 11 · `elderwise_sos_alert_lct` — ✅ APPROVED
**Header:** `SOS Alert` · **Sent only if a `local_caregivers` row exists.** If none, this template is not sent; the CT still receives template 10.

> 🚨 EMERGENCY ALERT 🚨
> *{{1}}* has raised an *SOS* and needs help.
> *Time*: {{2}}
> *Address*: {{3}}
>
> *His/Her assigned Doctor details are*:
> *Doctor*: {{4}}
> *Hospital/Clinic*: {{5}}
>
> You are listed as her local contact.
> His/Her family has also been alerted.

**Samples:** `Fatima` · `2:14 PM` · `12 Rose Street, Apt 4` · `Dr. Rao` · `Sama Hospital`
**Buttons:** `I'm on my way` ← resolves the SOS
**`{{3}}`** ← `elders.address`, mandatory at onboarding (M17).
**`{{4}}` / `{{5}}` → `Not on Record`** when no doctor (§3.3).

> **New data path.** This template discloses the Doctor's name and clinic to the Local
> Buddy. Covered by the Review `consent_data_sharing_at` consent, which is required
> whenever a Doctor or Buddy is added. Recorded deliberately — see `Architecture.md` §7.3.

---

### 12 · `elderwise_sos_alert_doctor` — ✅ APPROVED
**Header:** `SOS Alert` · **Sent only if** a `doctors` row exists **and** `whatsapp_number` is non-null.

> 🚨 EMERGENCY ALERT 🚨
> Your patient *{{1}}* has raised an SOS.
> *Time*: {{2}}
> *Patient Report* : {{3}}
> *Local Buddy Name*: {{4}}  & *Number*: {{5}}
> *Care Partner Name*:  {{6}} & *Number*: {{7}}
>
> His/Her family and local buddy have been alerted.

**Samples:** `Fatima` · `2:14 PM` · `http://elderwise.app/report/fatima` · `Ahmad` · `123456789` · `Saeed` · `123456789`
**Buttons:** `Acknowledge` ← resolves the SOS

**No WhatsApp number:** do **not** send. Log `sos_notifications` with `status = skipped`,
`skip_reason = no_whatsapp_number`, `wa_message_id` NULL, `sent_at` NULL. Not a delivery
failure (W3).

> **✅ Approved 2 August 2026**, unchanged from the submitted version — same body, same seven
> variables, same `Acknowledge` button. The full SOS path (CT → Buddy → Doctor → nudge →
> resolved) is now live on approved templates end to end.

> **Data-disclosure note.** `{{5}}` and `{{7}}` push the Buddy's and Care Partner's WhatsApp
> numbers to the Doctor. This is a **deliberate exception** to the doctor-view allowlist,
> which governs the share page only. Ruled 28 July 2026 — see `Architecture.md` §7.3.

---

### 13 · `elderwise_sos_nudge` — ✅ APPROVED
**Header:** `SOS ALERT` · **Sent:** the three nudge rounds — `nudge_index` **1, 2 and 3** — **2 minutes apart** — to every recipient who has not resolved **and** has a sendable channel. The initial alert is `nudge_index 0` and is **not** a nudge. See `Architecture.md` §8 WF-4.

> 🚨 *SOS STILL UNRESOLVED* 🚨
> *{{1}}*'s SOS from *{{2}}*.
> *No one has responded yet. Please respond.*

**Samples:** `Fatima` · `2:14 PM` · **Buttons:** `I'm Responding` ← resolves the SOS
*(Note: `I'm Responding` here vs `I Am Responding` on template 10 — see §3.2.)*

---

### 14 · `elderwise_sos_resolved` — ✅ APPROVED
**Header:** `SOS Resolved` · **Sent:** to all recipients once anyone resolves.

> ✅ SOS Resolved ✅
> *{{1}}*'s SOS has been answered by *{{2}}* at *{{3}}*.
> *No further action needed.*

**Samples:** `Fatima` · `Ahmad` · `2:17 PM` · **Buttons:** none
**Why this matters:** without it, three people stay frightened after the emergency is handled.

---

### 18 · `elderwise_wl_confirmation` — ✅ APPROVED (MARKETING)
**Header:** `ElderWise Waiting List Welcomes You` · **Category:** MARKETING

> Hello {{1}}, thank you for joining the ElderWise waitlist. We'll message you here as soon as early access opens.

**Buttons:** none

WF-8 currently sends **email only**. The WhatsApp branch is no longer blocked by template approval. **The WhatsApp branch is not built.**

---

## 7. Free-form messages — no Meta approval required

Sent inside the 24-hour customer-service window opened by the elder's own inbound message. Not Meta templates. Not submitted. Distinct from the 18 approved WABA templates (17 UTILITY + 1 MARKETING). **These can never be used to initiate contact** — they depend on the elder having messaged first.

### 7.1 Medication list picker *(interactive list)* — **NOT BUILT (MVP)**
**Scope reduction, ruled by Talal 3 August 2026.** Spec retained for a future path. Live behaviour: *Some of them* → `response_value = 'some_of_them'`, `status = responded`, CT notified; which medicines were taken is not captured (`Architecture.md` A-12). Reason: native WhatsApp node has no interactive-list type; raw Graph HTTP ruled out.

Was intended after the elder taps **`Some of them`** (or historically **`Not Yet`**):

> Which ones did you take, {{name}}?
> *(multi-select list, one row per medicine)*
> ☐ Amlodipine 5mg — 1 TAB
> ☐ Metformin 500mg — 1 TAB
> ☐ Aspirin 81mg — 1 TAB

Up to 10 rows. Populated from `medications`: **name** (incl. strength) + **dosage**
(quantity) + **dosage_unit**.

### 7.1b Consent declined / no response
`No, thank you` → send nothing further, ever; notify the CT from the dashboard, not
WhatsApp. **Never responds** → send nothing further either. Silence is not consent.

### 7.2 Unclear voice reply — re-ask *(N3: never guess)*
Once only (`reask_count` max 1).

> Sorry {{name}}, I didn't quite catch that.
> Did you take your medicine?
> [ Yes ] [ No ]

If the second attempt fails, the check-in follows the normal missed path. **We never infer
"yes" from muddy audio.**

### 7.3 SOS acknowledgement to the elder
Sent immediately when the elder triggers an SOS — she must not be left in silence.
**Free-form, not a template** — her own SOS message opens the 24-hour customer service window
(verified against Meta's live documentation, 3 August 2026). No Meta submission required.

**The previous single-string copy was defective (T3):** with no Local Buddy it rendered
`NA` to a frightened elderly woman. Replaced with four variants — only the middle clause
changes; **no variant can produce `NA`**.

| Case | Message |
|---|---|
| Buddy + Doctor | `{first_name}, I've let your family know, and {buddy_first_name} and your doctor as well. Help is on the way. Stay where you are — you're not alone.` |
| Buddy only | `{first_name}, I've let your family know, and {buddy_first_name} as well. Help is on the way. Stay where you are — you're not alone.` |
| Doctor only | `{first_name}, I've let your family know, and your doctor as well. Help is on the way. Stay where you are — you're not alone.` |
| Neither | `{first_name}, I've let your family know right away. Help is on the way. Stay where you are — you're not alone.` |

**Design choices:** the doctor is referred to by **role, not name**, because `doctors` has no
title field and "Dr" + `last_name` produces nonsense; the Buddy keeps a first name because the
elder knows them personally. **Copy pending Sama's sign-off (T5).** If she revises it, all four
variants must stay parallel.

### 7.4 Unrecognised reply
> Sorry {{name}}, I didn't understand that. I'll check in with you again shortly.

**Never** an error code. **Never** silence.

### 7.5 Voice note with no open check-in *(A-26 — closed 8 August 2026)* — **RETIRED 17 August 2026**

**Unreachable.** WF-5's no-open-check-in path now calls WF-9. The nodes `Find Elder For Re-prompt` and `Send No Check-in Reply` still sit on the canvas; **nothing connects into them**. The elder no longer receives this text. Historical copy retained so the retirement is auditable:

> Thank you for your message, {{first_name}}. I don't have anything to check with you right
> now — I'll be in touch at your next check-in time.

**Approved by Sama, 8 August 2026** (must not name a next check-in time; must not carry extra guidance). **Superseded 17 August 2026** by the journal acknowledgement (§7.6).

### 7.6 Journal acknowledgement *(WF-9)*

Sent when an unprompted voice note is stored as a journal entry and `urgency` is `attention` or `none`. **Not sent** when `urgency = emergency` — WF-4 sends the SOS acknowledgement itself.

> Thank you for sharing that with me, {first_name}. I've saved it for {care_partner_first_name}.

**Why no Meta approval:** the elder's inbound voice note opens the 24-hour customer-service window, so free-form text is permitted. Cannot initiate contact.

### 7.7 Cancel acknowledgement *(WF-10)*

Sent after a consented elder's whole-message `cancel` resolves an open SOS (Option A).

> Thank you, {first_name}. I've let your care circle know it was a false alarm.

**Why no Meta approval:** the elder's inbound `cancel` opens the 24-hour window. Cannot initiate contact.

### 7.8 Nothing to cancel *(WF-10)*

Sent when a consented elder sends `cancel` and there is no open SOS.

> Thank you, {first_name}. There is no active alert to cancel right now.

**Why no Meta approval:** same 24-hour window as §7.7. Cannot initiate contact.

---

## 8. Open items

| # | Item | Severity | Owner |
|---|---|---|---|
| ~~OT-8~~ | ~~`elderwise_sos_alert_doctor` PENDING~~ — **CLOSED 2 Aug 2026. Approved unchanged.** All 14 templates now approved. | Closed | Talal |
| ~~OT-7~~ | ~~The "No, thank you" path must actually be built.~~ — **CLOSED 3 Aug 2026.** Decline path verified on real WhatsApp (Phases B1.5). | Closed | Robert / Sandy |
| ~~OT-9~~ | ~~Period label derivation (B-3)~~ — **CLOSED 3 Aug 2026 (implemented):** `< 12:00` Morning · `< 17:00` Afternoon · `< 21:00` Evening · else Night. **Wording signed off by Sama, 10 August 2026 — retained as built.** These four strings are the expected result, not provisional. | Closed | Sandy + Sama |
| **OT-10** | **Template 8 `{{2}}` asymmetry across domains.** Spec = "routine label + period" (e.g. `Medication (Morning)`). Food names the meal ("Dinner"); health passes `h.name` (v2 approved 7 Aug); medication shows a **derived period** because a medication check-in is scoped to a **time slot** and may cover several medicines. Two of three domains name the routine; one does not. **Parked with Sama** (period-label wording itself is signed off — OT-9). | Parked | Sama |
| **OT-4** | Language of the elder's WhatsApp — MVP is English only. Cosmetic for the demo; real for the product. | Medium | Team |
| **OT-5** | Telegram equivalents — parked. Telegram needs no approval, so copy lifts directly from here. | Parked | Talal |
| **OT-6** | ~~Emoji usage~~ — **CLOSED by default 28 Jul.** Emoji shipped in approved templates (🚨 ✅ 👍 💚 👋). Revisit for v2. | Closed | Sama |
| **OT-1 / OT-2 / OT-3** | ~~Opt-in · address · medication dropdown~~ — **RESOLVED 14 Jul**, all three survived Meta review unchanged. | Closed | Talal |

---

## 9. Submission status

| Date | Action | Status |
|---|---|---|
| By 19 July | Submit templates 1–7 and 10–13 | ✅ Done |
| By 26 July | Submit 8, 9, 14 · resubmit rejections | ✅ Done |
| **27 July** | **All 14 submitted.** Several reformatted during upload to clear Meta validation errors. | ✅ Done |
| **28 July** | **13 approved.** `elderwise_sos_alert_doctor` still in review. Live state reconciled into this document. | ✅ Done |
| **2 August** | **All 14 approved.** `elderwise_sos_alert_doctor` cleared review unchanged. Verified via Graph API. | ✅ Done |
| **7 August** | **Health v2 pair approved.** `elderwise_ep_health_checkin_v2` and `elderwise_ep_health_reminder_v2` cleared review as `UTILITY` / `en`. 16 approved. Verified via Graph API. | ✅ Done |
| **17 August** | **`elderwise_wl_confirmation` submitted.** Meta reclassified as MARKETING. Pending approval. 16 approved remain in service; WhatsApp waitlist confirmation not live. | ✅ Done |
| **25 August** | **`elderwise_wl_confirmation` APPROVED as MARKETING** (`1629319865429272`). **`elderwise_ct_interaction_notice_v2` APPROVED** (`2568978943542289`). 18 templates total. Verified via audit `PADE2m75e6xVGS2e` execution `237026`. | ▶️ Current |
| **🚦 9 August** | **Channel go/no-go.** Full set approved → **WhatsApp as planned.** | ✅ Cleared early |
| ~~By 16 August~~ | ~~Template 12 approved, or SOS demo runs on the CT + LCT path alone~~ | ✅ Closed 2 Aug |

**Contingency no longer needed.** All four SOS templates (10, 11, 12, 13) plus the
resolution (14) are approved, so the full doctor leg can be demonstrated live. The
`skipped` row path remains implemented and correct for the real case it exists for — a
doctor with no WhatsApp number, or no doctor on the record at all (§3.3).

**Common rejection causes to avoid on any resubmission:** a variable at the very start or
end of the body · missing sample values · promotional phrasing in a UTILITY template ·
placeholder count not matching the samples · buttons over 20 characters.

---

## 10. Change log

| Date | Version | Change |
|---|---|---|
| 25 Aug 2026 | **1.16** | **WABA re-verified** via audit `PADE2m75e6xVGS2e` execution `237026` (`GET /v23.0/1495493002256968/message_templates`). Header: 17 UTILITY APPROVED + 1 MARKETING APPROVED. Registry row 17 `elderwise_ct_interaction_notice_v2` (`2568978943542289`); row 18 `elderwise_wl_confirmation` (`1629319865429272`) APPROVED as MARKETING. Buttons column is now verbatim labels (or `none`). §3 intro and authority note dated 25 August. §3.0a rewritten pending → approved; WF-8 WhatsApp branch no longer blocked by approval — **not built**. §5 entry 17 transcribed (APPROVED, unused; WF-6 still sends v1). §18 `**Buttons:** none`. Timeline 25 August. `silacares_ep_welcome` ignored. **§7** free-form intro: 16 → 18 approved (17 UTILITY + 1 MARKETING). **Footer** transcription provenance: 25 August 2026 / 18 APPROVED / execution `237026`. **§1.4** constraint counts 14 → 18; category is no longer all UTILITY. **§3.0** static-header claim 16 → 18 ElderWise templates. Sweep left §8 OT-8 “All 14” and §3.5 row numbers 14/15/16 as historical. **No body rewording of existing templates.** |
| 17 Aug 2026 | **1.15** | **Journal + cancel free-form replies.** §7.6 / §7.7 / §7.8 (WF-9 journal ack; WF-10 cancel ack and nothing-to-cancel). All three are 24-hour-window replies, not Meta templates — distinct from the 16 approved templates; cannot initiate contact. §7.5 retired — WF-5 no-check-in node orphaned. **No change to any WABA template body, variables, or buttons.** |
| 17 Aug 2026 | **1.14** | **`elderwise_wl_confirmation` submitted** (Meta MARKETING, pending). Fourth audience prefix `wl`. Header status no longer “all approved”. 16 WABA-approved templates unchanged. |
| 11 Aug 2026 | **1.13** | **"Not on Record" supersedes `NA` for absent Buddy/Doctor (§3.3).** Send-time substitution only; DB still untouched; no placeholder rows. Share-link mint failure (`{{3}}` of template 12) still fails open to `NA` (§3.4). Accepted demo defect on templates 10/12 prose recorded; real fix → PD-12. WF-4 Load Care Circle live with four `COALESCE(..., 'Not on Record')` defaults. |
| 11 Aug 2026 | **1.12** | **Medication check-in copy corrected; A-11 / OT-9 wording signed off.** §1.1 example and §4 template 2 body now match the live Meta-approved text (`Hi *{{1}}* — it's *{{2}}*, time for your medicines: *{{3}} *Did you take them?`). Stray `*{{3}} *` asterisk recorded as a known approved cosmetic defect (Rules W8 — fix needs `_v2`). Period labels: wording signed off by Sama, 10 Aug 2026 — `< 12:00` Morning · `< 17:00` Afternoon · `< 21:00` Evening · else Night are the expected result. |
| 4 Aug 2026 | **OT-10 opened (no version bump).** Template 8 `{{2}}` domain asymmetry — medication uses derived period label; food/health name the routine/meal. Parked with Sama alongside OT-9 wording sign-off. **No §4–6 body edits.** |
| 3 Aug 2026 | **1.10** | **Health v2 pair submitted (pending Meta).** §3.0 records `elderwise_ep_health_checkin_v2` and `_reminder_v2` — two vars, routine name in body; reminder wording avoids re-engagement MARKETING classification. Templates 3 and 6 remain in service. **No §4–6 body edits.** |
| 3 Aug 2026 | **1.9** | **Round 2 doc pass.** §1 WABA verification date restored to 28 Jul (re-verified 2 Aug). §13 nudge numbering aligned to `nudge_index` 1–3 (alert = 0). |
| 7 Aug 2026 | **1.11** | **Health v2 pair APPROVED and transcribed.** §3.0 rewritten from pending to approved with Meta IDs `1736094100935290` / `1057601289992008`, both `UTILITY` / `en`, both with static TEXT headers. **Two v1.10 transcription errors corrected:** bodies were recorded without the bold `*{{1}}*` / `*{{2}}*` markers Meta actually approved, and headers were omitted entirely. Registry now 16; new §4 entries 15 and 16; §3.2 and §3.5 extended. §2.1 records the `"health check {{2}}"` stutter as **accepted for demo** (Talal, 7 Aug) and marks the trailing 👍 superseded. §3.0 records the WF-1c / WF-3b cutover — **no query change needed, both source queries already emit `routine_name`**. Templates 3 and 6 retained until a v2 send is confirmed on a live handset. **New §7.5** free-form reply when a voice note arrives with no open check-in — closes **A-26**, copy approved by Sama 8 Aug (no named time, no extra guidance); sent only to active, consented, non-declined elders, silence otherwise. **No change to any other template's body, variables, or buttons.** |
| 3 Aug 2026 | **1.8** | **WF-4 SOS docs.** §3.2 callout names all four resolution labels + apostrophe-strip order. §3.4 reuse-before-mint struck (always mint). §7.3 elder acknowledgement rewritten as four variants with no `NA` (T3); pending Sama sign-off. |
| 3 Aug 2026 | **1.7** | **Track B build of 3 Aug.** OT-7 closed (decline path live). OT-9 closed (period labels implemented; Sama wording sign-off pending). §7.1 medicine list marked **not built** (Talal scope reduction); *Some of them* records `some_of_them` + CT notify only. |
| 2 Aug 2026 | **1.6** | **All 14 templates APPROVED** — `elderwise_sos_alert_doctor` cleared Meta review on 2 Aug, unchanged from submission (same body, seven variables, `Acknowledge` button). Registry, §6 heading, §8 OT-8 and §9 submission table updated. Template-12 rejection contingency removed as moot; the `skipped` path remains for the real case (no doctor / no number). Re-verified against the live WABA via Graph API. **No body text, variable, or button changed anywhere in this revision** — §3.2, §3.3, §3.4 and §3.5 stand exactly as written in v1.5. | 
| 28 Jul 2026 | **1.5** | **Reconciled against the live Meta WABA `1495493002256968`** (Graph API, 28 Jul). Registry rewritten with real statuses (13 APPROVED / 1 PENDING) and Meta template IDs. **§4–6 bodies replaced with the verbatim approved text** — all 14 gained TEXT headers; several were reworded during submission. **Two structural drifts recorded:** `sos_alert_lct` 3→5 vars (+Doctor, +Clinic), `sos_alert_doctor` 3→7 vars (+report link, +Buddy name/number, +CP name/number). **New §3.2** exact button labels + case-insensitive matching rule (B-1); food buttons are `Yes`/`No`, not `Yes`/`Not yet`. **New §3.3** NA substitution at send time, DB untouched (ruling: Talal, 28 Jul). **New §3.4** SOS share-link mint-or-reuse by n8n, fail-open to NA. **New §3.5** variable→source map incl. doctor-timezone rule (B-2) and period-label derivation (B-3). **New §2.1** known accepted copy defects ("Hay", trailing 👍) — accepted for demo. `language` is `en`, never `en_US`. OT-6 closed; OT-8/OT-9 opened. |
| 26 Jul 2026 | 1.4 | **A4 contract notes.** Dosage = quantity; strength in medicine name — Meta `{{3}}` bodies unchanged. Free-form picker rows show name + quantity + unit. Templates 8/9 keyed off per-routine `notify_care_partner` incl. never send on `not_required`. Template 12: skip + log when doctor has no WhatsApp. |
| 23 Jul 2026 | 1.3 | Companion-doc references no longer pin version numbers. |
| 22 Jul 2026 | 1.2 | Docs ↔ front-end reconciliation. Template 11 noted conditional on an LCT existing. |
| 14 Jul 2026 | 1.1 | All three blockers resolved and verified against Meta's live docs. |
| 14 Jul 2026 | 1.0 | Initial registry — 14 templates + 4 free-form messages. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 25 August 2026.*
*Template bodies transcribed verbatim from Meta Graph API, WABA `1495493002256968` — transcribed 28 July 2026, health v2 pair transcribed 7 August 2026, statuses re-verified 25 August 2026 via audit execution `237026` (18 APPROVED: 17 UTILITY + 1 MARKETING).*
