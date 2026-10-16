-- Durable learner booking references for Stripe-return confirmation, support lookup, disputes, refunds, and tracking.

create table if not exists public.lesson_booking_records (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  learner_id uuid references public.profiles(id) on delete cascade,
  learner_email text,
  learner_phone text,
  instructor_id text,
  instructor_name text not null,
  instructor_email text,
  lesson_summary text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  pickup_postcode text,
  lesson_price_pence integer not null default 0 check (lesson_price_pence >= 0),
  car text,
  status text not null default 'upcoming',
  payment_status text not null default 'paid',
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_booking_records_learner_idx on public.lesson_booking_records(learner_id, starts_at desc);
create index if not exists lesson_booking_records_reference_idx on public.lesson_booking_records(booking_reference);
create index if not exists lesson_booking_records_instructor_idx on public.lesson_booking_records(instructor_id, starts_at desc);

drop trigger if exists lesson_booking_records_set_updated_at on public.lesson_booking_records;
create trigger lesson_booking_records_set_updated_at before update on public.lesson_booking_records
for each row execute function public.set_updated_at();

alter table public.lesson_booking_records enable row level security;

drop policy if exists "Booking reference participants can view records" on public.lesson_booking_records;
create policy "Booking reference participants can view records"
on public.lesson_booking_records for select
to authenticated
using (
  learner_id = (select auth.uid())
  or instructor_id = (select auth.uid())::text
  or (select private.current_user_is_admin())
);

drop policy if exists "Learners create own booking reference records" on public.lesson_booking_records;
create policy "Learners create own booking reference records"
on public.lesson_booking_records for insert
to authenticated
with check (learner_id = (select auth.uid()));

drop policy if exists "Admins manage booking reference records" on public.lesson_booking_records;
create policy "Admins manage booking reference records"
on public.lesson_booking_records for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
