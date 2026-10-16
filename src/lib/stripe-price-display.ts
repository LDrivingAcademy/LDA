import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";
import {
  formatSubscriptionPrice,
  type SubscriptionPricingContext,
} from "@/lib/subscription-pricing";
import type { BillingInterval } from "@/lib/learner-packages";

type StripeCurrencyOption = {
  unit_amount?: number | null;
};

type StripePriceResponse = {
  id?: string;
  currency?: string;
  currency_options?: Record<string, StripeCurrencyOption>;
  unit_amount?: number | null;
  error?: {
    message?: string;
  };
};

type StripePriceLookup = {
  response: Pick<Response, "ok" | "status">;
  price: StripePriceResponse;
};

const stripePriceLookupCache = new Map<string, { expiresAt: number; promise: Promise<StripePriceLookup> }>();

async function retrieveStripePrice(secretKey: string, priceId: string, expandCurrencyOptions = false, cacheSeconds = 300) {
  const cacheKey = `${priceId}:${expandCurrencyOptions ? "currency-options" : "base"}`;
  const now = Date.now();

  if (cacheSeconds > 0) {
    const cached = stripePriceLookupCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.promise;
    }
  }

  const params = expandCurrencyOptions ? `?${new URLSearchParams({ "expand[]": "currency_options" }).toString()}` : "";
  const requestOptions: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    signal: AbortSignal.timeout(5000),
  };

  if (cacheSeconds > 0) {
    requestOptions.cache = "force-cache";
    requestOptions.next = { revalidate: cacheSeconds };
  } else {
    requestOptions.cache = "no-store";
  }

  const lookupPromise = fetch(`https://api.stripe.com/v1/prices/${priceId}${params}`, requestOptions).then(async (response) => {
    const price = (await response.json()) as StripePriceResponse;
    return { response: { ok: response.ok, status: response.status }, price };
  });

  if (cacheSeconds > 0) {
    stripePriceLookupCache.set(cacheKey, { expiresAt: now + cacheSeconds * 1000, promise: lookupPromise });
    lookupPromise.catch(() => {
      if (stripePriceLookupCache.get(cacheKey)?.promise === lookupPromise) {
        stripePriceLookupCache.delete(cacheKey);
      }
    });
  }

  return lookupPromise;
}

function formatStripeAmount(unitAmount: number, currencyCode: string, pricingContext: SubscriptionPricingContext) {
  return new Intl.NumberFormat(pricingContext.locale, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(unitAmount / 100);
}

export async function getStripeBackedSubscriptionPrice({
  fallbackPence,
  priceEnvName,
  pricingContext,
  billingInterval = "monthly",
}: {
  fallbackPence: number;
  priceEnvName?: string | null;
  pricingContext: SubscriptionPricingContext;
  billingInterval?: BillingInterval;
}) {
  if (fallbackPence <= 0) {
    return "Free";
  }

  const fallbackPrice = formatSubscriptionPrice(fallbackPence, pricingContext, billingInterval);
  const stripeSecret = getStripeSecretKey();
  const stripePrice = getStripePriceId(priceEnvName);

  if (!stripeSecret.value || !stripePrice?.value) {
    return fallbackPrice;
  }

  try {
    const { response, price } = await retrieveStripePrice(stripeSecret.value, stripePrice.value, true, 300);

    if (!response.ok) {
      console.error(
        `Stripe price display lookup failed for ${stripePrice.envName}: ${
          price.error?.message ?? "Unknown Stripe error"
        }`,
      );
      return fallbackPrice;
    }

    const localCurrencyCode = pricingContext.currencyCode.toLowerCase();
    const localCurrencyAmount = price.currency_options?.[localCurrencyCode]?.unit_amount;
    const defaultCurrencyCode = price.currency?.toLowerCase() ?? "gbp";
    const defaultAmount = price.unit_amount;

    if (defaultCurrencyCode === "gbp" && typeof defaultAmount === "number" && defaultAmount !== fallbackPence) {
      console.error(
        `${stripePrice.envName} points to ${stripePrice.value}, but that Stripe Price is ${defaultAmount} pence instead of the expected ${fallbackPence} pence.`,
      );
      return fallbackPrice;
    }

    if (typeof localCurrencyAmount === "number") {
      return `${formatStripeAmount(localCurrencyAmount, localCurrencyCode, pricingContext)} per month`;
    }

    if (typeof defaultAmount === "number") {
      return `${formatStripeAmount(defaultAmount, defaultCurrencyCode, pricingContext)} per month`;
    }
  } catch (error) {
    console.error(`Stripe price display lookup failed for ${stripePrice.envName}`, error);
  }

  return fallbackPrice;
}

export async function getStripeBackedSubscriptionStartingPrice({
  fallbackPence,
  priceEnvName,
  pricingContext,
}: {
  fallbackPence: number;
  priceEnvName?: string | null;
  pricingContext: SubscriptionPricingContext;
}) {
  if (fallbackPence <= 0) {
    return "Free";
  }

  const price = await getStripeBackedSubscriptionPrice({
    fallbackPence,
    priceEnvName,
    pricingContext,
    billingInterval: "monthly",
  });

  if (price === "Free") {
    return price;
  }

  const amount = price.replace(/\s+per month$/, "");
  return `From ${amount}/month`;
}

export async function validateStripePriceMatchesExpected({
  expectedPence,
  packageName,
  priceEnvName,
  priceId,
  secretKey,
}: {
  expectedPence: number;
  packageName: string;
  priceEnvName: string;
  priceId: string;
  secretKey: string;
}) {
  try {
    const { response, price } = await retrieveStripePrice(secretKey, priceId, false, 0);

    if (!response.ok) {
      return price.error?.message ?? `${packageName} Stripe Price could not be verified.`;
    }

    const currency = price.currency?.toLowerCase();
    const unitAmount = price.unit_amount;

    if (currency !== "gbp" || unitAmount !== expectedPence) {
      const actualAmount = typeof unitAmount === "number" ? `£${(unitAmount / 100).toFixed(2)}` : "an unknown amount";
      return `${priceEnvName} is linked to the wrong Stripe Price for ${packageName}. It currently resolves to ${
        currency?.toUpperCase() ?? "unknown currency"
      } ${actualAmount}, but ${packageName} must be £${(expectedPence / 100).toFixed(2)} per month. Update the Vercel env var to the correct price_ ID and redeploy.`;
    }
  } catch (error) {
    console.error(`Stripe price validation failed for ${priceEnvName}`, error);
    return `${packageName} Stripe Price could not be verified. Please try again shortly.`;
  }

  return null;
}
