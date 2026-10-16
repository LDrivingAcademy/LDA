create table if not exists public.cookie_consent_events (
  id uuid primary key default gen_random_uuid(),
  consent_id text not null check (char_length(consent_id) between 1 and 80),
  action text not null check (action in ('accept_all', 'customise', 'reject')),
  analytics_enabled boolean not null,
  targeted_advertising_enabled boolean not null,
  path text,
  viewport_width integer,
  viewport_height integer,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists cookie_consent_events_created_idx
  on public.cookie_consent_events (created_at desc);

create index if not exists cookie_consent_events_choice_idx
  on public.cookie_consent_events (analytics_enabled, targeted_advertising_enabled, created_at desc);

alter table public.cookie_consent_events enable row level security;

revoke all on public.cookie_consent_events from anon;
revoke all on public.cookie_consent_events from authenticated;
grant select on public.cookie_consent_events to authenticated;
grant all on public.cookie_consent_events to service_role;

drop policy if exists "Admins read cookie consent audit" on public.cookie_consent_events;
create policy "Admins read cookie consent audit"
  on public.cookie_consent_events
  for select
  to authenticated
  using ((select private.current_user_is_admin()));

