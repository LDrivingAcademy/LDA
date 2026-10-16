-- Keep stability-test accounts production-like: no marketplace account should be
-- both a learner and an instructor. Use separate accounts for learner and
-- instructor flow testing so bookings, cancellations, calendars, and reviews
-- exercise the same role boundaries as live users.

create or replace function public.prevent_dual_marketplace_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role in ('learner', 'instructor')
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

drop function if exists private.is_dual_marketplace_role_exception(uuid);

delete from public.account_roles roles
using public.profiles profiles
where roles.user_id = profiles.id
  and lower(profiles.email) = 'joshuamn1@hotmail.com'
  and roles.role in ('learner', 'admin');
