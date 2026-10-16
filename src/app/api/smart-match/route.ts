import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import { runSmartMatch, type SmartMatchInput } from "@/lib/smart-match";

export async function POST(request: Request) {
  if (isRateLimited(request, "smart-match", 30)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<SmartMatchInput>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid SmartMatch request." }, { status: 400 });
  }

  return jsonNoStore(runSmartMatch(input));
}
