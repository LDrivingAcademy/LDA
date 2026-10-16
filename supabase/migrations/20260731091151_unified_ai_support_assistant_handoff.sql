-- Unified AI support assistant handoff hardening.
-- Extends the existing assistant/session/ticket records in place.

alter table public.support_assistant_sessions
  add column if not exists anonymous_session boolean not null default true,
  add column if not exists expires_at timestamptz,
  add column if not exists resumed_at timestamptz,
  add column if not exists resume_count integer not null default 0 check (resume_count >= 0);

update public.support_assistant_sessions
set
  anonymous_session = requester_user_id is null,
  expires_at = coalesce(expires_at, created_at + interval '30 days')
where expires_at is null
   or anonymous_session is distinct from (requester_user_id is null);

create index if not exists support_assistant_sessions_expiry_idx
  on public.support_assistant_sessions (expires_at)
  where expires_at is not null;

create index if not exists support_assistant_sessions_user_active_idx
  on public.support_assistant_sessions (requester_user_id, status, last_message_at desc)
  where requester_user_id is not null;

alter table public.support_tickets
  add column if not exists agent_summary text,
  add column if not exists agent_summary_edited_at timestamptz,
  add column if not exists agent_summary_edited_by uuid references auth.users(id) on delete set null,
  add column if not exists likely_diagnosis text,
  add column if not exists troubleshooting_done text[] not null default '{}'::text[],
  add column if not exists suggested_next_steps text[] not null default '{}'::text[];

create index if not exists support_tickets_agent_summary_edited_by_idx
  on public.support_tickets (agent_summary_edited_by)
  where agent_summary_edited_by is not null;

create index if not exists support_tickets_troubleshooting_done_gin_idx
  on public.support_tickets using gin (troubleshooting_done);

create index if not exists support_tickets_suggested_next_steps_gin_idx
  on public.support_tickets using gin (suggested_next_steps);

comment on column public.support_assistant_sessions.session_key_hash is
  'One-way hash of the browser-held support session secret. The raw temporary session key is never stored.';

comment on column public.support_assistant_sessions.expires_at is
  'Expiry for temporary anonymous support sessions. Authenticated sessions may be refreshed while the account owns them.';

comment on column public.support_tickets.agent_summary is
  'Support-agent edited summary. If null, use ai_summary as the original assistant summary.';

comment on column public.support_tickets.likely_diagnosis is
  'Assistant-proposed operational diagnosis for agent review. Not automatically actioned.';

comment on column public.support_tickets.troubleshooting_done is
  'Steps the assistant already tried or asked the user to check before handoff.';

comment on column public.support_tickets.suggested_next_steps is
  'Suggested next agent actions. Agents decide what to do; the assistant does not execute sensitive actions.';
