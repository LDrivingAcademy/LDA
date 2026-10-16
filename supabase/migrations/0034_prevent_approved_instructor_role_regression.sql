-- Approved instructors must stay instructor-only. The in-progress state is only
-- a temporary holding state before LDA approval, not a state an approved
-- instructor can return to through role changes.

create or replace function public.prevent_approved_instructor_role_regression()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  if not exists (
    select 1
    from public.instructor_profiles
    where user_id = target_user_id
      and verification_status::text = 'approved'
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.role::text = 'learner' then
    raise exception 'Approved LDA instructor accounts cannot be moved back to learner or in-progress state.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.role::text = 'instructor'
     and (new.role::text <> 'instructor' or new.user_id <> old.user_id) then
    raise exception 'Approved LDA instructor accounts cannot have their instructor role downgraded.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_approved_instructor_role_regression on public.account_roles;
drop trigger if exists prevent_approved_instructor_role_insert_regression on public.account_roles;
create trigger prevent_approved_instructor_role_regression
before insert or update or delete on public.account_roles
for each row execute function public.prevent_approved_instructor_role_regression();
