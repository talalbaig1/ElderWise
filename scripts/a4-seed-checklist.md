# A4.5 — demo seed checklist

Rebuild `supabase/seed.sql` and demo fixtures against the post-A4 schema
(`Architecture.md` v1.8). Seed must be realistic enough to demo (populated
dashboard, check-in history, journal entries).

## Required content

- [ ] Care partner with `first_name` / `last_name` (no `full_name`, no `phone_number`)
- [ ] Elder with `last_name`, `age`, `relationship_to_care_partner`, Review consent timestamps + `consent_terms_version` (`2026-07-v1`)
- [ ] Optional Local Buddy / Doctor with `first_name` / `last_name`; doctor `clinic_name`; doctor WhatsApp may be null
- [ ] Medications: dosage as quantity, unit from UI set, **exactly one** entry in `times`
- [ ] Food / health routines: open-ended (`end_date` null); `start_date` in elder TZ
- [ ] Check-in history + SOS sample data for a non-empty dashboard
- [ ] Voice journal demo rows if the screen still needs fixtures

## message_templates (Track B blocker)

- [ ] **Recreate `message_templates` rows with correct `meta_template_name` values**
  matching `Templates.md`. After A4.0 the table is empty; without these rows Track B
  cannot resolve which Meta template to send.

## Scripts to update / re-run

- [ ] `scripts/verify-*.mjs`, `rls-*.mjs`, `share-link-isolation.mjs` — renamed columns
- [ ] Gate A3 re-earned against two fresh tenants
