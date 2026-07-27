-- supabase/seed.sql — A4.5 Dev fixtures ONLY (not a migration)
-- Architecture.md §5 · Phases A4.5 · scripts/a4-seed-checklist.md
-- Prerequisites: Auth user must already exist with id
--   a0000000-0000-4000-8000-000000000001  (created via Auth Admin API / create-seed-user.mjs)
-- CT timezone Asia/Riyadh · EP timezone Asia/Kolkata (M14)
-- All FKs ON DELETE CASCADE — wipe is scoped to the seed care_partner only.
-- System message_templates (elder_id NULL) are replaced explicitly (no cascade).
--
-- Demo content: populated dashboard, check-in history, missed dose, resolved SOS.
-- Voice Journal: no table in MVP (Architecture) — screen stays empty state.

begin;

delete from public.care_partners
  where id = 'a0000000-0000-4000-8000-000000000001';

delete from public.message_templates
  where elder_id is null;

insert into public.care_partners (
  id, first_name, last_name, email, whatsapp_number, timezone, address
) values (
  'a0000000-0000-4000-8000-000000000001',
  'Talal',
  'Seed',
  'ct.seed@elderwise.dev',
  '+966500000001',
  'Asia/Riyadh',
  'Olaya St, Riyadh 12213, Saudi Arabia'
);

insert into public.elders (
  id, care_partner_id, first_name, last_name, age, relationship_to_care_partner,
  gender, whatsapp_number, timezone, address,
  consent_attested_by_ct, consent_attested_at, consent_confirmed_at,
  consent_med_accuracy_at, consent_data_sharing_at, consent_terms_at,
  consent_terms_version, active
) values (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'Kamala', 'Sharma', 74, 'Mother',
  'female', '+919876543210',
  'Asia/Kolkata',
  '14 MG Road, Bengaluru 560001, Karnataka, India',
  true, timestamptz '2026-07-01 08:00:00+03',
  timestamptz '2026-07-01 12:30:00+05:30',
  timestamptz '2026-07-01 08:05:00+03',
  timestamptz '2026-07-01 08:05:00+03',
  timestamptz '2026-07-01 08:05:00+03',
  '2026-07-v1',
  true
);

insert into public.local_caregivers (
  id, elder_id, first_name, last_name, whatsapp_number, action_plan
) values (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000002',
  'Priya', 'Nair', '+919811112222',
  'Knock, wait 2 min, call CT if no answer'
);

-- doctors.timezone left null (A4: not collected; share page uses elder TZ)
insert into public.doctors (
  id, elder_id, first_name, last_name, whatsapp_number, clinic_name, timezone, approved_by_ct
) values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000002',
  'Anil', 'Mehta', '+919833334444',
  'Apollo Clinic, Bengaluru', null, true
);

-- Derived frequency = union of enabled routine times (08:00, 13:00, 20:00 for meds+food; health 09:00)
insert into public.domain_configs (id, elder_id, domain, enabled, frequency, ct_notification, escalate_to) values
  ('a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000002', 'medication', true,
   '{"times":["08:00","20:00"]}'::jsonb, 'only_missed', 'care_partner'),
  ('a0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000002', 'health', true,
   '{"times":["09:00"]}'::jsonb, 'only_missed', 'care_partner'),
  ('a0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000002', 'food', true,
   '{"times":["08:30","13:00"]}'::jsonb, 'only_missed', 'care_partner');

-- Medications: name includes strength; dosage = quantity; unit from UI set; exactly one time per row
insert into public.medications (
  id, elder_id, enabled, name, dosage, dosage_unit, times, days_of_week,
  start_date, end_date, timing_preference, notify_care_partner, escalation_minutes, active
) values
  ('a0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000002', true,
   'Amlodipine 5mg', '1', 'TAB', array['08:00'],
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', null, 'before_food', 'only_missed', 30, true),
  ('a0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000002', true,
   'Metformin 500mg', '1', 'TAB', array['08:00'],
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', null, 'after_food', 'every_time', 30, true),
  ('a0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000002', true,
   'Metformin 500mg', '1', 'TAB', array['20:00'],
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', null, 'after_food', 'every_time', 30, true),
  ('a0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000002', true,
   'Atorvastatin 10mg', '1', 'TAB', array['20:00'],
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   '2026-07-01', null, 'after_food', 'only_missed', 45, true);

insert into public.food_routines (
  id, elder_id, enabled, meal_name, meal_type, check_in_time, start_date, end_date,
  days_of_week, frequency, notify_care_partner, escalation_minutes
) values
  ('a0000000-0000-4000-8000-000000000040',
   'a0000000-0000-4000-8000-000000000002', true, 'Breakfast', 'breakfast', time '08:30',
   '2026-07-01', null,
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'daily', 'only_missed', 45),
  ('a0000000-0000-4000-8000-000000000041',
   'a0000000-0000-4000-8000-000000000002', true, 'Lunch', 'lunch', time '13:00',
   '2026-07-01', null,
   array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'daily', 'only_missed', 45);

insert into public.health_routines (
  id, elder_id, enabled, name, type, frequency, time, start_date, end_date,
  days_of_week, question, answer_type, notify_care_partner, escalation_minutes
) values (
  'a0000000-0000-4000-8000-000000000050',
  'a0000000-0000-4000-8000-000000000002', true, 'Morning wellbeing', 'general_wellness',
  'daily', time '09:00', '2026-07-01', null,
  array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
  'Are you feeling well today?', 'yes_no', 'only_missed', 60
);

-- checkins: mix of statuses + missed medication + voice responded (M4a)
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
  -- 08:00 IST medication — taken
  ('a0000000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-20 02:30:00+00', timestamptz '2026-07-20 02:31:00+00', 'responded',
   'button', 'yes_all', timestamptz '2026-07-20 02:40:00+00', null, null, null),
  -- missed evening medication (demo: at least one missed dose)
  ('a0000000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-19 14:30:00+00', timestamptz '2026-07-19 14:31:00+00', 'missed',
   null, null, null, timestamptz '2026-07-19 15:01:00+00',
   timestamptz '2026-07-19 15:35:00+00', timestamptz '2026-07-19 15:36:00+00'),
  ('a0000000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000002', 'health',
   timestamptz '2026-07-17 03:30:00+00', timestamptz '2026-07-17 03:31:00+00', 'responded',
   'voice', 'yes', timestamptz '2026-07-17 03:45:00+00', null, null, null),
  ('a0000000-0000-4000-8000-000000000066', 'a0000000-0000-4000-8000-000000000002', 'food',
   timestamptz '2026-07-18 02:00:00+00', timestamptz '2026-07-18 02:01:00+00', 'responded',
   'button', 'yes', timestamptz '2026-07-18 02:10:00+00', null, null, null),
  ('a0000000-0000-4000-8000-000000000067', 'a0000000-0000-4000-8000-000000000002', 'medication',
   timestamptz '2026-07-25 02:30:00+00', timestamptz '2026-07-25 02:31:00+00', 'responded',
   'button', 'yes_all', timestamptz '2026-07-25 02:38:00+00', null, null, null);

insert into public.checkin_medication_items (id, checkin_id, medication_id, taken) values
  ('a0000000-0000-4000-8000-000000000070', 'a0000000-0000-4000-8000-000000000063',
   'a0000000-0000-4000-8000-000000000030', true),
  ('a0000000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000063',
   'a0000000-0000-4000-8000-000000000031', true),
  ('a0000000-0000-4000-8000-000000000072', 'a0000000-0000-4000-8000-000000000067',
   'a0000000-0000-4000-8000-000000000030', true),
  ('a0000000-0000-4000-8000-000000000073', 'a0000000-0000-4000-8000-000000000067',
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

-- status required (A4); sent rows need wa_message_id + sent_at
insert into public.sos_notifications (
  id, sos_event_id, recipient_role, recipient_id, nudge_index,
  status, wa_message_id, sent_at, skip_reason
) values
  ('a0000000-0000-4000-8000-000000000090', 'a0000000-0000-4000-8000-000000000080', 'care_partner',
   'a0000000-0000-4000-8000-000000000001', 0,
   'sent', 'wamid.seed.sos.080.ct.0', timestamptz '2026-07-18 10:00:05+00', null),
  ('a0000000-0000-4000-8000-000000000091', 'a0000000-0000-4000-8000-000000000080', 'local_caregiver',
   'a0000000-0000-4000-8000-000000000010', 0,
   'sent', 'wamid.seed.sos.080.lct.0', timestamptz '2026-07-18 10:00:05+00', null),
  ('a0000000-0000-4000-8000-000000000092', 'a0000000-0000-4000-8000-000000000080', 'doctor',
   'a0000000-0000-4000-8000-000000000011', 0,
   'sent', 'wamid.seed.sos.080.dr.0', timestamptz '2026-07-18 10:00:06+00', null),
  ('a0000000-0000-4000-8000-000000000093', 'a0000000-0000-4000-8000-000000000081', 'care_partner',
   'a0000000-0000-4000-8000-000000000001', 0,
   'sent', 'wamid.seed.sos.081.ct.0', timestamptz '2026-07-23 06:15:05+00', null);

insert into public.ct_notifications (id, elder_id, care_partner_id, type, checkin_id, sent_at) values
  ('a0000000-0000-4000-8000-0000000000a0', 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'interaction',
   'a0000000-0000-4000-8000-000000000063', timestamptz '2026-07-20 02:41:00+00'),
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', 'missed',
   'a0000000-0000-4000-8000-000000000064', timestamptz '2026-07-19 15:36:00+00');

-- System defaults for Track B (Templates.md names). elder_id NULL = global.
insert into public.message_templates (id, elder_id, domain, language, meta_template_name, body) values
  ('a0000000-0000-4000-8000-0000000000b0', null, 'medication', 'en', 'elderwise_ep_welcome',
   'Hello {{1}}. This is ElderWise. Your family, {{2}}, has asked us to check in with you each day.'),
  ('a0000000-0000-4000-8000-0000000000b1', null, 'medication', 'en', 'elderwise_ep_medication_checkin',
   'Good morning {{1}} — it''s {{2}}, time for your medicines: {{3}}. Did you take them?'),
  ('a0000000-0000-4000-8000-0000000000b2', null, 'health', 'en', 'elderwise_ep_health_checkin',
   'Hello {{1}} — just a quick check. Are you feeling well today?'),
  ('a0000000-0000-4000-8000-0000000000b3', null, 'food', 'en', 'elderwise_ep_food_checkin',
   'Hi {{1}} — have you had {{2}} today?'),
  ('a0000000-0000-4000-8000-0000000000b4', null, 'medication', 'en', 'elderwise_ep_medication_reminder',
   'Hi {{1}} — gentle reminder about your medicines due at {{2}}: {{3}}.'),
  ('a0000000-0000-4000-8000-0000000000b5', null, 'health', 'en', 'elderwise_ep_health_reminder',
   'Hi {{1}} — still checking in about how you are feeling today.'),
  ('a0000000-0000-4000-8000-0000000000b6', null, 'food', 'en', 'elderwise_ep_food_reminder',
   'Hi {{1}} — gentle reminder about {{2}}.'),
  ('a0000000-0000-4000-8000-0000000000b7', null, 'medication', 'en', 'elderwise_ct_interaction_notice',
   'ElderWise update — {{1}}. {{2}}: {{3}}. Recorded at {{4}}.'),
  ('a0000000-0000-4000-8000-0000000000b8', null, 'medication', 'en', 'elderwise_ct_missed_notice',
   'ElderWise — {{1}} hasn''t responded. {{2}} was due at {{3}}.'),
  ('a0000000-0000-4000-8000-0000000000b9', null, 'sos', 'en', 'elderwise_sos_alert_ct',
   'ElderWise SOS — {{1}} needs help. Address: {{2}}.'),
  ('a0000000-0000-4000-8000-0000000000ba', null, 'sos', 'en', 'elderwise_sos_alert_lct',
   'ElderWise SOS — {{1}} needs help nearby. Address: {{2}}.'),
  ('a0000000-0000-4000-8000-0000000000bb', null, 'sos', 'en', 'elderwise_sos_alert_doctor',
   'ElderWise SOS — patient {{1}}. Address: {{2}}.'),
  ('a0000000-0000-4000-8000-0000000000bc', null, 'sos', 'en', 'elderwise_sos_nudge',
   'ElderWise SOS reminder — {{1}} still needs a response.'),
  ('a0000000-0000-4000-8000-0000000000bd', null, 'sos', 'en', 'elderwise_sos_resolved',
   'ElderWise SOS resolved for {{1}}.');

commit;
