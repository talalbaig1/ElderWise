-- Verification Console approval gate (Architecture §11.1 adjunct, Rules C10).
-- Testers request access; Team Lead approves via Supabase table editor only.
-- Idempotent by design — safe to re-run.

CREATE TABLE IF NOT EXISTS public.console_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_partner_id uuid NOT NULL UNIQUE
    REFERENCES public.care_partners (id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.care_partners (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  note text
);

COMMENT ON TABLE public.console_access IS
  'Approval gate for /verify read-only console. One row per care partner; approval is admin-side only.';
COMMENT ON COLUMN public.console_access.approved_at IS
  'NULL until Team Lead approves in Supabase dashboard. Testers cannot set this (RLS WITH CHECK).';
COMMENT ON COLUMN public.console_access.approved_by IS
  'Care partner who approved. Set only via service-role / dashboard, never by authenticated INSERT.';
COMMENT ON COLUMN public.console_access.revoked_at IS
  'When set, console access is denied on next request. Set only via service-role / dashboard.';
COMMENT ON COLUMN public.console_access.note IS
  'Free text for Team Lead. Not exposed in console UI.';

-- Redundant if an earlier draft created it — UNIQUE on care_partner_id already indexes the column.
DROP INDEX IF EXISTS public.console_access_care_partner_id_idx;

ALTER TABLE public.console_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'console_access'
      AND policyname = 'CT reads own console access'
  ) THEN
    CREATE POLICY "CT reads own console access"
      ON public.console_access FOR SELECT
      TO authenticated
      USING (care_partner_id = (select auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'console_access'
      AND policyname = 'CT requests own console access'
  ) THEN
    CREATE POLICY "CT requests own console access"
      ON public.console_access FOR INSERT
      TO authenticated
      WITH CHECK (
        care_partner_id = (select auth.uid())
        AND approved_at IS NULL
        AND approved_by IS NULL
        AND revoked_at IS NULL
      );
  END IF;
END $$;

-- Supabase defaults grant ALL (including TRUNCATE, which bypasses RLS) on new public tables.
-- Authenticated may only SELECT own row and INSERT a self-request; approval is service-role.
REVOKE ALL ON TABLE public.console_access FROM PUBLIC;
REVOKE ALL ON TABLE public.console_access FROM anon;
REVOKE ALL ON TABLE public.console_access FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.console_access TO authenticated;

-- No UPDATE or DELETE policies for authenticated — approval and revocation are
-- admin-side only (Supabase table editor / service-role).
