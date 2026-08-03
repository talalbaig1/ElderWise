-- B1.5 consent flow: the welcome-message lifecycle
-- Architecture §8 WF-0 / WF-2. Without consent_requested_at, a cron re-sends
-- the welcome every minute to an elder who has not yet replied — which is how
-- a WhatsApp Business account gets flagged (R1: one account, no backup).

alter table public.elders
  add column if not exists consent_requested_at timestamptz,
  add column if not exists consent_declined_at  timestamptz;

comment on column public.elders.consent_requested_at is
  'When the welcome/consent template was sent. NULL = not yet sent. Set by WF-0. Non-NULL suppresses re-send.';
comment on column public.elders.consent_declined_at is
  'Elder declined in-channel. Terminal: never schedule, never re-ask. Distinct from silence (both timestamps NULL after request).';

create index if not exists elders_consent_pending_idx
  on public.elders (active, consent_requested_at)
  where active = true and consent_confirmed_at is null and consent_declined_at is null;
