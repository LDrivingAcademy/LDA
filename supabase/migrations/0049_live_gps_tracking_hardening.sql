alter table public.location_shares
  add column if not exists heading_degrees double precision,
  add column if not exists speed_mps double precision,
  add column if not exists source text not null default 'browser_geolocation',
  add column if not exists client_recorded_at timestamptz;

alter table public.instructor_live_locations
  add column if not exists heading_degrees double precision,
  add column if not exists speed_mps double precision,
  add column if not exists client_recorded_at timestamptz;

do $$
begin
  alter table public.location_shares
    add constraint location_shares_heading_degrees_range
    check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.location_shares
    add constraint location_shares_speed_mps_nonnegative
    check (speed_mps is null or speed_mps >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.location_shares
    add constraint location_shares_source_present
    check (length(trim(source)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.instructor_live_locations
    add constraint instructor_live_locations_heading_degrees_range
    check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.instructor_live_locations
    add constraint instructor_live_locations_speed_mps_nonnegative
    check (speed_mps is null or speed_mps >= 0);
exception
  when duplicate_object then null;
end $$;

create index if not exists location_shares_booking_recorded_idx
  on public.location_shares (booking_id, recorded_at desc);

create index if not exists location_shares_learner_expiry_idx
  on public.location_shares (learner_id, expires_at);

create index if not exists location_shares_instructor_expiry_idx
  on public.location_shares (instructor_id, expires_at);

create index if not exists instructor_live_locations_instructor_recorded_idx
  on public.instructor_live_locations (instructor_id, recorded_at desc);

create index if not exists instructor_live_locations_expiry_idx
  on public.instructor_live_locations (expires_at);

do $$
begin
  alter publication supabase_realtime add table public.location_shares;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.instructor_live_locations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create schema if not exists private;

create or replace function private.purge_expired_live_locations()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  delete from public.location_shares where expires_at < now();
  delete from public.instructor_live_locations where expires_at < now();
end;
$$;

revoke all on function private.purge_expired_live_locations() from public, anon, authenticated;
grant execute on function private.purge_expired_live_locations() to service_role;
