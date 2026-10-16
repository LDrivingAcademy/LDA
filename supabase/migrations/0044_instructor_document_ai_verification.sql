alter table public.instructor_documents
add column if not exists ai_verification_status text not null default 'queued',
add column if not exists ai_verification_provider text,
add column if not exists ai_verification_summary text,
add column if not exists ai_verification_reference text,
add column if not exists ai_verification_checked_at timestamptz,
add column if not exists ai_verified_at timestamptz;

alter table public.instructor_documents
drop constraint if exists instructor_documents_ai_verification_status_check;

alter table public.instructor_documents
add constraint instructor_documents_ai_verification_status_check
check (
  ai_verification_status in (
    'queued',
    'passed',
    'needs_admin_review',
    'failed',
    'unavailable',
    'demo_verified'
  )
);

comment on column public.instructor_documents.ai_verification_status is
  'AI and authority-check status for instructor evidence before admin approval.';

comment on column public.instructor_documents.ai_verification_provider is
  'Authority or evidence route used for the document, for example DVSA ADI register or DVLA vehicle tax status.';

comment on column public.instructor_documents.ai_verification_summary is
  'AI intake and authority-review summary shown to LDA admin.';

comment on column public.instructor_documents.ai_verification_reference is
  'Internal LDA verification reference for document review audit trail.';
