-- Stores explicit Follow LDA mailing-list consent for learners and guests.

create table if not exists public.marketing_subscribers (
  email text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text,
  source text not null default 'follow_lda',
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_subscribers_email_lower check (email = lower(email)),
  constraint marketing_subscribers_email_shape check (position('@' in email) > 1)
);

create index if not exists marketing_subscribers_user_idx
on public.marketing_subscribers(user_id);

create index if not exists marketing_subscribers_active_idx
on public.marketing_subscribers(consented_at desc)
where unsubscribed_at is null;

alter table public.marketing_subscribers enable row level security;

drop policy if exists "Admins read marketing subscribers" on public.marketing_subscribers;
create policy "Admins read marketing subscribers"
on public.marketing_subscribers for select
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins manage marketing subscribers" on public.marketing_subscribers;
create policy "Admins manage marketing subscribers"
on public.marketing_subscribers for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
