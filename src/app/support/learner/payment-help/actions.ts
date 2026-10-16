"use server";

import { redirect } from "next/navigation";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { sendSupportEscalationEmail, sendSupportTicketConfirmationEmail } from "@/lib/email";
import { safeText } from "@/lib/security";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { classifySupportRequest, supportTicketReference } from "@/lib/support-guidance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paymentHelpPath = "/support/learner/payment-help";

function paymentRedirect(message: string): never {
  redirect(`${paymentHelpPath}?message=${encodeURIComponent(message)}`);
}

export async function submitPaymentSupportRequest(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect(`/auth/login?role=learner&next=${encodeURIComponent(paymentHelpPath)}`);

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?role=learner&next=${encodeURIComponent(paymentHelpPath)}`);

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (roleState.effectiveRole !== "learner") {
    redirect(roleState.effectiveRole === "instructor" ? "/support/instructor/dashboard" : "/learner-dashboard");
  }

  const requestType = safeText(formData.get("requestType"), "", 20);
  const paymentContext = safeText(formData.get("paymentContext"), "", 140);
  const details = safeText(formData.get("details"), "", 2200);
  const amount = safeText(formData.get("amount"), "", 30);
  const paymentDate = safeText(formData.get("paymentDate"), "", 20);

  if (!["refund", "duplicate", "other"].includes(requestType)) paymentRedirect("Choose the payment issue you need help with.");
  if (!paymentContext) paymentRedirect("Choose the relevant booking.");
  if (details.length < 15) paymentRedirect("Add a little more detail so support can review the payment.");

  const adminClient = createAdminClient();
  if (!adminClient) paymentRedirect("Payment support is temporarily unavailable. Please try again shortly.");

  const { data: profile } = await adminClient.from("profiles").select("email,full_name").eq("id", user.id).maybeSingle();
  let booking: {
    booking_reference: string;
    instructor_name: string | null;
    lesson_summary: string | null;
    starts_at: string | null;
    lesson_price_pence: number | null;
    payment_status: string | null;
    stripe_checkout_session_id: string | null;
    stripe_payment_intent_id?: string | null;
  } | null = null;

  if (paymentContext.startsWith("stripe:")) {
    const paymentIntentId = paymentContext.slice(7);
    const stripeSecret = getStripeSecretKey();
    if (!stripeSecret.value || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
      paymentRedirect("That payment attempt could not be verified.");
    }
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      headers: { Authorization: `Bearer ${stripeSecret.value}` },
      cache: "no-store"
    });
    if (!response.ok) paymentRedirect("That payment attempt could not be verified.");
    const intent = (await response.json()) as {
      id: string;
      amount?: number;
      status?: string;
      metadata?: Record<string, string>;
    };
    if (intent.metadata?.lda_user_id !== user.id) paymentRedirect("That payment attempt does not belong to this learner account.");
    booking = {
      booking_reference: safeText(intent.metadata?.booking_id, "Checkout attempt", 100),
      instructor_name: safeText(intent.metadata?.instructor_name, "LDA instructor", 120),
      lesson_summary: safeText(intent.metadata?.lesson_summary, "Driving lesson payment", 220),
      starts_at: null,
      lesson_price_pence: typeof intent.amount === "number" ? intent.amount : null,
      payment_status: intent.status || "incomplete",
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: intent.id
    };
  } else {
    const result = await adminClient
      .from("lesson_booking_records")
      .select("booking_reference,instructor_name,lesson_summary,starts_at,lesson_price_pence,payment_status,stripe_checkout_session_id")
      .eq("booking_reference", paymentContext)
      .eq("learner_id", user.id)
      .maybeSingle();
    booking = result.data;
  }

  if (!booking) paymentRedirect("That booking could not be matched to your learner account.");
  const bookingReference = booking.booking_reference;
  const contactEmail = String(profile?.email ?? user.email ?? "").trim().toLowerCase();
  if (!contactEmail) paymentRedirect("Add an email address to your LDA account before submitting a payment request.");

  const typeLabel = requestType === "refund" ? "Refund request" : requestType === "duplicate" ? "Duplicate charge report" : "Payment support request";
  const message = [
    `${typeLabel} for booking ${bookingReference}.`,
    `Booking: ${booking.lesson_summary || "Driving lesson"} with ${booking.instructor_name || "LDA instructor"}.`,
    paymentDate ? `Payment date supplied by learner: ${paymentDate}.` : "",
    amount ? `Amount supplied by learner: ${amount}.` : "",
    `Learner explanation: ${details}`
  ].filter(Boolean).join("\n\n");
  const classification = classifySupportRequest({
    message,
    role: "learner",
    hasBookingReference: true,
    hasContactEmail: true
  });
  const priority = requestType === "duplicate" ? "urgent" : classification.priority;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await adminClient
    .from("support_tickets")
    .select("ticket_number")
    .eq("requester_user_id", user.id)
    .eq("booking_reference", bookingReference)
    .eq("subject", typeLabel)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.ticket_number) {
    redirect(`${paymentHelpPath}?submitted=${encodeURIComponent(supportTicketReference(Number(existing.ticket_number)))}`);
  }

  const submittedAt = new Date().toISOString();
  const { data: ticket, error } = await adminClient
    .from("support_tickets")
    .insert({
      requester_user_id: user.id,
      requester_role: "learner",
      contact_email: contactEmail,
      category: "payment",
      priority,
      status: "new",
      subject: typeLabel,
      message,
      ai_summary: classification.summary,
      assistant_guidance:
        requestType === "refund"
          ? "Review the booking and existing cancellation/refund record before taking any manual Stripe action."
          : "Compare the supplied charge with Stripe and the booking record. Do not request full card details.",
      booking_reference: bookingReference,
      booking_context: {
        bookingReference,
        instructorName: booking.instructor_name,
        lessonSummary: booking.lesson_summary,
        startsAt: booking.starts_at,
        lessonPricePence: booking.lesson_price_pence,
        paymentStatus: booking.payment_status,
        stripeCheckoutSessionId: booking.stripe_checkout_session_id,
        stripePaymentIntentId: booking.stripe_payment_intent_id ?? null,
        suppliedAmount: amount || null,
        suppliedPaymentDate: paymentDate || null
      },
      conversation: [],
      risk_flags: requestType === "duplicate" ? ["duplicate_charge"] : [],
      source_path: paymentHelpPath,
      request_context: {
        workflow: `learner_payment_${requestType}`,
        submittedAt,
        callbackAvailable: false
      },
      preferred_contact_method: "email",
      callback_requested: false,
      callback_status: "not_requested"
    })
    .select("id,ticket_number")
    .single();

  if (error || !ticket) {
    console.error("[payment-help] support ticket creation failed", error?.message);
    paymentRedirect("The payment request could not be saved. Please try again.");
  }

  const reference = supportTicketReference(Number(ticket.ticket_number));
  await Promise.allSettled([
    sendSupportEscalationEmail({
      role: "learner",
      name: profile?.full_name || "",
      email: contactEmail,
      bookingReference,
      subject: typeLabel,
      message,
      assistantSummary: classification.summary,
      urgent: priority !== "standard"
    }),
    sendSupportTicketConfirmationEmail({
      to: contactEmail,
      reference,
      categoryLabel: typeLabel,
      priority,
      idempotencyKey: `payment-help-confirmation-${ticket.id}`
    }),
    adminClient.from("notifications").insert({
      user_id: user.id,
      notification_type: "support_ticket",
      title: `${typeLabel} received`,
      body: `LDA support reference ${reference} has been created for booking ${bookingReference}.`
    })
  ]);

  redirect(`${paymentHelpPath}?submitted=${encodeURIComponent(reference)}`);
}
