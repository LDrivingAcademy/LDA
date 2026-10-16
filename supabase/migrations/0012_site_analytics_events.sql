create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('pageview', 'click', 'engagement')),
  visitor_id text not null,
  session_id text not null,
  path text not null,
  section text,
  title text,
  referrer text,
  target_label text,
  target_type text,
  target_href text,
  duration_ms integer,
  viewport_width integer,
  viewport_height integer,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists site_analytics_events_created_idx
on public.site_analytics_events(created_at desc);

create index if not exists site_analytics_events_path_idx
on public.site_analytics_events(path, created_at desc);

create index if not exists site_analytics_events_type_idx
on public.site_analytics_events(event_type, created_at desc);

create index if not exists site_analytics_events_session_idx
on public.site_analytics_events(session_id, created_at desc);

alter table public.site_analytics_events enable row level security;

grant select on public.site_analytics_events to authenticated;
grant insert on public.site_analytics_events to service_role;

drop policy if exists "Admins read site analytics" on public.site_analytics_events;
create policy "Admins read site analytics"
on public.site_analytics_events for select
to authenticated
using ((select private.current_user_is_admin()));
