-- Applied to the live database 3 August 2026; never committed.
-- Reconstructed 4 August 2026 from the live catalogue (pg_constraint,
-- pg_indexes, information_schema.columns), not from documentation.
-- Idempotent by design.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS food_routine_id   uuid,
  ADD COLUMN IF NOT EXISTS health_routine_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'checkins_food_routine_id_fkey') THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_food_routine_id_fkey
      FOREIGN KEY (food_routine_id)
      REFERENCES public.food_routines(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'checkins_health_routine_id_fkey') THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_health_routine_id_fkey
      FOREIGN KEY (health_routine_id)
      REFERENCES public.health_routines(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'checkins_domain_routine_consistent') THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_domain_routine_consistent CHECK (
           (domain = 'medication'::care_domain
            AND food_routine_id IS NULL AND health_routine_id IS NULL)
        OR (domain = 'food'::care_domain
            AND food_routine_id IS NOT NULL AND health_routine_id IS NULL)
        OR (domain = 'health'::care_domain
            AND food_routine_id IS NULL AND health_routine_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS checkins_medication_slot_uniq
  ON public.checkins USING btree (elder_id, scheduled_for)
  WHERE (domain = 'medication'::care_domain);

CREATE UNIQUE INDEX IF NOT EXISTS checkins_food_slot_uniq
  ON public.checkins USING btree (elder_id, food_routine_id, scheduled_for)
  WHERE (domain = 'food'::care_domain);

CREATE UNIQUE INDEX IF NOT EXISTS checkins_health_slot_uniq
  ON public.checkins USING btree (elder_id, health_routine_id, scheduled_for)
  WHERE (domain = 'health'::care_domain);

CREATE INDEX IF NOT EXISTS checkins_wa_message_id_idx
  ON public.checkins USING btree (wa_message_id)
  WHERE (wa_message_id IS NOT NULL);
