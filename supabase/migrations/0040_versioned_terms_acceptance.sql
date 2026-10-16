alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version_accepted text;

create index if not exists profiles_terms_version_accepted_idx
  on public.profiles (terms_version_accepted);

update public.profiles p
set
  terms_accepted_at = coalesce(p.terms_accepted_at, lp.terms_accepted_at),
  terms_version_accepted = coalesce(
    p.terms_version_accepted,
    case when lp.terms_accepted_at is not null then 'legacy' end
  )
from public.learner_profiles lp
where lp.user_id = p.id
  and (p.terms_accepted_at is null or p.terms_version_accepted is null);
