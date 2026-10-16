-- Records automatic learner warning, suspension, and revocation ladder events.

create table if not exists public.learner_account_enforcement_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  booking_reference text,
  enforcement_key text not null,
  enforcement_action text not null check (enforcement_action in ('warning', 'suspension', 'revocation')),
  event_count integer not null check (event_count >= 0),
  window_days integer not null default 90 check (window_days > 0),
  reason text not null,
  ban_duration text,
  created_at timestamptz not null default now(),
  unique (learner_id, enforcement_key)
);

create index if not exists learner_enforcement_learner_created_idx
on public.learner_account_enforcement_events(learner_id, created_at desc);

alter table public.learner_account_enforcement_events enable row level security;

drop policy if exists "Admins read learner enforcement events" on public.learner_account_enforcement_events;
create policy "Admins read learner enforcement events"
on public.learner_account_enforcement_events for select
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins manage learner enforcement events" on public.learner_account_enforcement_events;
create policy "Admins manage learner enforcement events"
on public.learner_account_enforcement_events for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

grant select, insert, update, delete on public.learner_account_enforcement_events to authenticated, service_role;
grant select, insert, update, delete on public.marketing_subscribers to authenticated, service_role;
