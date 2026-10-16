-- Stage 1 support-operations foundation.
-- Extends the existing LDA support system in place; does not create a duplicate queue.

alter table public.support_tickets
  add column if not exists subcategory text,
  add column if not exists severity text not null default 'sev4_low',
  add column if not exists assigned_team text not null default 'technical_support',
  add column if not exists first_response_due_at timestamptz,
  add column if not exists next_update_due_at timestamptz,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists last_customer_reply_at timestamptz,
  add column if not exists last_staff_reply_at timestamptz,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists related_account_id uuid references auth.users(id) on delete set null,
  add column if not exists related_payment_reference text,
  add column if not exists related_subscription_reference text,
  add column if not exists related_incident_id uuid references public.technical_incidents(id) on delete set null,
  add column if not exists duplicate_of_ticket_id uuid references public.support_tickets(id) on delete set null,
  add column if not exists resolution_summary text,
  add column if not exists closure_reason text,
  add column if not exists reopened_at timestamptz;

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check,
  drop constraint if exists support_tickets_priority_check,
  drop constraint if exists support_tickets_status_check,
  drop constraint if exists support_tickets_severity_check,
  drop constraint if exists support_tickets_assigned_team_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category in (
    'booking',
    'payment',
    'cancellation',
    'arrival',
    'account',
    'verification',
    'payout',
    'safety',
    'off_platform',
    'technical',
    'general',
    'account_access',
    'email_verification',
    'learner_profile',
    'instructor_profile',
    'document_verification',
    'lesson_booking',
    'payments',
    'subscriptions',
    'stripe_billing',
    'maps_and_live_location',
    'notifications',
    'website_error',
    'browser_or_device',
    'privacy_request',
    'safeguarding',
    'security',
    'feature_request',
    'technical_enquiry',
    'other'
  )),
  add constraint support_tickets_priority_check
  check (priority in ('standard', 'urgent', 'critical')),
  add constraint support_tickets_status_check
  check (status in (
    'new',
    'reviewing',
    'waiting_on_customer',
    'triaged',
    'assigned',
    'in_progress',
    'waiting_for_customer',
    'waiting_for_internal_team',
    'escalated',
    'resolved',
    'closed',
    'reopened'
  )),
  add constraint support_tickets_severity_check
  check (severity in ('sev1_critical', 'sev2_high', 'sev3_medium', 'sev4_low')),
  add constraint support_tickets_assigned_team_check
  check (assigned_team in (
    'technical_support',
    'support_management',
    'administration',
    'finance',
    'safeguarding',
    'compliance',
    'development'
  ));

create index if not exists support_tickets_severity_status_idx
  on public.support_tickets (severity, status, created_at desc);

create index if not exists support_tickets_assigned_team_status_idx
  on public.support_tickets (assigned_team, status, created_at desc);

create index if not exists support_tickets_deadline_idx
  on public.support_tickets (resolution_due_at asc)
  where status not in ('resolved', 'closed') and resolution_due_at is not null;

create index if not exists support_tickets_first_response_deadline_idx
  on public.support_tickets (first_response_due_at asc)
  where status not in ('resolved', 'closed') and first_response_due_at is not null;

create index if not exists support_tickets_related_incident_idx
  on public.support_tickets (related_incident_id)
  where related_incident_id is not null;

create index if not exists support_tickets_duplicate_of_idx
  on public.support_tickets (duplicate_of_ticket_id)
  where duplicate_of_ticket_id is not null;

create index if not exists support_tickets_tags_gin_idx
  on public.support_tickets using gin (tags);

alter table public.technical_incidents
  add column if not exists incident_reference bigint generated always as identity unique,
  add column if not exists affected_services text[] not null default '{}'::text[],
  add column if not exists detected_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists incident_commander uuid references auth.users(id) on delete set null,
  add column if not exists assigned_responders uuid[] not null default '{}'::uuid[],
  add column if not exists suspected_cause text,
  add column if not exists confirmed_root_cause text,
  add column if not exists workaround text,
  add column if not exists resolution text,
  add column if not exists corrective_actions text,
  add column if not exists preventative_actions text,
  add column if not exists post_incident_review text;

alter table public.technical_incidents
  drop constraint if exists technical_incidents_status_check,
  drop constraint if exists technical_incidents_severity_check;

alter table public.technical_incidents
  add constraint technical_incidents_status_check
  check (status in (
    'new',
    'reviewing',
    'escalated',
    'investigating',
    'identified',
    'monitoring',
    'resolved',
    'post_incident_review',
    'closed'
  )),
  add constraint technical_incidents_severity_check
  check (severity in ('info', 'warning', 'critical', 'sev1_critical', 'sev2_high', 'sev3_medium', 'sev4_low'));

create index if not exists technical_incidents_severity_status_idx
  on public.technical_incidents (severity, status, last_seen_at desc);

create index if not exists technical_incidents_services_gin_idx
  on public.technical_incidents using gin (affected_services);

create table if not exists public.support_service_targets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  priority text not null,
  severity text not null,
  assigned_team text not null default 'technical_support',
  acknowledgement_minutes integer not null check (acknowledgement_minutes > 0),
  first_response_minutes integer not null check (first_response_minutes > 0),
  next_update_minutes integer not null check (next_update_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, priority, severity, assigned_team)
);

drop trigger if exists support_service_targets_set_updated_at on public.support_service_targets;
create trigger support_service_targets_set_updated_at
before update on public.support_service_targets
for each row execute function public.set_updated_at();

create index if not exists support_service_targets_lookup_idx
  on public.support_service_targets (category, priority, severity, assigned_team)
  where active = true;

alter table public.support_service_targets enable row level security;

revoke all on public.support_service_targets from anon;
revoke all on public.support_service_targets from authenticated;
grant select on public.support_service_targets to authenticated;
grant all on public.support_service_targets to service_role;

drop policy if exists "Support team reads service targets" on public.support_service_targets;
create policy "Support team reads service targets"
  on public.support_service_targets
  for select
  to authenticated
  using ((select private.current_user_can_access_support()));

create table if not exists public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  incident_id uuid references public.technical_incidents(id) on delete cascade,
  feedback_id uuid references public.product_feedback(id) on delete cascade,
  health_report_id uuid references public.site_health_reports(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  action text not null check (char_length(action) between 1 and 80),
  from_status text,
  to_status text,
  summary text check (summary is null or char_length(summary) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ticket_id is not null or incident_id is not null or feedback_id is not null or health_report_id is not null)
);

create index if not exists support_audit_events_ticket_idx
  on public.support_audit_events (ticket_id, created_at desc)
  where ticket_id is not null;

create index if not exists support_audit_events_incident_idx
  on public.support_audit_events (incident_id, created_at desc)
  where incident_id is not null;

create index if not exists support_audit_events_feedback_idx
  on public.support_audit_events (feedback_id, created_at desc)
  where feedback_id is not null;

create index if not exists support_audit_events_health_report_idx
  on public.support_audit_events (health_report_id, created_at desc)
  where health_report_id is not null;

create index if not exists support_audit_events_action_idx
  on public.support_audit_events (action, created_at desc);

create or replace function private.prevent_support_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Support audit events are immutable';
end;
$$;

drop trigger if exists support_audit_events_immutable_update on public.support_audit_events;
create trigger support_audit_events_immutable_update
before update on public.support_audit_events
for each row execute function private.prevent_support_audit_mutation();

drop trigger if exists support_audit_events_immutable_delete on public.support_audit_events;
create trigger support_audit_events_immutable_delete
before delete on public.support_audit_events
for each row execute function private.prevent_support_audit_mutation();

alter table public.support_audit_events enable row level security;

revoke all on public.support_audit_events from anon;
revoke all on public.support_audit_events from authenticated;
grant select, insert on public.support_audit_events to authenticated;
grant all on public.support_audit_events to service_role;

drop policy if exists "Support team reads support audit events" on public.support_audit_events;
create policy "Support team reads support audit events"
  on public.support_audit_events
  for select
  to authenticated
  using (
    (select private.current_user_can_access_support())
    or exists (
      select 1
      from public.support_tickets ticket
      where ticket.id = support_audit_events.ticket_id
        and ticket.requester_user_id = (select auth.uid())
    )
  );

drop policy if exists "Support team inserts support audit events" on public.support_audit_events;
create policy "Support team inserts support audit events"
  on public.support_audit_events
  for insert
  to authenticated
  with check ((select private.current_user_can_access_support()));

insert into public.support_service_targets (
  category,
  priority,
  severity,
  assigned_team,
  acknowledgement_minutes,
  first_response_minutes,
  next_update_minutes,
  resolution_minutes
)
values
  ('other', 'standard', 'sev4_low', 'technical_support', 120, 480, 1440, 4320),
  ('technical_enquiry', 'standard', 'sev4_low', 'technical_support', 120, 480, 1440, 4320),
  ('website_error', 'urgent', 'sev3_medium', 'technical_support', 60, 240, 720, 2880),
  ('payments', 'urgent', 'sev2_high', 'finance', 60, 240, 720, 2880),
  ('stripe_billing', 'urgent', 'sev2_high', 'finance', 60, 240, 720, 2880),
  ('safeguarding', 'critical', 'sev1_critical', 'safeguarding', 15, 60, 240, 1440),
  ('security', 'critical', 'sev1_critical', 'compliance', 15, 60, 240, 1440)
on conflict (category, priority, severity, assigned_team) do update
set
  acknowledgement_minutes = excluded.acknowledgement_minutes,
  first_response_minutes = excluded.first_response_minutes,
  next_update_minutes = excluded.next_update_minutes,
  resolution_minutes = excluded.resolution_minutes,
  active = true,
  updated_at = now();

comment on table public.support_service_targets is
  'Configurable support service targets used by the technical support dashboard and ticket workflow.';

comment on table public.support_audit_events is
  'Immutable operational audit trail for support ticket, feedback, and incident workflow changes.';
