-- ElderWise A2.1 — initial schema + RLS
-- Architecture.md §5–6 · Rules D1/D2/N6
-- Project: ElderWise MVP (vkrjupjqwdeghvpjsvai)
--
-- Policies: TO authenticated only; auth.uid() wrapped as (select auth.uid()).
--
-- rls_auto_enable() is a SECURITY DEFINER event-trigger helper created
-- out-of-band on this project. It only runs ALTER TABLE … ENABLE ROW LEVEL
-- SECURITY on CREATE TABLE in public — it does NOT create policies.
-- The event trigger itself must be recreated manually in Prod.
-- We still ENABLE RLS + create explicit policies in this migration and
-- REVOKE execute on the helper from anon/authenticated below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.care_domain AS ENUM ('medication', 'health', 'food');
CREATE TYPE public.ct_notification_mode AS ENUM ('every_interaction', 'only_missed');
CREATE TYPE public.escalate_target AS ENUM ('care_partner');
CREATE TYPE public.notify_care_partner_mode AS ENUM ('every_time', 'only_missed');
CREATE TYPE public.medication_timing AS ENUM ('before_food', 'after_food', 'no_preference');
CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'custom');
CREATE TYPE public.food_frequency AS ENUM ('daily', 'weekly', 'custom');
CREATE TYPE public.health_routine_type AS ENUM (
  'sleep', 'blood_pressure', 'blood_sugar', 'water_intake', 'exercise',
  'mood', 'weight', 'general_wellness', 'custom'
);
CREATE TYPE public.health_frequency AS ENUM ('daily', 'every_2_days', 'weekly', 'custom');
CREATE TYPE public.answer_type AS ENUM ('yes_no', 'number', 'mood', 'short_text');
CREATE TYPE public.checkin_status AS ENUM ('scheduled', 'sent', 'reminded', 'responded', 'missed');
CREATE TYPE public.response_channel AS ENUM ('button', 'voice');
CREATE TYPE public.sos_status AS ENUM ('open', 'resolved');
CREATE TYPE public.sos_resolver_role AS ENUM ('care_partner', 'local_caregiver', 'doctor');
CREATE TYPE public.sos_resolve_channel AS ENUM ('whatsapp', 'dashboard');
CREATE TYPE public.sos_recipient_role AS ENUM ('care_partner', 'local_caregiver', 'doctor');
CREATE TYPE public.ct_notification_type AS ENUM ('interaction', 'missed');
CREATE TYPE public.message_domain AS ENUM ('medication', 'health', 'food', 'sos');

-- ---------------------------------------------------------------------------
-- care_partners
-- ---------------------------------------------------------------------------
CREATE TABLE public.care_partners (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp_number text,
  phone_number text,
  timezone text NOT NULL,
  address text,
  secondary_contact jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.care_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own profile"
  ON public.care_partners FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "CT inserts own profile"
  ON public.care_partners FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "CT updates own profile"
  ON public.care_partners FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "CT deletes own profile"
  ON public.care_partners FOR DELETE
  TO authenticated
  USING (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- elders
-- ---------------------------------------------------------------------------
CREATE TABLE public.elders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_partner_id uuid NOT NULL REFERENCES public.care_partners (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  surname text NOT NULL,
  gender text,
  whatsapp_number text NOT NULL,
  timezone text NOT NULL,
  address text NOT NULL,
  consent_attested_by_ct boolean NOT NULL DEFAULT false,
  consent_attested_at timestamptz,
  consent_confirmed_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elders_whatsapp_number_unique UNIQUE (whatsapp_number)
);

CREATE INDEX elders_care_partner_id_idx ON public.elders (care_partner_id);

ALTER TABLE public.elders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own elders"
  ON public.elders FOR SELECT
  TO authenticated
  USING (care_partner_id = (select auth.uid()));

CREATE POLICY "CT inserts own elders"
  ON public.elders FOR INSERT
  TO authenticated
  WITH CHECK (care_partner_id = (select auth.uid()));

CREATE POLICY "CT updates own elders"
  ON public.elders FOR UPDATE
  TO authenticated
  USING (care_partner_id = (select auth.uid()))
  WITH CHECK (care_partner_id = (select auth.uid()));

CREATE POLICY "CT deletes own elders"
  ON public.elders FOR DELETE
  TO authenticated
  USING (care_partner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- local_caregivers (optional, 0..1 per elder)
-- ---------------------------------------------------------------------------
CREATE TABLE public.local_caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL UNIQUE REFERENCES public.elders (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  whatsapp_number text NOT NULL,
  phone_number text,
  action_plan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.local_caregivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own local caregivers"
  ON public.local_caregivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = local_caregivers.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own local caregivers"
  ON public.local_caregivers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = local_caregivers.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own local caregivers"
  ON public.local_caregivers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = local_caregivers.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = local_caregivers.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own local caregivers"
  ON public.local_caregivers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = local_caregivers.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- doctors (optional, 0..1 per elder)
-- ---------------------------------------------------------------------------
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL UNIQUE REFERENCES public.elders (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  whatsapp_number text NOT NULL,
  phone_number text,
  address text,
  timezone text,
  approved_by_ct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own doctors"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctors.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own doctors"
  ON public.doctors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctors.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own doctors"
  ON public.doctors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctors.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctors.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own doctors"
  ON public.doctors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctors.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- doctor_share_links (token_hash only — never raw token)
-- ---------------------------------------------------------------------------
CREATE TABLE public.doctor_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.care_partners (id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  CONSTRAINT doctor_share_links_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX doctor_share_links_elder_id_idx ON public.doctor_share_links (elder_id);

ALTER TABLE public.doctor_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own doctor share links"
  ON public.doctor_share_links FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctor_share_links.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own doctor share links"
  ON public.doctor_share_links FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctor_share_links.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own doctor share links"
  ON public.doctor_share_links FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctor_share_links.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctor_share_links.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own doctor share links"
  ON public.doctor_share_links FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = doctor_share_links.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- domain_configs
-- ---------------------------------------------------------------------------
CREATE TABLE public.domain_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  domain public.care_domain NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  frequency jsonb NOT NULL DEFAULT jsonb_build_object('times', jsonb_build_array()),
  ct_notification public.ct_notification_mode NOT NULL DEFAULT 'only_missed',
  escalate_to public.escalate_target NOT NULL DEFAULT 'care_partner',
  reminder_delay_minutes integer NOT NULL DEFAULT 30
    CHECK (reminder_delay_minutes >= 5 AND reminder_delay_minutes <= 240),
  escalation_enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT domain_configs_elder_domain_unique UNIQUE (elder_id, domain)
);

ALTER TABLE public.domain_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own domain configs"
  ON public.domain_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = domain_configs.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own domain configs"
  ON public.domain_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = domain_configs.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own domain configs"
  ON public.domain_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = domain_configs.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = domain_configs.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own domain configs"
  ON public.domain_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = domain_configs.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  name text NOT NULL,
  dosage text NOT NULL,
  dosage_unit text NOT NULL,
  times text[] NOT NULL DEFAULT '{}',
  days_of_week text[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date date,
  timing_preference public.medication_timing NOT NULL DEFAULT 'no_preference',
  instructions text,
  notify_care_partner public.notify_care_partner_mode NOT NULL DEFAULT 'only_missed',
  escalation_minutes integer NOT NULL DEFAULT 30
    CHECK (escalation_minutes >= 5 AND escalation_minutes <= 240),
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX medications_elder_id_idx ON public.medications (elder_id);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own medications"
  ON public.medications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = medications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own medications"
  ON public.medications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = medications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own medications"
  ON public.medications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = medications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = medications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own medications"
  ON public.medications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = medications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- food_routines
-- ---------------------------------------------------------------------------
CREATE TABLE public.food_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  meal_name text NOT NULL,
  meal_type public.meal_type NOT NULL DEFAULT 'custom',
  check_in_time time NOT NULL,
  start_date date NOT NULL,
  end_date date,
  days_of_week text[] NOT NULL DEFAULT '{}',
  frequency public.food_frequency NOT NULL DEFAULT 'daily',
  notify_care_partner public.notify_care_partner_mode NOT NULL DEFAULT 'only_missed',
  escalation_minutes integer NOT NULL DEFAULT 45
    CHECK (escalation_minutes >= 5 AND escalation_minutes <= 240),
  notes text
);

CREATE INDEX food_routines_elder_id_idx ON public.food_routines (elder_id);

ALTER TABLE public.food_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own food routines"
  ON public.food_routines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = food_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own food routines"
  ON public.food_routines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = food_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own food routines"
  ON public.food_routines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = food_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = food_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own food routines"
  ON public.food_routines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = food_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- health_routines
-- ---------------------------------------------------------------------------
CREATE TABLE public.health_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  name text NOT NULL,
  type public.health_routine_type NOT NULL DEFAULT 'general_wellness',
  frequency public.health_frequency NOT NULL DEFAULT 'daily',
  time time NOT NULL,
  start_date date NOT NULL,
  end_date date,
  days_of_week text[] NOT NULL DEFAULT '{}',
  question text NOT NULL DEFAULT 'Are you feeling well today?',
  answer_type public.answer_type NOT NULL DEFAULT 'yes_no',
  notify_care_partner public.notify_care_partner_mode NOT NULL DEFAULT 'only_missed',
  escalation_minutes integer NOT NULL DEFAULT 60
    CHECK (escalation_minutes >= 5 AND escalation_minutes <= 240),
  typical_bedtime time,
  typical_wake_time time
);

CREATE INDEX health_routines_elder_id_idx ON public.health_routines (elder_id);

ALTER TABLE public.health_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own health routines"
  ON public.health_routines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = health_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own health routines"
  ON public.health_routines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = health_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own health routines"
  ON public.health_routines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = health_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = health_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own health routines"
  ON public.health_routines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = health_routines.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- checkins
-- ---------------------------------------------------------------------------
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  domain public.care_domain NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status public.checkin_status NOT NULL DEFAULT 'scheduled',
  response_channel public.response_channel,
  response_value text,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  missed_at timestamptz,
  escalated_at timestamptz,
  wa_message_id text
);

CREATE INDEX checkins_elder_domain_scheduled_idx
  ON public.checkins (elder_id, domain, scheduled_for);
CREATE INDEX checkins_status_scheduled_idx
  ON public.checkins (status, scheduled_for);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own checkins"
  ON public.checkins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = checkins.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own checkins"
  ON public.checkins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = checkins.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own checkins"
  ON public.checkins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = checkins.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = checkins.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own checkins"
  ON public.checkins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = checkins.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- checkin_medication_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.checkin_medication_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins (id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications (id) ON DELETE CASCADE,
  taken boolean NOT NULL DEFAULT false
);

CREATE INDEX checkin_medication_items_checkin_id_idx
  ON public.checkin_medication_items (checkin_id);

ALTER TABLE public.checkin_medication_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own checkin medication items"
  ON public.checkin_medication_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = checkin_medication_items.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own checkin medication items"
  ON public.checkin_medication_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = checkin_medication_items.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own checkin medication items"
  ON public.checkin_medication_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = checkin_medication_items.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = checkin_medication_items.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own checkin medication items"
  ON public.checkin_medication_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = checkin_medication_items.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- voice_replies
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins (id) ON DELETE CASCADE,
  audio_path text NOT NULL,
  transcript text,
  confidence numeric,
  provider text,
  reask_count integer NOT NULL DEFAULT 0 CHECK (reask_count >= 0 AND reask_count <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voice_replies_checkin_id_idx ON public.voice_replies (checkin_id);

ALTER TABLE public.voice_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own voice replies"
  ON public.voice_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = voice_replies.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own voice replies"
  ON public.voice_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = voice_replies.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own voice replies"
  ON public.voice_replies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = voice_replies.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = voice_replies.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own voice replies"
  ON public.voice_replies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.checkins c
      JOIN public.elders e ON e.id = c.elder_id
      WHERE c.id = voice_replies.checkin_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- sos_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  status public.sos_status NOT NULL DEFAULT 'open',
  nudges_sent integer NOT NULL DEFAULT 0 CHECK (nudges_sent >= 0 AND nudges_sent <= 4),
  resolved_by_role public.sos_resolver_role,
  resolved_by_id uuid,
  resolved_channel public.sos_resolve_channel,
  resolved_at timestamptz
);

CREATE INDEX sos_events_elder_id_idx ON public.sos_events (elder_id);
CREATE INDEX sos_events_status_idx ON public.sos_events (status);

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own sos events"
  ON public.sos_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = sos_events.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own sos events"
  ON public.sos_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = sos_events.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own sos events"
  ON public.sos_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = sos_events.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = sos_events.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own sos events"
  ON public.sos_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = sos_events.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- sos_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.sos_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_event_id uuid NOT NULL REFERENCES public.sos_events (id) ON DELETE CASCADE,
  recipient_role public.sos_recipient_role NOT NULL,
  recipient_id uuid NOT NULL,
  nudge_index integer NOT NULL CHECK (nudge_index >= 0 AND nudge_index <= 3),
  wa_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE INDEX sos_notifications_sos_event_id_idx ON public.sos_notifications (sos_event_id);

ALTER TABLE public.sos_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own sos notifications"
  ON public.sos_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sos_events s
      JOIN public.elders e ON e.id = s.elder_id
      WHERE s.id = sos_notifications.sos_event_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own sos notifications"
  ON public.sos_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sos_events s
      JOIN public.elders e ON e.id = s.elder_id
      WHERE s.id = sos_notifications.sos_event_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own sos notifications"
  ON public.sos_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sos_events s
      JOIN public.elders e ON e.id = s.elder_id
      WHERE s.id = sos_notifications.sos_event_id
        AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sos_events s
      JOIN public.elders e ON e.id = s.elder_id
      WHERE s.id = sos_notifications.sos_event_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own sos notifications"
  ON public.sos_notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sos_events s
      JOIN public.elders e ON e.id = s.elder_id
      WHERE s.id = sos_notifications.sos_event_id
        AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- ct_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.ct_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders (id) ON DELETE CASCADE,
  care_partner_id uuid NOT NULL REFERENCES public.care_partners (id) ON DELETE CASCADE,
  type public.ct_notification_type NOT NULL,
  checkin_id uuid REFERENCES public.checkins (id) ON DELETE SET NULL,
  wa_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ct_notifications_care_partner_id_idx ON public.ct_notifications (care_partner_id);
CREATE INDEX ct_notifications_elder_id_idx ON public.ct_notifications (elder_id);

ALTER TABLE public.ct_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads own ct notifications"
  ON public.ct_notifications FOR SELECT
  TO authenticated
  USING (
    care_partner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = ct_notifications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own ct notifications"
  ON public.ct_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    care_partner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = ct_notifications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own ct notifications"
  ON public.ct_notifications FOR UPDATE
  TO authenticated
  USING (
    care_partner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = ct_notifications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    care_partner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = ct_notifications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own ct notifications"
  ON public.ct_notifications FOR DELETE
  TO authenticated
  USING (
    care_partner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = ct_notifications.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- message_templates (elder_id NULL = system default; SELECT for authenticated only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders (id) ON DELETE CASCADE,
  domain public.message_domain NOT NULL,
  language text NOT NULL DEFAULT 'en',
  meta_template_name text NOT NULL,
  body text NOT NULL
);

CREATE INDEX message_templates_elder_id_idx ON public.message_templates (elder_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CT reads system or own message templates"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (
    elder_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = message_templates.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT inserts own message templates"
  ON public.message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    elder_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = message_templates.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT updates own message templates"
  ON public.message_templates FOR UPDATE
  TO authenticated
  USING (
    elder_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = message_templates.elder_id AND e.care_partner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    elder_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = message_templates.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

CREATE POLICY "CT deletes own message templates"
  ON public.message_templates FOR DELETE
  TO authenticated
  USING (
    elder_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.elders e
      WHERE e.id = message_templates.elder_id AND e.care_partner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Harden out-of-band rls_auto_enable helper (event trigger must be recreated in Prod)
-- ---------------------------------------------------------------------------
-- PUBLIC default grant also grants anon/authenticated via inheritance; revoke all three.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
