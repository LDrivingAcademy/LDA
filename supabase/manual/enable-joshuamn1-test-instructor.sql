-- Stability-test instructor setup for JoshuaMN1@Hotmail.com only.
-- Run in Supabase SQL Editor on the live project when you need Joshua M.N
-- to be a full instructor-only test account for booking, cancellation,
-- scheduling, calendar, notification, and instructor dashboard testing.

alter table public.instructor_profiles
  add column if not exists instructor_package text not null default 'instructor'
    check (instructor_package in ('instructor', 'instructor-plus', 'instructor-pro')),
  add column if not exists instructor_subscription_status text,
  add column if not exists instructor_package_started_at timestamptz,
  add column if not exists instructor_package_expires_at timestamptz,
  add column if not exists instructor_package_source text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.instructor_profiles
  add column if not exists compliance_status text not null default 'clear'
    check (compliance_status in ('clear', 'under_review', 'blocked')),
  add column if not exists learner_availability_paused boolean not null default false,
  add column if not exists learner_availability_pause_reason text,
  add column if not exists compliance_reviewed_at timestamptz,
  add column if not exists compliance_blocked_at timestamptz;

do $$
declare
  target_email text := 'JoshuaMN1@Hotmail.com';
  target_user_id uuid;
  active_marketplace_roles text[];
  final_verification_status text;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  order by created_at desc
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase auth user found for %', target_email;
  end if;

  insert into public.profiles (id, email, full_name)
  values (target_user_id, target_email, 'Joshua M.N')
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    updated_at = now();

  delete from public.account_roles
  where user_id = target_user_id
    and role in ('learner', 'admin');

  insert into public.account_roles (user_id, role)
  values (target_user_id, 'instructor')
  on conflict do nothing;

  insert into public.instructor_profiles (
    user_id,
    display_name,
    bio,
    adi_pdi_status,
    adi_pdi_number,
    verification_status,
    rejection_reason,
    hourly_rate_pence,
    transmission,
    car_make,
    car_model,
    car_registration,
    areas_covered,
    base_postcode,
    latitude,
    longitude,
    auto_accept_bookings,
    instructor_package,
    instructor_subscription_status,
    instructor_package_started_at,
    instructor_package_expires_at,
    instructor_package_source,
    approved_at,
    compliance_status,
    learner_availability_paused,
    learner_availability_pause_reason,
    compliance_reviewed_at,
    compliance_blocked_at
  )
  values (
    target_user_id,
    'Joshua M.N',
    'LDA stability-test instructor profile for booking, cancellation, scheduling, calendar, and notification flow testing.',
    'ADI',
    'TEST-ADI-JMN1',
    'approved',
    null,
    4200,
    'automatic',
    'Toyota',
    'Yaris Hybrid',
    'LDA TEST',
    array['North Finchley', 'Barnet', 'Whetstone', 'Friern Barnet', 'Finchley'],
    'N12 9HE',
    51.6147,
    -0.1769,
    true,
    'instructor',
    'active',
    now(),
    null,
    'approved_test_account',
    now(),
    'clear',
    false,
    null,
    now(),
    null
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    bio = excluded.bio,
    adi_pdi_status = excluded.adi_pdi_status,
    adi_pdi_number = excluded.adi_pdi_number,
    verification_status = 'approved',
    rejection_reason = null,
    hourly_rate_pence = excluded.hourly_rate_pence,
    transmission = excluded.transmission,
    car_make = excluded.car_make,
    car_model = excluded.car_model,
    car_registration = excluded.car_registration,
    areas_covered = excluded.areas_covered,
    base_postcode = excluded.base_postcode,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    auto_accept_bookings = true,
    instructor_package = 'instructor',
    instructor_subscription_status = 'active',
    instructor_package_started_at = coalesce(public.instructor_profiles.instructor_package_started_at, now()),
    instructor_package_expires_at = null,
    instructor_package_source = 'approved_test_account',
    approved_at = coalesce(public.instructor_profiles.approved_at, now()),
    compliance_status = 'clear',
    learner_availability_paused = false,
    learner_availability_pause_reason = null,
    compliance_reviewed_at = now(),
    compliance_blocked_at = null,
    updated_at = now();

  insert into public.instructor_documents (
    instructor_id,
    uploaded_by,
    document_type,
    storage_path,
    status,
    reviewed_at
  )
  select
    target_user_id,
    target_user_id,
    document_type::public.document_type,
    'stability-test/joshuamn1/' || document_type || '.pdf',
    'approved',
    now()
  from unnest(array[
    'adi_pdi_badge',
    'driving_licence',
    'proof_of_id',
    'insurance',
    'dbs_check',
    'vehicle_photo'
  ]) as document_type
  where not exists (
    select 1
    from public.instructor_documents existing
    where existing.instructor_id = target_user_id
      and existing.document_type = document_type::public.document_type
      and existing.status = 'approved'
  );

  update public.account_role_transfer_requests
  set
    status = 'completed',
    reviewed_at = coalesce(reviewed_at, now()),
    decision_note = coalesce(decision_note, 'Converted to approved instructor-only test account for LDA platform testing.'),
    updated_at = now()
  where user_id = target_user_id
    and status in ('requested', 'approved');

  select array_agg(role::text order by role::text)
  into active_marketplace_roles
  from public.account_roles
  where user_id = target_user_id
    and role in ('learner', 'instructor');

  select verification_status::text
  into final_verification_status
  from public.instructor_profiles
  where user_id = target_user_id;

  if active_marketplace_roles is distinct from array['instructor'] then
    raise exception 'JoshuaMN1@Hotmail.com was not left as instructor-only. Current marketplace roles: %', active_marketplace_roles;
  end if;

  if final_verification_status <> 'approved' then
    raise exception 'JoshuaMN1@Hotmail.com was not left approved. Current verification_status: %', final_verification_status;
  end if;

  insert into public.availability_slots (
    instructor_id,
    starts_at,
    ends_at,
    is_booked
  )
  with generated_slots as (
    select
      target_user_id as instructor_id,
      ((day_value::date + slot_time::time) at time zone 'Europe/London') as starts_at,
      ((day_value::date + slot_time::time + interval '1 hour') at time zone 'Europe/London') as ends_at
    from generate_series(current_date, current_date + interval '21 days', interval '1 day') as day_value
    cross join unnest(array['09:30', '10:00', '13:00', '16:30', '18:00']) as slot_time

    union all

    select
      target_user_id as instructor_id,
      ((date_trunc('hour', now() at time zone 'Europe/London') + interval '2 hours') at time zone 'Europe/London') as starts_at,
      ((date_trunc('hour', now() at time zone 'Europe/London') + interval '3 hours') at time zone 'Europe/London') as ends_at
    where (date_trunc('hour', now() at time zone 'Europe/London') + interval '2 hours')::date = current_date
      and extract(hour from (date_trunc('hour', now() at time zone 'Europe/London') + interval '2 hours')) < 23
  )
  select
    generated_slots.instructor_id,
    generated_slots.starts_at,
    generated_slots.ends_at,
    false
  from generated_slots
  where generated_slots.starts_at > now() + interval '10 minutes'
    and not exists (
      select 1
      from public.availability_slots existing
      where existing.instructor_id = generated_slots.instructor_id
        and existing.starts_at = generated_slots.starts_at
    );

  raise notice 'JoshuaMN1 instructor test profile enabled for user id %', target_user_id;
end $$;

select
  p.email,
  string_agg(ar.role::text, ', ' order by ar.role::text) as active_roles,
  ip.display_name,
  ip.verification_status,
  ip.instructor_package,
  ip.instructor_subscription_status,
  ip.compliance_status,
  ip.learner_availability_paused,
  count(a.id) filter (where a.starts_at >= now() and a.is_booked = false) as upcoming_free_slots
from public.profiles p
join public.instructor_profiles ip on ip.user_id = p.id
left join public.account_roles ar on ar.user_id = p.id
left join public.availability_slots a on a.instructor_id = ip.user_id
where lower(p.email) = lower('JoshuaMN1@Hotmail.com')
group by p.email, ip.display_name, ip.verification_status, ip.instructor_package, ip.instructor_subscription_status, ip.compliance_status, ip.learner_availability_paused;
