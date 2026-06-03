import { sendProductFeedbackEmail } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscribeRequest = {
  email?: string;
  pageUrl?: string;
  source?: string;
};

const consentText = "I agree to receive L Driving Academy learner tips, offers, free-trial updates, and platform news by email.";

export async function POST(request: Request) {
  if (isRateLimited(request, "social-subscribe", 8)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as SubscribeRequest;
  const email = safeEmail(input.email);

  if (!email) {
    return jsonNoStore({ error: "Enter a valid email address." }, { status: 400 });
  }

  const emailNormalized = email.toLowerCase();
  const source = safeText(input.source, "social", 60) || "social";
  const pageUrl = safeText(input.pageUrl, "", 300);
  const admin = createAdminClient();
  let storageMode: "live" | "demo" = "demo";

  try {
    if (admin) {
      const { error } = await admin
        .from("marketing_subscribers")
        .upsert(
          {
            email,
            email_normalized: emailNormalized,
            source,
            consent_text: consentText,
            status: "subscribed",
            page_url: pageUrl || null,
            consented_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            unsubscribed_at: null
          },
          { onConflict: "email_normalized" }
        );

      if (error) {
        throw new Error(error.message);
      }

      await admin
        .from("profiles")
        .update({ marketing_opt_in: true })
        .eq("email", emailNormalized);

      storageMode = "live";
    }

    await sendProductFeedbackEmail({
      email,
      issue: "New marketing subscriber",
      details: [
        `${email} consented to receive LDA learner tips, offers, free-trial updates, and platform news.`,
        `Source: ${source}`,
        `Consent wording: ${consentText}`
      ].join("\n"),
      pageUrl
    });

    return jsonNoStore({
      ok: true,
      mode: storageMode,
      message:
        storageMode === "live"
          ? "You are subscribed. Thank you for joining LDA updates."
          : "Subscribed in demo mode. Add Supabase service credentials to store marketing consent."
    });
  } catch (error) {
    return jsonNoStore(
      { error: error instanceof Error ? error.message : "Subscription could not be saved." },
      { status: 500 }
    );
  }
}
