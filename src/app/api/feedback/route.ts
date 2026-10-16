import { sendProductFeedbackEmail } from "@/lib/email";
import { summariseProductFeedback } from "@/lib/feedback-summary";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const input = await readJsonBody<FeedbackRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid feedback request." }, { status: 400 });
  }

  const issue = safeText(input.issue, "", 120);
  const details = safeText(input.details, "", 4000);

  if (!issue || !details) {
    return jsonNoStore({ error: "Feedback issue and information are required." }, { status: 400 });
  }

  const summary = await summariseProductFeedback(issue, details);
  const adminClient = createAdminClient();

  if (!adminClient) {
    return jsonNoStore({ error: "Feedback is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  const pageUrl = safeText(input.pageUrl, "", 300);
  const { error: saveError } = await adminClient.from("product_feedback").insert({
    issue,
    details,
    summary: summary.text,
    summary_kind: summary.kind,
    page_url: pageUrl || null
  });

  if (saveError) {
    console.error("Feedback could not be stored.", saveError.message);
    return jsonNoStore({ error: "Feedback could not be saved. Please try again." }, { status: 503 });
  }

  try {
    await sendProductFeedbackEmail({
      issue,
      summary: summary.text,
      pageUrl
    });
  } catch {
    // The admin feedback area is the source of truth; email is only a notification.
  }

  return jsonNoStore({
    ok: true,
    message: "Thank you for the feedback."
  });
}
