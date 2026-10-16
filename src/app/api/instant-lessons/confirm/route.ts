import { sendInstantBookingConfirmationEmail } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";
import { normalizeSmsPhone, sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

type InstantConfirmRequest = {
  reference?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  learnerName?: string;
  instructorName?: string;
  lessonSummary?: string;
  trackingUrl?: string;
};

function buildTrackingUrl(request: Request, reference: string, suppliedUrl?: string) {
  const baseUrl = process.env.APP_WEBSITE_URL ?? new URL(request.url).origin;
  const fallback = new URL("/lesson-now/confirmed", baseUrl);
  fallback.searchParams.set("reference", reference);

  if (!suppliedUrl) {
    return fallback.toString();
  }

  try {
    const candidate = new URL(suppliedUrl);
    const base = new URL(baseUrl);
    const allowedHosts = new Set([base.host, "ldrivingacademy.co.uk", "www.ldrivingacademy.co.uk"]);
    const isAllowedHost = allowedHosts.has(candidate.host) || candidate.host.endsWith(".vercel.app");
    const isTrackingPage = candidate.pathname === "/lesson-now/confirmed";
    const matchesReference = candidate.searchParams.get("reference") === reference;

    if ((candidate.protocol === "https:" || candidate.protocol === "http:") && isAllowedHost && isTrackingPage && matchesReference) {
      return candidate.toString();
    }
  } catch {
    return fallback.toString();
  }

  return fallback.toString();
}

function wasSkipped(result: unknown) {
  return Boolean(result && typeof result === "object" && "skipped" in result && (result as { skipped?: unknown }).skipped);
}

function serialiseError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-confirm", 20)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<InstantConfirmRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid instant booking confirmation request." }, { status: 400 });
  }

  const reference = safeText(input.reference, "", 80);
  const learnerEmail = safeEmail(input.learnerEmail);
  const trackingUrl = buildTrackingUrl(request, reference, safeText(input.trackingUrl, "", 500));

  if (!reference || !learnerEmail) {
    return jsonNoStore({ error: "Reference and learner email are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonNoStore({ error: "Instant booking confirmation is temporarily unavailable." }, { status: 503 });
  }

  const { data: record, error: recordError } = await admin
    .from("lesson_booking_records")
    .select("learner_id,learner_email,payment_status,status")
    .eq("booking_reference", reference)
    .maybeSingle();

  if (recordError) {
    return jsonNoStore({ error: "Instant booking confirmation could not be verified." }, { status: 503 });
  }

  if (!record || record.payment_status !== "paid" || String(record.status ?? "").toLowerCase().includes("cancel")) {
    return jsonNoStore({ error: "Only paid active on-demand bookings can receive confirmation messages." }, { status: 403 });
  }

  if (safeEmail(record.learner_email) !== learnerEmail) {
    return jsonNoStore({ error: "This learner email does not match the booking reference." }, { status: 403 });
  }

  if (record.learner_id) {
    const supabase = await createClient();
    const {
      data: { user }
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (!supabase || !user) {
      return jsonNoStore({ error: "Sign in to send confirmation for this on-demand lesson." }, { status: 401 });
    }

    const roleState = await getMarketplaceRoleState(supabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner") || user.id !== record.learner_id) {
      return jsonNoStore({ error: "This on-demand lesson is not available on this account." }, { status: 403 });
    }
  }

  const learnerName = safeText(input.learnerName, "Learner", 120);
  const instructorName = safeText(input.instructorName, "your LDA instructor", 120);
  const lessonSummary = safeText(input.lessonSummary, "Instant LDA lesson", 180);
  const learnerPhone = normalizeSmsPhone(input.learnerPhone);
  const smsRequired = Boolean(learnerPhone);

  let emailResult: unknown = { skipped: true };
  let emailError = "";
  try {
    emailResult = await sendInstantBookingConfirmationEmail({
      reference,
      learnerEmail,
      learnerName,
      instructorName,
      lessonSummary,
      trackingUrl,
      idempotencyKey: `instant-booking-reference-${reference}`
    });
  } catch (error) {
    emailError = serialiseError(error);
    console.error("[instant-lessons.confirm] email reference send failed", {
      reference,
      message: emailError
    });
  }

  let smsResult: unknown = { skipped: true };
  let smsError = "";
  if (smsRequired) {
    try {
      smsResult = await sendSms({
        to: learnerPhone,
        required: true,
        body: `LDA on-demand booking confirmed. Reference: ${reference}. Track your instructor: ${trackingUrl}. Keep this reference for support, payment, refund, or dispute queries.`
      });
    } catch (error) {
      smsError = serialiseError(error);
      console.error("[instant-lessons.confirm] SMS reference send failed", {
        reference,
        message: smsError
      });
    }
  }

  const emailSkipped = wasSkipped(emailResult);
  const smsSkipped = wasSkipped(smsResult);
  const emailOk = !emailSkipped && !emailError;
  const smsOk = !smsSkipped && !smsError;
  const smsDeliveryFailed = smsRequired && !smsOk;
  const noProviderDelivered = !emailOk && (!smsRequired || !smsOk);

  return jsonNoStore({
    ok: emailOk && !smsDeliveryFailed,
    reference,
    trackingUrl,
    email: emailError ? { ok: false, error: emailError } : emailSkipped ? { ok: false, skipped: true } : { ok: true, result: emailResult },
    sms: smsRequired
      ? smsError
        ? { ok: false, required: true, error: smsError }
        : smsSkipped
          ? { ok: false, required: true, skipped: true }
          : { ok: true, required: true, result: smsResult }
      : { ok: true, required: false, skipped: true },
    message: emailOk
      ? smsOk
        ? "Instant booking reference email and text confirmation sent."
        : smsRequired
          ? "Instant booking reference email sent. Text confirmation could not be sent to the provided phone number."
          : "Instant booking reference email sent."
      : smsOk
        ? "Instant booking reference text confirmation sent. Email could not be sent."
        : "Instant booking reference was saved, but email and text confirmation could not be sent because the providers are unavailable or failed."
  }, noProviderDelivered ? { status: 503 } : smsDeliveryFailed ? { status: 502 } : undefined);
}
