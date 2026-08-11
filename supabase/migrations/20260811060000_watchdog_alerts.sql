-- Supports WF-7 Dispatch Watchdog: records which check-ins have already been
-- reported, so each is alerted on exactly once. Applied directly 11 Aug 2026;
-- this file is the committed record. Written idempotently so it is safe to
-- re-run against the live database.

create table if not exists public.watchdog_alerts (
  checkin_id uuid primary key
    references public.checkins(id) on delete cascade,
  alerted_at timestamptz not null default now()
);

alter table public.watchdog_alerts enable row level security;
-- Intentionally no policies: n8n connects directly via Postgres and bypasses
-- RLS; no frontend access is intended. RLS-on-with-no-policy keeps get_advisors
-- clean rather than reporting an unprotected table.

-- Seed: treat everything already undelivered at install time as "already
-- reported", so removing the previous 2-hour window does not fire one large
-- alert about history. 35 rows across 8 elders at time of application.
insert into public.watchdog_alerts (checkin_id, alerted_at)
select id, now()
from public.checkins
where sent_at is null and cancelled_at is null and scheduled_for < now()
on conflict (checkin_id) do nothing;
