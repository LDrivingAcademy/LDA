import { NextResponse } from "next/server";
import { sendProductFeedbackEmail } from "@/lib/email";

type FeedbackRequest = {
  name?: string;
  email?: string;
  issue?: string;
  details?: string;
  pageUrl?: string;
};

export async function POST(request: Request) {
  const input = (await request.json()) as FeedbackRequest;
  const issue = String(input.issue ?? "").trim();
  const details = String(input.details ?? "").trim();

  if (!issue || !details) {
    return NextResponse.json({ error: "Feedback issue and information are required." }, { status: 400 });
  }

  await sendProductFeedbackEmail({
    name: String(input.name ?? "").trim(),
    email: String(input.email ?? "").trim(),
    issue,
    details,
    pageUrl: String(input.pageUrl ?? "").trim()
  });

  return NextResponse.json({
    ok: true,
    message: "Thank you for the feedback."
  });
}
