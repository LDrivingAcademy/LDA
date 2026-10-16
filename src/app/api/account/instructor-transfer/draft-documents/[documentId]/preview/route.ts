import { NextResponse } from "next/server";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { applyNoIndexSecurityHeaders } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewRouteProps = {
  params: Promise<{ documentId: string }>;
};

function blocked(message: string, status = 404) {
  return applyNoIndexSecurityHeaders(
    NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store, max-age=0"
        }
      }
    )
  );
}

export async function GET(_request: Request, { params }: PreviewRouteProps) {
  const { documentId } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  if (!supabase || !adminClient) {
    return blocked("Secure draft preview is not configured.", 503);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return blocked("Log in to preview this draft document.", 401);
  }

  const roles = await getMarketplaceRolesForUser(supabase, user.id);
  if (!roles.includes("learner") || roles.includes("instructor")) {
    return blocked("Draft instructor application documents are only available from a learner account.", 403);
  }

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    return blocked("Draft document was not recognised.");
  }

  const { data: document, error } = await adminClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,storage_path,status")
    .eq("id", documentId)
    .eq("instructor_id", user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (error || !document?.storage_path) {
    return blocked("Saved draft is no longer available.");
  }

  await recordInstructorVerificationAudit({
    client: adminClient,
    instructorId: user.id,
    actorUserId: user.id,
    documentId: document.id,
    documentType: document.document_type,
    action: "view",
    outcome: "success",
    notes: "Learner opened a draft instructor transfer document preview."
  });

  const { data: signed, error: signedError } = await adminClient.storage
    .from(instructorDocumentsBucket)
    .createSignedUrl(document.storage_path, 60);

  if (signedError || !signed?.signedUrl) {
    return blocked("Saved draft preview could not be opened.", 503);
  }

  const upstream = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return blocked("Saved draft preview could not be read.", 503);
  }

  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  headers.set("Content-Disposition", `inline; filename="lda-instructor-application-draft-${document.id}.bin"`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}
