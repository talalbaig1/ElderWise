# ElderWise — Message Templates

| Field | Value |
|---|---|
| **Product** | ElderWise |
| **Team** | AIGF Cohort 7 · Group 7 · Team Lead: Talal Baig |
| **Document** | Templates.md — v1.3 |
| **Date** | 23 July 2026 |
| **Purpose** | Every message ElderWise sends. The submission and approval tracker for Meta. |
| **Owner** | Talal (submission) · Sama + Reema (copy & tone) |
| **Status** | 🔴 **Nothing submitted yet. This is the critical path** (`Phases.md` §7). |
| **Companion docs** | `PRD.md` · `Architecture.md` · `Rules.md` · `Phases.md` |

---

## 1. Read this first — two findings that change the design

> ✅ **All of §1 was verified against Meta's live WhatsApp Business Platform documentation on 14 July 2026 (via Context7).** Meta changes these rules; re-verify before submitting.

### 1.1 The medication dropdown cannot be a template — **RESOLVED**

**The constraint (verified):** business-initiated messages — anything sent on a schedule — **must** be a Meta-approved template. **Templates support only three button types: quick reply, URL, and phone number. Max 3 buttons. There is no list/dropdown button type.** Interactive lists exist only as **free-form messages inside the 24-hour customer-service window**, i.e. only after the user has messaged us first.

A scheduled check-in is business-initiated by definition. So a dropdown cannot be the opening message. Platform rule, not preference.

**The resolution (Talal, 14 Jul): keep three buttons, and name every scheduled medicine in the body.**

```
1. TEMPLATE (approved, business-initiated)
   "Good morning Fatima — it's 8:00 AM, time for your medicines:
    Amlodipine, Metformin, Aspirin.
    Did you take them?"
   [ Yes, all ]   [ Some of them ]   [ Not yet ]
                    │
                    ▼  any tap OPENS the 24-hour window
2. FREE-FORM INTERACTIVE LIST  (no Meta approval needed)
   Sent ONLY if she answered "Some of them"
   → multi-select list of her medicines
```

**Why this is better, not merely necessary:**
- She **sees exactly which medicines are due**, in the message itself. No memory required.
- On a good day — most days — she taps **"Yes, all"** and she's done. **One tap.** Sukin's directive honoured.
- The dropdown appears **only when the answer is complicated**, which is the only time it earns its complexity.
- The list needs **no Meta approval**, taking the riskiest component off the critical path entirely.

> **Note for v2:** **WhatsApp Flows** *can* be sent as templates without an open 24-hour window — a real path to multi-select in the opening message. It is a whole additional Meta surface to learn and get approved. Not for this MVP.

### 1.2 Elder opt-in — **RESOLVED (two-layer consent)**

**The constraint (verified):** Meta requires that **the recipient has provided their mobile number and explicitly confirmed they wish to receive messages**, with the **business name clearly stated**. Opt-in **need not be obtained on WhatsApp itself**, provided it complies with local law.

Read that carefully against ElderWise: the **care partner** supplies the number, and the **elder** has agreed to nothing. A son ticking a box does not, on a strict reading, constitute his mother's explicit confirmation.

**The resolution (Talal, 14 Jul) — two layers, and the second one is the real safeguard:**

| Layer | What happens | Stored |
|---|---|---|
| **(a) CT attestation** — off-channel opt-in, which Meta permits | At onboarding the CT must tick: *"I confirm that [Elder] has agreed to receive ElderWise messages."* Onboarding **cannot complete** without it. | `consent_attested_by_ct`, `consent_attested_at`, attesting CT |
| **(b) In-channel confirmation** — the real gate | ElderWise sends **one** welcome message, naming the business and its purpose. The elder taps to confirm. | `consent_confirmed_at` |

> **🔒 The hard rule: `consent_confirmed_at` is NULL ⇒ nothing is ever scheduled for that elder.**
> WF-1 checks this **before anything else**. An elder who never confirms receives exactly one welcome message and is never contacted again.

This is Meta-compliant. More importantly, it is the right thing to do. We are about to message somebody's mother several times a day, every day. She gets to say yes herself.

### 1.3 The elder's address is now captured — **RESOLVED**

The onboarding form captured the **doctor's** address and not the elder's — while the SOS message to the Local Caregiver, whose entire purpose is to *physically reach her*, needs to say **where**. **The elder's address is now a mandatory onboarding field** (M17) and appears in template 11.

### 1.4 Everything else you need to know

| | |
|---|---|
| **Category** | All ElderWise templates are **UTILITY**. None are marketing. Any promotional phrasing gets a UTILITY template rejected. |
| **Buttons** | Max **3** buttons per template. Types: **quick reply · URL · phone number** — *no list/dropdown*. Max **20 characters** per label. |
| **Variables** | `{{1}}`, `{{2}}`… Meta requires a **sample value** for each. A variable may **never** be at the very start or very end of the body — this is one of the most common rejection reasons. |
| **Language** | `en` only in the MVP (NFR-9). |
| **24-hour window** | Once the user sends us anything, we may reply with **free-form** messages (including interactive lists) for 24 hours, **with no approval needed**. |
| **Naming** | `elderwise_<audience>_<purpose>` — lowercase, underscores only. |

---

## 2. Copy rules

From `Rules.md` §9. These are not suggestions.

| # | Rule |
|---|---|
| T1 | **Warm, short, plain.** Never clinical, never bureaucratic. |
| T2 | **One question per message.** Never two. |
| T3 | **No error codes, no technical terms, no tool names.** Ever. |
| T4 | **No diagnosis, no judgement, no alarm.** Not "You've missed 3 doses — this is dangerous." |
| T5 | **Read every line aloud, imagining your own parent receiving it at 8am.** If you wince, rewrite it. |
| T6 | Use the elder's **first name**. Never "user", never "patient". |

---

## 3. Template registry — submission tracker

| # | Template name | Audience | Category | Buttons | Submitted | Status | Rejection reason |
|---|---|---|---|---|---|---|---|
| 1 | `elderwise_ep_welcome` | Elder | UTILITY | 1 | ☐ | Not submitted | — |
| 2 | `elderwise_ep_medication_checkin` | Elder | UTILITY | 3 | ☐ | Not submitted | — |
| 3 | `elderwise_ep_health_checkin` | Elder | UTILITY | 2 | ☐ | Not submitted | — |
| 4 | `elderwise_ep_food_checkin` | Elder | UTILITY | 2 | ☐ | Not submitted | — |
| 5 | `elderwise_ep_medication_reminder` | Elder | UTILITY | 3 | ☐ | Not submitted | — |
| 6 | `elderwise_ep_health_reminder` | Elder | UTILITY | 2 | ☐ | Not submitted | — |
| 7 | `elderwise_ep_food_reminder` | Elder | UTILITY | 2 | ☐ | Not submitted | — |
| 8 | `elderwise_ct_interaction_notice` | Care Partner | UTILITY | 0 | ☐ | Not submitted | — |
| 9 | `elderwise_ct_missed_notice` | Care Partner | UTILITY | 0 | ☐ | Not submitted | — |
| 10 | `elderwise_sos_alert_ct` | Care Partner | UTILITY | 1 | ☐ | Not submitted | — |
| 11 | `elderwise_sos_alert_lct` | Local Caregiver | UTILITY | 1 | ☐ | Not submitted | — |
| 12 | `elderwise_sos_alert_doctor` | Doctor | UTILITY | 1 | ☐ | Not submitted | — |
| 13 | `elderwise_sos_nudge` | CT / LCT / Doctor | UTILITY | 1 | ☐ | Not submitted | — |
| 14 | `elderwise_sos_resolved` | CT / LCT / Doctor | UTILITY | 0 | ☐ | Not submitted | — |

**14 templates. Submit in the order above** — the elder-facing ones (1–7) and the SOS ones (10–13) are the ones the demo dies without.

**Free-form messages — no approval needed** (sent inside the 24-hour window, see §6): medication list picker · unclear-voice re-ask · SOS acknowledgement to the elder · fallback re-prompt.

---

## 4. Elder-facing templates

> The elder sees these. They are the product. Everything else is plumbing.

### 1 · `elderwise_ep_welcome`
**Category:** UTILITY · **Sent:** once, at onboarding · **Purpose:** first contact + opens the session window

> Hello {{1}} 👋
> This is **ElderWise**. Your family, {{2}}, has asked us to check in with you each day — simple questions about your medicines and how you're feeling.
> No app to install. Just reply here whenever we ask.
> Is that alright with you? Tap below and we'll begin.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `Ahmed`
**Buttons:** `[ Yes, that's fine ]` · `[ No, thank you ]`

**🔒 This message is the consent gate (M16b).** It names the business, names who set it up, and states the purpose — all Meta opt-in requirements.

- **"Yes, that's fine"** → `consent_confirmed_at` is set. **Only now** may check-ins be scheduled.
- **"No, thank you"** → the elder is **never messaged again**, and the CT is told. She is allowed to say no. Build that path — do not treat it as an edge case to skip.
- **No response** → **nothing further is ever sent.** Not a reminder, not a nudge, not a second welcome. Silence means no.

---

### 2 · `elderwise_ep_medication_checkin`
**Category:** UTILITY · **Sent:** at each configured medication time (elder's timezone)

> Good morning {{1}} — it's {{2}}, time for your medicines:
> {{3}}
> Did you take them?

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `8:00 AM` · `{{3}}` = `Amlodipine, Metformin, Aspirin`
**Buttons:** `[ Yes, all ]` · `[ Some of them ]` · `[ Not yet ]`

**`{{3}}` names every medicine scheduled at that time** — pulled from her `medications` table. She never has to remember what she's supposed to be taking; the message tells her.

**Behaviour:**
- **"Yes, all"** → every medicine in `{{3}}` recorded as taken. Done. **One tap. This is the common path.**
- **"Some of them"** → the 24-hour window is now open → send the **free-form medication list** (§7.1) so she picks which.
- **"Not yet"** → recorded as not taken; the 30-minute reminder is armed.

---

### 3 · `elderwise_ep_health_checkin`
**Category:** UTILITY

> Hello {{1}} — just a quick check.
> Are you feeling well today?

**Variables:** `{{1}}` = `Fatima`
**Buttons:** `[ Yes ]` · `[ No ]`
**Note:** she may also reply with a **voice note** instead of tapping — that is a first-class response (M4a), transcribed and treated exactly like a button tap.

---

### 4 · `elderwise_ep_food_checkin`
**Category:** UTILITY

> Hello {{1}} — have you had your {{2}} today?

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `lunch`
**Buttons:** `[ Yes ]` · `[ Not yet ]`

---

### 5 · `elderwise_ep_medication_reminder`
**Category:** UTILITY · **Sent:** once, 30 minutes after an unanswered medication check-in

> {{1}}, just a gentle reminder about your {{2}} medicines:
> {{3}}
> Have you had a chance to take them?

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `morning` · `{{3}}` = `Amlodipine, Metformin, Aspirin`
**Buttons:** `[ Yes, all ]` · `[ Some of them ]` · `[ Not yet ]`
**Tone check:** *gentle*. Never "You have not responded." Never "This is your second reminder."

---

### 6 · `elderwise_ep_health_reminder`
**Category:** UTILITY

> {{1}}, I didn't hear back earlier — no rush at all.
> Are you feeling well today?

**Variables:** `{{1}}` = `Fatima`
**Buttons:** `[ Yes ]` · `[ No ]`

---

### 7 · `elderwise_ep_food_reminder`
**Category:** UTILITY

> {{1}}, just checking again — have you managed to have your {{2}}?

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `lunch`
**Buttons:** `[ Yes ]` · `[ Not yet ]`

---

## 5. Care-circle templates

### 8 · `elderwise_ct_interaction_notice`
**Audience:** Care Partner · **Sent:** when `ct_notification = every_interaction`

> ElderWise update — {{1}}
> {{2}}: {{3}}
> Recorded at {{4}}.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `Medication (morning)` · `{{3}}` = `Taken` · `{{4}}` = `8:04 AM, 14 Jul`
**Buttons:** none
**Note:** `{{4}}` renders in the **care partner's** timezone, not the elder's (M14).

---

### 9 · `elderwise_ct_missed_notice`
**Audience:** Care Partner · **Sent:** on escalation, after the unanswered reminder

> ElderWise — {{1}} hasn't responded.
> {{2}} was due at {{3}}. We sent a reminder and haven't heard back.
> You may want to check in with her.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `Morning medication` · `{{3}}` = `8:00 AM`
**Buttons:** none
**Tone check:** informative, not alarming. It says *what happened*. It does not say *what it means* — no diagnosis, no risk language (N1, T4). A missed dose is a fact for a human to act on, not a verdict.

---

## 6. SOS templates — **the most important messages in the product**

> These fire when someone's parent is in trouble. Every word is load-bearing. Get them approved first.

### 10 · `elderwise_sos_alert_ct`
**Audience:** Care Partner · **Sent:** immediately on SOS

> 🚨 EMERGENCY — {{1}} has raised an SOS.
> Time: {{2}}
> {{3}} and {{4}} have also been alerted.
> Please respond as soon as you can.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `2:14 PM` · `{{3}}` = `Ahmed (local caregiver)` · `{{4}}` = `Dr. Rao`
**Buttons:** `[ I'm responding ]` ← **this resolves the SOS** and stops all nudges (M14b)

---

### 11 · `elderwise_sos_alert_lct`
**Audience:** Local Caregiver / Local Buddy — **the person who can physically get there**
**Sent only if an LCT is onboarded.** Local Buddy is **optional** at onboarding (`Architecture.md` §5.5). If none is set, this template is **not** sent; SOS is still handled by the Care Partner (CT always notified via template 10).

> 🚨 EMERGENCY — {{1}} has raised an SOS and needs help.
> Time: {{2}}
> Address: {{3}}
> You are listed as her local contact. Her family has also been alerted.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `2:14 PM` · `{{3}}` = `12 Rose Street, Apt 4`
**Buttons:** `[ I'm on my way ]` ← resolves the SOS
**Source of `{{3}}`:** `elders.address` — **mandatory at onboarding** (M17), including when Local Buddy is skipped. This person exists to physically reach her; without the address they cannot.

---

### 12 · `elderwise_sos_alert_doctor`
**Audience:** Doctor

> 🚨 EMERGENCY — your patient {{1}} has raised an SOS.
> Time: {{2}}
> Her family and local caregiver have been alerted.
> Recent records: {{3}}

**Variables:** `{{1}}` = `Fatima Ahmed` · `{{2}}` = `2:14 PM` · `{{3}}` = `elderwise.app/s/a8f3…`
**Buttons:** `[ Acknowledged ]` ← resolves the SOS
**Note:** `{{3}}` is the **read-only share link** (M15). No diagnosis, no interpretation — the doctor gets facts and a link (N1).

---

### 13 · `elderwise_sos_nudge`
**Sent:** nudges 2, 3, and 4 — **2 minutes apart** — to every recipient who has not yet resolved

> 🚨 STILL UNRESOLVED — {{1}}'s SOS from {{2}}.
> No one has responded yet. Please respond.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `2:14 PM`
**Buttons:** `[ I'm responding ]` ← resolves the SOS

---

### 14 · `elderwise_sos_resolved`
**Sent:** to all recipients once anyone resolves

> ✅ {{1}}'s SOS has been answered by {{2}} at {{3}}.
> No further action needed.

**Variables:** `{{1}}` = `Fatima` · `{{2}}` = `Ahmed` · `{{3}}` = `2:17 PM`
**Buttons:** none
**Why this matters:** without it, three people stay frightened after the emergency is already handled.

---

## 7. Free-form messages — **no Meta approval required**

Sent inside the 24-hour window (the user messaged us first). Not templates. Not submitted. **Not on the critical path.**

### 7.1 Medication list picker *(interactive list)*
Sent only after the elder taps **"Some of them"** or **"Not yet"**.

> Which ones did you take, {{name}}?
> *(multi-select list, one row per medicine)*
> ☐ Amlodipine — 1 tablet
> ☐ Metformin — 1 tablet
> ☐ Aspirin — 1 tablet

Up to 10 rows. Populated from that elder's `medications` table.

### 7.1b Consent declined / no response
If the elder answers **"No, thank you"**, send nothing further — ever — and notify the CT from the dashboard, not from WhatsApp. If she **never responds**, send nothing further either. **Silence is not consent.**

### 7.2 Unclear voice reply — re-ask *(N3: never guess)*
Sent when a transcript's confidence is below threshold. **Once only** (`reask_count` max 1).

> Sorry {{name}}, I didn't quite catch that.
> Did you take your medicine?
> [ Yes ] [ No ]

If the second attempt also fails, the check-in follows the normal missed path. **We never infer "yes" from muddy audio.**

### 7.3 SOS acknowledgement to the elder
Sent immediately when the elder triggers an SOS — she must not be left in silence.

> {{name}}, I've alerted your family, {{lct_name}}, and your doctor right now.
> Help is coming. Stay where you are.

### 7.4 Unrecognised reply
> Sorry {{name}}, I didn't understand that. I'll check in with you again shortly.

**Never** an error code. **Never** silence.

---

## 8. Open items

| # | Item | Severity | Owner |
|---|---|---|---|
| **OT-1** | ~~Elder opt-in~~ — **RESOLVED 14 Jul: two-layer consent** (CT attestation + in-channel confirmation). `consent_confirmed_at` NULL ⇒ nothing scheduled. Now **PRD M16**, **Architecture** (`elders` schema + WF-1 gate), and template 1. | Closed | Talal |
| **OT-2** | ~~Elder address~~ — **RESOLVED 14 Jul: mandatory onboarding field.** Now **PRD M17 / FR-ON-2**, `elders.address NOT NULL`, and template 11. | Closed | Talal |
| **OT-3** | ~~Medication dropdown~~ — **RESOLVED 14 Jul: three buttons, every scheduled medicine named in the body**, follow-up list only on *"Some of them"*. Now PRD M12 / FR-RE-3. | Closed | Talal |
| **OT-7** | **The "No, thank you" path must actually be built.** An elder who declines is never messaged again, and the CT is told. It is not an edge case — it is the whole basis of her consent being real. | Medium | Talal |
| **OT-4** | Language of the elder's WhatsApp — MVP is English only, but the elder may have their phone in another language. Cosmetic for the demo; real for the product. | Medium | Team |
| **OT-5** | Telegram equivalents — parked until the 9 Aug channel go/no-go (`Phases.md` §7). Telegram needs **no approval**, so its copy can be lifted from here directly. | Parked | Talal |
| **OT-6** | Emoji usage (🚨, ✅) — renders differently across devices, and some elders find emoji confusing. Keep them on SOS only? | Low | Sama |

---

## 9. Submission plan

| Date | Action |
|---|---|
| **By 17 July** | Copy reviewed by Sama + Reema against §2. Read aloud. |
| **By 19 July** | **Submit templates 1–7 and 10–13** — the elder-facing and SOS sets. These are the ones the demo dies without. |
| **By 26 July** | Submit 8, 9, 14. Resubmit any rejections. |
| **By 2 August** | All 14 submitted. |
| **🚦 9 August** | **Channel go/no-go** — if the core set is approved, WhatsApp as planned. |
| **By 16 August** | All approved, or the fallback is in flight. |

**Common rejection causes to avoid:** a variable at the very start or end of the body · missing sample values · promotional phrasing in a UTILITY template · placeholder count not matching the samples · buttons over 20 characters.

---

## 10. Change log

| Date | Version | Change |
|---|---|---|
| 23 Jul 2026 | 1.3 | **Companion-doc references no longer pin version numbers.** `main` is the single source of truth; pinned cross-references forced edits to every other doc on each version bump and went stale silently. Refs now name the file only. Each document's own version remains in its header. |
| 22 Jul 2026 | 1.2 | **Docs ↔ front-end reconciliation.** Template 11 (`elderwise_sos_alert_lct`) noted as **conditional** — sent only when a Local Buddy / LCT exists; SOS still always alerts the CT. Elder address remains mandatory. Vocabulary aligned with `Architecture.md` §5.5. |
| 14 Jul 2026 | 1.1 | **All three blockers resolved and verified against Meta's live docs (Context7).** Medication check-in: three quick-reply buttons with **every scheduled medicine named in the body**; follow-up interactive list only on *"Some of them"*. Elder opt-in: **two-layer consent** — CT attestation at onboarding + the elder's own in-channel confirmation, with **nothing scheduled until she confirms** and **silence treated as refusal**. Elder address: **mandatory**, and now carried in the Local Caregiver's SOS message. WhatsApp Flows noted as a v2 route to true multi-select. |
| 14 Jul 2026 | 1.0 | Initial registry — 14 templates + 4 free-form messages. Two platform findings: (1) the **medication dropdown cannot be a template** — interactive lists are only available as free-form messages inside the 24-hour window, resolved with a two-step flow that keeps the common case to a single tap and takes the dropdown off the approval path entirely; (2) **elder opt-in is unsolved** — WhatsApp requires it, the CT supplies the number, and the elder consents to nothing. Also surfaced: **the onboarding form does not capture the elder's address**, which the local-caregiver SOS message needs. |

---

*Compiled by Claude (Anthropic) on behalf of Team Lead Talal Baig — AIGF Cohort 7, Group 7 — 23 July 2026.*
