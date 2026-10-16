create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  issue text not null check (char_length(issue) between 1 and 120),
  details text not null check (char_length(details) between 1 and 4000),
  summary text not null check (char_length(summary) between 1 and 400),
  summary_kind text not null check (summary_kind in ('short', 'ai', 'fallback')),
  page_url text,
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_created_at_idx
  on public.product_feedback (created_at desc);

alter table public.product_feedback enable row level security;

revoke all on public.product_feedback from anon;
revoke all on public.product_feedback from authenticated;
grant select on public.product_feedback to authenticated;
grant all on public.product_feedback to service_role;

drop policy if exists "Admins read product feedback" on public.product_feedback;
create policy "Admins read product feedback"
  on public.product_feedback
  for select
  to authenticated
  using ((select private.current_user_is_admin()));
