import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildInstructorApplicationDocumentPath } from "../src/lib/instructor-document-storage";
import { validateInstructorVerificationFile } from "../src/lib/instructor-verification-file-security";

function makeFile(parts: BlobPart[], name: string, type: string) {
  return new File(parts, name, { type });
}

const userId = "11111111-1111-4111-8111-111111111111";
const path = buildInstructorApplicationDocumentPath(userId, "Joshua Passport Scan 2026.pdf");

assert.match(path, /^applications\/11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.pdf$/);
assert.equal(path.includes("Joshua"), false);
assert.equal(path.includes("Passport"), false);

const validPdf = await validateInstructorVerificationFile(
  makeFile(["%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"], "licence.pdf", "application/pdf")
);
assert.equal(validPdf.ok, true);
assert.equal(validPdf.extension, "pdf");
assert.equal(validPdf.scanStatus, "passed");
assert.ok(validPdf.sha256);

const riskyPdf = await validateInstructorVerificationFile(
  makeFile(["%PDF-1.7\n/OpenAction << /S /JavaScript /JS (app.alert('x')) >>"], "bad.pdf", "application/pdf")
);
assert.equal(riskyPdf.ok, false);
assert.match(riskyPdf.reason ?? "", /active content/i);

const mismatchedImage = await validateInstructorVerificationFile(
  makeFile(["not a png"], "photo.png", "image/png")
);
assert.equal(mismatchedImage.ok, false);
assert.match(mismatchedImage.reason ?? "", /corrupt|extension/i);

const webp = await validateInstructorVerificationFile(
  makeFile(["RIFF....WEBP"], "badge.webp", "image/webp")
);
assert.equal(webp.ok, false);
assert.match(webp.reason ?? "", /PDF, JPG, JPEG, or PNG/);

const uploadActionSource = readFileSync(join(process.cwd(), "src/app/instructor-verification/actions.ts"), "utf8");
assert.match(uploadActionSource, /\.from\("instructor_documents"\)[\s\S]*\.insert\(/);
assert.match(uploadActionSource, /status:\s*"pending"/);
assert.match(uploadActionSource, /expires_at:\s*expiresAt/);
assert.match(uploadActionSource, /document_version:\s*documentVersion/);
assert.match(uploadActionSource, /instructorDocumentRequiresExpiry/);
assert.match(uploadActionSource, /revalidatePath\("\/admin\/instructors"\)/);
assert.match(uploadActionSource, /Instructor uploaded verification evidence for temporary LDA review/);

const adminInstructorActionSource = readFileSync(join(process.cwd(), "src/app/admin/instructors/actions.ts"), "utf8");
assert.doesNotMatch(adminInstructorActionSource, /purgeDecisionFilesOrStop/);
assert.doesNotMatch(adminInstructorActionSource, /purgeInstructorVerificationFiles/);
assert.match(adminInstructorActionSource, /metadata_locked_at:\s*now/);
assert.match(adminInstructorActionSource, /version_state:\s*"archived"/);
assert.match(adminInstructorActionSource, /replaced_by_document_id:\s*document\.id/);
assert.doesNotMatch(adminInstructorActionSource, /storage_path:\s*null/s);
assert.match(adminInstructorActionSource, /approveInstructorDocumentVersionAction/);

const cleanupMigrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/20260802102758_document_cleanup.sql"),
  "utf8"
);
assert.match(cleanupMigrationSource, /alter column storage_path drop not null/i);

const metadataColumnsMigrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/20260802104945_instructor_document_metadata_columns.sql"),
  "utf8"
);
assert.match(metadataColumnsMigrationSource, /expires_at date/i);
assert.match(metadataColumnsMigrationSource, /document_version integer/i);
assert.match(metadataColumnsMigrationSource, /renewal_reminder_sent_at timestamptz/i);

const metadataGrantMigrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/20260802105048_instructor_document_expiry_grant.sql"),
  "utf8"
);
assert.match(metadataGrantMigrationSource, /grant select/i);
assert.doesNotMatch(metadataGrantMigrationSource, /storage_path/i);

const versioningMigrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/20260802152000_instructor_document_versioning_archive.sql"),
  "utf8"
);
assert.match(versioningMigrationSource, /is_current boolean/i);
assert.match(versioningMigrationSource, /version_state text/i);
assert.match(versioningMigrationSource, /drop policy if exists "Admins delete instructor verification files"/i);
assert.match(versioningMigrationSource, /drop policy if exists "Admins delete instructor documents"/i);
assert.match(versioningMigrationSource, /instructor_documents_one_current_per_type_idx/i);

const instructorVerificationPageSource = readFileSync(join(process.cwd(), "src/app/instructor-verification/page.tsx"), "utf8");
assert.match(instructorVerificationPageSource, /expires_at,document_version,storage_deleted_at,is_current,version_state/);
assert.doesNotMatch(instructorVerificationPageSource, /storage_path/);

const vehicleCompliancePageSource = readFileSync(join(process.cwd(), "src/app/instructor-vehicle-compliance/page.tsx"), "utf8");
assert.match(vehicleCompliancePageSource, /initialComplianceItems/);
assert.match(vehicleCompliancePageSource, /is_current,version_state/);
assert.doesNotMatch(vehicleCompliancePageSource, /storage_path/);

const cronRouteSource = readFileSync(join(process.cwd(), "src/app/api/cron/instructor-compliance/route.ts"), "utf8");
assert.match(cronRouteSource, /learner_availability_paused:\s*true/);
assert.match(cronRouteSource, /sendInstructorComplianceReminderEmail/);
assert.doesNotMatch(cronRouteSource, /storage_path/);

const vercelConfigSource = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
assert.match(vercelConfigSource, /\/api\/cron\/instructor-compliance/);

const docsSource = readFileSync(join(process.cwd(), "docs/instructor-verification-document-handling.md"), "utf8");
assert.match(docsSource, /Instructors can upload evidence but cannot retrieve submitted files/);

console.log("Instructor verification security checks passed.");
