# ElderWise — Privacy Policy & Terms of Use
## Approved content for `/privacy` and `/terms`

**Version string for `consent_terms_version`: `2026-07-v1`**

> **For Cursor:** this is page *content*. Render it into the existing page components,
> preserving current layout and typography. Do not rewrite, expand, condense, or
> "improve" the wording. Do not add sections. If something cannot be rendered as
> written, stop and report it rather than paraphrasing.
>
> **Not legal advice.** This was written to describe accurately what the system does.
> It has not been reviewed by a lawyer. It should not be presented as a vetted legal
> instrument, and ElderWise should not be operated as a commercial service on the
> strength of it.

---

# PRIVACY POLICY

**Last updated: 26 July 2026 · Version 2026-07-v1**

## What ElderWise is

ElderWise is a **non-commercial student capstone project** built by Group 7 of Cohort 7
of the AI Generalist Fellowship (AIGF), an educational programme run by Outskill.

There is **no registered company** behind ElderWise. It is operated by the project team
as coursework. It is not a business, not a commercial service, and not a product you are
purchasing or subscribing to.

## Please do not enter real health information

ElderWise is a **demonstration project**. It has not been security-audited, it carries no
uptime or data-protection guarantees, and it is maintained by students as part of a
time-limited course.

**Please do not enter real medical information, real home addresses, or the real WhatsApp
number of an elderly person who has not clearly agreed to it.** Use test data wherever you
can.

**Your account and all associated data may be deleted at any time, without notice and
without the ability to recover it.** This is not a remote possibility — the project team
resets the database during development. Do not rely on ElderWise to store anything you
would be upset to lose.

## What we collect

If you create an account as a care partner, we collect:

- Your first name, last name, and email address
- Your WhatsApp number and time zone

If you add an elderly person ("loved one"), we collect the information you enter about
them:

- First name, last name, age, WhatsApp number, time zone, home address, and their
  relationship to you
- Their medication, meal, and health check-in routines, including times and reminder
  settings
- Their responses to check-in messages, and any voice notes they send in reply
- Any SOS alerts they raise, and how those alerts were resolved

If you add a local buddy or doctor, we collect the name, WhatsApp number, and — for a
doctor — the clinic or hospital name that you enter.

We also record when you gave each of the consents shown on the final onboarding screen,
and which version of this policy was in effect at the time.

## How we use it

We use this information only to operate the features you have set up:

- Sending WhatsApp check-in and reminder messages to the elderly person at the times you
  configured
- Recording their responses and showing them to you on your dashboard
- Notifying you when a check-in is missed, according to the notification setting you
  chose for each routine
- Sending SOS alerts to you, the local buddy, and the doctor when an SOS is raised
- Generating a health summary you can share with a doctor through a link you create

We do not sell your data. We do not use it for advertising. We do not use it to train AI
models.

## Who your data is shared with

ElderWise runs on third-party services that necessarily process your data:

| Service | What it handles |
|---|---|
| **Supabase** | Database, authentication, and access control |
| **Vercel** | Application hosting and content delivery |
| **Meta (WhatsApp Business Cloud API)** | Delivery of all WhatsApp messages |
| **OpenAI** | Interpreting free-text and voice replies |
| **Speech-to-text provider** | Transcribing voice notes |
| **Upstash** | Rate limiting |

Each of these operates under its own privacy policy and terms.

Health summaries are shared only with a doctor you explicitly name, through a link you
choose to create. That link expires after 30 days. You can find more detail on your
dashboard.

## Where your data is stored

- **Database and authentication:** Supabase, in the **ap-northeast-2** region
  (**Seoul, South Korea**)
- **Rate limiting:** Upstash, in the **us-east-1** region (**United States**)
- **Application hosting:** Vercel's global edge network
- **Message delivery:** Meta's infrastructure, subject to Meta's own data handling

If you are outside these regions, your data is transferred to and stored in them.

## Retention and deletion

There is no fixed retention schedule. Data persists until it is deleted — by you, or by
the project team, or when the project ends.

**The project team may delete all data at any time without notice.** When the fellowship
concludes, the project may be shut down and all data destroyed.

To request deletion of your account and data, email **elderwise0@gmail.com**. We will
action reasonable requests, but we cannot promise a response time — this is a student
project without staffed support.

## Security

Access to data is enforced at the database level, so one care partner cannot read
another's records. Traffic is encrypted in transit. Passwords are handled by Supabase
Auth and are never stored by us in readable form.

That said: this system has not undergone an independent security audit. Treat it as a
student project, because it is one.

## What ElderWise is not

- **Not a HIPAA covered entity or business associate.** ElderWise makes no HIPAA
  compliance claim of any kind.
- **Not a medical device.** ElderWise does not diagnose, treat, or make clinical
  recommendations, and provides no medical advice.
- **Not an emergency service.** SOS alerts are WhatsApp messages to people you have
  named. They are not connected to emergency services and can fail. In an emergency,
  contact your local emergency number.

## Children

ElderWise is not intended for anyone under 18 and we do not knowingly collect data from
children.

## Changes to this policy

If this policy changes materially, the version string will change and you may be asked to
re-confirm. The version you agreed to is recorded with your consent.

## Contact

**elderwise0@gmail.com**

---
---

# TERMS OF USE

**Last updated: 26 July 2026 · Version 2026-07-v1**

## Who you are agreeing with

Nobody, in the legal sense.

ElderWise is a **non-commercial student capstone project** by Group 7 of Cohort 7 of the
AI Generalist Fellowship. **There is no registered company operating it**, no contract of
service is being offered, and no fee is being charged.

These terms describe how the project is intended to be used and what you should not
expect from it. They are a statement of intent, not a commercial agreement.

## Use it as a demonstration

ElderWise is built for coursework and demonstration. Please use test data. Do not enter
real medical information, real home addresses, or the real WhatsApp number of an elderly
person who has not clearly agreed to receive messages.

## No medical advice

ElderWise does not provide medical advice, diagnosis, or treatment, and is not a medical
device. Nothing it displays or sends should be used to make a clinical decision.
Medication reminders reflect only what a care partner typed in — they are not verified
against any prescription, drug database, or clinician.

**Always consult a qualified healthcare professional.** Never disregard or delay
professional medical advice because of something ElderWise showed you.

## Not an emergency service

SOS alerts are WhatsApp messages sent to contacts you have named. Delivery is not
guaranteed. Messages can be delayed, undelivered, or missed.

**ElderWise is not connected to emergency services and must not be relied upon in an
emergency.** Call your local emergency number.

## Consent from the person being cared for

You must have the clear agreement of the elderly person before adding them. You are
confirming that they have agreed to receive WhatsApp messages from ElderWise. Do not add
someone who has not agreed, or who cannot meaningfully agree.

## Your account and your data may be deleted

**The project team may delete accounts and all associated data at any time, without notice
and without recovery.** The database is reset during development, and the project may be
shut down entirely when the fellowship ends.

Do not store anything in ElderWise that you would be upset to lose.

## No warranty

ElderWise is provided as-is, with no warranty of any kind. It may be unavailable,
messages may not send, data may be lost, and features may change or disappear without
notice. It is maintained by students alongside their coursework.

## Third-party services

Using ElderWise means your messages pass through WhatsApp, operated by Meta, and are
subject to Meta's own terms and policies. Other third-party services are listed in the
Privacy Policy.

## Acceptable use

Do not use ElderWise to harass, monitor, or contact anyone without their agreement; to
send unlawful or harmful content; or to attempt to access another person's data.

## Changes

These terms may change as the project develops. Material changes come with a new version
string, and you may be asked to re-confirm.

## Contact

**elderwise0@gmail.com**

---

*ElderWise — AIGF Cohort 7, Group 7. A student capstone project.*
