create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_role text not null check (requester_role in ('visitor', 'learner', 'instructor', 'in_progress', 'admin')),
  contact_email text,
  category text not null check (category in (
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
    'general'
  )),
  priority text not null default 'standard' check (priority in ('standard', 'urgent', 'critical')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'waiting_on_customer', 'escalated', 'resolved')),
  subject text not null check (char_length(subject) between 1 and 180),
  message text not null check (char_length(message) between 3 and 4000),
  ai_summary text not null check (char_length(ai_summary) between 1 and 500),
  assistant_guidance text not null check (char_length(assistant_guidance) between 1 and 4000),
  booking_reference text,
  booking_context jsonb not null default '{}'::jsonb,
  conversation jsonb not null default '[]'::jsonb,
  risk_flags text[] not null default '{}'::text[],
  source_path text,
  request_context jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  internal_note text,
  preferred_contact_method text not null default 'email' check (preferred_contact_method in ('email', 'callback')),
  callback_requested boolean not null default false,
  callback_status text not null default 'not_requested' check (callback_status in ('not_requested', 'unavailable', 'requested', 'scheduled', 'completed')),
  escalated_at timestamptz,
  escalated_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is null or contact_email = lower(contact_email)),
  check (callback_requested = false or preferred_contact_method = 'callback')
);

create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

create index if not exists support_tickets_priority_created_idx
  on public.support_tickets (priority, created_at desc);

create index if not exists support_tickets_requester_created_idx
  on public.support_tickets (requester_user_id, created_at desc)
  where requester_user_id is not null;

create index if not exists support_tickets_booking_reference_idx
  on public.support_tickets (booking_reference)
  where booking_reference is not null;

create index if not exists support_tickets_assigned_to_idx
  on public.support_tickets (assigned_to)
  where assigned_to is not null;

create index if not exists support_tickets_escalated_by_idx
  on public.support_tickets (escalated_by)
  where escalated_by is not null;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

revoke all on public.support_tickets from anon;
revoke all on public.support_tickets from authenticated;
grant select, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

drop policy if exists "Users read own support tickets" on public.support_tickets;
create policy "Users read own support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or (select private.current_user_is_admin())
  );

drop policy if exists "Admins update support tickets" on public.support_tickets;
create policy "Admins update support tickets"
  on public.support_tickets
  for update
  to authenticated
  using ((select private.current_user_is_admin()))
  with check ((select private.current_user_is_admin()));

comment on table public.support_tickets is
  'Canonical LDA customer support case record created by the existing AI support flow.';

comment on column public.support_tickets.callback_requested is
  'Reserved for a future authenticated callback workflow. Public support currently uses email only.';
