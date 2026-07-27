-- A4.2 fix — FR-ON-7 + unique_violation diagnostics (Architecture.md §5.7).
-- approved_by_ct stays false at Care Circle draft; Review sets true with
-- consent_data_sharing_at. Unique WhatsApp errors match CONSTRAINT_NAME exactly.

CREATE OR REPLACE FUNCTION public.save_care_circle_draft(
  p_care_partner jsonb,
  p_elder jsonb,
  p_local_buddy jsonb DEFAULT NULL,
  p_doctor jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_elder_id uuid;
  v_existing_draft_id uuid;
  v_cp_first text;
  v_cp_last text;
  v_cp_email text;
  v_cp_wa text;
  v_cp_tz text;
  v_elder_existing_id uuid;
  v_constraint text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_cp_wa := nullif(trim(p_care_partner->>'whatsapp_number'), '');
  v_cp_tz := nullif(trim(p_care_partner->>'timezone'), '');
  IF v_cp_wa IS NULL THEN
    RAISE EXCEPTION 'Care partner WhatsApp number is required';
  END IF;
  IF v_cp_tz IS NULL THEN
    RAISE EXCEPTION 'Care partner timezone is required';
  END IF;

  -- Names/email from payload when inserting; on update keep existing names
  -- (Care Circle does not re-collect them — Architecture §5.7).
  SELECT first_name, last_name, email
    INTO v_cp_first, v_cp_last, v_cp_email
  FROM public.care_partners
  WHERE id = v_uid;

  IF NOT FOUND THEN
    v_cp_first := nullif(trim(p_care_partner->>'first_name'), '');
    v_cp_last := nullif(trim(p_care_partner->>'last_name'), '');
    v_cp_email := lower(nullif(trim(p_care_partner->>'email'), ''));
    IF v_cp_first IS NULL OR v_cp_last IS NULL OR v_cp_email IS NULL THEN
      RAISE EXCEPTION 'Care partner profile incomplete — sign-up names and email required';
    END IF;

    INSERT INTO public.care_partners (
      id, first_name, last_name, email, whatsapp_number, timezone
    ) VALUES (
      v_uid, v_cp_first, v_cp_last, v_cp_email, v_cp_wa, v_cp_tz
    );
  ELSE
    UPDATE public.care_partners
    SET
      whatsapp_number = v_cp_wa,
      timezone = v_cp_tz
    WHERE id = v_uid;
  END IF;

  v_elder_existing_id := nullif(trim(p_elder->>'id'), '')::uuid;

  -- One-draft invariant
  SELECT id INTO v_existing_draft_id
  FROM public.elders
  WHERE care_partner_id = v_uid
    AND active = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_draft_id IS NOT NULL
     AND (v_elder_existing_id IS NULL OR v_elder_existing_id IS DISTINCT FROM v_existing_draft_id) THEN
    RAISE EXCEPTION 'You have an unfinished Loved One draft — resume or discard it first';
  END IF;

  IF v_elder_existing_id IS NOT NULL THEN
    -- Must own this draft
    IF NOT EXISTS (
      SELECT 1 FROM public.elders
      WHERE id = v_elder_existing_id
        AND care_partner_id = v_uid
        AND active = false
    ) THEN
      RAISE EXCEPTION 'Loved One draft not found or not owned by you';
    END IF;

    UPDATE public.elders SET
      first_name = trim(p_elder->>'first_name'),
      last_name = trim(p_elder->>'last_name'),
      age = (p_elder->>'age')::smallint,
      relationship_to_care_partner = trim(p_elder->>'relationship_to_care_partner'),
      whatsapp_number = trim(p_elder->>'whatsapp_number'),
      timezone = trim(p_elder->>'timezone'),
      address = trim(p_elder->>'address'),
      active = false
    WHERE id = v_elder_existing_id
      AND care_partner_id = v_uid;

    v_elder_id := v_elder_existing_id;
  ELSE
    -- Reuse own draft row with same WhatsApp if present
    SELECT id INTO v_elder_id
    FROM public.elders
    WHERE care_partner_id = v_uid
      AND whatsapp_number = trim(p_elder->>'whatsapp_number')
      AND active = false
    LIMIT 1;

    IF v_elder_id IS NOT NULL THEN
      UPDATE public.elders SET
        first_name = trim(p_elder->>'first_name'),
        last_name = trim(p_elder->>'last_name'),
        age = (p_elder->>'age')::smallint,
        relationship_to_care_partner = trim(p_elder->>'relationship_to_care_partner'),
        timezone = trim(p_elder->>'timezone'),
        address = trim(p_elder->>'address'),
        active = false
      WHERE id = v_elder_id
        AND care_partner_id = v_uid;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.elders
        WHERE care_partner_id = v_uid
          AND whatsapp_number = trim(p_elder->>'whatsapp_number')
          AND active = true
      ) THEN
        RAISE EXCEPTION 'This WhatsApp number is already registered to a Loved One';
      END IF;

      INSERT INTO public.elders (
        care_partner_id,
        first_name,
        last_name,
        age,
        relationship_to_care_partner,
        whatsapp_number,
        timezone,
        address,
        consent_attested_by_ct,
        active
      ) VALUES (
        v_uid,
        trim(p_elder->>'first_name'),
        trim(p_elder->>'last_name'),
        (p_elder->>'age')::smallint,
        trim(p_elder->>'relationship_to_care_partner'),
        trim(p_elder->>'whatsapp_number'),
        trim(p_elder->>'timezone'),
        trim(p_elder->>'address'),
        false,
        false
      )
      RETURNING id INTO v_elder_id;

      INSERT INTO public.domain_configs (
        elder_id, domain, enabled, frequency, ct_notification, escalate_to
      ) VALUES
        (v_elder_id, 'medication', false, '{"times":[]}'::jsonb, 'only_missed', 'care_partner'),
        (v_elder_id, 'food', false, '{"times":[]}'::jsonb, 'only_missed', 'care_partner'),
        (v_elder_id, 'health', false, '{"times":[]}'::jsonb, 'only_missed', 'care_partner');
    END IF;
  END IF;

  -- Local Buddy: engaged → upsert; skipped (null) → delete any row
  IF p_local_buddy IS NULL THEN
    DELETE FROM public.local_caregivers WHERE elder_id = v_elder_id;
  ELSE
    INSERT INTO public.local_caregivers (
      elder_id, first_name, last_name, whatsapp_number
    ) VALUES (
      v_elder_id,
      trim(p_local_buddy->>'first_name'),
      trim(p_local_buddy->>'last_name'),
      trim(p_local_buddy->>'whatsapp_number')
    )
    ON CONFLICT (elder_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      whatsapp_number = EXCLUDED.whatsapp_number;
  END IF;

  -- Doctor: engaged → upsert with approved_by_ct = false (FR-ON-7).
  -- Review sets approved_by_ct = true with consent_data_sharing_at.
  -- ON CONFLICT does not touch approved_by_ct (preserves Review approval).
  IF p_doctor IS NULL THEN
    DELETE FROM public.doctors WHERE elder_id = v_elder_id;
  ELSE
    INSERT INTO public.doctors (
      elder_id,
      first_name,
      last_name,
      whatsapp_number,
      clinic_name,
      approved_by_ct
    ) VALUES (
      v_elder_id,
      trim(p_doctor->>'first_name'),
      trim(p_doctor->>'last_name'),
      nullif(trim(p_doctor->>'whatsapp_number'), ''),
      trim(p_doctor->>'clinic_name'),
      false
    )
    ON CONFLICT (elder_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      whatsapp_number = EXCLUDED.whatsapp_number,
      clinic_name = EXCLUDED.clinic_name;
  END IF;

  RETURN v_elder_id;
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'elders_whatsapp_number_unique' THEN
      RAISE EXCEPTION 'This WhatsApp number is already registered to a Loved One';
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.save_care_circle_draft(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_care_circle_draft(jsonb, jsonb, jsonb, jsonb) TO authenticated;
