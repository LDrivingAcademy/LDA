import { sendBookingConfirmationEmails } from "@/lib/email";
import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

type ConfirmRequest = {
  bookingId: string;
  learnerId?: string;
  instructorId?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
  checkoutSessionId?: string;
  date?: string;
  time?: string;
  bookingWindow?: "same_day_or_next_day" | "advance_scheduled";
  pickup?: string;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  pickupSource?: string | null;
  pricePence?: number;
  car?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildLessonStart(date?: string, time?: string) {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const startsAt = new Date(`${date}T${time}:00+01:00`);
  return Number.isNaN(startsAt.getTime()) ? null : startsAt;
}

function normaliseCoordinate(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

async function verifyCheckoutSession({
  checkoutSessionId,
  bookingReference,
  learnerEmail
}: {
  checkoutSessionId: string;
  bookingReference: string;
  learnerEmail: string;
}) {
  const sessionId = safeText(checkoutSessionId, "", 120);
  if (!/^cs_(test|live)_[A-Za-z0-9]+/.test(sessionId)) {
    return { ok: false, error: "Payment confirmation is missing or invalid." };
  }

  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, error: "Payment confirmation is temporarily unavailable." }
      : { ok: true, sessionId };
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`
    }
  });
  const session = await response.json();

  if (!response.ok) {
    return { ok: false, error: "Payment confirmation could not be verified." };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, error: "This lesson payment is not marked as paid yet." };
  }

  if (session.metadata?.booking_id !== bookingReference) {
    return { ok: false, error: "Payment confirmation does not match this booking reference." };
  }

  if (session.customer_email && learnerEmail && String(session.customer_email).toLowerCase() !== learnerEmail.toLowerCase()) {
    return { ok: false, error: "Payment email does not match this learner account." };
  }

  return { ok: true, sessionId };
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-confirm", 20)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<ConfirmRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid booking confirmation request." }, { status: 400 });
  }

  const bookingId = safeText(input.bookingId, "", 80);
  const instructorName = safeText(input.instructorName, "", 120);
  const lessonSummary = safeText(input.lessonSummary, "", 180);
  if (!bookingId || !instructorName || !lessonSummary) {
    return jsonNoStore({ error: "Booking reference, instructor name, and lesson summary are required." }, { status: 400 });
  }

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Secure account access is temporarily unavailable." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before confirming a booking." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "learner")) {
    return jsonNoStore({ error: "Use a learner account before confirming a booking." }, { status: 403 });
  }

  const [{ data: profile }, { data: booking }] = await Promise.all([
    signedInSupabase.from("profiles").select("email,phone").eq("id", user.id).maybeSingle(),
    uuidPattern.test(bookingId)
      ? signedInSupabase
          .from("bookings")
          .select("id,learner_id,instructor_id")
          .eq("id", bookingId)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  if (uuidPattern.test(bookingId) && !booking) {
    return jsonNoStore({ error: "You can only confirm bookings linked to your account." }, { status: 403 });
  }

  const learnerEmail = safeEmail(profile?.email || user.email || input.learnerEmail);
  const learnerPhone = safeText(profile?.phone || input.learnerPhone, "", 40);
  const manageUrl = `${getAppOrigin(request)}/dashboard`;
  const checkoutSessionId = safeText(input.checkoutSessionId, "", 120);

  if (!checkoutSessionId) {
    return jsonNoStore({ error: "A verified payment confirmation is required before LDA can confirm a paid booking." }, { status: 400 });
  }

  const sessionCheck = await verifyCheckoutSession({
    checkoutSessionId,
    bookingReference: bookingId,
    learnerEmail
  });

  if (!sessionCheck.ok) {
    return jsonNoStore({ error: sessionCheck.error }, { status: 409 });
  }

  const lessonStart = buildLessonStart(input.date, input.time);
  const lessonEnd = lessonStart ? new Date(lessonStart.getTime() + 60 * 60 * 1000) : null;
  const lessonWhen = [safeText(input.date, "", 20), safeText(input.time, "", 20)].filter(Boolean).join(" at ") || "the selected lesson time";
  const pickupLatitude = normaliseCoordinate(input.pickupLatitude, -90, 90);
  const pickupLongitude = normaliseCoordinate(input.pickupLongitude, -180, 180);
  const livePickupFallback =
    pickupLatitude !== null && pickupLongitude !== null
      ? `Live pickup location (${pickupLatitude.toFixed(5)}, ${pickupLongitude.toFixed(5)})`
      : "the confirmed pickup point";
  const pickup = safeText(input.pickup, livePickupFallback, 120);
  const bookingKind = input.bookingWindow === "advance_scheduled" ? "scheduled lesson" : "today or tomorrow lesson";
  const supabase = createAdminClient();
  let instructorNotificationUserId = "";
  let resolvedInstructorId = "";
  let resolvedInstructorEmail = safeEmail(input.instructorEmail);

  if (supabase) {
    const { data: existingDurableRecord } = await supabase
      .from("lesson_booking_records")
      .select("payment_status,status")
      .eq("booking_reference", bookingId)
      .maybeSingle();

    if (existingDurableRecord?.payment_status === "paid") {
      return jsonNoStore({
        ok: true,
        bookingReference: bookingId,
        alreadyConfirmed: true
      });
    }

    const bookingInstructorId = safeText(booking?.instructor_id, "", 120);
    const inputInstructorId = safeText(input.instructorId, "", 120);

    if (uuidPattern.test(bookingInstructorId)) {
      resolvedInstructorId = bookingInstructorId;
    } else if (uuidPattern.test(inputInstructorId)) {
      resolvedInstructorId = inputInstructorId;
    } else {
      const instructorEmail = safeEmail(input.instructorEmail);
      if (instructorEmail) {
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", instructorEmail)
          .maybeSingle();
        const instructorProfileId = safeText(instructorProfile?.id, "", 120);
        if (uuidPattern.test(instructorProfileId)) {
          resolvedInstructorId = instructorProfileId;
        }
      }
    }

    if (!resolvedInstructorId && instructorName) {
      const { data: instructorProfileByName } = await supabase
        .from("instructor_profiles")
        .select("user_id")
        .ilike("display_name", instructorName)
        .limit(1)
        .maybeSingle();
      const instructorProfileByNameId = safeText(instructorProfileByName?.user_id, "", 120);
      if (uuidPattern.test(instructorProfileByNameId)) {
        resolvedInstructorId = instructorProfileByNameId;
      }
    }

    if (resolvedInstructorId) {
      instructorNotificationUserId = resolvedInstructorId;
      if (!resolvedInstructorEmail) {
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", resolvedInstructorId)
          .maybeSingle();
        resolvedInstructorEmail = safeEmail(instructorProfile?.email);
      }
    }

    const { error: recordError } = await supabase.from("lesson_booking_records").upsert(
      {
        booking_reference: bookingId,
        learner_id: user.id,
        learner_email: learnerEmail,
        learner_phone: learnerPhone || safeText(input.learnerPhone, "", 40),
        instructor_id: resolvedInstructorId || safeText(input.instructorId, "", 120),
        instructor_name: instructorName,
        instructor_email: resolvedInstructorEmail,
        lesson_summary: lessonSummary,
        starts_at: lessonStart?.toISOString() ?? null,
        ends_at: lessonEnd?.toISOString() ?? null,
        pickup_postcode: pickup,
        pickup_latitude: pickupLatitude,
        pickup_longitude: pickupLongitude,
        lesson_price_pence: Math.max(0, Number.isInteger(input.pricePence) ? Number(input.pricePence) : 0),
        car: safeText(input.car, "", 120),
        status: "upcoming",
        payment_status: "paid",
        stripe_checkout_session_id: checkoutSessionId || null
      },
      { onConflict: "booking_reference" }
    );

    if (recordError) {
      console.warn("[booking.confirm] durable booking reference save failed", {
        bookingReference: bookingId,
        message: recordError.message
      });
      return jsonNoStore(
        {
          error:
            "The payment was received, but LDA could not save the booking to the learner and instructor calendars. Contact support with this booking reference.",
          bookingReference: bookingId
        },
        { status: 500 }
      );
    }

    if (resolvedInstructorId && lessonStart) {
      const slotWindowStart = new Date(lessonStart.getTime() - 60_000).toISOString();
      const slotWindowEnd = new Date(lessonStart.getTime() + 60_000).toISOString();

      const { error: availabilityUpdateError } = await supabase
        .from("availability_slots")
        .update({ is_booked: true })
        .eq("instructor_id", resolvedInstructorId)
        .gte("starts_at", slotWindowStart)
        .lt("starts_at", slotWindowEnd)
        .eq("is_booked", false);

      if (availabilityUpdateError) {
        console.warn("[booking.confirm] availability slot update failed", {
          bookingReference: bookingId,
          message: availabilityUpdateError.message
        });
      }
    }

    if (uuidPattern.test(bookingId)) {
      await supabase
        .from("bookings")
        .update({
          status: "accepted",
          payment_status: "paid"
        })
        .eq("id", bookingId)
        .eq("learner_id", user.id);
    }
  }

  await sendBookingConfirmationEmails({
    bookingReference: bookingId,
    learnerEmail,
    instructorEmail: resolvedInstructorEmail,
    instructorName,
    lessonSummary,
    manageUrl
  });

  await sendSms({
    to: learnerPhone || safeText(input.learnerPhone, "", 40),
    body: `LDA booking confirmed. Reference: ${bookingId}. Thank you for booking ${instructorName}. Only share this reference with your instructor when they arrive.`
  });

  let notificationWarning = "";
  if (supabase) {
    const notificationBookingId = uuidPattern.test(bookingId) ? bookingId : null;
    const notificationRows = [
      {
        user_id: user.id,
        booking_id: notificationBookingId,
        title: input.bookingWindow === "advance_scheduled" ? "Scheduled LDA lesson confirmed" : "LDA lesson confirmed",
        body: `${instructorName} is booked for ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`,
        notification_type: input.bookingWindow === "advance_scheduled" ? "booking_scheduled" : "booking_confirmed"
      }
    ];

    if (instructorNotificationUserId && instructorNotificationUserId !== user.id) {
      notificationRows.push({
        user_id: instructorNotificationUserId,
        booking_id: notificationBookingId,
        title: input.bookingWindow === "advance_scheduled" ? "New scheduled LDA lesson" : "New LDA lesson booked",
        body: `${learnerEmail || "A learner"} booked a ${bookingKind} for ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`,
        notification_type: input.bookingWindow === "advance_scheduled" ? "booking_scheduled" : "booking_paid"
      });
    }

    const { error: notificationError } = await supabase.from("notifications").insert(notificationRows);
    if (notificationError) {
      notificationWarning = notificationError.message;
      console.warn("[booking.confirm] notification insert failed", {
        bookingReference: bookingId,
        message: notificationError.message
      });
    }
  }

  return jsonNoStore({
    ok: true,
    message: "Learner email, text confirmation, instructor email, and instructor notification flow completed or queued.",
    notificationWarning
  });
}
