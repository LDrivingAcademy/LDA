-- Production hardening for LDA instructor verification.
-- Keeps uploaded evidence admin-only, configurable, audited, and ready for later versioned archive handling.

alter type public.document_type add value if not exists 'passport';
alter type public.document_type add value if not exists 'national_id_card';
alter type public.document_type add value if not exists 'professional_licence';
alter type public.document_type add value if not exists 'teaching_qualification';
alter type public.document_type add value if not exists 'proof_of_address';

alter type public.instructor_verification_status add value if not exists 'not_started';
alter type public.instructor_verification_status add value if not exists 'documents_required';
alter type public.instructor_verification_status add value if not exists 'upload_in_progress';
alter type public.instructor_verification_status add value if not exists 'submitted';
alter type public.instructor_verification_status add value if not exists 'under_review';
alter type public.instructor_verification_status add value if not exists 'additional_documents_required';
alter type public.instructor_verification_status add value if not exists 'verified';
alter type public.instructor_verification_status add value if not exists 'verification_expiring_soon';
alter type public.instructor_verification_status add value if not exists 'reverification_required';

create table if not exists public.instructor_verification_document_requirements (
  document_type text primary key,
  label text not null,
  detail text not null,
  requirement text not null default 'recommended' check (requirement in ('required', 'recommended')),
  category text not null default 'supporting' check (category in ('identity', 'authority', 'vehicle', 'insurance', 'professional', 'supporting')),
  display_order integer not null default 999,
  is_enabled boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.instructor_verification_document_requirements
  (document_type, label, detail, requirement, category, display_order)
values
  ('passport', 'Passport', 'Optional identity evidence where LDA needs an additional identity check.', 'recommended', 'identity', 10),
  ('driving_licence', 'Full UK driving licence', 'Confirms the instructor holds the driving entitlement attached to their teaching vehicle and transmission.', 'required', 'identity', 20),
  ('national_id_card', 'National ID card', 'Optional identity evidence where a passport is not used.', 'recommended', 'identity', 30),
  ('proof_of_address', 'Proof of address', 'Optional address evidence where LDA needs to confirm a contractor or operating record.', 'recommended', 'identity', 40),
  ('adi_pdi_badge', 'ADI badge or certificate', 'Confirms the DVSA ADI registration needed before an instructor can charge for lessons through LDA.', 'required', 'authority', 100),
  ('dbs_check', 'DBS certificate', 'Supports DVSA fit-and-proper checks and the 4-year ADI renewal cycle before learner-facing availability is approved.', 'required', 'authority', 110),
  ('teaching_qualification', 'Teaching qualification', 'Optional supporting qualification evidence for instructors who want it added to their LDA record.', 'recommended', 'professional', 120),
  ('professional_licence', 'Professional licence', 'Optional professional evidence for specialist driving or training permissions.', 'recommended', 'professional', 130),
  ('standards_check', 'Latest ADI standards check', 'Supports teaching quality assurance, review history, and ongoing instructor development.', 'recommended', 'professional', 140),
  ('mot_certificate', 'Current MOT certificate or exemption evidence', 'Required for vehicles over 3 years old and used to evidence roadworthiness before lessons are offered.', 'required', 'vehicle', 200),
  ('vehicle_tax_status', 'Vehicle tax status confirmation', 'Confirms the lesson vehicle is taxed before being used for learner lessons or test-day support.', 'required', 'vehicle', 210),
  ('vehicle_registration', 'V5C, lease agreement, or keeper permission', 'Confirms the vehicle identity, registration, and authority to use it for LDA learner bookings.', 'required', 'vehicle', 220),
  ('vehicle_safety_declaration', 'Lesson vehicle safety declaration', 'Confirms L-plates, mirrors, tyres, lights, brakes, roadworthiness, and any dual-control or test-suitability checks.', 'required', 'vehicle', 230),
  ('vehicle_photo', 'Vehicle photos', 'Shows the learner-facing car condition, plates, mirrors, signage, and profile images before the vehicle goes live.', 'recommended', 'vehicle', 240),
  ('tuition_insurance', 'Paid driving tuition motor insurance', 'Must show the vehicle is insured for paid driving instruction or business tuition use, not ordinary private cover only.', 'required', 'insurance', 300),
  ('public_liability_insurance', 'Public liability or professional indemnity cover', 'Useful platform protection evidence for claims, disputes, and professional services.', 'recommended', 'insurance', 310),
  ('other', 'Other supporting documents', 'Any extra evidence LDA specifically asks for during verification.', 'recommended', 'supporting', 900)
on conflict (document_type) do update set
  label = excluded.label,
  detail = excluded.detail,
  requirement = excluded.requirement,
  category = excluded.category,
  display_order = excluded.display_order,
  is_enabled = true,
  updated_at = now();

alter table public.instructor_documents
  add column if not exists file_sha256 text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text,
  add column if not exists original_extension text,
  add column if not exists malware_scan_status text,
  add column if not exists malware_scan_provider text,
  add column if not exists malware_scan_checked_at timestamptz,
  add column if not exists storage_deleted_at timestamptz;

alter table public.instructor_documents
  drop constraint if exists instructor_documents_malware_scan_status_check;

alter table public.instructor_documents
  add constraint instructor_documents_malware_scan_status_check
  check (malware_scan_status is null or malware_scan_status in ('passed', 'failed', 'unavailable', 'skipped'));

create table if not exists public.instructor_verification_audit_events (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  admin_id uuid references public.profiles(id),
  document_id uuid references public.instructor_documents(id) on delete set null,
  document_type text,
  action text not null check (action in ('upload', 'view', 'approve', 'reject', 'request_new_documents', 'automatic_deletion', 'manual_deletion', 'status_change')),
  outcome text not null default 'success' check (outcome in ('success', 'failed')),
  session_id text,
  ip_address text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists instructor_verification_audit_instructor_idx
  on public.instructor_verification_audit_events(instructor_id, created_at desc);

create index if not exists instructor_verification_audit_action_idx
  on public.instructor_verification_audit_events(action, created_at desc);

create or replace function private.prevent_instructor_verification_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  raise exception 'Instructor verification audit events are immutable';
end;
$$;

drop trigger if exists instructor_verification_audit_events_immutable_update on public.instructor_verification_audit_events;
create trigger instructor_verification_audit_events_immutable_update
before update on public.instructor_verification_audit_events
for each row execute function private.prevent_instructor_verification_audit_mutation();

drop trigger if exists instructor_verification_audit_events_immutable_delete on public.instructor_verification_audit_events;
create trigger instructor_verification_audit_events_immutable_delete
before delete on public.instructor_verification_audit_events
for each row execute function private.prevent_instructor_verification_audit_mutation();

alter table public.instructor_verification_document_requirements enable row level security;
alter table public.instructor_verification_audit_events enable row level security;

drop policy if exists "Anyone authenticated can read active instructor verification requirements" on public.instructor_verification_document_requirements;
create policy "Anyone authenticated can read active instructor verification requirements"
on public.instructor_verification_document_requirements for select
to authenticated
using (is_enabled = true or (select private.current_user_is_admin()));

drop policy if exists "Admins manage instructor verification requirements" on public.instructor_verification_document_requirements;
create policy "Admins manage instructor verification requirements"
on public.instructor_verification_document_requirements for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

drop policy if exists "Admins read instructor verification audit" on public.instructor_verification_audit_events;
create policy "Admins read instructor verification audit"
on public.instructor_verification_audit_events for select
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists "Service inserts instructor verification audit" on public.instructor_verification_audit_events;
create policy "Service inserts instructor verification audit"
on public.instructor_verification_audit_events for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  or admin_id = (select auth.uid())
  or instructor_id = (select auth.uid())
  or (select private.current_user_is_admin())
);

revoke select on public.instructor_documents from authenticated;
grant select (
  id,
  instructor_id,
  uploaded_by,
  document_type,
  status,
  reviewed_by,
  reviewed_at,
  created_at,
  ai_verification_status,
  ai_verification_provider,
  ai_verification_summary,
  ai_verification_reference,
  ai_verification_checked_at,
  ai_verified_at,
  file_sha256,
  file_size_bytes,
  mime_type,
  original_extension,
  malware_scan_status,
  malware_scan_provider,
  malware_scan_checked_at,
  storage_deleted_at
) on public.instructor_documents to authenticated;

grant select, insert, update, delete on public.instructor_verification_document_requirements to authenticated;
grant select, insert on public.instructor_verification_audit_events to authenticated;

insert into storage.buckets (id, name, public)
values ('instructor-documents', 'instructor-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Owners and admins read verification files" on storage.objects;
drop policy if exists "Admins read instructor verification files" on storage.objects;
drop policy if exists "Admins delete instructor verification files" on storage.objects;

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
