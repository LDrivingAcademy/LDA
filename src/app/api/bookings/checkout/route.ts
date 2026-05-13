import { NextResponse } from "next/server";

type CheckoutRequest = {
  bookingId?: string;
  instructorName?: string;
  lessonSummary?: string;
  amountPence?: number;
  stripeConnectedAccountId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CheckoutRequest;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk";
  const currency = process.env.STRIPE_DEFAULT_CURRENCY ?? "gbp";
  const amountPence = body.amountPence ?? 4200;
  const instructorName = body.instructorName ?? "your driving instructor";
  const bookingId = body.bookingId ?? "demo-booking";
  const commissionPercent = Number(process.env.LDA_PLATFORM_COMMISSION_PERCENT ?? 10);
  const applicationFeeAmount = Math.round(amountPence * (commissionPercent / 100));

  if (!stripeSecretKey) {
    return NextResponse.json({
      mode: "demo",
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to create live Checkout sessions.",
      checkoutUrl: `${appUrl}/dashboard?demoCheckout=1&booking=${encodeURIComponent(bookingId)}`
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/dashboard?payment=success&booking=${encodeURIComponent(bookingId)}`,
    cancel_url: `${appUrl}/dashboard?payment=cancelled&booking=${encodeURIComponent(bookingId)}`,
    "metadata[booking_id]": bookingId,
    "automatic_payment_methods[enabled]": "true",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": `LDA driving lesson with ${instructorName}`
  });

  if (body.stripeConnectedAccountId) {
    params.set("payment_intent_data[transfer_data][destination]", body.stripeConnectedAccountId);
    params.set("payment_intent_data[application_fee_amount]", String(applicationFeeAmount));
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
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
