import { NextResponse } from "next/server";

type InstantCheckoutRequest = {
  fullName?: string;
  learnerEmail?: string;
  provisionalLicenceNumber?: string;
  instructorName?: string;
  instructorEmail?: string;
  lessonSummary?: string;
  amountPence?: number;
};

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `LDA-${date}-${random}`;
}

function required(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  const body = (await request.json()) as InstantCheckoutRequest;

  if (!required(body.fullName) || !required(body.learnerEmail) || !required(body.provisionalLicenceNumber)) {
    return NextResponse.json({ error: "Name, email, and provisional licence number are required." }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk";
  const currency = process.env.STRIPE_DEFAULT_CURRENCY ?? "gbp";
  const amountPence = body.amountPence ?? 6500;
  const instructorName = body.instructorName ?? "your LDA instructor";
  const lessonSummary = body.lessonSummary ?? `Instant LDA lesson with ${instructorName}`;
  const reference = createReference();
  const successParams = new URLSearchParams({
    reference,
    email: body.learnerEmail ?? "",
    name: body.fullName ?? "",
    instructor: instructorName,
    summary: lessonSummary
  });
  const successUrl = `${appUrl}/lesson-now/confirmed?${successParams.toString()}`;
  const cancelUrl = `${appUrl}/lesson-now?payment=cancelled`;

  if (!stripeSecretKey) {
    return NextResponse.json({
      mode: "demo",
      reference,
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY for live payment collection.",
      checkoutUrl: successUrl
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[booking_reference]": reference,
    "metadata[learner_email]": body.learnerEmail ?? "",
    "metadata[instructor_name]": instructorName,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": `Instant LDA driving lesson with ${instructorName}`,
    "line_items[0][price_data][product_data][description]": lessonSummary,
    "customer_email": body.learnerEmail ?? "",
    "payment_method_types[0]": "card"
  });

  if (process.env.STRIPE_ENABLE_PAYPAL === "true") {
    params.set("payment_method_types[1]", "paypal");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const session = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: session.error?.message ?? "Stripe checkout failed" }, { status: 400 });
  }

  return NextResponse.json({
    reference,
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
