-- Enforce compliance blockers before instructors appear to learners or accept new bookings.

alter table public.instructor_profiles
  add column if not exists compliance_status text not null default 'clear'
    check (compliance_status in ('clear', 'under_review', 'blocked')),
  add column if not exists learner_availability_paused boolean not null default false,
  add column if not exists learner_availability_pause_reason text,
  add column if not exists compliance_reviewed_at timestamptz,
  add column if not exists compliance_blocked_at timestamptz;

create index if not exists instructor_profiles_learner_availability_idx
on public.instructor_profiles(verification_status, compliance_status, learner_availability_paused);

create or replace function private.instructor_can_take_learner_bookings(instructor uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instructor_profiles ip
    where ip.user_id = instructor
      and ip.verification_status = 'approved'
      and ip.compliance_status = 'clear'
      and ip.learner_availability_paused = false
  );
$$;

drop policy if exists "Approved instructors are public" on public.instructor_profiles;
drop policy if exists "Approved compliant instructors are public" on public.instructor_profiles;
create policy "Approved compliant instructors are public"
on public.instructor_profiles for select
to anon, authenticated
using (
  (
    verification_status = 'approved'
    and compliance_status = 'clear'
    and learner_availability_paused = false
  )
  or (select auth.uid()) = user_id
  or (select private.current_user_is_admin())
);

drop policy if exists "Availability for approved instructors is public" on public.availability_slots;
drop policy if exists "Availability for approved compliant instructors is public" on public.availability_slots;
create policy "Availability for approved compliant instructors is public"
on public.availability_slots for select
to anon, authenticated
using (
  (select private.instructor_can_take_learner_bookings(instructor_id))
  or instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Learners create bookings with approved instructors" on public.bookings;
drop policy if exists "Learners create bookings with approved compliant instructors" on public.bookings;
create policy "Learners create bookings with approved compliant instructors"
on public.bookings for insert
to authenticated
with check (
  learner_id = (select auth.uid())
  and (select private.instructor_can_take_learner_bookings(instructor_id))
);
