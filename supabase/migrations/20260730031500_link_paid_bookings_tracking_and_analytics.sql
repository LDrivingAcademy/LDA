-- Links the durable payment record to the marketplace booking used by live
-- routing, punctuality, notifications, admin operations, and support.

alter table public.bookings
  add column if not exists booking_reference text;

create unique index if not exists bookings_booking_reference_idx
  on public.bookings (booking_reference);

alter table public.lesson_booking_records
  add column if not exists marketplace_booking_id uuid
    references public.bookings(id) on delete set null;

create unique index if not exists lesson_booking_records_marketplace_booking_id_idx
  on public.lesson_booking_records (marketplace_booking_id)
  where marketplace_booking_id is not null;

create or replace function private.sync_marketplace_booking_from_lesson_record()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  linked_booking_id uuid;
  mapped_booking_status public.booking_status;
  mapped_payment_status public.payment_status;
begin
  if new.instructor_id is null
    or new.instructor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or new.starts_at is null
    or new.ends_at is null
    or new.ends_at <= new.starts_at
    or not exists (
      select 1
      from public.instructor_profiles
      where user_id = new.instructor_id::uuid
    )
  then
    return new;
  end if;

  mapped_booking_status := case
    when lower(coalesce(new.status, '')) like '%cancel%' then 'cancelled'::public.booking_status
    when lower(coalesce(new.status, '')) = 'completed' then 'completed'::public.booking_status
    when lower(coalesce(new.status, '')) in ('refunded', 'refund_completed') then 'refunded'::public.booking_status
    when lower(coalesce(new.status, '')) in ('refund_requested', 'refund_pending') then 'refund_requested'::public.booking_status
    when lower(coalesce(new.status, '')) = 'disputed' then 'disputed'::public.booking_status
    when lower(coalesce(new.status, '')) in ('instructor_en_route', 'en_route') then 'instructor_en_route'::public.booking_status
    when lower(coalesce(new.status, '')) in ('in_progress', 'lesson_started') then 'in_progress'::public.booking_status
    when lower(coalesce(new.payment_status, '')) = 'paid' then 'accepted'::public.booking_status
    else 'pending'::public.booking_status
  end;

  mapped_payment_status := case
    when lower(coalesce(new.payment_status, '')) = 'refunded' then 'refunded'::public.payment_status
    when lower(coalesce(new.payment_status, '')) = 'disputed' then 'disputed'::public.payment_status
    when lower(coalesce(new.payment_status, '')) in ('paid', 'refund_pending', 'refund_requested') then 'paid'::public.payment_status
    else 'unpaid'::public.payment_status
  end;

  insert into public.bookings (
    booking_reference,
    learner_id,
    instructor_id,
    starts_at,
    ends_at,
    pickup_postcode,
    pickup_latitude,
    pickup_longitude,
    lesson_price_pence,
    platform_fee_pence,
    status,
    payment_status
  )
  values (
    new.booking_reference,
    new.learner_id,
    new.instructor_id::uuid,
    new.starts_at,
    new.ends_at,
    coalesce(nullif(new.pickup_label, ''), nullif(new.pickup_postcode, ''), 'Confirmed pickup point'),
    new.pickup_latitude,
    new.pickup_longitude,
    greatest(coalesce(new.lesson_price_pence, 0), 0),
    0,
    mapped_booking_status,
    mapped_payment_status
  )
  on conflict (booking_reference) do update
  set learner_id = excluded.learner_id,
      instructor_id = excluded.instructor_id,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      pickup_postcode = excluded.pickup_postcode,
      pickup_latitude = excluded.pickup_latitude,
      pickup_longitude = excluded.pickup_longitude,
      lesson_price_pence = excluded.lesson_price_pence,
      status = case
        when public.bookings.status in (
          'instructor_en_route'::public.booking_status,
          'in_progress'::public.booking_status,
          'completed'::public.booking_status,
          'cancelled'::public.booking_status,
          'refund_requested'::public.booking_status,
          'refunded'::public.booking_status,
          'disputed'::public.booking_status
        )
        and excluded.status in ('pending'::public.booking_status, 'accepted'::public.booking_status)
          then public.bookings.status
        else excluded.status
      end,
      payment_status = case
        when public.bookings.payment_status in (
          'refunded'::public.payment_status,
          'disputed'::public.payment_status
        )
        and excluded.payment_status in ('unpaid'::public.payment_status, 'paid'::public.payment_status)
          then public.bookings.payment_status
        else excluded.payment_status
      end,
      updated_at = now()
  returning id into linked_booking_id;

  new.marketplace_booking_id := linked_booking_id;
  return new;
end;
$$;

revoke all on function private.sync_marketplace_booking_from_lesson_record()
  from public, anon, authenticated;

drop trigger if exists lesson_booking_records_sync_marketplace_booking
  on public.lesson_booking_records;
create trigger lesson_booking_records_sync_marketplace_booking
  before insert or update of
    learner_id,
    instructor_id,
    starts_at,
    ends_at,
    pickup_postcode,
    pickup_label,
    pickup_latitude,
    pickup_longitude,
    lesson_price_pence,
    status,
    payment_status
  on public.lesson_booking_records
  for each row execute function private.sync_marketplace_booking_from_lesson_record();

-- Backfill valid historical payment records through the same guarded path.
update public.lesson_booking_records
set pickup_label = coalesce(nullif(pickup_label, ''), nullif(pickup_postcode, ''), 'Confirmed pickup point')
where marketplace_booking_id is null;

create or replace function public.record_site_analytics_visitor(
  p_visitor_ip_hash text,
  p_path text,
  p_session_id text,
  p_user_agent text,
  p_seen_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_visitor_ip_hash), '') is null then
    return;
  end if;

  insert into public.site_analytics_visitors (
    visitor_ip_hash,
    first_seen_at,
    last_seen_at,
    first_path,
    last_path,
    first_session_id,
    last_session_id,
    first_user_agent,
    last_user_agent,
    visits_count,
    created_at,
    updated_at
  )
  values (
    p_visitor_ip_hash,
    p_seen_at,
    p_seen_at,
    p_path,
    p_path,
    p_session_id,
    p_session_id,
    p_user_agent,
    p_user_agent,
    1,
    p_seen_at,
    p_seen_at
  )
  on conflict (visitor_ip_hash) do update
  set last_seen_at = excluded.last_seen_at,
      last_path = excluded.last_path,
      last_session_id = excluded.last_session_id,
      last_user_agent = excluded.last_user_agent,
      visits_count = public.site_analytics_visitors.visits_count + 1,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.record_site_analytics_visitor(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_site_analytics_visitor(text, text, text, text, timestamptz)
  to service_role;

create index if not exists account_role_transfer_reviewed_by_idx
  on public.account_role_transfer_requests (reviewed_by)
  where reviewed_by is not null;
create index if not exists learner_time_bank_ledger_created_by_idx
  on public.learner_time_bank_ledger (created_by)
  where created_by is not null;
create index if not exists auth_handoff_requests_verified_user_idx
  on public.auth_handoff_requests (verified_user_id)
  where verified_user_id is not null;
create index if not exists notifications_booking_id_idx
  on public.notifications (booking_id)
  where booking_id is not null;
