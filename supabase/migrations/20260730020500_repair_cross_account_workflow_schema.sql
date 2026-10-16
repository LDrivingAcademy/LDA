-- Restores workflow structures that application routes already depend on.
-- This migration is idempotent so it can repair environments where earlier
-- schema changes were applied outside migration history.

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
grant select, insert, update, delete on public.account_role_transfer_requests to authenticated;
grant all on public.account_role_transfer_requests to service_role;

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
      select 1 from public.account_roles
      where account_roles.user_id = (select auth.uid())
        and account_roles.role = 'learner'
    )
    and not exists (
      select 1 from public.account_roles
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
create trigger account_role_transfer_requests_set_updated_at
  before update on public.account_role_transfer_requests
  for each row execute function public.set_updated_at();

create table if not exists public.lesson_progress_records (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  learner_name text not null,
  learner_email text not null,
  instructor_name text not null,
  lesson_reference text,
  completed_skills text[] not null default '{}',
  instructor_notes text not null default '',
  next_lesson_focus text not null default '',
  recommended_videos text not null default '',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_progress_records_instructor_idx
  on public.lesson_progress_records(instructor_id, sent_at desc);
create index if not exists lesson_progress_records_learner_idx
  on public.lesson_progress_records(learner_id, sent_at desc);

drop trigger if exists lesson_progress_records_set_updated_at on public.lesson_progress_records;
create trigger lesson_progress_records_set_updated_at
  before update on public.lesson_progress_records
  for each row execute function public.set_updated_at();

alter table public.lesson_progress_records enable row level security;
grant select, insert, update on public.lesson_progress_records to authenticated;
grant all on public.lesson_progress_records to service_role;

drop policy if exists "Lesson progress visible to participants" on public.lesson_progress_records;
create policy "Lesson progress visible to participants"
  on public.lesson_progress_records for select
  to authenticated
  using (
    learner_id = (select auth.uid())
    or instructor_id = (select auth.uid())
    or (select private.current_user_is_admin())
  );

drop policy if exists "Instructors create own lesson progress records" on public.lesson_progress_records;
create policy "Instructors create own lesson progress records"
  on public.lesson_progress_records for insert
  to authenticated
  with check (
    instructor_id = (select auth.uid())
    and (select private.current_user_has_role('instructor'))
  );

drop policy if exists "Instructors update own lesson progress records" on public.lesson_progress_records;
create policy "Instructors update own lesson progress records"
  on public.lesson_progress_records for update
  to authenticated
  using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
  with check (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

create table if not exists public.account_erasure_events (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null,
  requested_by text not null default 'self_service'
    check (requested_by in ('self_service', 'admin')),
  deleted_categories text[] not null default '{}',
  retained_categories text[] not null default '{}',
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists account_erasure_events_processed_idx
  on public.account_erasure_events(processed_at desc);
create unique index if not exists account_erasure_events_subject_hash_idx
  on public.account_erasure_events(subject_hash);

alter table public.account_erasure_events enable row level security;
grant select on public.account_erasure_events to authenticated;
grant all on public.account_erasure_events to service_role;

drop policy if exists "Admins read account erasure events" on public.account_erasure_events;
create policy "Admins read account erasure events"
  on public.account_erasure_events for select
  to authenticated
  using ((select private.current_user_is_admin()));

alter table public.lesson_booking_records
  add column if not exists cancellation_actor text
    check (cancellation_actor in ('learner', 'instructor', 'admin')),
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancelled_at timestamptz,
  add column if not exists pickup_label text,
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision,
  add column if not exists instructor_arrived_at timestamptz,
  add column if not exists lesson_started_at timestamptz,
  add column if not exists lesson_completed_at timestamptz,
  add column if not exists instructor_late_minutes integer not null default 0,
  add column if not exists learner_time_bank_minutes_awarded integer not null default 0,
  add column if not exists time_bank_awarded_at timestamptz,
  add column if not exists punctuality_status text not null default 'pending';

create index if not exists lesson_booking_records_cancel_actor_idx
  on public.lesson_booking_records(cancellation_actor, cancelled_at desc)
  where cancellation_actor is not null;
create index if not exists lesson_booking_records_cancelled_by_idx
  on public.lesson_booking_records(cancelled_by, cancelled_at desc)
  where cancelled_by is not null;
create index if not exists lesson_booking_records_on_demand_route_idx
  on public.lesson_booking_records (booking_reference, pickup_postcode)
  where pickup_postcode is not null;

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
end $$;

update public.lesson_booking_records
set pickup_label = coalesce(nullif(pickup_label, ''), pickup_postcode)
where pickup_label is null or pickup_label = '';

update public.lesson_booking_records records
set pickup_latitude = bookings.pickup_latitude,
    pickup_longitude = bookings.pickup_longitude
from public.bookings bookings
where records.booking_reference = bookings.id::text
  and (records.pickup_latitude is null or records.pickup_longitude is null);

alter table public.bookings
  add column if not exists instructor_arrived_at timestamptz,
  add column if not exists lesson_started_at timestamptz,
  add column if not exists instructor_late_minutes integer not null default 0,
  add column if not exists time_bank_awarded_at timestamptz,
  add column if not exists punctuality_status text not null default 'pending';

do $$
begin
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

create table if not exists public.instant_lesson_instructor_offers (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null references public.lesson_booking_records(booking_reference) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_reference, instructor_id)
);

create index if not exists instant_lesson_offers_instructor_status_idx
  on public.instant_lesson_instructor_offers(instructor_id, status, offered_at desc);
create index if not exists instant_lesson_offers_reference_status_idx
  on public.instant_lesson_instructor_offers(booking_reference, status, offered_at desc);

drop trigger if exists instant_lesson_instructor_offers_set_updated_at on public.instant_lesson_instructor_offers;
create trigger instant_lesson_instructor_offers_set_updated_at
  before update on public.instant_lesson_instructor_offers
  for each row execute function public.set_updated_at();

alter table public.instant_lesson_instructor_offers enable row level security;
grant select on public.instant_lesson_instructor_offers to authenticated;
grant all on public.instant_lesson_instructor_offers to service_role;

drop policy if exists "Instant offer instructors can view own offers" on public.instant_lesson_instructor_offers;
create policy "Instant offer instructors can view own offers"
  on public.instant_lesson_instructor_offers for select
  to authenticated
  using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Admins manage instant instructor offers" on public.instant_lesson_instructor_offers;
create policy "Admins manage instant instructor offers"
  on public.instant_lesson_instructor_offers for all
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

alter table public.site_analytics_events
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
grant insert, update, delete on public.site_analytics_visitors to service_role;

drop policy if exists "Admins can read site analytics visitors" on public.site_analytics_visitors;
create policy "Admins can read site analytics visitors"
  on public.site_analytics_visitors for select
  to authenticated
  using ((select private.current_user_is_admin()));

create table if not exists public.learner_time_bank_ledger (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  instructor_id uuid references public.profiles(id) on delete set null,
  booking_reference text,
  minutes integer not null check (minutes <> 0),
  entry_type text not null
    check (entry_type in ('instructor_late_credit', 'lesson_redemption', 'admin_adjustment', 'expiry')),
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
grant select on public.learner_time_bank_ledger to authenticated;
grant all on public.learner_time_bank_ledger to service_role;

drop policy if exists "Learners view own time bank ledger" on public.learner_time_bank_ledger;
create policy "Learners view own time bank ledger"
  on public.learner_time_bank_ledger for select
  to authenticated
  using ((select auth.uid()) = learner_id);

drop policy if exists "Admins manage learner time bank ledger" on public.learner_time_bank_ledger;
create policy "Admins manage learner time bank ledger"
  on public.learner_time_bank_ledger for all
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

create or replace view public.learner_time_bank_balances
with (security_invoker = true) as
select
  learner_id,
  greatest(coalesce(sum(minutes), 0), 0)::integer as available_minutes,
  coalesce(sum(case when minutes > 0 then minutes else 0 end), 0)::integer as credited_minutes,
  abs(coalesce(sum(case when minutes < 0 then minutes else 0 end), 0))::integer as used_minutes
from public.learner_time_bank_ledger
group by learner_id;

grant select on public.learner_time_bank_balances to authenticated;

create table if not exists public.chat_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  account_role text not null
    check (account_role in ('visitor', 'learner', 'instructor', 'in_progress', 'admin')),
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
grant insert, select on public.chat_security_events to authenticated;
grant all on public.chat_security_events to service_role;

drop policy if exists "Admins read chat security events" on public.chat_security_events;
create policy "Admins read chat security events"
  on public.chat_security_events for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists "Users can record own chat security events" on public.chat_security_events;
create policy "Users can record own chat security events"
  on public.chat_security_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

alter table public.location_shares
  add column if not exists heading_degrees double precision,
  add column if not exists speed_mps double precision,
  add column if not exists source text not null default 'browser_geolocation',
  add column if not exists client_recorded_at timestamptz;

alter table public.instructor_live_locations
  add column if not exists heading_degrees double precision,
  add column if not exists speed_mps double precision,
  add column if not exists client_recorded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'location_shares_heading_degrees_range'
  ) then
    alter table public.location_shares
      add constraint location_shares_heading_degrees_range
      check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'location_shares_speed_mps_nonnegative'
  ) then
    alter table public.location_shares
      add constraint location_shares_speed_mps_nonnegative
      check (speed_mps is null or speed_mps >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'location_shares_source_present'
  ) then
    alter table public.location_shares
      add constraint location_shares_source_present
      check (length(trim(source)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'instructor_live_locations_heading_degrees_range'
  ) then
    alter table public.instructor_live_locations
      add constraint instructor_live_locations_heading_degrees_range
      check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'instructor_live_locations_speed_mps_nonnegative'
  ) then
    alter table public.instructor_live_locations
      add constraint instructor_live_locations_speed_mps_nonnegative
      check (speed_mps is null or speed_mps >= 0);
  end if;
end $$;

create index if not exists location_shares_booking_recorded_idx
  on public.location_shares (booking_id, recorded_at desc);
create index if not exists location_shares_learner_expiry_idx
  on public.location_shares (learner_id, expires_at);
create index if not exists location_shares_instructor_expiry_idx
  on public.location_shares (instructor_id, expires_at);
create index if not exists instructor_live_locations_instructor_recorded_idx
  on public.instructor_live_locations (instructor_id, recorded_at desc);
create index if not exists instructor_live_locations_expiry_idx
  on public.instructor_live_locations (expires_at);

do $$
begin
  alter publication supabase_realtime add table public.location_shares;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.instructor_live_locations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function private.purge_expired_live_locations()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  delete from public.location_shares where expires_at < now();
  delete from public.instructor_live_locations where expires_at < now();
end;
$$;

revoke all on function private.purge_expired_live_locations() from public, anon, authenticated;
grant execute on function private.purge_expired_live_locations() to service_role;
