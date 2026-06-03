-- Marketing consent capture for visitors who are not signed in yet.
-- Account holders still keep their profile-level marketing_opt_in flag.

create table if not exists public.marketing_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  source text not null default 'social',
  consent_text text not null,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  user_id uuid references public.profiles(id) on delete set null,
  page_url text,
  consented_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists marketing_subscribers_status_seen_idx
on public.marketing_subscribers(status, last_seen_at desc);

alter table public.marketing_subscribers enable row level security;

drop policy if exists "Admins can manage marketing subscribers" on public.marketing_subscribers;
create policy "Admins can manage marketing subscribers"
on public.marketing_subscribers
for all
using (private.current_user_has_role('admin'))
with check (private.current_user_has_role('admin'));
