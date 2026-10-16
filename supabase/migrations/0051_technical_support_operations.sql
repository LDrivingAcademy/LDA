alter table public.product_feedback
  add column if not exists support_status text not null default 'new',
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

alter table public.product_feedback
  drop constraint if exists product_feedback_support_status_check;

alter table public.product_feedback
  add constraint product_feedback_support_status_check
  check (support_status in ('new', 'reviewing', 'escalated', 'resolved'));

create index if not exists product_feedback_support_status_created_idx
  on public.product_feedback (support_status, created_at desc);

grant update on public.product_feedback to authenticated;

drop policy if exists "Admins update product feedback triage" on public.product_feedback;
create policy "Admins update product feedback triage"
  on public.product_feedback
  for update
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

create table if not exists public.technical_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  source text not null check (source in ('client_error', 'health_monitor', 'manual')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'escalated', 'resolved')),
  title text not null check (char_length(title) between 1 and 180),
  summary text not null check (char_length(summary) between 1 and 1000),
  path text,
  technical_context jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  escalated_at timestamptz,
  escalated_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);

create index if not exists technical_incidents_status_seen_idx
  on public.technical_incidents (status, last_seen_at desc);

alter table public.technical_incidents enable row level security;

revoke all on public.technical_incidents from anon;
revoke all on public.technical_incidents from authenticated;
grant select, update on public.technical_incidents to authenticated;
grant all on public.technical_incidents to service_role;

drop policy if exists "Admins read technical incidents" on public.technical_incidents;
create policy "Admins read technical incidents"
  on public.technical_incidents
  for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists "Admins update technical incident triage" on public.technical_incidents;
create policy "Admins update technical incident triage"
  on public.technical_incidents
  for update
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

create table if not exists public.site_health_reports (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  status text not null check (status in ('ok', 'degraded', 'fail')),
  checked_at timestamptz not null,
  duration_ms integer not null,
  total_checks integer not null,
  passed_checks integer not null,
  failed_checks integer not null,
  slow_checks_count integer not null,
  success_rate numeric(6,3) not null,
  threshold numeric(6,3) not null,
  p50_ms integer not null,
  p95_ms integer not null,
  p99_ms integer not null,
  max_ms integer not null,
  failures jsonb not null default '[]'::jsonb,
  slow_checks jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  alert_severity text not null default 'none' check (alert_severity in ('none', 'warning', 'critical')),
  alert_reason text,
  escalated_at timestamptz,
  escalated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (checked_at, target)
);

create index if not exists site_health_reports_checked_idx
  on public.site_health_reports (checked_at desc);

alter table public.site_health_reports enable row level security;

revoke all on public.site_health_reports from anon;
revoke all on public.site_health_reports from authenticated;
grant select, update on public.site_health_reports to authenticated;
grant all on public.site_health_reports to service_role;

drop policy if exists "Admins read site health reports" on public.site_health_reports;
create policy "Admins read site health reports"
  on public.site_health_reports
  for select
  to authenticated
  using ((select private.current_user_is_admin()));

drop policy if exists "Admins update site health escalation" on public.site_health_reports;
create policy "Admins update site health escalation"
  on public.site_health_reports
  for update
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

create or replace function public.record_technical_incident(
  p_fingerprint text,
  p_source text,
  p_severity text,
  p_title text,
  p_summary text,
  p_path text default null,
  p_technical_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  incident_id uuid;
begin
  insert into public.technical_incidents (
    fingerprint,
    source,
    severity,
    title,
    summary,
    path,
    technical_context
  )
  values (
    p_fingerprint,
    p_source,
    p_severity,
    p_title,
    p_summary,
    p_path,
    coalesce(p_technical_context, '{}'::jsonb)
  )
  on conflict (fingerprint) do update
  set
    severity = excluded.severity,
    title = excluded.title,
    summary = excluded.summary,
    path = excluded.path,
    technical_context = excluded.technical_context,
    occurrence_count = public.technical_incidents.occurrence_count + 1,
    last_seen_at = now(),
    status = case
      when public.technical_incidents.status = 'resolved' then 'new'
      else public.technical_incidents.status
    end,
    resolved_at = case
      when public.technical_incidents.status = 'resolved' then null
      else public.technical_incidents.resolved_at
    end
  returning id into incident_id;

  return incident_id;
end;
$$;

revoke all on function public.record_technical_incident(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.record_technical_incident(text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.record_technical_incident(text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.record_technical_incident(text, text, text, text, text, text, jsonb) to service_role;
