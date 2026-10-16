import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";
import { getStripeEnvValue, getStripePriceId, getStripeRuntimeMode, getStripeSecretKey } from "@/lib/stripe-env";
import { getInstructorPackage, type InstructorPackage, type InstructorPackageId } from "@/lib/instructor-packages";
import { getLearnerPackage, type LearnerPackage, type LearnerPackageId } from "@/lib/learner-packages";
import { syncSubscriptionTarget, type SubscriptionSyncTarget } from "@/lib/subscription-profile-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession | StripeSubscription | StripeInvoice;
  };
};

type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  client_reference_id?: string | null;
  customer_email?: string | null;
  customer?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
  subscription?: string | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeCustomer = {
  id?: string;
  email?: string | null;
  deleted?: boolean;
  error?: {
    message?: string;
  };
};

type StripeSubscription = {
  id: string;
  object: "subscription";
  customer?: string | null;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string | undefined> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

type StripeInvoice = {
  id: string;
  object: "invoice";
  customer?: string | null;
  subscription?: string | null;
  parent?: {
    subscription_details?: {
      subscription?: string | null;
      metadata?: Record<string, string | undefined> | null;
    } | null;
  } | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeApiError = {
  error?: {
    message?: string;
  };
};

const handledStripeWebhookEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded"
]);

function parseStripeSignature(header: string | null) {
  if (!header) {
    return null;
  }

  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  return timestamp && signatures.length ? { timestamp, signatures } : null;
}

function secureCompare(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStripeWebhook(payload: string, signatureHeader: string | null, secret: string) {
  const parsedSignature = parseStripeSignature(signatureHeader);

  if (!parsedSignature) {
    return false;
  }

  const timestampSeconds = Number(parsedSignature.timestamp);
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);

  if (!Number.isFinite(timestampSeconds) || ageSeconds > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${parsedSignature.timestamp}.${payload}`).digest("hex");
  return parsedSignature.signatures.some((signature) => secureCompare(signature, expected));
}

function normaliseWebhookSecret(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.startsWith("whsec_") ? trimmed : null;
}

function getWebhookSecretCandidates() {
  const mode = getStripeRuntimeMode();
  const primarySecret = getStripeEnvValue("STRIPE_WEBHOOK_SECRET");
  const modeSpecificNames =
    mode === "live"
      ? ["LDA_THIN_LIVE_WEBHOOK_SECRET", "LDA_SNAPSHOT_LIVE_WEBHOOK_SECRET"]
      : mode === "test"
        ? ["LDA_THIN_TEST_WEBHOOK_SECRET", "LDA_SNAPSHOT_TEST_WEBHOOK_SECRET"]
        : [];
  const expectedEnvNames = [primarySecret.envName, ...modeSpecificNames];
  const secrets = [
    { envName: primarySecret.envName, value: normaliseWebhookSecret(primarySecret.value) },
    ...modeSpecificNames.map((envName) => ({ envName, value: normaliseWebhookSecret(process.env[envName]) }))
  ].filter((secret): secret is { envName: string; value: string } => Boolean(secret.value));

  return {
    expectedEnvNames,
    secrets: secrets.filter(
      (secret, index, values) => values.findIndex((candidate) => candidate.value === secret.value) === index
    )
  };
}

function hasCheckoutTargetMetadata(session: StripeCheckoutSession) {
  return Boolean(
    session.metadata?.lda_account_role &&
      (session.metadata?.lda_package_id || session.metadata?.lda_instructor_package_id)
  );
}

function hasSubscriptionTargetData(subscription: StripeSubscription) {
  return Boolean(subscription.status && (subscription.metadata?.lda_account_role || subscription.items?.data?.[0]?.price?.id));
}

async function retrieveStripeResource<T extends StripeApiError>(path: string, secretKey?: string | null) {
  if (!secretKey) {
    return null;
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const resource = (await response.json()) as T;

  if (!response.ok) {
    console.error(`Stripe webhook resource lookup failed for ${path}`, resource.error?.message ?? "Unknown Stripe error.");
    return null;
  }

  return resource;
}

async function hydrateCheckoutSession(session: StripeCheckoutSession, secretKey?: string | null) {
  if (hasCheckoutTargetMetadata(session)) {
    return session;
  }

  return (
    (await retrieveStripeResource<StripeCheckoutSession & StripeApiError>(
      `checkout/sessions/${encodeURIComponent(session.id)}?expand[]=subscription`,
      secretKey
    )) ?? session
  );
}

async function hydrateSubscription(subscription: StripeSubscription, secretKey?: string | null) {
  if (hasSubscriptionTargetData(subscription)) {
    return subscription;
  }

  return (
    (await retrieveStripeResource<StripeSubscription & StripeApiError>(
      `subscriptions/${encodeURIComponent(subscription.id)}`,
      secretKey
    )) ?? subscription
  );
}

function toTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function formatMonthlyPrice(pence: number) {
  return pence > 0 ? `\u00a3${(pence / 100).toFixed(2)} per month` : "Free";
}

function getPricePackage(priceId?: string | null): SubscriptionSyncTarget | null {
  if (!priceId) {
    return null;
  }

  const priceMappings: Array<{ envName: string; role: SubscriptionSyncTarget["role"]; packageId: string }> = [
    { envName: "STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PLUS_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_INSTRUCTOR_PRO_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PLUS_YEARLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-pro" },
    { envName: "STRIPE_LEARNER_PRO_YEARLY_PRICE_ID", role: "learner", packageId: "learner-pro" }
  ];

  for (const mapping of priceMappings) {
    if (getStripePriceId(mapping.envName)?.value === priceId) {
      return mapping.role === "instructor"
        ? { role: "instructor", packageId: mapping.packageId as InstructorPackageId }
        : { role: "learner", packageId: mapping.packageId as LearnerPackageId };
    }
  }

  return null;
}

function getSessionTarget(session: StripeCheckoutSession): SubscriptionSyncTarget | null {
  const role = session.metadata?.lda_account_role;
  const instructorPackageId = session.metadata?.lda_instructor_package_id;
  const learnerPackageId = session.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId };
  }

  return null;
}

function getSubscriptionTarget(subscription: StripeSubscription): SubscriptionSyncTarget | null {
  const role = subscription.metadata?.lda_account_role;
  const instructorPackageId = subscription.metadata?.lda_instructor_package_id;
  const learnerPackageId = subscription.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId };
  }

  return getPricePackage(subscription.items?.data?.[0]?.price?.id);
}

async function syncTarget({
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd
}: {
  target: SubscriptionSyncTarget;
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}) {
  await syncSubscriptionTarget({ target, userId, customerId, subscriptionId, status, periodEnd });
}

function getTargetPackage(target: SubscriptionSyncTarget): InstructorPackage | LearnerPackage | undefined {
  return target.role === "instructor"
    ? getInstructorPackage(target.packageId)
    : getLearnerPackage(target.packageId);
}

function getUpdatedDashboardUrl(request: Request, target: SubscriptionSyncTarget) {
  const url = new URL(target.role === "learner" ? "/learner-dashboard" : "/instructor-dashboard", request.url);
  url.searchParams.set("subscription", "updated");
  url.searchParams.set("plan", target.packageId);
  return url.toString();
}

function getPackageFeaturesUrl(request: Request, target: SubscriptionSyncTarget) {
  const url = new URL(
    target.role === "instructor" ? `/instructor-plus/${target.packageId}` : `/learner-plus/${target.packageId}`,
    request.url,
  );
  return url.toString();
}

async function getStripeCustomerEmail(customerId: string | null | undefined, secretKey?: string | null) {
  if (!customerId || !secretKey) {
    return null;
  }

  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const customer = (await response.json()) as StripeCustomer;

  if (!response.ok || customer.deleted) {
    console.error("Stripe customer email lookup failed", customer.error?.message ?? "Customer was not available.");
    return null;
  }

  return customer.email ?? null;
}

async function sendCheckoutSubscriptionConfirmation({
  request,
  session,
  target,
  secretKey
}: {
  request: Request;
  session: StripeCheckoutSession;
  target: SubscriptionSyncTarget;
  secretKey?: string | null;
}) {
  const targetPackage = getTargetPackage(target);

  if (!targetPackage) {
    return;
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    (await getStripeCustomerEmail(session.customer, secretKey));

  if (!email) {
    console.error(`Stripe checkout ${session.id} has no email for ${targetPackage.name} subscription confirmation.`);
    return;
  }

  try {
    await sendSubscriptionConfirmationEmail({
      to: email,
      role: target.role,
      packageName: targetPackage.name,
      changeType: "activation",
      billingLabel: "monthly subscription",
      priceLabel: formatMonthlyPrice(targetPackage.monthlyPricePence),
      dashboardUrl: getUpdatedDashboardUrl(request, target),
      packageSummary: targetPackage.summary,
      featuresUrl: getPackageFeaturesUrl(request, target),
      idempotencyKey: `subscription-confirmation-${session.subscription ?? session.id}`
    });
  } catch (emailError) {
    console.error("Subscription confirmation email failed", emailError);
  }
}

function getInvoiceSubscriptionId(invoice: StripeInvoice) {
  return invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
}

function getInvoiceTarget(invoice: StripeInvoice): SubscriptionSyncTarget | null {
  const metadata = invoice.parent?.subscription_details?.metadata ?? invoice.metadata;
  const role = metadata?.lda_account_role;
  const instructorPackageId = metadata?.lda_instructor_package_id;
  const learnerPackageId = metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId };
  }

  return null;
}

export async function POST(request: Request) {
  const webhookSecrets = getWebhookSecretCandidates();
  const stripeSecret = getStripeSecretKey();
  const payload = await request.text();

  if (!webhookSecrets.secrets.length) {
    return NextResponse.json(
      { error: `Add one of ${webhookSecrets.expectedEnvNames.join(", ")} in Vercel to enable Stripe webhooks.` },
      { status: 500 }
    );
  }

  if (!webhookSecrets.secrets.some((webhookSecret) => verifyStripeWebhook(payload, request.headers.get("stripe-signature"), webhookSecret.value))) {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (!handledStripeWebhookEvents.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = await hydrateCheckoutSession(event.data.object as StripeCheckoutSession, stripeSecret.value);
      const target = getSessionTarget(session);

      if (target) {
        await syncTarget({
          target,
          userId: session.metadata?.lda_user_id ?? session.client_reference_id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          status: "active"
        });
        await sendCheckoutSubscriptionConfirmation({
          request,
          session,
          target,
          secretKey: stripeSecret.value
        });
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = await hydrateSubscription(event.data.object as StripeSubscription, stripeSecret.value);
      const target = getSubscriptionTarget(subscription);

      if (target) {
        await syncTarget({
          target,
          userId: subscription.metadata?.lda_user_id,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status ?? "active",
          periodEnd: toTimestamp(subscription.current_period_end)
        });
      }
    }

    if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as StripeInvoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      const subscription = subscriptionId
        ? await retrieveStripeResource<StripeSubscription & StripeApiError>(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecret.value)
        : null;
      const target = subscription ? getSubscriptionTarget(subscription) : getInvoiceTarget(invoice);

      if (target) {
        await syncTarget({
          target,
          userId: subscription?.metadata?.lda_user_id ?? invoice.parent?.subscription_details?.metadata?.lda_user_id ?? invoice.metadata?.lda_user_id,
          customerId: subscription?.customer ?? invoice.customer,
          subscriptionId: subscription?.id ?? subscriptionId,
          status: subscription?.status ?? (event.type === "invoice.payment_failed" ? "past_due" : "active"),
          periodEnd: toTimestamp(subscription?.current_period_end)
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe subscription sync failed", error);
    return NextResponse.json({ error: "Stripe subscription sync failed." }, { status: 500 });
  }
}
