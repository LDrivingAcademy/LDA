create index if not exists instructor_documents_status_expiry_idx
  on public.instructor_documents(status, expires_at)
  where expires_at is not null;

create index if not exists instructor_documents_instructor_type_created_idx
  on public.instructor_documents(instructor_id, document_type, created_at desc);

drop trigger if exists instructor_documents_set_updated_at on public.instructor_documents;
create trigger instructor_documents_set_updated_at
  before update on public.instructor_documents
  for each row execute function public.set_updated_at();
