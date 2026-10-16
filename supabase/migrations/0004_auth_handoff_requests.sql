-- Cross-device login hand-off.
-- Lets a learner/instructor approve the email link on one device while the
-- original browser continues automatically after approval.

create table if not exists public.auth_handoff_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role public.app_role not null default 'learner',
  next_path text not null default '/dashboard',
  secret_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'consumed', 'expired')),
  verified_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  approved_at timestamptz,
  consumed_at timestamptz
);

create index if not exists auth_handoff_requests_status_expires_idx
on public.auth_handoff_requests(status, expires_at);

create index if not exists auth_handoff_requests_email_created_idx
on public.auth_handoff_requests(email, created_at desc);

alter table public.auth_handoff_requests enable row level security;
