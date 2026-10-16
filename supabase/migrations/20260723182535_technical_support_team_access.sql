alter type public.app_role add value if not exists 'support';

create or replace function private.current_user_is_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_roles
    where user_id = (select auth.uid())
      and role::text = 'support'
  );
$$;

revoke all on function private.current_user_is_support() from public;
grant execute on function private.current_user_is_support() to authenticated;

create or replace function private.current_user_can_access_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.current_user_is_admin())
    or (select private.current_user_is_support());
$$;

revoke all on function private.current_user_can_access_support() from public;
grant execute on function private.current_user_can_access_support() to authenticated;

drop policy if exists "Users read own support tickets" on public.support_tickets;
create policy "Users and support team read support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or (select private.current_user_can_access_support())
  );

drop policy if exists "Admins update support tickets" on public.support_tickets;
create policy "Support team updates support tickets"
  on public.support_tickets
  for update
  to authenticated
  using ((select private.current_user_can_access_support()))
  with check ((select private.current_user_can_access_support()));

drop policy if exists "Admins read product feedback" on public.product_feedback;
create policy "Support team reads product feedback"
  on public.product_feedback
  for select
  to authenticated
  using ((select private.current_user_can_access_support()));

drop policy if exists "Admins update product feedback triage" on public.product_feedback;
create policy "Support team updates product feedback triage"
  on public.product_feedback
  for update
  to authenticated
  using ((select private.current_user_can_access_support()))
  with check ((select private.current_user_can_access_support()));

drop policy if exists "Admins read technical incidents" on public.technical_incidents;
create policy "Support team reads technical incidents"
  on public.technical_incidents
  for select
  to authenticated
  using ((select private.current_user_can_access_support()));

drop policy if exists "Admins update technical incident triage" on public.technical_incidents;
create policy "Support team updates technical incident triage"
  on public.technical_incidents
  for update
  to authenticated
  using ((select private.current_user_can_access_support()))
  with check ((select private.current_user_can_access_support()));

drop policy if exists "Admins read site health reports" on public.site_health_reports;
create policy "Support team reads site health reports"
  on public.site_health_reports
  for select
  to authenticated
  using ((select private.current_user_can_access_support()));

drop policy if exists "Admins update site health escalation" on public.site_health_reports;
create policy "Support team updates site health escalation"
  on public.site_health_reports
  for update
  to authenticated
  using ((select private.current_user_can_access_support()))
  with check ((select private.current_user_can_access_support()));

drop policy if exists "Admins read cookie consent audit" on public.cookie_consent_events;
create policy "Support team reads cookie consent audit"
  on public.cookie_consent_events
  for select
  to authenticated
  using ((select private.current_user_can_access_support()));
