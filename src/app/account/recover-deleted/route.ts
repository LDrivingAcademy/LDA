import { NextResponse } from "next/server";
import { recoverScheduledAccountDeletion } from "@/lib/account-erasure";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const admin = createAdminClient();

  if (!admin) {
    return redirectWithMessage(request, "Account restart is temporarily unavailable. Contact LDA support.");
  }

  const result = await recoverScheduledAccountDeletion({ admin, token, origin: url.origin });
  return redirectWithMessage(request, result.message);
}

function redirectWithMessage(request: Request, message: string) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("message", message);
  return NextResponse.redirect(loginUrl);
}
