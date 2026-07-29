ALTER TABLE public.elders
  ADD CONSTRAINT elders_whatsapp_e164
  CHECK (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE public.care_partners
  ADD CONSTRAINT care_partners_whatsapp_e164
  CHECK (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE public.local_caregivers
  ADD CONSTRAINT local_caregivers_whatsapp_e164
  CHECK (
    (whatsapp_number IS NULL)
    OR (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$')
  );

ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_whatsapp_e164
  CHECK (
    (whatsapp_number IS NULL)
    OR (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$')
  );
