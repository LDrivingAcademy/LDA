alter table public.instructor_profiles
  add column if not exists smart_match_inclusive_enabled boolean not null default false,
  add column if not exists smart_match_teaching_styles text[] not null default '{}',
  add column if not exists smart_match_specialisms text[] not null default '{}',
  add column if not exists smart_match_inclusive_rate_pence integer,
  add column if not exists smart_match_updated_at timestamptz;

create index if not exists instructor_profiles_smart_match_visibility_idx
  on public.instructor_profiles (verification_status, compliance_status, smart_match_inclusive_enabled)
  where verification_status = 'approved';

alter table public.instructor_profiles
  add constraint instructor_profiles_smart_match_rate_check
  check (
    smart_match_inclusive_rate_pence is null
    or smart_match_inclusive_rate_pence between 1000 and 12000
  )
  not valid;

alter table public.instructor_profiles
  validate constraint instructor_profiles_smart_match_rate_check;
