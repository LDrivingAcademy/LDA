-- Learner Plus account flags for manual admin upgrades now and Stripe subscription sync later.
alter table public.learner_profiles
  add column if not exists learner_plus_active boolean not null default false,
  add column if not exists learner_plus_started_at timestamptz,
  add column if not exists learner_plus_expires_at timestamptz,
  add column if not exists learner_plus_source text;

create index if not exists learner_profiles_plus_active_idx
on public.learner_profiles(learner_plus_active)
where learner_plus_active = true;
