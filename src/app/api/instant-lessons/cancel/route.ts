import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { enforceLearnerCancellationPolicy } from "@/lib/learner-account-enforcement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

type CancelInstantLessonRequest = {
  reference?: string;
  sessionId?: string;
};

const cancellableStatuses = new Set(["checkout_started", "waiting_for_instructor", "pending_assignment", "payment_pending"]);

function logBookingStoreError(action: string, reference: string, error: { code?: string; message?: string; details?: string; hint?: string }) {
  console.error(`[instant-lessons.cancel] ${action} failed`, {
    bookingReference: reference,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
}

function canAutoAssign() {
  return process.env.LDA_ON_DEMAND_AUTO_ASSIGN !== "0" && process.env.LDA_ON_DEMAND_AUTO_ASSIGN !== "false";
}

async function getStripeCheckoutSession(sessionId: string) {
  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, error: "Cancellation lookup is temporarily unavailable." }
      : { ok: true, session: { id: sessionId, created: Math.floor(Date.now() / 1000), payment_status: "paid" } };
  }

  const sessionUrl = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  sessionUrl.searchParams.set("expand[]", "payment_intent");

  const sessionResponse = await fetch(sessionUrl, {
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`
    }
  });
  const session = await sessionResponse.json();

  if (!sessionResponse.ok) {
    return { ok: false, error: "Payment confirmation could not be found." };
  }

  return { ok: true, session };
}

function isStripeSessionStillWaiting(session: Record<string, any>) {
  if (!canAutoAssign()) {
    return true;
  }

  const createdAt = Number(session.created ?? 0) > 0 ? Number(session.created) * 1000 : Date.now();
  return Date.now() - createdAt < 8_000;
}

async function refundStripeSession(sessionId: string, idempotencyKey?: string) {
  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, error: "Refund processing is temporarily unavailable." }
      : { ok: true, refundId: "demo_refund" };
  }

  const sessionUrl = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  sessionUrl.searchParams.set("expand[]", "payment_intent");

  const sessionResponse = await fetch(sessionUrl, {
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`
    }
  });
  const session = await sessionResponse.json();

  if (!sessionResponse.ok) {
    return { ok: false, error: "Payment confirmation could not be found." };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? "";

  if (!paymentIntentId) {
    return { ok: false, error: "Payment details are not available for this booking yet." };
  }

  const refundParams = new URLSearchParams({
    payment_intent: paymentIntentId,
    reason: "requested_by_customer"
  });

  const refundResponse = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: refundParams
  });
  const refund = await refundResponse.json();

  if (!refundResponse.ok) {
    return { ok: false, error: "Refund could not be created." };
  }

  return { ok: true, refundId: refund.id as string };
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-cancel", 12)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<CancelInstantLessonRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid cancellation request." }, { status: 400 });
  }

  const reference = safeText(input.reference, "", 80);
  const sessionId = safeText(input.sessionId, "", 140);

  if (!reference) {
    return jsonNoStore({ error: "Booking reference is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return jsonNoStore(
        {
          error:
            "Refund cancellation is temporarily unavailable because LDA cannot safely reserve the booking record. Contact support with your booking reference."
        },
        { status: 503 }
      );
    }

    if (!sessionId) {
      return jsonNoStore({ error: "Cancellation is temporarily unavailable without the payment reference." }, { status: 503 });
    }

    const sessionLookup = await getStripeCheckoutSession(sessionId);
    if (!sessionLookup.ok || !sessionLookup.session) {
      return jsonNoStore({ error: sessionLookup.error ?? "Payment confirmation could not be checked." }, { status: 409 });
    }

    const sessionReference = safeText(sessionLookup.session.metadata?.booking_reference, "", 80);
    if (sessionReference && sessionReference !== reference) {
      return jsonNoStore({ error: "Payment confirmation does not match this booking reference." }, { status: 409 });
    }

    if (!isStripeSessionStillWaiting(sessionLookup.session)) {
      return jsonNoStore(
        {
          error:
            "This on-demand lesson has already been accepted by an instructor, so automatic refund cancellation is no longer available. Contact LDA support if there is a problem."
        },
        { status: 409 }
      );
    }

    const refundResult =
      sessionLookup.session.payment_status === "paid"
        ? await refundStripeSession(sessionId, `instant-refund-${reference}-${sessionId}`)
        : { ok: true as const };

    if (!refundResult.ok) {
      return jsonNoStore({ error: refundResult.error ?? "Refund could not be processed." }, { status: 409 });
    }

    return jsonNoStore({
      ok: true,
      refundId: "refundId" in refundResult ? refundResult.refundId ?? null : null,
      message:
        sessionLookup.session.payment_status === "paid"
          ? "Your on-demand lesson was cancelled before instructor acceptance and the refund has been requested."
          : "Your on-demand lesson request was cancelled before payment was completed."
    });
  }

  const { data: record, error } = await supabase
    .from("lesson_booking_records")
    .select("*")
    .eq("booking_reference", reference)
    .maybeSingle();

  if (error) {
    logBookingStoreError("booking read", reference, error);
    if (sessionId) {
      const sessionLookup = await getStripeCheckoutSession(sessionId);
      if (!sessionLookup.ok || !sessionLookup.session) {
        return jsonNoStore({ error: sessionLookup.error ?? "Payment confirmation could not be checked." }, { status: 409 });
      }

      const sessionReference = safeText(sessionLookup.session.metadata?.booking_reference, "", 80);
      if (sessionReference && sessionReference !== reference) {
        return jsonNoStore({ error: "Payment confirmation does not match this booking reference." }, { status: 409 });
      }

      if (!isStripeSessionStillWaiting(sessionLookup.session)) {
        return jsonNoStore(
          {
            error:
              "This on-demand lesson has already been accepted by an instructor, so automatic refund cancellation is no longer available. Contact LDA support if there is a problem."
          },
          { status: 409 }
        );
      }

      const refundResult =
        sessionLookup.session.payment_status === "paid"
          ? await refundStripeSession(sessionId, `instant-refund-${reference}-${sessionId}`)
          : { ok: true as const };

      if (!refundResult.ok) {
        return jsonNoStore({ error: refundResult.error ?? "Refund could not be processed." }, { status: 409 });
      }

      return jsonNoStore({
        ok: true,
        refundId: "refundId" in refundResult ? refundResult.refundId ?? null : null,
        message:
          sessionLookup.session.payment_status === "paid"
            ? "Your on-demand lesson was cancelled before instructor acceptance and the refund has been requested."
            : "Your on-demand lesson request was cancelled before payment was completed."
      });
    }

    return jsonNoStore({ error: "Booking status store is temporarily unavailable." }, { status: 503 });
  }

  if (!record) {
    return jsonNoStore({ error: "Booking reference was not found." }, { status: 404 });
  }

  const signedInSupabase = await createClient();
  const {
    data: { user }
  } = signedInSupabase ? await signedInSupabase.auth.getUser() : { data: { user: null } };
  const learnerId = safeText(record.learner_id, "", 120);

  if (learnerId) {
    if (!signedInSupabase || !user) {
      return jsonNoStore({ error: "Sign in to cancel this on-demand lesson." }, { status: 401 });
    }

    const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner") || user.id !== learnerId) {
      return jsonNoStore({ error: "This on-demand lesson is not available on this account." }, { status: 403 });
    }
  } else if (user && signedInSupabase) {
    const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner")) {
      return jsonNoStore({ error: "Use a learner account to cancel an on-demand lesson." }, { status: 403 });
    }
  }

  if (!learnerId && !sessionId) {
    return jsonNoStore({ error: "Payment reference is required before cancelling this guest on-demand lesson." }, { status: 403 });
  }

  const status = String(record.status ?? "");
  if (!cancellableStatuses.has(status)) {
    return jsonNoStore(
      {
        error:
          "This on-demand lesson has already been accepted by an instructor, so automatic refund cancellation is no longer available. Contact LDA support if there is a problem."
      },
      { status: 409 }
    );
  }

  const checkoutSessionId = safeText(record.stripe_checkout_session_id || sessionId, "", 140);
  let refundResult: { ok: boolean; error?: string; refundId?: string } = { ok: true };

  if (record.payment_status === "refunded" || record.payment_status === "refund_pending") {
    return jsonNoStore(
      {
        error:
          "This booking refund has already been requested or processed. Contact LDA support if your payment has not updated yet."
      },
      { status: 409 }
    );
  }

  if (record.payment_status === "paid") {
    if (!checkoutSessionId) {
      return jsonNoStore({ error: "Payment reference is missing, so the refund needs support review." }, { status: 409 });
    }

    const { data: reservedRefund, error: reserveError } = await supabase
      .from("lesson_booking_records")
      .update({
        payment_status: "refund_pending",
        lesson_summary: `${record.lesson_summary ?? "On-demand lesson"} Cancellation requested before instructor acceptance. Refund is being created.`
      })
      .eq("booking_reference", reference)
      .eq("payment_status", "paid")
      .in("status", Array.from(cancellableStatuses))
      .select("booking_reference")
      .maybeSingle();

    if (reserveError) {
      logBookingStoreError("refund reservation", reference, reserveError);
      return jsonNoStore({ error: "Refund could not be reserved safely. Contact LDA support with your booking reference." }, { status: 503 });
    }

    if (!reservedRefund) {
      return jsonNoStore(
        {
          error:
            "This booking is no longer eligible for automatic refund cancellation, or a refund is already in progress."
        },
        { status: 409 }
      );
    }

    refundResult = await refundStripeSession(checkoutSessionId, `instant-refund-${reference}-${checkoutSessionId}`);
    if (!refundResult.ok) {
      await supabase
        .from("lesson_booking_records")
        .update({
          payment_status: "paid",
          lesson_summary: record.lesson_summary ?? "On-demand lesson"
        })
        .eq("booking_reference", reference)
        .eq("payment_status", "refund_pending");
      return jsonNoStore({ error: refundResult.error ?? "Refund could not be processed." }, { status: 409 });
    }
  }

  const { error: updateError } = await supabase
    .from("lesson_booking_records")
    .update({
      status: "cancelled",
      payment_status: record.payment_status === "paid" ? "refunded" : "unpaid",
      lesson_summary: `${record.lesson_summary ?? "On-demand lesson"} Cancellation requested before instructor acceptance.${refundResult.refundId ? ` Refund reference: ${refundResult.refundId}.` : ""}`,
      cancellation_actor: "learner",
      cancellation_reason: "Learner cancelled on-demand lesson before instructor acceptance.",
      cancelled_by: learnerId || null,
      cancelled_at: new Date().toISOString()
    })
    .eq("booking_reference", reference)
    .in("status", Array.from(cancellableStatuses))
    .in("payment_status", record.payment_status === "paid" ? ["refund_pending"] : [String(record.payment_status ?? "")]);

  if (updateError) {
    logBookingStoreError("cancellation update", reference, updateError);
    return jsonNoStore({ error: "Cancellation could not be saved. Contact LDA support with your booking reference." }, { status: 503 });
  }

  if (learnerId) {
    await enforceLearnerCancellationPolicy(learnerId, reference);
  }

  return jsonNoStore({
    ok: true,
    refundId: refundResult.refundId ?? null,
    message:
      record.payment_status === "paid"
        ? "Your on-demand lesson was cancelled before instructor acceptance and the refund has been requested."
        : "Your on-demand lesson request was cancelled before payment was completed."
  });
}
