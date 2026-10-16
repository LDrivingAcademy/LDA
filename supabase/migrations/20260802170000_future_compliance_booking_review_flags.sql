alter table public.lesson_booking_records
  add column if not exists compliance_review_required boolean not null default false,
  add column if not exists compliance_review_reason text,
  add column if not exists compliance_review_flagged_at timestamptz,
  add column if not exists compliance_review_resolved_at timestamptz;

create index if not exists lesson_booking_records_compliance_review_idx
  on public.lesson_booking_records (instructor_id, starts_at)
  where compliance_review_required = true;

create index if not exists lesson_booking_records_future_instructor_idx
  on public.lesson_booking_records (instructor_id, starts_at)
  where starts_at is not null;

comment on column public.lesson_booking_records.compliance_review_required is
  'True when a future booking needs admin review because instructor compliance evidence will not cover the scheduled lesson date.';

