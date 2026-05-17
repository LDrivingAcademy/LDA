import { sendProductFeedbackEmail } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";

type FeedbackRequest = {
  name?: string;
  email?: string;
  issue?: string;
  details?: string;
  pageUrl?: string;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "feedback", 10)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as FeedbackRequest;
  const issue = safeText(input.issue, "", 120);
  const details = safeText(input.details, "", 4000);

  if (!issue || !details) {
    return jsonNoStore({ error: "Feedback issue and information are required." }, { status: 400 });
  }

  await sendProductFeedbackEmail({
    name: safeText(input.name, "", 120),
    email: safeEmail(input.email),
    issue,
    details,
    pageUrl: safeText(input.pageUrl, "", 300)
  });

  return jsonNoStore({
    ok: true,
    message: "Thank you for the feedback."
  });
}
