alter table public.support_tickets
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_by_name text,
  add column if not exists resolution_signed_at timestamptz;

alter table public.support_tickets
  drop constraint if exists support_tickets_resolved_by_name_length;

alter table public.support_tickets
  add constraint support_tickets_resolved_by_name_length
  check (resolved_by_name is null or char_length(resolved_by_name) <= 120);

create index if not exists support_tickets_resolved_by_idx
  on public.support_tickets (resolved_by, resolution_signed_at desc)
  where resolved_by is not null;

alter table public.product_feedback
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_by_name text,
  add column if not exists resolution_signed_at timestamptz;

alter table public.product_feedback
  drop constraint if exists product_feedback_resolved_by_name_length;

alter table public.product_feedback
  add constraint product_feedback_resolved_by_name_length
  check (resolved_by_name is null or char_length(resolved_by_name) <= 120);

create index if not exists product_feedback_resolved_by_idx
  on public.product_feedback (resolved_by, resolution_signed_at desc)
  where resolved_by is not null;

alter table public.technical_incidents
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_by_name text,
  add column if not exists resolution_signed_at timestamptz;

alter table public.technical_incidents
  drop constraint if exists technical_incidents_resolved_by_name_length;

alter table public.technical_incidents
  add constraint technical_incidents_resolved_by_name_length
  check (resolved_by_name is null or char_length(resolved_by_name) <= 120);

create index if not exists technical_incidents_resolved_by_idx
  on public.technical_incidents (resolved_by, resolution_signed_at desc)
  where resolved_by is not null;

create table if not exists public.support_shift_handover_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('admin', 'support')),
  actor_name text not null check (char_length(actor_name) between 1 and 120),
  handover_date date not null,
  brief_summary text not null check (char_length(brief_summary) between 1 and 3000),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (actor_user_id, handover_date)
);

create index if not exists support_shift_handover_date_idx
  on public.support_shift_handover_acknowledgements (handover_date desc, acknowledged_at desc);

create index if not exists support_shift_handover_actor_idx
  on public.support_shift_handover_acknowledgements (actor_user_id, acknowledged_at desc);

alter table public.support_shift_handover_acknowledgements enable row level security;

revoke all on public.support_shift_handover_acknowledgements from anon;
revoke all on public.support_shift_handover_acknowledgements from authenticated;
grant select, insert, update on public.support_shift_handover_acknowledgements to authenticated;
grant all on public.support_shift_handover_acknowledgements to service_role;

drop policy if exists "Support team reads handover acknowledgements" on public.support_shift_handover_acknowledgements;
create policy "Support team reads handover acknowledgements"
  on public.support_shift_handover_acknowledgements
  for select
  to authenticated
  using (
    (select private.current_user_can_access_support())
    and (
      actor_user_id = (select auth.uid())
      or (select private.current_user_is_admin())
    )
  );

drop policy if exists "Support team inserts own handover acknowledgement" on public.support_shift_handover_acknowledgements;
create policy "Support team inserts own handover acknowledgement"
  on public.support_shift_handover_acknowledgements
  for insert
  to authenticated
  with check (
    (select private.current_user_can_access_support())
    and actor_user_id = (select auth.uid())
  );

drop policy if exists "Support team updates own handover acknowledgement" on public.support_shift_handover_acknowledgements;
create policy "Support team updates own handover acknowledgement"
  on public.support_shift_handover_acknowledgements
  for update
  to authenticated
  using (
    (select private.current_user_can_access_support())
    and actor_user_id = (select auth.uid())
  )
  with check (
    (select private.current_user_can_access_support())
    and actor_user_id = (select auth.uid())
  );

comment on column public.support_tickets.resolved_by is
  'Technical support or admin user who last signed this ticket off as resolved.';

comment on column public.support_tickets.resolved_by_name is
  'Staff accountability label captured at the point of resolution sign-off.';

comment on table public.support_shift_handover_acknowledgements is
  'Daily technical support handover acknowledgements proving each operator saw the latest operational brief before using the console.';
