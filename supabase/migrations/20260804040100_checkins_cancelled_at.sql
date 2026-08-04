-- Applied to the live database 4 August 2026; never committed.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

COMMENT ON COLUMN public.checkins.cancelled_at IS
  'Set by WF-3c when the owning routine was disabled while the check-in was still open. NULL in every other state.';
