drop policy if exists "Booking participants view live locations" on public.location_shares;
create policy "Booking participants view live locations"
on public.location_shares for select
to authenticated
using (
  expires_at > now()
  and (learner_id = (select auth.uid()) or instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
  and exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.learner_id = location_shares.learner_id
      and b.instructor_id = location_shares.instructor_id
      and b.ends_at > now()
      and b.status in ('accepted', 'pending', 'instructor_en_route', 'in_progress')
  )
);

drop policy if exists "Instructors share own live location for active bookings" on public.location_shares;
create policy "Instructors share own live location for active bookings"
on public.location_shares for insert
to authenticated
with check (
  instructor_id = (select auth.uid())
  and expires_at <= (
    select b.ends_at
    from public.bookings b
    where b.id = booking_id
      and b.instructor_id = (select auth.uid())
      and b.learner_id = location_shares.learner_id
      and b.ends_at > now()
      and b.status in ('accepted', 'pending', 'instructor_en_route', 'in_progress')
    limit 1
  )
);
