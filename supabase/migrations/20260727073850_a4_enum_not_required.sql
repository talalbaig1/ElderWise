-- A4.1 migration 1 of 2 — enums only (Architecture.md §5 / enum ordering note).
-- Postgres: a newly added enum value cannot be used in the same transaction that
-- adds it. This file must run before 20260726190100_a4_schema_alignment.sql.
-- Apply only after A4.0 wipe (empty DB). Do not apply via the dashboard (Rules.md D1).

ALTER TYPE public.notify_care_partner_mode ADD VALUE 'not_required';
ALTER TYPE public.ct_notification_mode ADD VALUE 'not_required';
