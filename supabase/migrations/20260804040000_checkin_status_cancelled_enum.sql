-- Applied to the live database 4 August 2026; never committed.
-- MUST stay alone in its own migration. PostgreSQL will not let a
-- statement use an enum value added in the same transaction, and the
-- Supabase migration runner wraps each file in one. Adding anything
-- that references 'cancelled' to this file will break a fresh build.

ALTER TYPE public.checkin_status ADD VALUE IF NOT EXISTS 'cancelled';
