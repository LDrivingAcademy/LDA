import {
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  getAppOrigin,
  readJsonBody,
  safeAmountPence,
  safeCurrency,
  safeEmail,
  safeStripeConnectedAccountId,
  safeText
} from "@/lib/security";
import { applyStripeCheckoutPaymentMethods } from "@/lib/stripe-checkout";
import { getStripeEnvValue, getStripeSecretKey } from "@/lib/stripe-env";
import { createClient } from "@/lib/supabase/server";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { createBookingReference, isLdaBookingReference } from "@/lib/booking-reference";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getCurrentTermsStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_MESSAGE } from "@/lib/terms-version";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";
import {
  getInstructorFutureComplianceBlockMessage,
  getInstructorFutureComplianceStatus,
  readInstructorFutureComplianceDocuments
} from "@/lib/instructor-future-compliance";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import {
  buildSmartMatchLessonNote,
  normaliseSmartMatchHandoff,
  smartMatchStripeMetadata,
  type SmartMatchHandoffContext
} from "@/lib/smart-match-handoff";

type CheckoutRequest = {
  bookingId?: string;
  instructorId?: string;
  instructorName?: string;
  instructorEmail?: string | null;
  lessonSummary?: string;
  amountPence?: number;
  bookingWindow?: "same_day_or_next_day" | "advance_scheduled";
  date?: string;
  time?: string;
  pickup?: string;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  pickupSource?: string | null;
  car?: string;
  learnerAvailabilityPaused?: boolean;
  learnerAvailabilityPauseReason?: string;
  stripeConnectedAccountId?: string;
  paymentPreference?: string;
  learnerEmail?: string | null;
  learnerPhone?: string | null;
  lessonPackage?: CheckoutLessonPackage | null;
  smartMatchContext?: SmartMatchHandoffContext;
};

type CheckoutLessonPackageSession = {
  date?: string;
  time?: string;
};

type CheckoutLessonPackage = {
  id?: string;
  title?: string;
  body?: string;
  hours?: number;
  sessionHours?: number;
  totalSessions?: number;
  paceLabel?: string;
  sessions?: CheckoutLessonPackageSession[];
};

function normalisePaymentPreference(value?: string) {
  return String(value ?? "card")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function normaliseLessonPackage(value?: CheckoutLessonPackage | null) {
  if (!value || typeof value !== "object") return null;

  const id = safeText(value.id, "", 80);
  const title = safeText(value.title, "", 100);
  const hours = Math.min(Math.max(Number(value.hours ?? 0), 1), 60);
  const sessionHours = Math.min(Math.max(Number(value.sessionHours ?? 1), 1), 4);
  const totalSessions = Math.min(Math.max(Number(value.totalSessions ?? 0), 1), 40);
  const paceLabel = safeText(value.paceLabel, "", 140);
  const sessions = Array.isArray(value.sessions)
    ? value.sessions
        .map((session) => ({
          date: safeText(session.date, "", 20),
          time: safeText(session.time, "", 20)
        }))
        .filter((session) => isIsoDay(session.date) && isClockTime(session.time))
        .slice(0, totalSessions)
    : [];

  if (!id || !title || !sessions.length || sessions.length < totalSessions) return null;

  return {
    id,
    title,
    hours,
    sessionHours,
    totalSessions,
    paceLabel,
    sessions
  };
}

function compactPackageSessions(sessions: CheckoutLessonPackageSession[]) {
  return sessions
    .map((session) => `${safeText(session.date, "", 20)} ${safeText(session.time, "", 20)}`)
    .filter((value) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
    .join("|")
    .slice(0, 480);
}

function normaliseCoordinate(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

async function assertInstructorSlotAvailable(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  instructorId: string,
  lessonDate: string,
  lessonTime: string
) {
  const requestedStart = londonDateTimeToUtc(lessonDate, lessonTime);
  if (Number.isNaN(requestedStart.getTime())) return false;

  const slotWindowStart = new Date(requestedStart.getTime() - 60_000).toISOString();
  const slotWindowEnd = new Date(requestedStart.getTime() + 60_000).toISOString();
  const { data: matchingSlot, error: matchingSlotError } = await supabase
    .from("availability_slots")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("is_booked", false)
    .gte("starts_at", slotWindowStart)
    .lt("starts_at", slotWindowEnd)
    .gt("ends_at", requestedStart.toISOString())
    .maybeSingle();

  return !matchingSlotError && Boolean(matchingSlot);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isClockTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function londonDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(utcGuess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const londonAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const offsetMs = londonAsUtc - utcGuess.getTime();

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs);
}

type InstructorAvailabilityStatus = {
  verification_status?: string | null;
  compliance_status?: string | null;
  learner_availability_paused?: boolean | null;
  learner_availability_pause_reason?: string | null;
};

function isMissingColumnLookupError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /column .* does not exist/i.test(candidate?.message ?? "");
}

async function readInstructorAvailabilityStatus(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  instructorId: string
): Promise<{ data: InstructorAvailabilityStatus | null; error: { message: string } | null }> {
  const fullLookup = await supabase
    .from("instructor_profiles")
    .select("verification_status,compliance_status,learner_availability_paused,learner_availability_pause_reason")
    .eq("user_id", instructorId)
    .maybeSingle();

  if (!fullLookup.error) {
    return { data: fullLookup.data, error: null };
  }

  if (!isMissingColumnLookupError(fullLookup.error)) {
    return { data: null, error: fullLookup.error };
  }

  const basicLookup = await supabase
    .from("instructor_profiles")
    .select("verification_status")
    .eq("user_id", instructorId)
    .maybeSingle();

  if (basicLookup.error) {
    return { data: null, error: basicLookup.error };
  }

  return {
    data: basicLookup.data
      ? {
          ...basicLookup.data,
          compliance_status: "clear",
          learner_availability_paused: false
        }
      : null,
    error: null
  };
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-checkout", 20)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<CheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before booking a lesson." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);

  if (!canUseMarketplaceRole(roleState, "learner")) {
    return jsonNoStore({ error: "Use a learner account before booking a lesson." }, { status: 403 });
  }

  const termsStatus = await getCurrentTermsStatus(supabase, user.id);
  if (!termsStatus.accepted) {
    return jsonNoStore({ error: CURRENT_TERMS_MESSAGE }, { status: 403 });
  }

  const stripeSecret = getStripeSecretKey();
  const appUrl = getAppOrigin(request);
  const currency = safeCurrency(getStripeEnvValue("STRIPE_DEFAULT_CURRENCY").value, "gbp");
  const lessonPackage = normaliseLessonPackage(body.lessonPackage);
  const amountPence = safeAmountPence(body.amountPence, 4200, 1000, lessonPackage ? 500000 : 30000);
  const instructorName = safeText(body.instructorName, "your driving instructor", 80);
  const instructorId = safeText(body.instructorId, "", 80);
  const instructorEmail = safeEmail(body.instructorEmail);
  const requestedBookingId = safeText(body.bookingId, "", 80).toUpperCase();
  const bookingId = isLdaBookingReference(requestedBookingId) ? requestedBookingId : createBookingReference();
  const paymentPreference = normalisePaymentPreference(body.paymentPreference);
  const bookingWindow = body.bookingWindow === "advance_scheduled" ? "advance_scheduled" : "same_day_or_next_day";
  const learnerEmail = safeEmail(body.learnerEmail);
  const learnerPhone = safeText(body.learnerPhone, "", 40);
  const lessonDate = safeText(body.date, "", 20);
  const lessonTime = safeText(body.time, "", 20);
  const pickupLatitude = normaliseCoordinate(body.pickupLatitude, -90, 90);
  const pickupLongitude = normaliseCoordinate(body.pickupLongitude, -180, 180);
  const pickupSource = safeText(body.pickupSource, "", 20);
  const livePickupFallback =
    pickupLatitude !== null && pickupLongitude !== null
      ? `Live pickup location (${pickupLatitude.toFixed(5)}, ${pickupLongitude.toFixed(5)})`
      : "";
  const pickup = safeText(body.pickup, livePickupFallback, 120);
  const car = safeText(body.car, "", 120);
  const commissionPercent = Math.min(Math.max(Number(process.env.LDA_PLATFORM_COMMISSION_PERCENT ?? 10), 0), 30);
  const applicationFeeAmount = Math.round(amountPence * (commissionPercent / 100));
  const smartMatchContext = normaliseSmartMatchHandoff(body.smartMatchContext);
  const smartMatchLessonSummary = [
    safeText(body.lessonSummary, "", 180),
    buildSmartMatchLessonNote(smartMatchContext)
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);

  if (body.learnerAvailabilityPaused && !shouldBypassInstructorAvailabilityPauseForTest(instructorEmail)) {
    return jsonNoStore(
      {
        error:
          safeText(body.learnerAvailabilityPauseReason, "", 180) ||
          "This instructor is temporarily unavailable while LDA reviews compliance evidence."
      },
      { status: 409 }
    );
  }

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    .from("learner_profiles")
    .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (learnerProfileError) {
    console.error("[booking.checkout] learner eligibility read failed", {
      userId: user.id,
      message: learnerProfileError.message
    });
    return jsonNoStore({ error: "LDA could not confirm your learner eligibility. Try again before checkout." }, { status: 500 });
  }

  if (!hasCompletedLearnerEligibility(learnerProfile)) {
    return jsonNoStore(
      {
        error:
          "Complete learner setup and add a DVLA-verified provisional driving licence in Manage Your Profile before checkout."
      },
      { status: 403 }
    );
  }

  if (instructorId && isUuid(instructorId)) {
    const { data: instructorAccount } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", instructorId)
      .maybeSingle();
    const bypassPausedAvailability = shouldBypassInstructorAvailabilityPauseForTest(
      instructorAccount?.email ?? instructorEmail
    );

    const { data: instructorProfile, error: instructorProfileError } = await readInstructorAvailabilityStatus(
      supabase,
      instructorId
    );

    if (instructorProfileError) {
      console.warn("[booking.checkout] instructor availability read failed", {
        instructorId,
        message: instructorProfileError.message
      });
    }

    const instructorClearedForCheckout =
      bypassPausedAvailability ||
      (!instructorProfileError &&
        instructorProfile &&
        instructorProfile.verification_status === "approved" &&
        (!instructorProfile.compliance_status || instructorProfile.compliance_status === "clear") &&
        !instructorProfile.learner_availability_paused);

    if (!instructorClearedForCheckout) {
      return jsonNoStore(
        {
          error:
            safeText(instructorProfile?.learner_availability_pause_reason, "", 180) ||
            "This instructor is temporarily unavailable while LDA reviews compliance evidence."
        },
        { status: 409 }
      );
    }

    if (!isIsoDay(lessonDate) || !isClockTime(lessonTime)) {
      return jsonNoStore({ error: "Choose a valid instructor availability slot before checkout." }, { status: 400 });
    }

    const requirementSections = await getInstructorVerificationRequirements(supabase);
    const requiredDocumentTypes = flattenInstructorVerificationRequirements(requirementSections)
      .filter((document) => document.requirement === "required")
      .map((document) => document.type);
    const documentsByInstructor = await readInstructorFutureComplianceDocuments(supabase, [instructorId]);
    const complianceDates = lessonPackage
      ? lessonPackage.sessions.map((session) => ({ date: session.date, time: session.time }))
      : [{ date: lessonDate, time: lessonTime }];

    for (const complianceDate of complianceDates) {
      const lessonAt = londonDateTimeToUtc(complianceDate.date, complianceDate.time);
      const futureCompliance = getInstructorFutureComplianceStatus(
        documentsByInstructor.get(instructorId) ?? [],
        requiredDocumentTypes,
        lessonAt
      );

      if (!futureCompliance.ok) {
        return jsonNoStore(
          {
            error: getInstructorFutureComplianceBlockMessage(futureCompliance)
          },
          { status: 409 }
        );
      }
    }

    const firstSlotAvailable = await assertInstructorSlotAvailable(supabase, instructorId, lessonDate, lessonTime);

    if (!firstSlotAvailable) {
      return jsonNoStore(
        {
          error: "That instructor is no longer available for this time. Please choose another live slot before checkout."
        },
        { status: 409 }
      );
    }

    if (lessonPackage) {
      for (const session of lessonPackage.sessions) {
        const sessionSlotAvailable = await assertInstructorSlotAvailable(supabase, instructorId, session.date, session.time);
        if (!sessionSlotAvailable) {
          return jsonNoStore(
            {
              error: "That instructor no longer has enough availability for the full package. Please choose another instructor or start date."
            },
            { status: 409 }
          );
        }
      }
    }
  }

  if (!stripeSecret.value) {
    if (process.env.NODE_ENV === "production") {
      return jsonNoStore({ error: "Payment collection is temporarily unavailable." }, { status: 503 });
    }

    return jsonNoStore({
      mode: "demo",
      message: "Secure checkout is temporarily unavailable.",
      bookingId,
      checkoutUrl: `${appUrl}/learner-dashboard?section=driving-lessons&from=checkout&demoCheckout=1&booking=${encodeURIComponent(bookingId)}#driving-lessons-booking`
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/api/bookings/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/learner-dashboard?section=driving-lessons&from=checkout&payment=cancelled&booking=${encodeURIComponent(bookingId)}#driving-lessons-booking`,
    client_reference_id: user.id,
    "metadata[booking_id]": bookingId,
    "metadata[lda_user_id]": user.id,
    "metadata[instructor_name]": instructorName,
    "metadata[lesson_summary]": smartMatchLessonSummary.slice(0, 480),
    "metadata[price_pence]": String(amountPence),
    "metadata[lda_protected_booking]": "true",
    "metadata[platform_policy_version]": "anti_circumvention_launch",
    "metadata[payment_preference]": paymentPreference,
    "metadata[booking_window]": bookingWindow,
    "payment_intent_data[metadata][booking_id]": bookingId,
    "payment_intent_data[metadata][lda_user_id]": user.id,
    "payment_intent_data[metadata][instructor_id]": instructorId,
    "payment_intent_data[metadata][lda_protected_booking]": "true",
    "payment_intent_data[metadata][platform_policy_version]": "anti_circumvention_launch",
    "payment_intent_data[metadata][booking_window]": bookingWindow,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": lessonPackage ? `LDA ${lessonPackage.title} with ${instructorName}` : `LDA driving lesson with ${instructorName}`,
    allow_promotion_codes: "true"
  });

  if (lessonPackage) {
    const packageSessions = compactPackageSessions(lessonPackage.sessions);
    const packageMetadata: Record<string, string> = {
      lesson_package_id: lessonPackage.id,
      lesson_package_title: lessonPackage.title,
      lesson_package_hours: String(lessonPackage.hours),
      lesson_package_session_hours: String(lessonPackage.sessionHours),
      lesson_package_total_sessions: String(lessonPackage.totalSessions),
      lesson_package_pace: lessonPackage.paceLabel,
      lesson_package_sessions: packageSessions
    };

    for (const [key, value] of Object.entries(packageMetadata)) {
      if (value) {
        params.set(`metadata[${key}]`, value);
        params.set(`payment_intent_data[metadata][${key}]`, value);
      }
    }
  }

  if (learnerEmail) {
    params.set("customer_email", learnerEmail);
    params.set("metadata[learner_email]", learnerEmail);
  }

  const optionalMetadata: Record<string, string> = {
    instructor_id: instructorId,
    instructor_email: instructorEmail,
    learner_phone: learnerPhone,
    lesson_date: lessonDate,
    lesson_time: lessonTime,
    pickup,
    pickup_latitude: pickupLatitude === null ? "" : String(pickupLatitude),
    pickup_longitude: pickupLongitude === null ? "" : String(pickupLongitude),
    pickup_source: pickupSource,
    car
  };

  for (const [key, value] of Object.entries(optionalMetadata)) {
    if (value) {
      params.set(`metadata[${key}]`, value);
    }
  }

  for (const [key, value] of Object.entries(smartMatchStripeMetadata(smartMatchContext))) {
    params.set(`metadata[${key}]`, value);
    params.set(`payment_intent_data[metadata][${key}]`, value);
  }

  applyStripeCheckoutPaymentMethods(params);

  const connectedAccountId = safeStripeConnectedAccountId(body.stripeConnectedAccountId);
  if (connectedAccountId) {
    params.set("payment_intent_data[transfer_data][destination]", connectedAccountId);
    params.set("payment_intent_data[application_fee_amount]", String(applicationFeeAmount));
  }

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

  return jsonNoStore({
    bookingId,
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
