create table if not exists public.chat_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  account_role text not null check (account_role in ('visitor', 'learner', 'instructor', 'in_progress', 'admin')),
  attempt_type text not null,
  requested_label text,
  requested_path text,
  source_path text,
  message_excerpt text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists chat_security_events_created_at_idx
  on public.chat_security_events (created_at desc);

create index if not exists chat_security_events_user_id_idx
  on public.chat_security_events (user_id);

alter table public.chat_security_events enable row level security;

revoke all on public.chat_security_events from anon;
grant insert on public.chat_security_events to authenticated;
grant select on public.chat_security_events to authenticated;
grant all on public.chat_security_events to service_role;

drop policy if exists "Admins read chat security events" on public.chat_security_events;
create policy "Admins read chat security events"
  on public.chat_security_events
  for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists "Users can record own chat security events" on public.chat_security_events;
create policy "Users can record own chat security events"
  on public.chat_security_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
