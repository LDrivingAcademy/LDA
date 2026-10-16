grant select (
  expires_at,
  document_version,
  metadata_locked_at,
  renewal_reminder_sent_at,
  updated_at
) on public.instructor_documents to authenticated;
