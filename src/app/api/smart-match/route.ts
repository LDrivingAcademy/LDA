import { isRateLimited, jsonNoStore, rateLimitResponse } from "@/lib/security";
import { runSmartMatch, type SmartMatchInput } from "@/lib/smart-match";

export async function POST(request: Request) {
  if (isRateLimited(request, "smart-match", 30)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as SmartMatchInput;

  return jsonNoStore(runSmartMatch(input));
}
