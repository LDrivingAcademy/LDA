-- Seed learner date of birth from the secure learner sign-up flow.
-- This keeps admin learner records complete as soon as the account exists,
-- while the verification page still confirms terms and booking eligibility.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'account_intent', 'learner');
  submitted_date_of_birth date := null;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  if (new.raw_user_meta_data ->> 'date_of_birth') ~ '^\d{4}-\d{2}-\d{2}$' then
    submitted_date_of_birth := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  end if;

  if requested_role = 'learner' and submitted_date_of_birth is not null then
    insert into public.learner_profiles (user_id, date_of_birth)
    values (new.id, submitted_date_of_birth)
    on conflict (user_id) do update
      set date_of_birth = coalesce(public.learner_profiles.date_of_birth, excluded.date_of_birth),
          updated_at = now();
  end if;

  return new;
end;
$$;

insert into public.learner_profiles (user_id, date_of_birth)
select roles.user_id, (users.raw_user_meta_data ->> 'date_of_birth')::date
from public.account_roles roles
join auth.users users on users.id = roles.user_id
where roles.role = 'learner'
  and (users.raw_user_meta_data ->> 'date_of_birth') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id) do update
  set date_of_birth = coalesce(public.learner_profiles.date_of_birth, excluded.date_of_birth),
      updated_at = now();
