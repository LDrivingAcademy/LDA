import { NextResponse } from "next/server";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { applyAdminSecurityHeaders } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewRouteProps = {
  params: Promise<{ documentId: string }>;
};

function blocked(message: string, status = 404) {
  return applyAdminSecurityHeaders(
    NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    )
  );
}

export async function GET(_request: Request, { params }: PreviewRouteProps) {
  const { documentId } = await params;
  const { user } = await requireAdminDashboardClient();
  const adminClient = createAdminClient();

  if (!adminClient) {
    return blocked("Admin storage access is not configured.", 503);
  }

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    return blocked("Document was not recognised.");
  }

  const { data: document, error } = await adminClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,storage_path,status")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document?.storage_path) {
    return blocked("Secure evidence is no longer available.");
  }

  await recordInstructorVerificationAudit({
    client: adminClient,
    instructorId: document.instructor_id,
    actorUserId: user.id,
    adminId: user.id,
    documentId: document.id,
    documentType: document.document_type,
    action: "view",
    outcome: "success",
    notes: "Admin opened secure document version preview."
  });

  const { data: signed, error: signedError } = await adminClient.storage
    .from(instructorDocumentsBucket)
    .createSignedUrl(document.storage_path, 60);

  if (signedError || !signed?.signedUrl) {
    return blocked("Secure evidence preview could not be opened.", 503);
  }

  const upstream = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return blocked("Secure evidence preview could not be read.", 503);
  }

  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  headers.set("Content-Disposition", `inline; filename="lda-verification-${document.id}.bin"`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}
