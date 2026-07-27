# A4.5 — demo seed checklist

Rebuild `supabase/seed.sql` and demo fixtures against the post-A4 schema
(`Architecture.md`). Seed must be realistic enough to demo (populated
dashboard, check-in history, journal entries).

## Required content

- [x] Care partner with `first_name` / `last_name` (no `full_name`, no `phone_number`)
- [x] Elder with `last_name`, `age`, `relationship_to_care_partner`, Review consent timestamps + `consent_terms_version` (`2026-07-v1`)
- [x] Optional Local Buddy / Doctor with `first_name` / `last_name`; doctor `clinic_name`; doctor WhatsApp may be null
- [x] Medications: dosage as quantity, unit from UI set, **exactly one** entry in `times`
- [x] Food / health routines: open-ended (`end_date` null); `start_date` in elder TZ
- [x] Check-in history + SOS sample data for a non-empty dashboard (incl. missed dose + resolved SOS)
- [x] Voice journal demo rows if the screen still needs fixtures — **N/A**: `voice_journal_entries` is **not** in the MVP schema (`Architecture.md`); screen stays empty state. Do not invent the table.

## message_templates (Track B blocker)

- [x] **Recreate `message_templates` rows with correct `meta_template_name` values**
  matching `Templates.md` (14 system rows, `elder_id` NULL).

## Scripts to update / re-run

- [x] `scripts/share-link-isolation.mjs` — `last_name` + age/relationship; elder TZ assertion
- [x] `scripts/verify-seed-reads.mjs` — `last_name` / age / relationship
- [x] `scripts/verify-pass2-writes.mjs` — **updated** (kept: soft-delete + domain_configs + consent immutability beyond A4.2 RPC smoke)
- [x] `scripts/verify-a2-4-onboarding.mjs` — **retired** (8-step path deleted; superseded by `verify-a4-2-care-circle.mjs`)
- [x] `scripts/verify-a3-auth.mjs` — already on `first_name`/`last_name`
- [ ] Gate A3 re-earned against two fresh tenants (after wipe + seed + env update)
