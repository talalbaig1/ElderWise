-- supabase/seed.sql — A2.2 Dev fixtures ONLY (not a migration)
-- Architecture.md · Phases A2.2
-- Prerequisites: Auth user must already exist with id
--   a0000000-0000-4000-8000-000000000001  (created via Auth Admin API)
-- CT timezone Asia/Riyadh · EP timezone Asia/Kolkata (M14)
-- All FKs ON DELETE CASCADE — wipe is scoped to the seed care_partner only.

begin;

delete from public.care_partners
  where id = 'a0000000-0000-4000-8000-000000000001';

insert into public.care_partners (
  id, full_name, email, whatsapp_number, phone_number, timezone, address
) values (
  'a0000000-0000-4000-8000-000000000001',
  'Talal Seed',
  'ct.seed@elderwise.dev',
  '+966500000001',
  '+966500000001',
  'Asia/Riyadh',
  'Olaya St, Riyadh 12213, Saudi Arabia'
);

insert into public.elders (
  id, care_partner_id, first_name, surname, gender, whatsapp_number,
  timezone, address, consent_attested_by_ct, consent_attested_at,
  consent_confirmed_at, active
) values (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'Kamala', 'Sharma', 'female', '+919876543210',
  'Asia/Kolkata',
  '14 MG Road, Bengaluru 560001, Karnataka, India',
  true, timestamptz '2026-07-01 08:00:00+03',
  timestamptz '2026-07-01 12:30:00+05:30',
  true
);

insert into public.local_caregivers (id, elder_id, full_name, whatsapp_number, phone_number, action_plan)
values (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000002',
  'Priya Nair', '+919811112222', '+919811112222',
  'Knock, wait 2 min, call CT if no answer'
);

insert into public.doctors (
  id, elder_id, full_name, whatsapp_number, phone_number, address, timezone, approved_by_ct
) values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000002',
  'Dr. Anil Mehta', '+919833334444', '+919833334444',
  'Apollo Clinic, Bengaluru', 'Asia/Kolkata', true
);

insert into public.domain_configs (id, elder_id, domain, enabled, frequency, ct_notification, escalate_to) values
  ('a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000002', 'medication', true,
   '{"times":["08:00","20:00"]}'::jsonb, 'only_missed', 'care_partner'),
  ('a0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000002', 'health', true,
   '{"times":["09:00"]}'::jsonb, 'only_missed', 'care_partner'),
  ('a0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000002', 'food', true,
   '{"times":["13:00"]}'::jsonb, 'every_interaction', 'care_partner');

insert into public.medications (
  id, elder_id, enabled, name, dosage, dosage_unit, times, days_of_week,
  start_date, timing_preference, notify_care_partner, escalation_minutes, active
) values
  ('a0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000002', true,
   'Amlodipine', '5', 'mg', array['08:00'], array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', 'no_preference', 'only_missed', 30, true),
  ('a0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000002', true,
   'Metformin', '500', 'mg', array['08:00','20:00'], array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', 'after_food', 'every_time', 30, true),
  ('a0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000002', true,
   'Atorvastatin', '10', 'mg', array['20:00'], array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', 'after_food', 'only_missed', 45, true);

insert into public.food_routines (
  id, elder_id, enabled, meal_name, meal_type, check_in_time, start_date,
  days_of_week, frequency, notify_care_partner, escalation_minutes
) values (
  'a0000000-0000-4000-8000-000000000040',
  'a0000000-0000-4000-8000-000000000002', true, 'Lunch', 'lunch', time '13:00',
  '2026-07-01', array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
  'daily', 'only_missed', 45
);

insert into public.health_routines (
  id, elder_id, enabled, name, type, frequency, time, start_date,
  days_of_week, question, answer_type, notify_care_partner, escalation_minutes
) values (
  'a0000000-0000-4000-8000-000000000050',
  'a0000000-0000-4000-8000-000000000002', true, 'Morning wellbeing', 'general_wellness',
  'daily', time '09:00', '2026-07-01',
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
  'Are you feeling well today?', 'yes_no', 'only_missed', 60
);

-- checkins: every backend status + one voice responded (M4a)
insert into public.checkins (
  id, elder_id, domain, scheduled_for, sent_at, status,
  response_channel, response_value, responded_at, reminder_sent_at, missed_at, escalated_at
) values
  ('a0000000-0000-4000-8000-000000000060', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-24 02:30:00+00', null, 'scheduled',
   null, null, null, null, null, null),
  ('a0000000-0000-4000-8000-000000000061', 'a0000000-0000-4000-8000-000000000002', 'health',
   timestamptz '2026-07-22 03:30:00+00', timestamptz '2026-07-22 03:31:00+00', 'sent',
   null, null, null, null, null, null),
  ('a0000000-0000-4000-8000-000000000062', 'a0000000-0000-4000-8000-000000000002', 'food',
   timestamptz '2026-07-21 07:30:00+00', timestamptz '2026-07-21 07:31:00+00', 'reminded',
   null, null, null, timestamptz '2026-07-21 08:01:00+00', null, null),
  -- 08:00 IST medication slot (02:30 UTC) — Amlodipine + Metformin only
  ('a0000000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-20 02:30:00+00', timestamptz '2026-07-20 02:31:00+00', 'responded',
   'button', 'yes_all', timestamptz '2026-07-20 02:40:00+00', null, null, null),
  ('a0000000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-19 14:30:00+00', timestamptz '2026-07-19 14:31:00+00', 'missed',
   null, null, null, timestamptz '2026-07-19 15:01:00+00',
   timestamptz '2026-07-19 15:35:00+00', timestamptz '2026-07-19 15:36:00+00'),
  -- M4a voice reply fixture
  ('a0000000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000002', 'health',
   timestamptz '2026-07-17 03:30:00+00', timestamptz '2026-07-17 03:31:00+00', 'responded',
   'voice', 'yes', timestamptz '2026-07-17 03:45:00+00', null, null, null);

insert into public.checkin_medication_items (id, checkin_id, medication_id, taken) values
  ('a0000000-0000-4000-8000-000000000070', 'a0000000-0000-4000-8000-000000000063',
   'a0000000-0000-4000-8000-000000000030', true),
  ('a0000000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000063',
   'a0000000-0000-4000-8000-000000000031', true);

insert into public.voice_replies (
  id, checkin_id, audio_path, transcript, confidence, provider, reask_count
) values (
  'a0000000-0000-4000-8000-000000000075',
  'a0000000-0000-4000-8000-000000000065',
  'voice-replies/a0000000-0000-4000-8000-000000000065/reply.ogg',
  'Yes I am feeling well today',
  0.92,
  'google_speech',
  0
);

insert into public.sos_events (
  id, elder_id, triggered_at, status, nudges_sent,
  resolved_by_role, resolved_by_id, resolved_channel, resolved_at
) values
  ('a0000000-0000-4000-8000-000000000080', 'a0000000-0000-4000-8000-000000000002',
   timestamptz '2026-07-18 10:00:00+00', 'resolved', 2, 'care_partner',
   'a0000000-0000-4000-8000-000000000001', 'dashboard', timestamptz '2026-07-18 10:08:00+00'),
  ('a0000000-0000-4000-8000-000000000081', 'a0000000-0000-4000-8000-000000000002',
   timestamptz '2026-07-23 06:15:00+00', 'open', 1, null, null, null, null);

insert into public.sos_notifications (id, sos_event_id, recipient_role, recipient_id, nudge_index, sent_at) values
  ('a0000000-0000-4000-8000-000000000090', 'a0000000-0000-4000-8000-000000000080', 'care_partner',
   'a0000000-0000-4000-8000-000000000001', 0, timestamptz '2026-07-18 10:00:05+00'),
  ('a0000000-0000-4000-8000-000000000091', 'a0000000-0000-4000-8000-000000000080', 'local_caregiver',
   'a0000000-0000-4000-8000-000000000010', 0, timestamptz '2026-07-18 10:00:05+00'),
  ('a0000000-0000-4000-8000-000000000092', 'a0000000-0000-4000-8000-000000000081', 'care_partner',
   'a0000000-0000-4000-8000-000000000001', 0, timestamptz '2026-07-23 06:15:05+00');

insert into public.ct_notifications (id, elder_id, care_partner_id, type, checkin_id, sent_at) values
  ('a0000000-0000-4000-8000-0000000000a0', 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'interaction',
   'a0000000-0000-4000-8000-000000000063', timestamptz '2026-07-20 02:41:00+00'),
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'missed',
   'a0000000-0000-4000-8000-000000000064', timestamptz '2026-07-19 15:36:00+00');

commit;
