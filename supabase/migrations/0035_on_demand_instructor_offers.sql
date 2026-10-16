-- Track on-demand lesson offers sent to instructors so declined requests can
-- move to the next suitable instructor without being re-offered to the same one.

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
create trigger instant_lesson_instructor_offers_set_updated_at before update on public.instant_lesson_instructor_offers
for each row execute function public.set_updated_at();

alter table public.instant_lesson_instructor_offers enable row level security;

drop policy if exists "Instant offer instructors can view own offers" on public.instant_lesson_instructor_offers;
create policy "Instant offer instructors can view own offers"
on public.instant_lesson_instructor_offers for select
to authenticated
using (
  instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Admins manage instant instructor offers" on public.instant_lesson_instructor_offers;
create policy "Admins manage instant instructor offers"
on public.instant_lesson_instructor_offers for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
