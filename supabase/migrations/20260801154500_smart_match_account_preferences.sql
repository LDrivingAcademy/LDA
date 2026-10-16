create table if not exists public.smart_match_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.smart_match_preferences enable row level security;

grant select, insert, update, delete on public.smart_match_preferences to authenticated;

create index if not exists smart_match_preferences_updated_at_idx
  on public.smart_match_preferences (updated_at desc);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_match_preferences'
      and policyname = 'smart_match_preferences_select_own'
  ) then
    create policy smart_match_preferences_select_own
      on public.smart_match_preferences
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_match_preferences'
      and policyname = 'smart_match_preferences_insert_own'
  ) then
    create policy smart_match_preferences_insert_own
      on public.smart_match_preferences
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_match_preferences'
      and policyname = 'smart_match_preferences_update_own'
  ) then
    create policy smart_match_preferences_update_own
      on public.smart_match_preferences
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_match_preferences'
      and policyname = 'smart_match_preferences_delete_own'
  ) then
    create policy smart_match_preferences_delete_own
      on public.smart_match_preferences
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;
