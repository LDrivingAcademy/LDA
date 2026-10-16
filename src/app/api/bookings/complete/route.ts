import { NextResponse } from "next/server";
import { sendBookingConfirmationEmails } from "@/lib/email";
import { getAppOrigin, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeCheckoutSession = {
  id?: string;
  payment_status?: string | null;
  client_reference_id?: string | null;
  customer_email?: string | null;
  customer?: string | null;
  metadata?: Record<string, string | undefined> | null;
  error?: {
    message?: string;
  };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finalBookingStatuses = new Set([
  "cancelled",
  "cancelled_by_learner",
  "cancelled_by_instructor",
  "completed",
  "refunded",
  "refund_requested",
  "disputed"
]);
const finalPaymentStatuses = new Set(["refunded", "refund_pending", "refund_requested", "disputed"]);

function isFinalBookingRecord(record?: { status?: string | null; payment_status?: string | null } | null) {
  const bookingStatus = String(record?.status ?? "").trim().toLowerCase();
  const paymentStatus = String(record?.payment_status ?? "").trim().toLowerCase();
  return (
    finalBookingStatuses.has(bookingStatus) ||
    bookingStatus.includes("cancel") ||
    bookingStatus.includes("refund") ||
    finalPaymentStatuses.has(paymentStatus)
  );
}

function buildLessonStart(date?: string | null, time?: string | null) {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const startsAt = new Date(`${date}T${time}:00+01:00`);
  return Number.isNaN(startsAt.getTime()) ? null : startsAt;
}

function parseNumberMetadata(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseCoordinateMetadata(value: string | undefined, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parsePackageSessions(value?: string) {
  if (!value) return [];

  return value
    .split("|")
    .map((entry) => {
      const [date, time] = entry.trim().split(" ");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(time ?? "")) return null;
      return { date, time };
    })
    .filter((session): session is { date: string; time: string } => Boolean(session));
}

function buildSessionReference(bookingId: string, index: number) {
  if (index === 0) return bookingId;
  return `${bookingId}-S${String(index + 1).padStart(2, "0")}`;
}

function buildLessonEnd(start: Date | null, hours: number) {
  return start ? new Date(start.getTime() + hours * 60 * 60 * 1000) : null;
}

function formatSessionWhen(date?: string | null, time?: string | null) {
  return [date, time].filter(Boolean).join(" at ") || "the selected lesson time";
}

function redirectToDashboard(request: Request, params: Record<string, string>) {
  const url = new URL("/learner-dashboard", request.url);
  url.searchParams.set("section", "driving-lessons");
  url.searchParams.set("from", "checkout");
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  url.hash = "driving-lessons-booking";
  return NextResponse.redirect(url);
}

async function getStripeCheckoutSession(sessionId: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const session = (await response.json()) as StripeCheckoutSession;

  if (!response.ok) {
    throw new Error(session.error?.message ?? "Stripe checkout session could not be confirmed.");
  }

  return session;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = safeText(url.searchParams.get("session_id"), "", 140);
  const stripeSecret = getStripeSecretKey();

  if (!sessionId || !stripeSecret.value) {
    return redirectToDashboard(request, {
      payment: "error",
      bookingError: !sessionId ? "missing-session" : "missing-stripe-secret"
    });
  }

  const signedInSupabase = await createClient();

  if (!signedInSupabase) {
    return redirectToDashboard(request, { payment: "error", bookingError: "missing-auth" });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("role", "learner");
    loginUrl.searchParams.set("next", `/api/bookings/complete?session_id=${encodeURIComponent(sessionId)}`);
    return NextResponse.redirect(loginUrl);
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "learner")) {
    const deniedUrl = new URL(roleState.effectiveRole === "instructor" ? "/instructor-dashboard" : "/learner-dashboard", request.url);
    deniedUrl.searchParams.set("payment", "error");
    deniedUrl.searchParams.set("bookingError", "wrong-account-type");
    return NextResponse.redirect(deniedUrl);
  }

  try {
    const session = await getStripeCheckoutSession(sessionId, stripeSecret.value);
    const metadata = session.metadata ?? {};
    const bookingId = safeText(metadata.booking_id, "", 80);
    const metadataUserId = safeText(metadata.lda_user_id || session.client_reference_id, "", 120);

    if (!bookingId) {
      return redirectToDashboard(request, { payment: "error", bookingError: "missing-booking" });
    }

    if (metadataUserId && metadataUserId !== user.id) {
      return redirectToDashboard(request, { payment: "error", booking: bookingId, bookingError: "account-mismatch" });
    }

    if (session.payment_status !== "paid") {
      return redirectToDashboard(request, { payment: "pending", booking: bookingId, bookingError: "payment-not-paid" });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return redirectToDashboard(request, { payment: "error", booking: bookingId, bookingError: "missing-service-role" });
    }

    const [{ data: profile }, { data: existingRecord }] = await Promise.all([
      signedInSupabase.from("profiles").select("email,phone").eq("id", user.id).maybeSingle(),
      supabase
        .from("lesson_booking_records")
        .select("booking_reference,payment_status,status")
        .eq("booking_reference", bookingId)
        .maybeSingle()
    ]);

    const lessonDate = safeText(metadata.lesson_date, "", 20);
    const lessonTime = safeText(metadata.lesson_time, "", 20);
    const instructorName = safeText(metadata.instructor_name, "LDA instructor", 120);
    const lessonSummary = safeText(
      metadata.lesson_summary,
      lessonDate && lessonTime ? `${lessonDate} at ${lessonTime}` : "LDA driving lesson",
      180
    );
    const pickupLatitude = parseCoordinateMetadata(metadata.pickup_latitude, -90, 90);
    const pickupLongitude = parseCoordinateMetadata(metadata.pickup_longitude, -180, 180);
    const livePickupFallback =
      pickupLatitude !== null && pickupLongitude !== null
        ? `Live pickup location (${pickupLatitude.toFixed(5)}, ${pickupLongitude.toFixed(5)})`
        : "the confirmed pickup point";
    const pickup = safeText(metadata.pickup, livePickupFallback, 120);
    const learnerEmail = safeEmail(profile?.email || user.email || metadata.learner_email || session.customer_email);
    const learnerPhone = safeText(profile?.phone || metadata.learner_phone, "", 40);
    const bookingWindow = metadata.booking_window === "advance_scheduled" ? "advance_scheduled" : "same_day_or_next_day";
    const packageTitle = safeText(metadata.lesson_package_title, "", 100);
    const packageHours = parseNumberMetadata(metadata.lesson_package_hours, 0, 0, 60);
    const packageSessionHours = parseNumberMetadata(metadata.lesson_package_session_hours, 1, 1, 4);
    const packageTotalSessions = parseNumberMetadata(metadata.lesson_package_total_sessions, 0, 0, 40);
    const packagePace = safeText(metadata.lesson_package_pace, "", 140);
    const packageSessions = parsePackageSessions(metadata.lesson_package_sessions).slice(0, packageTotalSessions || undefined);
    const isPackageBooking = Boolean(packageTitle && packageSessions.length && packageSessions.length >= packageTotalSessions);
    const plannedSessions = isPackageBooking
      ? packageSessions
      : lessonDate && lessonTime
        ? [{ date: lessonDate, time: lessonTime }]
        : [{ date: lessonDate, time: lessonTime }];
    const firstPlannedSession = plannedSessions[0] ?? { date: lessonDate, time: lessonTime };
    const lessonWhen = isPackageBooking
      ? `${formatSessionWhen(firstPlannedSession.date, firstPlannedSession.time)} (${packageSessions.length} scheduled sessions)`
      : formatSessionWhen(lessonDate, lessonTime);
    let instructorId = safeText(metadata.instructor_id, "", 120);
    let instructorEmail = safeEmail(metadata.instructor_email);

    if (!uuidPattern.test(instructorId)) {
      instructorId = "";
    }

    if (!instructorEmail && instructorId) {
      const { data: instructorProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", instructorId)
        .maybeSingle();
      instructorEmail = safeEmail(instructorProfile?.email);
    }

    if (!instructorId && instructorEmail) {
      const { data: instructorProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", instructorEmail)
        .maybeSingle();
      const resolvedInstructorId = safeText(instructorProfile?.id, "", 120);
      instructorId = uuidPattern.test(resolvedInstructorId) ? resolvedInstructorId : "";
    }

    if (!instructorId && instructorName) {
      const { data: instructorProfile } = await supabase
        .from("instructor_profiles")
        .select("user_id")
        .ilike("display_name", instructorName)
        .limit(1)
        .maybeSingle();
      const resolvedInstructorId = safeText(instructorProfile?.user_id, "", 120);
      instructorId = uuidPattern.test(resolvedInstructorId) ? resolvedInstructorId : "";
    }

    if (!instructorEmail && instructorId) {
      const { data: instructorProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", instructorId)
        .maybeSingle();
      instructorEmail = safeEmail(instructorProfile?.email);
    }

    const alreadyConfirmed = existingRecord?.payment_status === "paid";
    if (isFinalBookingRecord(existingRecord)) {
      return redirectToDashboard(request, { payment: "error", booking: bookingId, bookingError: "booking-finalised" });
    }

    const totalPricePence = Number(metadata.price_pence ?? 0) || 0;
    const sessionCount = Math.max(plannedSessions.length, 1);
    const baseSessionPrice = Math.floor(totalPricePence / sessionCount);
    const priceRemainder = totalPricePence - baseSessionPrice * sessionCount;
    const recordRows = plannedSessions.map((session, index) => {
      const sessionStart = buildLessonStart(session.date, session.time);
      const sessionEnd = buildLessonEnd(sessionStart, isPackageBooking ? packageSessionHours : 1);
      const sessionReference = buildSessionReference(bookingId, index);
      const sessionSummary = isPackageBooking
        ? `${packageTitle}: session ${index + 1} of ${packageSessions.length}. ${packagePace || "Same instructor package booking."}`
        : lessonSummary;

      return {
        booking_reference: sessionReference,
        learner_id: user.id,
        learner_email: learnerEmail,
        learner_phone: learnerPhone,
        instructor_id: instructorId || null,
        instructor_name: instructorName,
        instructor_email: instructorEmail,
        lesson_summary: sessionSummary,
        starts_at: sessionStart?.toISOString() ?? null,
        ends_at: sessionEnd?.toISOString() ?? null,
        pickup_postcode: pickup,
        pickup_latitude: pickupLatitude,
        pickup_longitude: pickupLongitude,
        lesson_price_pence: baseSessionPrice + (index === 0 ? priceRemainder : 0),
        car: safeText(metadata.car, "", 120),
        status: "upcoming",
        payment_status: "paid",
        stripe_checkout_session_id: sessionId
      };
    });

    const { error: recordError } = await supabase
      .from("lesson_booking_records")
      .upsert(recordRows, { onConflict: "booking_reference" });

    if (recordError) {
      console.error("[booking.complete] durable booking save failed", {
        bookingId,
        message: recordError.message
      });
      return redirectToDashboard(request, { payment: "error", booking: bookingId, bookingError: "save-failed" });
    }

    if (uuidPattern.test(bookingId)) {
      await supabase
        .from("bookings")
        .update({ status: "accepted", payment_status: "paid" })
        .eq("id", bookingId)
        .eq("learner_id", user.id);
    }

    if (instructorId) {
      for (const session of plannedSessions) {
        const sessionStart = buildLessonStart(session.date, session.time);
        if (!sessionStart) continue;

        const slotWindowStart = new Date(sessionStart.getTime() - 60_000).toISOString();
        const slotWindowEnd = new Date(sessionStart.getTime() + 60_000).toISOString();
        await supabase
          .from("availability_slots")
          .update({ is_booked: true })
          .eq("instructor_id", instructorId)
          .gte("starts_at", slotWindowStart)
          .lt("starts_at", slotWindowEnd)
          .eq("is_booked", false);
      }
    }

    if (!alreadyConfirmed) {
      await sendBookingConfirmationEmails({
        bookingReference: bookingId,
        learnerEmail,
        instructorEmail,
        instructorName,
        lessonSummary: isPackageBooking ? `${packageTitle}: ${packageHours} hours with ${instructorName}. First session ${lessonWhen}.` : lessonSummary,
        manageUrl: `${getAppOrigin(request)}/dashboard`
      });

      await sendSms({
        to: learnerPhone,
        body: `LDA booking confirmed. Reference: ${bookingId}. Thank you for booking ${instructorName}.`
      });

      const notificationRows = [
        {
          user_id: user.id,
          booking_id: uuidPattern.test(bookingId) ? bookingId : null,
          title: isPackageBooking ? "LDA lesson package confirmed" : bookingWindow === "advance_scheduled" ? "Scheduled LDA lesson confirmed" : "LDA lesson confirmed",
          body: isPackageBooking
            ? `${packageTitle} is booked with ${instructorName}. First session: ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`
            : `${instructorName} is booked for ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`,
          notification_type: bookingWindow === "advance_scheduled" ? "booking_scheduled" : "booking_confirmed"
        }
      ];

      if (instructorId && instructorId !== user.id) {
        notificationRows.push({
          user_id: instructorId,
          booking_id: uuidPattern.test(bookingId) ? bookingId : null,
          title: isPackageBooking ? "New LDA package booking" : bookingWindow === "advance_scheduled" ? "New scheduled LDA lesson" : "New LDA lesson booked",
          body: isPackageBooking
            ? `${learnerEmail || "A learner"} booked ${packageTitle}. First session: ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`
            : `${learnerEmail || "A learner"} booked ${lessonWhen}. Pickup: ${pickup}. Reference: ${bookingId}.`,
          notification_type: bookingWindow === "advance_scheduled" ? "booking_scheduled" : "booking_paid"
        });
      }

      await supabase.from("notifications").insert(notificationRows);
    }

    return redirectToDashboard(request, {
      payment: "success",
      bookingConfirmed: bookingId
    });
  } catch (error) {
    console.error("[booking.complete] Stripe booking completion failed", error);
    return redirectToDashboard(request, { payment: "error", bookingError: "completion-failed" });
  }
}
