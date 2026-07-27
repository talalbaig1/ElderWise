-- A4.1 migration 2 of 2 — schema alignment (Architecture.md §5).
-- Requires: 20260727073850_a4_enum_not_required.sql already applied.
-- Apply only after A4.0 wipe — new NOT NULL columns assume empty tables.
-- Do not apply via the dashboard (Rules.md D1). New columns inherit existing RLS.

-- ---------------------------------------------------------------------------
-- care_partners: first_name / last_name; drop full_name, phone_number
-- ---------------------------------------------------------------------------
ALTER TABLE public.care_partners
  ADD COLUMN first_name text NOT NULL,
  ADD COLUMN last_name text NOT NULL;

ALTER TABLE public.care_partners
  DROP COLUMN full_name,
  DROP COLUMN phone_number;

-- ---------------------------------------------------------------------------
-- elders: surname → last_name; age; relationship; Review consents
-- ---------------------------------------------------------------------------
ALTER TABLE public.elders
  RENAME COLUMN surname TO last_name;

ALTER TABLE public.elders
  ADD COLUMN age smallint NOT NULL,
  ADD COLUMN relationship_to_care_partner text NOT NULL,
  ADD COLUMN consent_med_accuracy_at timestamptz,
  ADD COLUMN consent_data_sharing_at timestamptz,
  ADD COLUMN consent_terms_at timestamptz,
  ADD COLUMN consent_terms_version text;

ALTER TABLE public.elders
  ADD CONSTRAINT elders_age_between_1_and_120 CHECK (age BETWEEN 1 AND 120);

-- ---------------------------------------------------------------------------
-- local_caregivers: first_name / last_name; drop full_name, phone_number
-- ---------------------------------------------------------------------------
ALTER TABLE public.local_caregivers
  ADD COLUMN first_name text NOT NULL,
  ADD COLUMN last_name text NOT NULL;

ALTER TABLE public.local_caregivers
  DROP COLUMN full_name,
  DROP COLUMN phone_number;

-- ---------------------------------------------------------------------------
-- doctors: first_name / last_name; clinic_name; nullable WhatsApp
-- ---------------------------------------------------------------------------
ALTER TABLE public.doctors
  ADD COLUMN first_name text NOT NULL,
  ADD COLUMN last_name text NOT NULL;

ALTER TABLE public.doctors
  DROP COLUMN full_name,
  DROP COLUMN phone_number;

ALTER TABLE public.doctors
  RENAME COLUMN address TO clinic_name;

ALTER TABLE public.doctors
  ALTER COLUMN clinic_name SET NOT NULL;

ALTER TABLE public.doctors
  ALTER COLUMN whatsapp_number DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- medications: exactly one time per row (Rules.md D12)
-- Use cardinality(), not array_length(): array_length('{}', 1) is NULL and
-- CHECK treats NULL as pass, so '{}' (the column default) would slip through.
-- ---------------------------------------------------------------------------
ALTER TABLE public.medications
  ADD CONSTRAINT medications_times_exactly_one
  CHECK (cardinality(times) = 1);

-- ---------------------------------------------------------------------------
-- sos_notifications: skip audit + created_at; sent_at nullable (Architecture §5.2)
-- status has no DEFAULT — callers must set it explicitly with consistent fields.
-- ---------------------------------------------------------------------------
CREATE TYPE public.sos_notification_status AS ENUM ('sent', 'failed', 'skipped');

ALTER TABLE public.sos_notifications
  ADD COLUMN status public.sos_notification_status NOT NULL,
  ADD COLUMN skip_reason text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.sos_notifications
  ALTER COLUMN sent_at DROP DEFAULT;

ALTER TABLE public.sos_notifications
  ALTER COLUMN sent_at DROP NOT NULL;

ALTER TABLE public.sos_notifications
  ADD CONSTRAINT sos_notifications_status_fields_consistent CHECK (
    (
      status = 'sent'
      AND wa_message_id IS NOT NULL
      AND sent_at IS NOT NULL
      AND skip_reason IS NULL
    )
    OR (
      status = 'skipped'
      AND skip_reason IS NOT NULL
      AND wa_message_id IS NULL
      AND sent_at IS NULL
    )
    OR (
      status = 'failed'
      AND sent_at IS NULL
      AND skip_reason IS NULL
    )
  );
