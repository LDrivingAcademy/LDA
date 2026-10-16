alter table public.instructor_documents add column if not exists expires_at date;
alter table public.instructor_documents add column if not exists document_version integer not null default 1;
alter table public.instructor_documents add column if not exists metadata_locked_at timestamptz;
alter table public.instructor_documents add column if not exists renewal_reminder_sent_at timestamptz;
alter table public.instructor_documents add column if not exists updated_at timestamptz not null default now();
