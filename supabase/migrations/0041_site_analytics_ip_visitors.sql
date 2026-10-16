-- Tracks public website visitors by a one-way IP hash so admin analytics can
-- count new network visitors without storing raw IP addresses.

alter table if exists public.site_analytics_events
  add column if not exists visitor_ip_hash text;

create index if not exists site_analytics_events_ip_hash_idx
  on public.site_analytics_events (visitor_ip_hash)
  where visitor_ip_hash is not null;

create table if not exists public.site_analytics_visitors (
  visitor_ip_hash text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_path text,
  last_path text,
  first_session_id text,
  last_session_id text,
  first_user_agent text,
  last_user_agent text,
  visits_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_analytics_visitors_first_seen_idx
  on public.site_analytics_visitors (first_seen_at desc);

create index if not exists site_analytics_visitors_last_seen_idx
  on public.site_analytics_visitors (last_seen_at desc);

alter table public.site_analytics_visitors enable row level security;

grant select on public.site_analytics_visitors to authenticated;
grant insert, update on public.site_analytics_visitors to service_role;

drop policy if exists "Admins can read site analytics visitors" on public.site_analytics_visitors;

create policy "Admins can read site analytics visitors"
  on public.site_analytics_visitors
  for select
  to authenticated
  using (private.current_user_is_admin());
