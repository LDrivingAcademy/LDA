-- Adds explicit cancellation audit fields to durable lesson references.
-- Existing booking rows already retain status and participant IDs; these fields
-- make learner/instructor cancellation pattern review easier for admin tools.

alter table public.lesson_booking_records
add column if not exists cancellation_actor text check (cancellation_actor in ('learner', 'instructor', 'admin')),
add column if not exists cancellation_reason text,
add column if not exists cancelled_by uuid references public.profiles(id),
add column if not exists cancelled_at timestamptz;

create index if not exists lesson_booking_records_cancel_actor_idx
on public.lesson_booking_records(cancellation_actor, cancelled_at desc)
where cancellation_actor is not null;

create index if not exists lesson_booking_records_cancelled_by_idx
on public.lesson_booking_records(cancelled_by, cancelled_at desc)
where cancelled_by is not null;
