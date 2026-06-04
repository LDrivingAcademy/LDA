create table if not exists public.lesson_progress_records (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles(user_id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  learner_name text not null,
  learner_email text not null,
  instructor_name text not null,
  lesson_reference text,
  completed_skills text[] not null default '{}',
  instructor_notes text not null default '',
  next_lesson_focus text not null default '',
  recommended_videos text not null default '',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_progress_records_instructor_idx
on public.lesson_progress_records(instructor_id, sent_at desc);

create index if not exists lesson_progress_records_learner_idx
on public.lesson_progress_records(learner_id, sent_at desc);

drop trigger if exists lesson_progress_records_set_updated_at on public.lesson_progress_records;
create trigger lesson_progress_records_set_updated_at before update on public.lesson_progress_records
for each row execute function public.set_updated_at();

alter table public.lesson_progress_records enable row level security;

drop policy if exists "Lesson progress visible to participants" on public.lesson_progress_records;
create policy "Lesson progress visible to participants"
on public.lesson_progress_records for select
to authenticated
using (
  learner_id = (select auth.uid())
  or instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

drop policy if exists "Instructors create own lesson progress records" on public.lesson_progress_records;
create policy "Instructors create own lesson progress records"
on public.lesson_progress_records for insert
to authenticated
with check (
  instructor_id = (select auth.uid())
  and (select private.current_user_has_role('instructor'))
);

drop policy if exists "Instructors update own lesson progress records" on public.lesson_progress_records;
create policy "Instructors update own lesson progress records"
on public.lesson_progress_records for update
to authenticated
using (
  instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
)
with check (
  instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);
