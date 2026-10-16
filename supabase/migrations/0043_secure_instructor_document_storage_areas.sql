insert into storage.buckets (id, name, public)
values ('instructor-documents', 'instructor-documents', false)
on conflict (id) do update set public = false;

alter table public.instructor_documents
drop constraint if exists instructor_documents_secure_storage_path_check;

alter table public.instructor_documents
add constraint instructor_documents_secure_storage_path_check
check (
  storage_path ~ '^(applications|compliance)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
  or storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
) not valid;

drop policy if exists "Owners or admins insert instructor documents" on public.instructor_documents;
create policy "Owners or admins insert instructor documents"
on public.instructor_documents for insert
to authenticated
with check (
  (
    instructor_id = (select auth.uid())
    and uploaded_by = (select auth.uid())
    and (
      storage_path like ('applications/' || (select auth.uid())::text || '/%')
      or (
        storage_path like ('compliance/' || (select auth.uid())::text || '/%')
        and exists (
          select 1
          from public.instructor_profiles profile
          where profile.user_id = (select auth.uid())
            and profile.verification_status = 'approved'
        )
      )
    )
  )
  or (select private.current_user_is_admin())
);

drop policy if exists "Instructors upload own verification files" on storage.objects;
drop policy if exists "Instructors upload own application verification files" on storage.objects;
drop policy if exists "Approved instructors upload own compliance files" on storage.objects;
drop policy if exists "Owners and admins read verification files" on storage.objects;
drop policy if exists "Admins read instructor verification files" on storage.objects;
drop policy if exists "Admins delete instructor verification files" on storage.objects;

create policy "Instructors upload own application verification files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'instructor-documents'
  and (storage.foldername(name))[1] = 'applications'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "Approved instructors upload own compliance files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'instructor-documents'
  and (storage.foldername(name))[1] = 'compliance'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.instructor_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.verification_status = 'approved'
  )
);

create policy "Admins read instructor verification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'instructor-documents'
  and (select private.current_user_is_admin())
);

create policy "Admins delete instructor verification files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'instructor-documents'
  and (select private.current_user_is_admin())
);
