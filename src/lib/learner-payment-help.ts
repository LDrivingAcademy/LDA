import "server-only";

import { getStripeSecretKey } from "@/lib/stripe-env";

export type PaymentConfirmation = {
  id: string;
  bookingReferences: string[];
  bookingLabel: string;
  tutor: string;
  lessonDate: string | null;
  paymentDate: string;
  amountPence: number;
  currency: string;
  paymentMethod: string;
  status: string;
  confirmationReference: string;
  receiptUrl: string | null;
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
  bookingHref: string;
  confirmBookingUrl: string | null;
};

export type FailedPayment = {
  id: string;
  supportValue: string;
  bookingReference: string;
  bookingLabel: string;
  attemptedAt: string;
  failureReason: string;
  stripeError: string;
  retryUrl: string | null;
};

export type PaymentHelpData = {
  confirmations: PaymentConfirmation[];
  failedPayments: FailedPayment[];
  stripeAvailable: boolean;
};

type BookingRecordRow = {
  booking_reference: string;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  lesson_price_pence: number | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

type StripeCharge = {
  created?: number;
  receipt_url?: string | null;
  payment_method_details?: {
    card?: { brand?: string | null; last4?: string | null };
    type?: string | null;
  } | null;
};

type StripePaymentIntent = {
  id: string;
  amount?: number;
  currency?: string;
  created?: number;
  status?: string;
  metadata?: Record<string, string>;
  latest_charge?: StripeCharge | string | null;
  last_payment_error?: {
    message?: string | null;
    code?: string | null;
    decline_code?: string | null;
  } | null;
};

type StripeInvoice = {
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  amount_total?: number | null;
  currency?: string | null;
  created?: number;
  expires_at?: number;
  status?: string | null;
  payment_status?: string | null;
  url?: string | null;
  metadata?: Record<string, string>;
  payment_intent?: StripePaymentIntent | string | null;
  invoice?: StripeInvoice | string | null;
};

type PaymentHelpSupabase = {
  // Supabase query builders are Promise-like fluent objects with generated generic types.
  from: (table: string) => any;
};

const stripeApi = "https://api.stripe.com/v1";

function learnerReceiptUrl(paymentId: string) {
  return `/support/learner/payment-help/receipt/${encodeURIComponent(paymentId)}`;
}

function bookingHistoryUrl(reference: string) {
  return `/booking-history?from=dashboard&booking=${encodeURIComponent(reference)}`;
}

function stripeUrl(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function stripeDate(value: number | undefined, fallback: string) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : fallback;
}

function paymentMethodLabel(charge: StripeCharge | null) {
  const card = charge?.payment_method_details?.card;
  if (card?.last4) {
    const brand = card.brand ? `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)}` : "Card";
    return `${brand} ending ${card.last4}`;
  }
  const type = charge?.payment_method_details?.type?.replaceAll("_", " ");
  return type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : "Payment method protected";
}

function checkoutPaymentIntent(session: StripeCheckoutSession) {
  return session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
}

function checkoutCharge(session: StripeCheckoutSession) {
  const charge = checkoutPaymentIntent(session)?.latest_charge;
  return charge && typeof charge === "object" ? charge : null;
}

function checkoutInvoice(session: StripeCheckoutSession) {
  return session.invoice && typeof session.invoice === "object" ? session.invoice : null;
}

async function stripeGet<T>(path: string, secretKey: string): Promise<T | null> {
  const response = await fetch(`${stripeApi}/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store"
  });
  if (!response.ok) {
    console.warn("[payment-help] Stripe lookup failed", { path: path.split("?")[0], status: response.status });
    return null;
  }
  return (await response.json()) as T;
}

async function mapInBatches<T, R>(items: T[], batchSize: number, mapper: (item: T) => Promise<R>) {
  const output: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    output.push(...(await Promise.all(items.slice(index, index + batchSize).map(mapper))));
  }
  return output;
}

function sessionGroups(rows: BookingRecordRow[]) {
  const groups = new Map<string, BookingRecordRow[]>();
  for (const row of rows) {
    if (!row.stripe_checkout_session_id) continue;
    groups.set(row.stripe_checkout_session_id, [...(groups.get(row.stripe_checkout_session_id) ?? []), row]);
  }
  return [...groups.entries()].map(([sessionId, records]) => ({ sessionId, records }));
}

function paymentStatusLabel(session: StripeCheckoutSession, fallback: string | null) {
  const value = session.payment_status || checkoutPaymentIntent(session)?.status || fallback || "unknown";
  const labels: Record<string, string> = {
    paid: "Paid",
    succeeded: "Paid",
    unpaid: "Payment required",
    no_payment_required: "No payment required",
    processing: "Processing",
    requires_action: "Action required",
    requires_payment_method: "Failed",
    canceled: "Cancelled"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function buildConfirmation(session: StripeCheckoutSession, records: BookingRecordRow[]): PaymentConfirmation {
  const first = records[0];
  const paymentIntent = checkoutPaymentIntent(session);
  const charge = checkoutCharge(session);
  const invoice = checkoutInvoice(session);
  const references = records.map((record) => record.booking_reference);
  const paid = session.payment_status === "paid" || paymentIntent?.status === "succeeded";
  const recordedPaid = records.every((record) => record.payment_status === "paid");

  return {
    id: session.id,
    bookingReferences: references,
    bookingLabel: records.length > 1 ? `${first.lesson_summary || "Lesson package"} (${records.length} lessons)` : first.lesson_summary || "Driving lesson",
    tutor: first.instructor_name || "LDA instructor",
    lessonDate: records.map((record) => record.starts_at).filter(Boolean).sort()[0] ?? null,
    paymentDate: stripeDate(charge?.created ?? paymentIntent?.created ?? session.created, first.created_at),
    amountPence: session.amount_total ?? paymentIntent?.amount ?? records.reduce((total, record) => total + (record.lesson_price_pence ?? 0), 0),
    currency: (session.currency || paymentIntent?.currency || "gbp").toUpperCase(),
    paymentMethod: paymentMethodLabel(charge),
    status: paymentStatusLabel(session, first.payment_status),
    confirmationReference: references[0] || session.metadata?.booking_id || session.id,
    receiptUrl: learnerReceiptUrl(session.id),
    invoiceUrl: stripeUrl(invoice?.hosted_invoice_url),
    invoicePdfUrl: stripeUrl(invoice?.invoice_pdf),
    bookingHref: bookingHistoryUrl(references[0] || session.metadata?.booking_id || session.id),
    confirmBookingUrl: paid && !recordedPaid ? `/api/bookings/complete?session_id=${encodeURIComponent(session.id)}` : null
  };
}

function buildFallbackConfirmation(records: BookingRecordRow[], sessionId: string): PaymentConfirmation {
  const first = records[0];
  const references = records.map((record) => record.booking_reference);
  return {
    id: sessionId,
    bookingReferences: references,
    bookingLabel: records.length > 1 ? `${first.lesson_summary || "Lesson package"} (${records.length} lessons)` : first.lesson_summary || "Driving lesson",
    tutor: first.instructor_name || "LDA instructor",
    lessonDate: records.map((record) => record.starts_at).filter(Boolean).sort()[0] ?? null,
    paymentDate: first.created_at,
    amountPence: records.reduce((total, record) => total + (record.lesson_price_pence ?? 0), 0),
    currency: "GBP",
    paymentMethod: "Payment details temporarily unavailable",
    status: first.payment_status === "paid" ? "Paid" : "Payment status unavailable",
    confirmationReference: references[0],
    receiptUrl: learnerReceiptUrl(sessionId),
    invoiceUrl: null,
    invoicePdfUrl: null,
    bookingHref: bookingHistoryUrl(references[0] || sessionId),
    confirmBookingUrl: null
  };
}

function failureDetails(intent: StripePaymentIntent) {
  const error = intent.last_payment_error;
  const reason = error?.message || (intent.status === "canceled" ? "This payment attempt was cancelled." : "Stripe needs another payment attempt.");
  const code = error?.decline_code || error?.code;
  return {
    failureReason: reason,
    stripeError: code ? code.replaceAll("_", " ") : intent.status?.replaceAll("_", " ") || "payment incomplete"
  };
}

async function retryUrlForIntent(intentId: string, secretKey: string) {
  const params = new URLSearchParams({ payment_intent: intentId, limit: "1" });
  const result = await stripeGet<{ data?: StripeCheckoutSession[] }>(`checkout/sessions?${params}`, secretKey);
  const session = result?.data?.[0];
  if (!session || session.status !== "open" || (session.expires_at && session.expires_at * 1000 <= Date.now())) return null;
  return stripeUrl(session.url);
}

async function getFailedPayments(userId: string, representedIntentIds: Set<string>, secretKey: string) {
  const params = new URLSearchParams({
    query: `metadata['lda_user_id']:'${userId}'`,
    limit: "50"
  });
  params.append("expand[]", "data.latest_charge");
  const result = await stripeGet<{ data?: StripePaymentIntent[] }>(`payment_intents/search?${params}`, secretKey);
  const failures = (result?.data ?? []).filter(
    (intent) => !representedIntentIds.has(intent.id) && ["requires_payment_method", "requires_action", "requires_confirmation", "canceled"].includes(intent.status || "")
  );

  return mapInBatches(failures, 5, async (intent): Promise<FailedPayment> => {
    const details = failureDetails(intent);
    return {
      id: intent.id,
      supportValue: `stripe:${intent.id}`,
      bookingReference: intent.metadata?.booking_id || "Checkout attempt",
      bookingLabel: intent.metadata?.lesson_summary || "Driving lesson payment",
      attemptedAt: stripeDate(intent.created, new Date().toISOString()),
      ...details,
      retryUrl: await retryUrlForIntent(intent.id, secretKey)
    };
  });
}

function buildSessionFailure(session: StripeCheckoutSession, records: BookingRecordRow[]): FailedPayment {
  const paymentIntent = checkoutPaymentIntent(session);
  const details = paymentIntent
    ? failureDetails(paymentIntent)
    : {
        failureReason: session.status === "expired" ? "This checkout expired before payment was completed." : "This checkout has not been completed.",
        stripeError: session.status === "expired" ? "checkout expired" : "payment incomplete"
      };
  const first = records[0];
  const retryAvailable = session.status === "open" && (!session.expires_at || session.expires_at * 1000 > Date.now());

  return {
    id: paymentIntent?.id || session.id,
    supportValue: first.booking_reference,
    bookingReference: first.booking_reference,
    bookingLabel: records.length > 1 ? `${first.lesson_summary || "Lesson package"} (${records.length} lessons)` : first.lesson_summary || "Driving lesson payment",
    attemptedAt: stripeDate(paymentIntent?.created ?? session.created, first.created_at),
    ...details,
    retryUrl: retryAvailable ? stripeUrl(session.url) : null
  };
}

function buildFallbackFailure(records: BookingRecordRow[], sessionId: string): FailedPayment {
  const first = records[0];
  return {
    id: sessionId,
    supportValue: first.booking_reference,
    bookingReference: first.booking_reference,
    bookingLabel: first.lesson_summary || "Driving lesson payment",
    attemptedAt: first.created_at,
    failureReason: "This payment has not been completed.",
    stripeError: "live Stripe status unavailable",
    retryUrl: null
  };
}

export async function getLearnerPaymentHelpData(
  supabase: PaymentHelpSupabase,
  learnerId: string
): Promise<PaymentHelpData> {
  const { data, error } = await supabase
    .from("lesson_booking_records")
    .select("booking_reference,instructor_name,lesson_summary,starts_at,lesson_price_pence,payment_status,stripe_checkout_session_id,created_at")
    .eq("learner_id", learnerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[payment-help] booking lookup failed", error.message);
  }

  const rows = (data as BookingRecordRow[] | null) ?? [];
  const groups = sessionGroups(rows);
  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    const paidGroups = groups.filter(({ records }) => records.every((record) => record.payment_status === "paid"));
    return {
      confirmations: paidGroups.map(({ records, sessionId }) => buildFallbackConfirmation(records, sessionId)),
      failedPayments: groups
        .filter(({ records }) => !records.every((record) => record.payment_status === "paid"))
        .map(({ records, sessionId }) => buildFallbackFailure(records, sessionId)),
      stripeAvailable: false
    };
  }

  const sessions = await mapInBatches(groups, 5, async ({ sessionId, records }) => {
    const params = new URLSearchParams();
    params.append("expand[]", "payment_intent.latest_charge");
    params.append("expand[]", "invoice");
    const session = await stripeGet<StripeCheckoutSession>(`checkout/sessions/${encodeURIComponent(sessionId)}?${params}`, stripeSecret.value!);
    return { session, sessionId, records };
  });

  const representedIntentIds = new Set(
    sessions
      .map(({ session }) => (session ? checkoutPaymentIntent(session)?.id : null))
      .filter((id): id is string => Boolean(id))
  );
  const confirmationSessions = sessions.filter(({ session, records }) =>
    session
      ? session.payment_status === "paid" || checkoutPaymentIntent(session)?.status === "succeeded"
      : records.every((record) => record.payment_status === "paid")
  );
  const confirmations = confirmationSessions.map(({ session, sessionId, records }) =>
    session ? buildConfirmation(session, records) : buildFallbackConfirmation(records, sessionId)
  );
  const sessionFailures = sessions
    .filter((entry) => !confirmationSessions.includes(entry))
    .map(({ session, sessionId, records }) =>
      session ? buildSessionFailure(session, records) : buildFallbackFailure(records, sessionId)
    );
  const searchedFailures = await getFailedPayments(learnerId, representedIntentIds, stripeSecret.value);
  const failedPayments = [...sessionFailures, ...searchedFailures];

  return {
    confirmations: confirmations.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
    failedPayments: failedPayments.sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)),
    stripeAvailable: true
  };
}
