import { getHeaderAccountSummary } from "@/lib/current-account";
import { jsonNoStore } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonNoStore({
    account: await getHeaderAccountSummary()
  });
}
