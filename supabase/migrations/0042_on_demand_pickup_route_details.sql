alter table public.lesson_booking_records
  add column if not exists pickup_label text,
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision;

create index if not exists lesson_booking_records_on_demand_route_idx
  on public.lesson_booking_records (booking_reference, pickup_postcode)
  where pickup_postcode is not null;
