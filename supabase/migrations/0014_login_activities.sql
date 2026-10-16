-- Durable learner/instructor login activity history.

create table if not exists public.login_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  signed_in_at timestamptz not null default now(),
  device_label text not null default 'Unknown device',
  browser_name text not null default 'Browser',
  approximate_location text not null default 'Approximate location unavailable',
  country_code text,
  ip_address text,
  is_unusual boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_activities_user_signed_in_idx
on public.login_activities (user_id, signed_in_at desc);

alter table public.login_activities enable row level security;

drop policy if exists "Users read own login activities" on public.login_activities;
create policy "Users read own login activities"
on public.login_activities for select
to authenticated
using ((select auth.uid()) = user_id or (select private.current_user_is_admin()));

drop policy if exists "Users create own login activities" on public.login_activities;
create policy "Users create own login activities"
on public.login_activities for insert
to authenticated
with check ((select auth.uid()) = user_id or (select private.current_user_is_admin()));

drop policy if exists "Admins manage login activities" on public.login_activities;
create policy "Admins manage login activities"
on public.login_activities for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
