import { permanentlyEraseExpiredDeletionAccounts } from "@/lib/account-erasure";
import { jsonNoStore } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonNoStore({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const result = await permanentlyEraseExpiredDeletionAccounts({ admin });

  return jsonNoStore({
    ok: true,
    erasedCount: result.erased.length,
    warnings: result.warnings.slice(0, 20)
  });
}
