-- Stripe subscription state for automatic learner and instructor tier access.

alter table public.learner_profiles
  add column if not exists learner_package text not null default 'learner'
    check (learner_package in ('learner', 'learner-plus', 'learner-pro')),
  add column if not exists learner_subscription_status text,
  add column if not exists learner_package_started_at timestamptz,
  add column if not exists learner_package_expires_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.instructor_profiles
  add column if not exists instructor_package text not null default 'instructor'
    check (instructor_package in ('instructor', 'instructor-plus', 'instructor-pro')),
  add column if not exists instructor_subscription_status text,
  add column if not exists instructor_package_started_at timestamptz,
  add column if not exists instructor_package_expires_at timestamptz,
  add column if not exists instructor_package_source text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists learner_profiles_stripe_customer_idx
on public.learner_profiles(stripe_customer_id)
where stripe_customer_id is not null;

create index if not exists learner_profiles_stripe_subscription_idx
on public.learner_profiles(stripe_subscription_id)
where stripe_subscription_id is not null;

create index if not exists instructor_profiles_stripe_customer_idx
on public.instructor_profiles(stripe_customer_id)
where stripe_customer_id is not null;

create index if not exists instructor_profiles_stripe_subscription_idx
on public.instructor_profiles(stripe_subscription_id)
where stripe_subscription_id is not null;

update public.learner_profiles
set
  learner_package = case
    when learner_plus_active then 'learner-plus'
    else learner_package
  end,
  learner_package_started_at = coalesce(learner_package_started_at, learner_plus_started_at),
  learner_package_expires_at = coalesce(learner_package_expires_at, learner_plus_expires_at);
