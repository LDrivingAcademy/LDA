import {
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  getAppOrigin,
  readJsonBody,
  safeAmountPence,
  safeCurrency,
  safeEmail,
  safeText
} from "@/lib/security";
import { applyStripeCheckoutPaymentMethods } from "@/lib/stripe-checkout";
import { getStripeEnvValue, getStripeSecretKey } from "@/lib/stripe-env";
import { hasCompletedLearnerSetup } from "@/lib/learner-eligibility";
import { verifyAndSaveProvisionalLicence, verifyProvisionalLicenceNumber } from "@/lib/dvla-provisional-verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createBookingReference } from "@/lib/booking-reference";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getCurrentTermsStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_MESSAGE } from "@/lib/terms-version";
import {
  buildSmartMatchLessonNote,
  normaliseSmartMatchHandoff,
  smartMatchStripeMetadata,
  type SmartMatchHandoffContext
} from "@/lib/smart-match-handoff";

type InstantCheckoutRequest = {
  fullName?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  pickup?: string;
  pickupLabel?: string;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  instructorName?: string;
  instructorEmail?: string;
  lessonSummary?: string;
  amountPence?: number;
  paymentPreference?: string;
  transmission?: string;
  provisionalLicenceNumber?: string;
  provisionalLicencePermission?: boolean;
  smartMatchContext?: SmartMatchHandoffContext;
};

function required(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalisePaymentPreference(value?: string) {
  return String(value ?? "card")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function normaliseTransmission(value?: string) {
  return String(value ?? "automatic").trim().toLowerCase() === "manual" ? "manual" : "automatic";
}

function normaliseCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function upsertInstantBookingRecord(adminClient: ReturnType<typeof createAdminClient>, row: Record<string, unknown>) {
  if (!adminClient) {
    return { error: { message: "Supabase admin client unavailable.", code: "missing_client", details: null, hint: null } };
  }

  const { error } = await adminClient.from("lesson_booking_records").upsert(row, { onConflict: "booking_reference" });

  if (!error) {
    return { error: null };
  }

  const missingRouteColumn =
    error.code === "42703" &&
    /pickup_label|pickup_latitude|pickup_longitude/i.test(error.message ?? "");

  if (!missingRouteColumn) {
    return { error };
  }

  const fallbackRow = { ...row };
  delete fallbackRow.pickup_label;
  delete fallbackRow.pickup_latitude;
  delete fallbackRow.pickup_longitude;

  return adminClient.from("lesson_booking_records").upsert(fallbackRow, { onConflict: "booking_reference" });
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<InstantCheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const learnerEmail = safeEmail(body.learnerEmail);

  if (!required(body.fullName) || !learnerEmail) {
    return jsonNoStore({ error: "Name and a valid email are required." }, { status: 400 });
  }

  const pickup = safeText(body.pickup, "", 180);
  const pickupLabel = safeText(body.pickupLabel, pickup, 180);
  const pickupLatitude = normaliseCoordinate(body.pickupLatitude);
  const pickupLongitude = normaliseCoordinate(body.pickupLongitude);

  if (!pickup) {
    return jsonNoStore({ error: "Enter the learner pickup postcode or full address before checkout." }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (user && supabase) {
    const roleState = await getMarketplaceRoleState(supabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner")) {
      return jsonNoStore({ error: "Use a learner account before booking an on-demand lesson." }, { status: 403 });
    }

    const termsStatus = await getCurrentTermsStatus(supabase, user.id);
    if (!termsStatus.accepted) {
      return jsonNoStore({ error: CURRENT_TERMS_MESSAGE }, { status: 403 });
    }

    const { data: learnerProfile, error: learnerProfileError } = await supabase
      .from("learner_profiles")
      .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (learnerProfileError) {
      console.error("[instant-lessons.checkout] learner eligibility read failed", {
        userId: user.id,
        message: learnerProfileError.message
      });
      return jsonNoStore({ error: "LDA could not confirm your learner eligibility. Try again before checkout." }, { status: 500 });
    }

    if (!hasCompletedLearnerSetup(learnerProfile)) {
      return jsonNoStore(
        {
          error:
            "Complete your learner setup before booking a paid driving lesson."
        },
        { status: 403 }
      );
    }

    if (!learnerProfile?.provisional_licence_confirmed_at) {
      const licenceResult = await verifyAndSaveProvisionalLicence({
        supabase,
        userId: user.id,
        drivingLicenceNumber: body.provisionalLicenceNumber,
        permissionConfirmed: body.provisionalLicencePermission
      });

      if (!licenceResult.valid) {
        return jsonNoStore(
          {
            error: licenceResult.message || "Enter and verify a valid provisional driving licence before checkout."
          },
          { status: licenceResult.status }
        );
      }
    }
  } else {
    const licenceResult = await verifyProvisionalLicenceNumber({
      drivingLicenceNumber: body.provisionalLicenceNumber,
      permissionConfirmed: body.provisionalLicencePermission
    });

    if (!licenceResult.valid) {
      return jsonNoStore(
        {
          error: licenceResult.message || "Enter and verify a valid provisional driving licence before checkout."
        },
        { status: licenceResult.status }
      );
    }
  }

  const stripeSecret = getStripeSecretKey();
  const appUrl = getAppOrigin(request);
  const currency = safeCurrency(getStripeEnvValue("STRIPE_DEFAULT_CURRENCY").value, "gbp");
  const amountPence = safeAmountPence(body.amountPence, 6500, 2500, 50000);
  const transmission = normaliseTransmission(body.transmission);
  const transmissionLabel = transmission === "manual" ? "manual" : "automatic";
  const smartMatchContext = normaliseSmartMatchHandoff(body.smartMatchContext);
  const smartMatchLessonNote = buildSmartMatchLessonNote(smartMatchContext);
  const lessonSummary = [
    `Instant on-demand LDA lesson. Requested transmission: ${transmissionLabel}. LDA will assign the closest suitable instructor with availability after payment.`,
    smartMatchLessonNote
  ]
    .filter(Boolean)
    .join(" ");
  const paymentPreference = normalisePaymentPreference(body.paymentPreference);
  const reference = createBookingReference();
  const successUrl = `${appUrl}/lesson-now/confirmed?reference=${encodeURIComponent(reference)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/lesson-now?payment=cancelled`;
  const adminClient = createAdminClient();

  if (!stripeSecret.value) {
    if (process.env.NODE_ENV === "production") {
      return jsonNoStore({ error: "Payment collection is temporarily unavailable." }, { status: 503 });
    }

    if (!adminClient) {
      return jsonNoStore(
        { error: "On-demand booking references are temporarily unavailable, so demo checkout cannot safely start." },
        { status: 503 }
      );
    }

    const { error } = await upsertInstantBookingRecord(adminClient, {
      booking_reference: reference,
      learner_id: user?.id ?? null,
      learner_email: learnerEmail,
      learner_phone: safeText(body.learnerPhone, "", 30),
      instructor_id: null,
      instructor_name: "Waiting for instructor",
      instructor_email: null,
      lesson_summary: lessonSummary,
      pickup_postcode: pickup,
      pickup_label: pickupLabel,
      pickup_latitude: pickupLatitude,
      pickup_longitude: pickupLongitude,
      lesson_price_pence: amountPence,
      car: null,
      status: "waiting_for_instructor",
      payment_status: "paid"
    });

    if (error) {
      console.error("[instant-lessons.checkout] demo booking reference save failed", {
        bookingReference: reference,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return jsonNoStore(
        { error: "On-demand booking reference could not be saved, so checkout cannot safely start." },
        { status: 503 }
      );
    }

    return jsonNoStore({
      mode: "demo",
      reference,
      message: "Secure checkout is temporarily unavailable.",
      checkoutUrl: `${appUrl}/lesson-now/confirmed?reference=${encodeURIComponent(reference)}&demo=1`
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[booking_reference]": reference,
    "metadata[learner_email]": learnerEmail,
    "metadata[learner_phone]": safeText(body.learnerPhone, "", 30),
    "metadata[pickup]": pickup,
    "metadata[pickup_label]": pickupLabel,
    "metadata[instructor_name]": "pending_assignment",
    "metadata[booking_context]": user ? "signed_in_learner" : "guest_on_demand",
    "metadata[payment_preference]": paymentPreference,
    "metadata[transmission]": transmission,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": "Instant LDA on-demand driving lesson",
    "line_items[0][price_data][product_data][description]": `Closest suitable available ${transmissionLabel} LDA instructor assigned after payment.`,
    "customer_email": learnerEmail,
    allow_promotion_codes: "true"
  });

  if (user) {
    params.set("metadata[learner_id]", user.id);
  }

  if (pickupLatitude !== null && pickupLongitude !== null) {
    params.set("metadata[pickup_latitude]", String(pickupLatitude));
    params.set("metadata[pickup_longitude]", String(pickupLongitude));
  }

  for (const [key, value] of Object.entries(smartMatchStripeMetadata(smartMatchContext))) {
    params.set(`metadata[${key}]`, value);
  }

  applyStripeCheckoutPaymentMethods(params);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const session = await response.json();

  if (!response.ok) {
    return jsonNoStore({ error: "Secure checkout could not start. Please try again." }, { status: 400 });
  }

  if (adminClient) {
    const { error } = await upsertInstantBookingRecord(adminClient, {
      booking_reference: reference,
      learner_id: user?.id ?? null,
      learner_email: learnerEmail,
      learner_phone: safeText(body.learnerPhone, "", 30),
      instructor_id: null,
      instructor_name: "Waiting for instructor",
      instructor_email: null,
      lesson_summary: lessonSummary,
      pickup_postcode: pickup,
      pickup_label: pickupLabel,
      pickup_latitude: pickupLatitude,
      pickup_longitude: pickupLongitude,
      lesson_price_pence: amountPence,
      car: null,
      status: "checkout_started",
      payment_status: "requires_payment",
      stripe_checkout_session_id: session.id
    });

    if (error) {
      console.error("[instant-lessons.checkout] booking reference save failed; Stripe metadata fallback will be used", {
        bookingReference: reference,
        checkoutSessionId: session.id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    }
  } else {
    console.error("[instant-lessons.checkout] Supabase admin client unavailable; Stripe metadata fallback will be used", {
      bookingReference: reference,
      checkoutSessionId: session.id
    });
  }

  return jsonNoStore({
    reference,
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
