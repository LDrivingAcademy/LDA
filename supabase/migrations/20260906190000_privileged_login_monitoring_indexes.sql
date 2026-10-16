create index if not exists auth_audit_logs_privileged_login_lookup_idx
on public.auth_audit_logs (target_type, target_id, action, created_at desc)
where target_type = 'privileged_login_identifier';
