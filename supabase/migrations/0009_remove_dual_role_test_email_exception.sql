-- Remove the temporary dual-role email exception before production launch.
-- Learner-to-instructor changes should use account_role_transfer_requests.

create or replace function public.prevent_dual_marketplace_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role in ('learner', 'instructor') and exists (
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
