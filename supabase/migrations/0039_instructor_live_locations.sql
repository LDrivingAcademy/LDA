create table if not exists public.instructor_live_locations (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters integer,
  source text not null default 'working_day',
  recorded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint instructor_live_locations_latitude_check check (latitude between -90 and 90),
  constraint instructor_live_locations_longitude_check check (longitude between -180 and 180),
  constraint instructor_live_locations_accuracy_check check (accuracy_meters is null or accuracy_meters >= 0),
  constraint instructor_live_locations_source_check check (source in ('working_day', 'start_work', 'log_on'))
);

create index if not exists instructor_live_locations_instructor_recorded_idx
  on public.instructor_live_locations(instructor_id, recorded_at desc);

create index if not exists instructor_live_locations_expires_idx
  on public.instructor_live_locations(expires_at);

alter table public.instructor_live_locations enable row level security;

grant select on public.instructor_live_locations to authenticated;
grant insert, update, delete on public.instructor_live_locations to service_role;

drop policy if exists "Admins read instructor live locations" on public.instructor_live_locations;
create policy "Admins read instructor live locations"
on public.instructor_live_locations
for select
to authenticated
using ((select private.current_user_is_admin()));
