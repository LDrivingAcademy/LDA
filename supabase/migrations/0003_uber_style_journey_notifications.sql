-- LDA staged marketplace flow additions.
-- Supports learner booking confirmations, instructor in-app notifications,
-- and explicit live-tracking states for accepted lessons.

alter type public.booking_status add value if not exists 'scheduled';
alter type public.booking_status add value if not exists 'instructor_en_route';
alter type public.booking_status add value if not exists 'in_progress';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users read their own notifications" on public.notifications;
create policy "Users read their own notifications"
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Users mark their own notifications read" on public.notifications;
create policy "Users mark their own notifications read"
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_is_admin()))
with check (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Admins and service create notifications" on public.notifications;
create policy "Admins and service create notifications"
on public.notifications for insert
to authenticated
with check ((select private.current_user_is_admin()));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'account_intent', 'learner');
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  if requested_role = 'instructor' then
    insert into public.account_roles (user_id, role)
    values (new.id, 'instructor')
    on conflict do nothing;

    insert into public.instructor_profiles (user_id, verification_status)
    values (new.id, 'draft')
    on conflict do nothing;
  else
    insert into public.account_roles (user_id, role)
    values (new.id, 'learner')
    on conflict do nothing;

    insert into public.learner_profiles (user_id)
    values (new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
