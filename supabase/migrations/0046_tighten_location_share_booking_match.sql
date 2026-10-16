drop policy if exists "Instructors share own live location for active bookings" on public.location_shares;
create policy "Instructors share own live location for active bookings"
on public.location_shares for insert
to authenticated
with check (
  instructor_id = (select auth.uid())
  and expires_at <= (
    select b.ends_at
    from public.bookings b
    where b.id = location_shares.booking_id
      and b.instructor_id = (select auth.uid())
      and b.learner_id = location_shares.learner_id
      and b.ends_at > now()
      and b.status in ('accepted', 'pending', 'instructor_en_route', 'in_progress')
    limit 1
  )
);
