-- Two-column model for food/health (Talal, 12 August 2026).
-- `enabled` = pause switch. `active` = soft-delete tombstone.
-- Live DB already has these columns; IF NOT EXISTS keeps this idempotent
-- for environments that received the dashboard add first (D13).
-- Existing table RLS covers the new column; no new policies.

ALTER TABLE public.food_routines
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.health_routines
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
