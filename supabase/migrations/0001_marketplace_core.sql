-- LDA marketplace core schema
-- Run this in Supabase SQL editor or via Supabase migrations.

create extension if not exists "pgcrypto";

create schema if not exists private;

do $$ begin
  create type public.app_role as enum ('learner', 'instructor', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.instructor_verification_status as enum ('draft', 'pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transmission_type as enum ('manual', 'automatic', 'both');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('pending', 'accepted', 'declined', 'completed', 'cancelled', 'refund_requested', 'refunded', 'disputed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'requires_payment', 'paid', 'refunded', 'disputed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_type as enum ('adi_pdi_badge', 'driving_licence', 'proof_of_id', 'insurance', 'dbs_check', 'vehicle_photo', 'other');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.account_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.learner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  provisional_licence_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instructor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  bio text,
  adi_pdi_status text check (adi_pdi_status in ('ADI', 'PDI')),
  adi_pdi_number text,
  verification_status public.instructor_verification_status not null default 'draft',
  rejection_reason text,
  hourly_rate_pence integer check (hourly_rate_pence >= 0),
  transmission public.transmission_type not null default 'manual',
  car_make text,
  car_model text,
  car_registration text,
  areas_covered text[] not null default '{}',
  base_postcode text,
  latitude double precision,
  longitude double precision,
  auto_accept_bookings boolean not null default false,
  stripe_account_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instructor_documents (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  storage_path text not null,
  status public.instructor_verification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id),
  instructor_id uuid not null references public.instructor_profiles(user_id),
  availability_slot_id uuid references public.availability_slots(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pickup_postcode text not null,
  pickup_latitude double precision,
  pickup_longitude double precision,
  lesson_price_pence integer not null check (lesson_price_pence >= 0),
  platform_fee_pence integer not null default 0 check (platform_fee_pence >= 0),
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  gross_amount_pence integer not null check (gross_amount_pence >= 0),
  platform_fee_pence integer not null check (platform_fee_pence >= 0),
  instructor_net_pence integer not null check (instructor_net_pence >= 0),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_transfer_id text,
  status public.payment_status not null default 'requires_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  learner_id uuid not null references public.profiles(id),
  instructor_id uuid not null references public.instructor_profiles(user_id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed_amount')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  id boolean primary key default true,
  platform_commission_percent numeric(5,2) not null default 10.00,
  cancellation_window_hours integer not null default 24,
  updated_at timestamptz not null default now(),
  check (id),
  check (platform_commission_percent >= 0 and platform_commission_percent <= 100)
);

insert into public.admin_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.location_shares (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  instructor_id uuid not null references public.instructor_profiles(user_id),
  learner_id uuid not null references public.profiles(id),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters integer,
  recorded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create index if not exists account_roles_user_id_idx on public.account_roles(user_id);
create index if not exists instructor_profiles_status_idx on public.instructor_profiles(verification_status);
create index if not exists availability_slots_instructor_starts_idx on public.availability_slots(instructor_id, starts_at);
create index if not exists bookings_learner_idx on public.bookings(learner_id, starts_at desc);
create index if not exists bookings_instructor_idx on public.bookings(instructor_id, starts_at desc);
create index if not exists location_shares_booking_recorded_idx on public.location_shares(booking_id, recorded_at desc);

create or replace function private.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function private.current_user_has_role(required_role public.app_role)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.account_roles (user_id, role)
  values (new.id, 'learner')
  on conflict do nothing;

  insert into public.learner_profiles (user_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists learner_profiles_set_updated_at on public.learner_profiles;
create trigger learner_profiles_set_updated_at before update on public.learner_profiles
for each row execute function public.set_updated_at();

drop trigger if exists instructor_profiles_set_updated_at on public.instructor_profiles;
create trigger instructor_profiles_set_updated_at before update on public.instructor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.account_roles enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.instructor_profiles enable row level security;
alter table public.instructor_documents enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.promo_codes enable row level security;
alter table public.admin_settings enable row level security;
alter table public.location_shares enable row level security;

drop policy if exists "Profiles are visible to owner or admin" on public.profiles;
create policy "Profiles are visible to owner or admin"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select private.current_user_is_admin()));

drop policy if exists "Users can update their own non-role profile" on public.profiles;
create policy "Users can update their own non-role profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own roles" on public.account_roles;
create policy "Users can read their own roles"
on public.account_roles for select
to authenticated
using ((select auth.uid()) = user_id or (select private.current_user_is_admin()));

drop policy if exists "Admins manage roles" on public.account_roles;
create policy "Admins manage roles"
on public.account_roles for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Learners manage own learner profile" on public.learner_profiles;
create policy "Learners manage own learner profile"
on public.learner_profiles for all
to authenticated
using ((select auth.uid()) = user_id or (select private.current_user_is_admin()))
with check ((select auth.uid()) = user_id or (select private.current_user_is_admin()));

drop policy if exists "Approved instructors are public" on public.instructor_profiles;
create policy "Approved instructors are public"
on public.instructor_profiles for select
to anon, authenticated
using (verification_status = 'approved' or (select auth.uid()) = user_id or (select private.current_user_is_admin()));

drop policy if exists "Users create own instructor profile" on public.instructor_profiles;
create policy "Users create own instructor profile"
on public.instructor_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id and verification_status in ('draft', 'pending'));

drop policy if exists "Users update own unapproved instructor profile" on public.instructor_profiles;
create policy "Users update own unapproved instructor profile"
on public.instructor_profiles for update
to authenticated
using ((select auth.uid()) = user_id and verification_status in ('draft', 'pending', 'rejected'))
with check ((select auth.uid()) = user_id and verification_status in ('draft', 'pending'));

drop policy if exists "Admins manage instructor profiles" on public.instructor_profiles;
create policy "Admins manage instructor profiles"
on public.instructor_profiles for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Instructor documents visible to owner or admin" on public.instructor_documents;
create policy "Instructor documents visible to owner or admin"
on public.instructor_documents for select
to authenticated
using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Instructors upload their own documents" on public.instructor_documents;
create policy "Instructors upload their own documents"
on public.instructor_documents for insert
to authenticated
with check (instructor_id = (select auth.uid()) and uploaded_by = (select auth.uid()));

drop policy if exists "Admins manage instructor documents" on public.instructor_documents;
create policy "Admins manage instructor documents"
on public.instructor_documents for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Availability for approved instructors is public" on public.availability_slots;
create policy "Availability for approved instructors is public"
on public.availability_slots for select
to anon, authenticated
using (
  exists (
    select 1 from public.instructor_profiles ip
    where ip.user_id = instructor_id
      and ip.verification_status = 'approved'
  )
  or instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Instructors manage own availability" on public.availability_slots;
create policy "Instructors manage own availability"
on public.availability_slots for all
to authenticated
using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
with check (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Booking participants can view bookings" on public.bookings;
create policy "Booking participants can view bookings"
on public.bookings for select
to authenticated
using (learner_id = (select auth.uid()) or instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Learners create bookings with approved instructors" on public.bookings;
create policy "Learners create bookings with approved instructors"
on public.bookings for insert
to authenticated
with check (
  learner_id = (select auth.uid())
  and exists (
    select 1 from public.instructor_profiles ip
    where ip.user_id = instructor_id
      and ip.verification_status = 'approved'
  )
);

drop policy if exists "Booking participants can update booking status" on public.bookings;
create policy "Booking participants can update booking status"
on public.bookings for update
to authenticated
using (learner_id = (select auth.uid()) or instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
with check (learner_id = (select auth.uid()) or instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Booking participants can view payments" on public.payments;
create policy "Booking participants can view payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.learner_id = (select auth.uid()) or b.instructor_id = (select auth.uid()))
  )
  or (select private.current_user_is_admin())
);

drop policy if exists "Admins manage payments" on public.payments;
create policy "Admins manage payments"
on public.payments for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Reviews are public" on public.reviews;
create policy "Reviews are public"
on public.reviews for select
to anon, authenticated
using (true);

drop policy if exists "Learners review completed bookings" on public.reviews;
create policy "Learners review completed bookings"
on public.reviews for insert
to authenticated
with check (
  learner_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.learner_id = (select auth.uid())
      and b.status = 'completed'
  )
);

drop policy if exists "Active promo codes are public" on public.promo_codes;
create policy "Active promo codes are public"
on public.promo_codes for select
to anon, authenticated
using (active = true);

drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins manage promo codes"
on public.promo_codes for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Admins read settings" on public.admin_settings;
create policy "Admins read settings"
on public.admin_settings for select
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins update settings" on public.admin_settings;
create policy "Admins update settings"
on public.admin_settings for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Booking participants view live locations" on public.location_shares;
create policy "Booking participants view live locations"
on public.location_shares for select
to authenticated
using (
  expires_at > now()
  and (learner_id = (select auth.uid()) or instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
);

drop policy if exists "Instructors share own live location for active bookings" on public.location_shares;
create policy "Instructors share own live location for active bookings"
on public.location_shares for insert
to authenticated
with check (
  instructor_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.instructor_id = (select auth.uid())
      and b.learner_id = learner_id
      and b.status in ('accepted', 'pending')
  )
);

insert into storage.buckets (id, name, public)
values ('instructor-documents', 'instructor-documents', false)
on conflict (id) do nothing;

drop policy if exists "Instructors upload own verification files" on storage.objects;
create policy "Instructors upload own verification files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'instructor-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and admins read verification files" on storage.objects;
create policy "Owners and admins read verification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'instructor-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.current_user_is_admin())
  )
);
