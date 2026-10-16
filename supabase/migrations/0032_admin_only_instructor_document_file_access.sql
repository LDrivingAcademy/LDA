insert into storage.buckets (id, name, public)
values ('instructor-documents', 'instructor-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Owners and admins read verification files" on storage.objects;
drop policy if exists "Admins read instructor verification files" on storage.objects;

create policy "Admins read instructor verification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'instructor-documents'
  and (select private.current_user_is_admin())
);
