-- Origin column for doctor share links + one live Care-Partner-issued link per elder.
-- Pre-existing active links must be revoked before this index can be created (one-off data op; not in this file).

alter table public.doctor_share_links
  add column if not exists sos_event_id uuid null
    references public.sos_events(id) on delete set null;

comment on column public.doctor_share_links.sos_event_id is
  'Null = issued from the dashboard by a Care Partner. Non-null = minted by WF-4 for that SOS event.';

-- Cap: at most one live Care-Partner-issued link per elder.
-- SOS-minted links (sos_event_id not null) are deliberately uncapped.
create unique index if not exists doctor_share_links_one_active_cp_link
  on public.doctor_share_links (elder_id)
  where revoked_at is null and sos_event_id is null;
