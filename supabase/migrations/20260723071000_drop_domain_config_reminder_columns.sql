-- Architecture.md v1.4 §5.2 adopts the per-routine model — reminder delay and
-- notify_care_partner live on medications / food_routines / health_routines,
-- NOT on domain_configs. These two columns were added in error and are removed
-- here. domain_configs retains the 7 columns of v1.4 §5.2:
-- id, elder_id, domain, enabled, frequency, ct_notification, escalate_to.

ALTER TABLE public.domain_configs DROP COLUMN reminder_delay_minutes;
ALTER TABLE public.domain_configs DROP COLUMN escalation_enabled;
