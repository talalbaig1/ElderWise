-- 20260803100000_tighten_sos_nudges_sent_bound.sql
--
-- Tighten sos_events.nudges_sent from CHECK (0..4) to CHECK (0..3).
--
-- Why: decision S-2 (Talal, 3 August 2026) states that the initial SOS alert is
-- nudge_index 0 and is NOT a nudge. There are therefore exactly three nudge
-- rounds (nudge_index 1, 2, 3), and nudges_sent counts nudge rounds only.
--
-- The old upper bound of 4 permitted a state the system cannot produce, and read
-- as though there were four nudge rounds. That ambiguity is the same seam that
-- produced the "4 nudges, 2 minutes apart" error in Architecture.md §8, which
-- would have had WF-4d attempt an insert at nudge_index = 4 and be rejected by
-- sos_notifications_nudge_index_check mid-SOS.
--
-- sos_notifications.nudge_index CHECK (0..3) is already correct and is NOT
-- touched by this migration.
--
-- Functional risk: none. WF-4d's selection query already bounds on
-- `nudges_sent < 3`, so a value of 4 was unreachable in practice.
--
-- D13: applied migrations are immutable. This is a new forward migration.
-- Idempotent: DROP IF EXISTS followed by ADD re-runs cleanly.

-- Pre-flight. Abort loudly rather than fail on the ALTER with a cryptic message.
DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending
  FROM public.sos_events
  WHERE nudges_sent > 3;

  IF offending > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten nudges_sent bound: % sos_events row(s) have nudges_sent > 3. Resolve these before applying.',
      offending;
  END IF;
END $$;

ALTER TABLE public.sos_events
  DROP CONSTRAINT IF EXISTS sos_events_nudges_sent_check;

ALTER TABLE public.sos_events
  ADD CONSTRAINT sos_events_nudges_sent_check
  CHECK (nudges_sent >= 0 AND nudges_sent <= 3);

COMMENT ON COLUMN public.sos_events.nudges_sent IS
  'Nudge rounds sent, 0-3. The initial alert is nudge_index 0 and is NOT counted here (S-2, 3 Aug 2026).';
