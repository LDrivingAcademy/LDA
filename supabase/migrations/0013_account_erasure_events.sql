-- Non-identifying erasure audit log.
-- Stores proof that an account erasure request was processed without keeping
-- the deleted user's name, email, phone number, licence details, postcode, or
-- Supabase user id in this audit table.

create table if not exists public.account_erasure_events (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null,
  requested_by text not null default 'self_service'
    check (requested_by in ('self_service', 'admin')),
  deleted_categories text[] not null default '{}',
  retained_categories text[] not null default '{}',
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists account_erasure_events_processed_idx
on public.account_erasure_events(processed_at desc);

create unique index if not exists account_erasure_events_subject_hash_idx
on public.account_erasure_events(subject_hash);

alter table public.account_erasure_events enable row level security;

drop policy if exists "Admins read account erasure events" on public.account_erasure_events;
create policy "Admins read account erasure events"
on public.account_erasure_events for select
to authenticated
using ((select private.current_user_is_admin()));
