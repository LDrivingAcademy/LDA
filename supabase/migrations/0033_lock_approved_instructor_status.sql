-- Once LDA admin approves an instructor, the account must remain a full
-- instructor account. Compliance pauses should use compliance fields instead
-- of moving the instructor back into the application/in-progress state.

create or replace function public.prevent_approved_instructor_status_regression()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.verification_status::text = 'approved'
     and new.verification_status::text <> 'approved' then
    raise exception 'Approved LDA instructor accounts cannot be moved back to in-progress verification.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_approved_instructor_status_regression on public.instructor_profiles;
create trigger prevent_approved_instructor_status_regression
before update of verification_status on public.instructor_profiles
for each row execute function public.prevent_approved_instructor_status_regression();
