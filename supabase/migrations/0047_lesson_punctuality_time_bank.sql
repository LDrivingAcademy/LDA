alter table if exists public.lesson_booking_records
  add column if not exists instructor_arrived_at timestamptz,
  add column if not exists lesson_started_at timestamptz,
  add column if not exists lesson_completed_at timestamptz,
  add column if not exists instructor_late_minutes integer not null default 0,
  add column if not exists learner_time_bank_minutes_awarded integer not null default 0,
  add column if not exists time_bank_awarded_at timestamptz,
  add column if not exists punctuality_status text not null default 'pending';

alter table if exists public.bookings
  add column if not exists instructor_arrived_at timestamptz,
  add column if not exists lesson_started_at timestamptz,
  add column if not exists instructor_late_minutes integer not null default 0,
  add column if not exists time_bank_awarded_at timestamptz,
  add column if not exists punctuality_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lesson_booking_records_late_minutes_non_negative'
  ) then
    alter table public.lesson_booking_records
      add constraint lesson_booking_records_late_minutes_non_negative
      check (instructor_late_minutes >= 0 and learner_time_bank_minutes_awarded >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'lesson_booking_records_punctuality_status_check'
  ) then
    alter table public.lesson_booking_records
      add constraint lesson_booking_records_punctuality_status_check
      check (punctuality_status in ('pending', 'on_time', 'instructor_late', 'manual_review'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_late_minutes_non_negative'
  ) then
    alter table public.bookings
      add constraint bookings_late_minutes_non_negative
      check (instructor_late_minutes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_punctuality_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_punctuality_status_check
      check (punctuality_status in ('pending', 'on_time', 'instructor_late', 'manual_review'));
  end if;
end $$;

create table if not exists public.learner_time_bank_ledger (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  instructor_id uuid references public.profiles(id) on delete set null,
  booking_reference text,
  minutes integer not null check (minutes <> 0),
  entry_type text not null check (entry_type in ('instructor_late_credit', 'lesson_redemption', 'admin_adjustment', 'expiry')),
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists learner_time_bank_ledger_learner_id_idx
  on public.learner_time_bank_ledger (learner_id);

create index if not exists learner_time_bank_ledger_instructor_id_idx
  on public.learner_time_bank_ledger (instructor_id);

create index if not exists learner_time_bank_ledger_booking_reference_idx
  on public.learner_time_bank_ledger (booking_reference);

create index if not exists learner_time_bank_ledger_created_at_idx
  on public.learner_time_bank_ledger (created_at desc);

alter table public.learner_time_bank_ledger enable row level security;

drop policy if exists "Learners view own time bank ledger" on public.learner_time_bank_ledger;
create policy "Learners view own time bank ledger"
  on public.learner_time_bank_ledger
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

drop policy if exists "Admins manage learner time bank ledger" on public.learner_time_bank_ledger;
create policy "Admins manage learner time bank ledger"
  on public.learner_time_bank_ledger
  for all
  to authenticated
  using (private.current_user_is_admin())
  with check (private.current_user_is_admin());

create or replace view public.learner_time_bank_balances
with (security_invoker = true) as
select
  learner_id,
  greatest(coalesce(sum(minutes), 0), 0)::integer as available_minutes,
  coalesce(sum(case when minutes > 0 then minutes else 0 end), 0)::integer as credited_minutes,
  abs(coalesce(sum(case when minutes < 0 then minutes else 0 end), 0))::integer as used_minutes
from public.learner_time_bank_ledger
group by learner_id;

grant select on public.learner_time_bank_ledger to authenticated;
grant select on public.learner_time_bank_balances to authenticated;
grant all on public.learner_time_bank_ledger to service_role;
