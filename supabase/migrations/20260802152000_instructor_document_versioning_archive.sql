-- Instructor document versioning and archive retention.
-- Keeps current approved versions active while replacement uploads wait for admin review.

alter table public.instructor_documents
  add column if not exists is_current boolean not null default false,
  add column if not exists version_state text not null default 'pending',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists replaced_by_document_id uuid references public.instructor_documents(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists replacement_requested_at timestamptz,
  add column if not exists review_note text;

alter table public.instructor_documents
  drop constraint if exists instructor_documents_version_state_check;

alter table public.instructor_documents
  add constraint instructor_documents_version_state_check
  check (version_state in ('draft', 'pending', 'current', 'archived', 'rejected', 'replacement_requested'));

update public.instructor_documents
set
  version_state = case
    when lower(coalesce(status::text, '')) in ('approved', 'completed', 'clear') then 'current'
    when lower(coalesce(status::text, '')) = 'draft' then 'draft'
    when lower(coalesce(status::text, '')) = 'rejected' then 'rejected'
    else 'pending'
  end,
  is_current = lower(coalesce(status::text, '')) in ('approved', 'completed', 'clear')
where version_state is null
   or version_state = 'pending';

with ranked_current as (
  select
    id,
    row_number() over (
      partition by instructor_id, document_type
      order by coalesce(document_version, 0) desc, created_at desc
    ) as rn
  from public.instructor_documents
  where lower(coalesce(status::text, '')) in ('approved', 'completed', 'clear')
)
update public.instructor_documents d
set
  is_current = ranked_current.rn = 1,
  version_state = case when ranked_current.rn = 1 then 'current' else 'archived' end,
  archived_at = case when ranked_current.rn = 1 then d.archived_at else coalesce(d.archived_at, now()) end,
  archive_reason = case when ranked_current.rn = 1 then d.archive_reason else coalesce(d.archive_reason, 'Archived by LDA document versioning backfill.') end
from ranked_current
where d.id = ranked_current.id;

update public.instructor_documents
set
  is_current = false,
  version_state = 'pending'
where lower(coalesce(status::text, '')) in ('pending', 'submitted', 'under_review', 'in_review', 'upload_in_progress')
  and version_state <> 'draft';

update public.instructor_documents
set
  is_current = false,
  version_state = 'rejected'
where lower(coalesce(status::text, '')) = 'rejected'
  and version_state not in ('replacement_requested', 'archived');

create unique index if not exists instructor_documents_one_current_per_type_idx
  on public.instructor_documents (instructor_id, document_type)
  where is_current = true;

create index if not exists instructor_documents_pending_review_idx
  on public.instructor_documents (document_type, created_at desc)
  where version_state = 'pending';

create index if not exists instructor_documents_instructor_type_version_idx
  on public.instructor_documents (instructor_id, document_type, document_version desc, created_at desc);

create index if not exists instructor_documents_archive_idx
  on public.instructor_documents (instructor_id, document_type, archived_at desc)
  where version_state = 'archived';

drop policy if exists "Admins delete instructor verification files" on storage.objects;
drop policy if exists "Admins delete instructor documents" on public.instructor_documents;

grant select (
  is_current,
  version_state,
  archived_at,
  archive_reason,
  replaced_by_document_id,
  rejection_reason,
  replacement_requested_at,
  review_note
) on public.instructor_documents to authenticated;
