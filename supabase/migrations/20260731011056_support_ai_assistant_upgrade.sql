-- Production AI support assistant upgrade.
-- Extends the existing support assistant, ticket, and technical-support queue in place.

create table if not exists public.support_assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key_hash text not null unique,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_role text not null default 'visitor'
    check (requester_role in ('visitor', 'learner', 'instructor', 'in_progress', 'admin')),
  contact_email text,
  status text not null default 'active'
    check (status in ('active', 'ticket_created', 'resolved_without_ticket', 'abandoned')),
  current_category text,
  current_priority text,
  last_summary text check (last_summary is null or char_length(last_summary) <= 1000),
  memory jsonb not null default '{}'::jsonb,
  last_seen_path text,
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (contact_email is null or contact_email = lower(contact_email))
);

drop trigger if exists support_assistant_sessions_set_updated_at on public.support_assistant_sessions;
create trigger support_assistant_sessions_set_updated_at
before update on public.support_assistant_sessions
for each row execute function public.set_updated_at();

create index if not exists support_assistant_sessions_user_seen_idx
  on public.support_assistant_sessions (requester_user_id, last_message_at desc)
  where requester_user_id is not null;

create index if not exists support_assistant_sessions_status_seen_idx
  on public.support_assistant_sessions (status, last_message_at desc);

create table if not exists public.support_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.support_assistant_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  text text not null check (char_length(text) between 1 and 4000),
  category text,
  priority text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_assistant_messages_session_created_idx
  on public.support_assistant_messages (session_id, created_at desc);

create table if not exists public.support_knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 180),
  audience text[] not null default array['visitor', 'learner', 'instructor', 'in_progress']::text[],
  category text not null,
  summary text not null check (char_length(summary) between 1 and 600),
  body text not null check (char_length(body) between 1 and 5000),
  keywords text[] not null default '{}'::text[],
  route_id text,
  route_href text,
  action_label text,
  priority integer not null default 0,
  active boolean not null default true,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector
);

drop trigger if exists support_knowledge_articles_set_updated_at on public.support_knowledge_articles;
create trigger support_knowledge_articles_set_updated_at
before update on public.support_knowledge_articles
for each row execute function public.set_updated_at();

create or replace function public.update_support_knowledge_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.search_document :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.body, '')), 'C');
  return new;
end;
$$;

drop trigger if exists support_knowledge_articles_search_document on public.support_knowledge_articles;
create trigger support_knowledge_articles_search_document
before insert or update of title, summary, keywords, body
on public.support_knowledge_articles
for each row execute function public.update_support_knowledge_search_document();

create index if not exists support_knowledge_articles_search_idx
  on public.support_knowledge_articles using gin (search_document);

create index if not exists support_knowledge_articles_active_category_idx
  on public.support_knowledge_articles (category, priority desc, updated_at desc)
  where active = true;

create index if not exists support_knowledge_articles_audience_idx
  on public.support_knowledge_articles using gin (audience)
  where active = true;

create table if not exists public.support_assistant_tool_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.support_assistant_sessions(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  tool_name text not null check (char_length(tool_name) between 1 and 80),
  allowed boolean not null default true,
  input_summary text check (input_summary is null or char_length(input_summary) <= 1000),
  result_summary text check (result_summary is null or char_length(result_summary) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_assistant_tool_events_session_idx
  on public.support_assistant_tool_events (session_id, created_at desc)
  where session_id is not null;

create index if not exists support_assistant_tool_events_ticket_idx
  on public.support_assistant_tool_events (ticket_id, created_at desc)
  where ticket_id is not null;

create index if not exists support_assistant_tool_events_tool_idx
  on public.support_assistant_tool_events (tool_name, created_at desc);

alter table public.support_tickets
  add column if not exists assistant_session_id uuid references public.support_assistant_sessions(id) on delete set null,
  add column if not exists knowledge_article_ids uuid[] not null default '{}'::uuid[],
  add column if not exists tool_trace jsonb not null default '[]'::jsonb;

create index if not exists support_tickets_assistant_session_idx
  on public.support_tickets (assistant_session_id)
  where assistant_session_id is not null;

create index if not exists support_tickets_knowledge_article_ids_gin_idx
  on public.support_tickets using gin (knowledge_article_ids);

alter table public.support_assistant_sessions enable row level security;
alter table public.support_assistant_messages enable row level security;
alter table public.support_knowledge_articles enable row level security;
alter table public.support_assistant_tool_events enable row level security;

revoke all on public.support_assistant_sessions from anon;
revoke all on public.support_assistant_sessions from authenticated;
grant select on public.support_assistant_sessions to authenticated;
grant all on public.support_assistant_sessions to service_role;

revoke all on public.support_assistant_messages from anon;
revoke all on public.support_assistant_messages from authenticated;
grant select on public.support_assistant_messages to authenticated;
grant all on public.support_assistant_messages to service_role;

revoke all on public.support_knowledge_articles from anon;
revoke all on public.support_knowledge_articles from authenticated;
grant select on public.support_knowledge_articles to authenticated;
grant all on public.support_knowledge_articles to service_role;

revoke all on public.support_assistant_tool_events from anon;
revoke all on public.support_assistant_tool_events from authenticated;
grant select on public.support_assistant_tool_events to authenticated;
grant all on public.support_assistant_tool_events to service_role;

drop policy if exists "Users read own support assistant sessions" on public.support_assistant_sessions;
create policy "Users read own support assistant sessions"
  on public.support_assistant_sessions
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or (select private.current_user_can_access_support())
  );

drop policy if exists "Users read own support assistant messages" on public.support_assistant_messages;
create policy "Users read own support assistant messages"
  on public.support_assistant_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_assistant_sessions session
      where session.id = support_assistant_messages.session_id
        and (
          session.requester_user_id = (select auth.uid())
          or (select private.current_user_can_access_support())
        )
    )
  );

drop policy if exists "Support knowledge visible to authenticated users" on public.support_knowledge_articles;
create policy "Support knowledge visible to authenticated users"
  on public.support_knowledge_articles
  for select
  to authenticated
  using (active = true or (select private.current_user_can_access_support()));

drop policy if exists "Support team reads support assistant tool events" on public.support_assistant_tool_events;
create policy "Support team reads support assistant tool events"
  on public.support_assistant_tool_events
  for select
  to authenticated
  using (
    (select private.current_user_can_access_support())
    or exists (
      select 1
      from public.support_assistant_sessions session
      where session.id = support_assistant_tool_events.session_id
        and session.requester_user_id = (select auth.uid())
    )
  );

insert into public.support_knowledge_articles (
  slug,
  title,
  audience,
  category,
  summary,
  body,
  keywords,
  route_id,
  route_href,
  action_label,
  priority,
  reviewed_at
)
values
  (
    'learner-booking-calendar',
    'Manage learner bookings from the learner calendar',
    array['learner']::text[],
    'booking',
    'Learners should use the learner calendar to view upcoming, completed, cancelled and rescheduled lessons.',
    'Open the learner calendar when a learner needs to view a booking, choose a calendar day, reschedule a lesson, or book another lesson from the day planner. If a booking is missing, ask for the booking reference, lesson date, payment status and instructor name before creating a ticket.',
    array['booking', 'calendar', 'reschedule', 'lesson missing', 'day planner']::text[],
    'learner_calendar',
    '/learner-calendar?from=chat',
    'Open learner calendar',
    20,
    now()
  ),
  (
    'payment-help',
    'Payment help and receipt checks',
    array['learner']::text[],
    'payment',
    'Payment help handles confirmations, failed payments, duplicate charges, refunds and receipt access.',
    'Use Payment Help when a learner asks about payment confirmation, failed card payment, duplicate charge, refund, receipt or invoice. Do not ask for full card details. Ask for the booking reference, payment date, amount and what the checkout or receipt page showed.',
    array['payment', 'receipt', 'refund', 'duplicate charge', 'stripe', 'invoice']::text[],
    'learner_support',
    '/support/learner/payment-help',
    'Open payment help',
    20,
    now()
  ),
  (
    'instructor-verification-documents',
    'Instructor verification document support',
    array['instructor', 'in_progress']::text[],
    'verification',
    'Instructor document issues should guide users back to verification before escalation.',
    'Use instructor verification when the issue is about ADI/PDI evidence, identity checks, driving licence evidence, insurance, DBS or document review. Ask for the document type and status shown, but never ask the instructor to paste document numbers or upload identity images into chat.',
    array['adi', 'pdi', 'verification', 'documents', 'approval', 'licence']::text[],
    'instructor_verification',
    '/instructor-verification?from=chat',
    'Open instructor verification',
    18,
    now()
  ),
  (
    'instructor-payouts',
    'Instructor payouts and finance support',
    array['instructor']::text[],
    'payout',
    'Instructor finance is the first route for earnings, statements, Stripe Connect and payout checks.',
    'Use instructor finance when an instructor asks about payout timing, earnings, statements, Stripe Connect or tax setup. Do not request bank or card details. Ask for payout date, statement period or Stripe reference if they have it.',
    array['payout', 'earnings', 'finance', 'stripe connect', 'statement', 'tax']::text[],
    'instructor_finance',
    '/instructor-finance',
    'Open instructor finance',
    18,
    now()
  ),
  (
    'off-platform-payment',
    'Off-platform payment requests',
    array['visitor', 'learner', 'instructor', 'in_progress']::text[],
    'off_platform',
    'Off-platform payment requests must be refused and escalated with context.',
    'If a learner says an instructor asked for cash, bank transfer, WhatsApp payment or a private booking outside LDA, tell them not to pay outside LDA. Platform protection only applies to LDA bookings and payments. Ask for instructor name, booking reference if one exists, date and exact wording, then create an urgent ticket if the issue remains unresolved.',
    array['cash', 'bank transfer', 'whatsapp', 'private booking', 'outside lda', 'off platform']::text[],
    'learner_support',
    '/support/learner/off-platform-report',
    'Report off-platform request',
    30,
    now()
  ),
  (
    'technical-page-error',
    'Website errors and broken page support',
    array['visitor', 'learner', 'instructor', 'in_progress']::text[],
    'technical',
    'Website issues should capture page, device and exact error before sending to technical support.',
    'For broken pages, blank screens, slow loading, menu issues or application errors, ask which page they were on, what they clicked, device/browser and the exact error shown. Suggest refreshing once, then create a technical ticket if it continues.',
    array['error', 'broken', 'application error', 'blank screen', 'slow', 'loading', 'bug']::text[],
    'feedback',
    '/feedback?from=chat',
    'Send feedback',
    14,
    now()
  ),
  (
    'account-access',
    'Account access and sign-in help',
    array['visitor', 'learner', 'instructor', 'in_progress']::text[],
    'account',
    'Account access support should guide users to login, recovery or account centre based on sign-in state.',
    'For sign-in, password, email verification, profile or account access issues, guide visitors to log in or create an account. Signed-in users should use account centre. Do not ask for passwords or authentication codes.',
    array['login', 'sign in', 'password', 'email verification', 'account', 'profile']::text[],
    'account_centre',
    '/account',
    'Open account centre',
    16,
    now()
  ),
  (
    'service-status',
    'Service status checks',
    array['visitor', 'learner', 'instructor', 'in_progress']::text[],
    'technical',
    'The assistant can check the latest LDA health report before escalating technical issues.',
    'If a user asks whether the site, payments, bookings or support is down, check the latest service status. If health is degraded or failing, explain that LDA is already monitoring it and create a ticket only when the user has an account-specific impact that still needs review.',
    array['status', 'down', 'service', 'health', 'outage', 'not loading']::text[],
    null,
    null,
    null,
    12,
    now()
  )
on conflict (slug) do update
set
  title = excluded.title,
  audience = excluded.audience,
  category = excluded.category,
  summary = excluded.summary,
  body = excluded.body,
  keywords = excluded.keywords,
  route_id = excluded.route_id,
  route_href = excluded.route_href,
  action_label = excluded.action_label,
  priority = excluded.priority,
  active = true,
  reviewed_at = now(),
  updated_at = now();

comment on table public.support_assistant_sessions is
  'Conversation memory for the existing LDA support assistant. Not a ticket queue.';

comment on table public.support_assistant_messages is
  'Recent assistant/user messages used for continuity and ticket context.';

comment on table public.support_knowledge_articles is
  'Curated support knowledge retrieved by the existing support assistant before escalation.';

comment on table public.support_assistant_tool_events is
  'Audit and analytics trail for backend support-assistant tool decisions.';
