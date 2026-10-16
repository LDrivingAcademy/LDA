-- Allow LDA to remove temporary instructor verification evidence after review
-- while retaining only verification metadata and audit history.
alter table public.instructor_documents
  alter column storage_path drop not null;
