alter table public.instructor_live_locations
  alter column accuracy_meters type double precision using accuracy_meters::double precision;

alter table public.location_shares
  alter column accuracy_meters type double precision using accuracy_meters::double precision;

alter table public.instructor_live_locations
  add column if not exists is_active boolean not null default true;

create index if not exists instructor_live_locations_admin_live_idx
  on public.instructor_live_locations (is_active, expires_at, recorded_at desc)
  where is_active = true;

create index if not exists availability_slots_active_work_idx
  on public.availability_slots (instructor_id, starts_at, ends_at)
  where is_booked = false;

create table if not exists public.instructor_safety_events (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  event_type text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  reported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint instructor_safety_events_type_check
    check (event_type in ('manual_emergency_alert', 'stale_ping_warning', 'low_accuracy_warning', 'abnormal_movement_signal', 'native_crash_detection_report')),
  constraint instructor_safety_events_severity_check
    check (severity in ('info', 'warning', 'critical')),
  constraint instructor_safety_events_status_check
    check (status in ('open', 'monitoring', 'investigating', 'resolved'))
);

create index if not exists instructor_safety_events_open_idx
  on public.instructor_safety_events (instructor_id, status, created_at desc)
  where status in ('open', 'monitoring', 'investigating');

create index if not exists instructor_safety_events_created_idx
  on public.instructor_safety_events (created_at desc);

alter table public.instructor_safety_events enable row level security;

revoke all on public.instructor_safety_events from anon;
revoke all on public.instructor_safety_events from authenticated;
grant select on public.instructor_safety_events to authenticated;
grant all on public.instructor_safety_events to service_role;

drop policy if exists "Admins read instructor safety events" on public.instructor_safety_events;
create policy "Admins read instructor safety events"
on public.instructor_safety_events
for select
to authenticated
using ((select private.current_user_is_admin()));

comment on table public.instructor_safety_events is
  'Admin-only safety event structure for signed-on instructor location warnings and future native emergency integrations.';

comment on column public.instructor_live_locations.is_active is
  'False after instructor sign-off so old work locations cannot appear on the active admin map.';
