-- Enforce one active marketplace role per account.
-- Learners can later request a controlled transfer to instructor status, but
-- the same Supabase user/email must not hold learner and instructor roles at
-- the same time.

do $$ begin
  create type public.account_role_transfer_status as enum ('requested', 'approved', 'rejected', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

alter table public.learner_profiles
  add column if not exists full_licence_held_since date,
  add column if not exists full_licence_confirmed_at timestamptz;

create table if not exists public.account_role_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_role public.app_role not null default 'learner',
  to_role public.app_role not null default 'instructor',
  full_licence_held_since date,
  adi_pdi_status text check (adi_pdi_status in ('ADI', 'PDI')),
  adi_pdi_number text,
  notes text,
  status public.account_role_transfer_status not null default 'requested',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_role = 'learner' and to_role = 'instructor')
);

create unique index if not exists account_role_transfer_one_open_request_idx
on public.account_role_transfer_requests(user_id)
where status in ('requested', 'approved');

create index if not exists account_role_transfer_user_created_idx
on public.account_role_transfer_requests(user_id, created_at desc);

alter table public.account_role_transfer_requests enable row level security;

drop policy if exists "Users read own role transfer requests" on public.account_role_transfer_requests;
create policy "Users read own role transfer requests"
on public.account_role_transfer_requests for select
to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Learners request instructor transfer" on public.account_role_transfer_requests;
create policy "Learners request instructor transfer"
on public.account_role_transfer_requests for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and from_role = 'learner'
  and to_role = 'instructor'
  and exists (
    select 1
    from public.account_roles
    where account_roles.user_id = (select auth.uid())
      and account_roles.role = 'learner'
  )
  and full_licence_held_since <= (current_date - interval '2 years')::date
  and not exists (
    select 1
    from public.account_roles
    where account_roles.user_id = (select auth.uid())
      and account_roles.role = 'instructor'
  )
);

drop policy if exists "Admins manage role transfer requests" on public.account_role_transfer_requests;
create policy "Admins manage role transfer requests"
on public.account_role_transfer_requests for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop trigger if exists account_role_transfer_requests_set_updated_at on public.account_role_transfer_requests;
create trigger account_role_transfer_requests_set_updated_at before update on public.account_role_transfer_requests
for each row execute function public.set_updated_at();

create or replace function public.prevent_dual_marketplace_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role in ('learner', 'instructor') and exists (
    select 1
    from public.account_roles existing
    where existing.user_id = new.user_id
      and existing.role in ('learner', 'instructor')
      and existing.role <> new.role
  ) then
    raise exception 'LDA accounts cannot be both learner and instructor. Request an account transfer instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_dual_marketplace_roles on public.account_roles;
create trigger prevent_dual_marketplace_roles
before insert or update on public.account_roles
for each row execute function public.prevent_dual_marketplace_roles();

-- New auth users get a profile shell only. The verified server-side onboarding
-- step assigns exactly one marketplace role after checking existing roles.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  return new;
end;
$$;
