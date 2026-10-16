create extension if not exists "pgcrypto";

do $$ begin
  create type public.lda_auth_session_role as enum ('learner', 'instructor', 'admin', 'support');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lda_auth_session_status as enum ('active', 'revoked', 'expired');
exception when duplicate_object then null;
end $$;

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.lda_auth_session_role not null,
  session_token_hash text not null unique,
  trusted_device boolean not null default false,
  persistent boolean not null default false,
  device_label text,
  browser_name text,
  ip_address text,
  country_code text,
  approximate_location text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoke_reason text,
  status public.lda_auth_session_status not null default 'active',
  constraint auth_sessions_marketplace_persistence check (
    (role in ('learner', 'instructor') and persistent in (true, false))
    or (role in ('admin', 'support') and persistent = false and trusted_device = false)
  )
);

create index if not exists auth_sessions_user_last_seen_idx
on public.auth_sessions (user_id, last_seen_at desc);

create index if not exists auth_sessions_active_token_idx
on public.auth_sessions (session_token_hash)
where status = 'active' and revoked_at is null;

create index if not exists auth_sessions_expiry_idx
on public.auth_sessions (expires_at)
where status = 'active' and revoked_at is null;

create table if not exists public.auth_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  role public.lda_auth_session_role,
  action text not null,
  target_type text,
  target_id text,
  session_id uuid references public.auth_sessions(id) on delete set null,
  ip_address text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_logs_subject_created_idx
on public.auth_audit_logs (subject_user_id, created_at desc);

create index if not exists auth_audit_logs_actor_created_idx
on public.auth_audit_logs (actor_user_id, created_at desc);

create index if not exists auth_audit_logs_action_created_idx
on public.auth_audit_logs (action, created_at desc);

alter table public.auth_sessions enable row level security;
alter table public.auth_audit_logs enable row level security;

drop policy if exists "Users read own marketplace sessions" on public.auth_sessions;
create policy "Users read own marketplace sessions"
on public.auth_sessions for select
to authenticated
using (
  user_id = (select auth.uid())
  and role in ('learner', 'instructor')
);

drop policy if exists "Users revoke own marketplace sessions" on public.auth_sessions;
create policy "Users revoke own marketplace sessions"
on public.auth_sessions for update
to authenticated
using (
  user_id = (select auth.uid())
  and role in ('learner', 'instructor')
)
with check (
  user_id = (select auth.uid())
  and role in ('learner', 'instructor')
);

drop policy if exists "Admins read auth sessions" on public.auth_sessions;
create policy "Admins read auth sessions"
on public.auth_sessions for select
to authenticated
using (
  exists (
    select 1 from public.account_roles roles
    where roles.user_id = (select auth.uid())
      and roles.role = 'admin'
  )
);

drop policy if exists "Admins manage auth sessions" on public.auth_sessions;
create policy "Admins manage auth sessions"
on public.auth_sessions for update
to authenticated
using (
  exists (
    select 1 from public.account_roles roles
    where roles.user_id = (select auth.uid())
      and roles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.account_roles roles
    where roles.user_id = (select auth.uid())
      and roles.role = 'admin'
  )
);

drop policy if exists "Users read own auth audit logs" on public.auth_audit_logs;
create policy "Users read own auth audit logs"
on public.auth_audit_logs for select
to authenticated
using (
  subject_user_id = (select auth.uid())
  and role in ('learner', 'instructor')
);

drop policy if exists "Admins read all auth audit logs" on public.auth_audit_logs;
create policy "Admins read all auth audit logs"
on public.auth_audit_logs for select
to authenticated
using (
  exists (
    select 1 from public.account_roles roles
    where roles.user_id = (select auth.uid())
      and roles.role = 'admin'
  )
);
