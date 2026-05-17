-- Temporary development exception:
-- joshuamn1@hotmail.com may hold both learner and instructor roles while LDA
-- tests the split dashboard flows. All other emails remain one marketplace role
-- at a time and should use the learner-to-instructor transfer process.

create or replace function private.is_dual_marketplace_role_exception(account_id uuid)
returns boolean
language sql
stable
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = account_id
      and lower(profiles.email) = 'joshuamn1@hotmail.com'
  );
$$;

revoke all on function private.is_dual_marketplace_role_exception(uuid) from public, anon, authenticated;

create or replace function public.prevent_dual_marketplace_roles()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.role in ('learner', 'instructor')
    and not private.is_dual_marketplace_role_exception(new.user_id)
    and exists (
      select 1
      from public.account_roles existing
      where existing.user_id = new.user_id
        and existing.role in ('learner', 'instructor')
        and existing.role <> new.role
    ) then
    raise exception 'LDA accounts cannot be both learner and instructor. Request an account transfer instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
