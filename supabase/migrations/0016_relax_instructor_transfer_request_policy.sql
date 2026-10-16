drop policy if exists "Learners request instructor transfer" on public.account_role_transfer_requests;

create policy "Learners request instructor transfer"
on public.account_role_transfer_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and from_role = 'learner'
  and to_role = 'instructor'
  and exists (
    select 1
    from public.account_roles
    where account_roles.user_id = (select auth.uid())
      and account_roles.role = 'learner'
  )
  and not exists (
    select 1
    from public.account_roles
    where account_roles.user_id = (select auth.uid())
      and account_roles.role = 'instructor'
  )
);
