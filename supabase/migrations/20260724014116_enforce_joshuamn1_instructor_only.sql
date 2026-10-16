-- Keep the approved stability-test instructor production-like. Test bypasses
-- are email-scoped in application code and must never grant admin access or a
-- second marketplace role.

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = 'joshuamn1@hotmail.com'
  order by created_at desc
  limit 1;

  if target_user_id is null then
    raise notice 'JoshuaMN1@hotmail.com does not exist in this environment.';
    return;
  end if;

  delete from public.account_roles
  where user_id = target_user_id
    and role in ('admin', 'learner');

  insert into public.account_roles (user_id, role)
  values (target_user_id, 'instructor')
  on conflict do nothing;
end
$$;
