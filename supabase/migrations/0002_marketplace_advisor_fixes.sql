-- Advisor fixes after marketplace_core.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists bookings_availability_slot_id_idx on public.bookings(availability_slot_id);
create index if not exists instructor_documents_instructor_id_idx on public.instructor_documents(instructor_id);
create index if not exists instructor_documents_uploaded_by_idx on public.instructor_documents(uploaded_by);
create index if not exists instructor_documents_reviewed_by_idx on public.instructor_documents(reviewed_by);
create index if not exists location_shares_instructor_id_idx on public.location_shares(instructor_id);
create index if not exists location_shares_learner_id_idx on public.location_shares(learner_id);
create index if not exists reviews_instructor_id_idx on public.reviews(instructor_id);
create index if not exists reviews_learner_id_idx on public.reviews(learner_id);

drop policy if exists "Admins manage roles" on public.account_roles;
drop policy if exists "Users can read their own roles" on public.account_roles;
create policy "Users and admins read roles"
on public.account_roles for select
to authenticated
using ((select auth.uid()) = user_id or (select private.current_user_is_admin()));
create policy "Admins insert roles"
on public.account_roles for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy "Admins update roles"
on public.account_roles for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy "Admins delete roles"
on public.account_roles for delete
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins manage instructor profiles" on public.instructor_profiles;
drop policy if exists "Users create own instructor profile" on public.instructor_profiles;
drop policy if exists "Users update own unapproved instructor profile" on public.instructor_profiles;
create policy "Users or admins create instructor profiles"
on public.instructor_profiles for insert
to authenticated
with check (
  ((select auth.uid()) = user_id and verification_status in ('draft', 'pending'))
  or (select private.current_user_is_admin())
);
create policy "Users or admins update instructor profiles"
on public.instructor_profiles for update
to authenticated
using (
  ((select auth.uid()) = user_id and verification_status in ('draft', 'pending', 'rejected'))
  or (select private.current_user_is_admin())
)
with check (
  ((select auth.uid()) = user_id and verification_status in ('draft', 'pending'))
  or (select private.current_user_is_admin())
);
create policy "Admins delete instructor profiles"
on public.instructor_profiles for delete
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins manage instructor documents" on public.instructor_documents;
drop policy if exists "Instructor documents visible to owner or admin" on public.instructor_documents;
drop policy if exists "Instructors upload their own documents" on public.instructor_documents;
create policy "Owners or admins read instructor documents"
on public.instructor_documents for select
to authenticated
using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy "Owners or admins insert instructor documents"
on public.instructor_documents for insert
to authenticated
with check (
  (instructor_id = (select auth.uid()) and uploaded_by = (select auth.uid()))
  or (select private.current_user_is_admin())
);
create policy "Admins update instructor documents"
on public.instructor_documents for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy "Admins delete instructor documents"
on public.instructor_documents for delete
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Instructors manage own availability" on public.availability_slots;
create policy "Instructors or admins insert availability"
on public.availability_slots for insert
to authenticated
with check (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy "Instructors or admins update availability"
on public.availability_slots for update
to authenticated
using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()))
with check (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));
create policy "Instructors or admins delete availability"
on public.availability_slots for delete
to authenticated
using (instructor_id = (select auth.uid()) or (select private.current_user_is_admin()));

drop policy if exists "Admins manage payments" on public.payments;
create policy "Admins insert payments"
on public.payments for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy "Admins update payments"
on public.payments for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy "Admins delete payments"
on public.payments for delete
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Admins manage promo codes" on public.promo_codes;
create policy "Admins insert promo codes"
on public.promo_codes for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy "Admins update promo codes"
on public.promo_codes for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy "Admins delete promo codes"
on public.promo_codes for delete
to authenticated
using ((select private.current_user_is_admin()));
