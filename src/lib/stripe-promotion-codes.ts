import { safeText } from "@/lib/security";
import { getStripeSecretKey } from "@/lib/stripe-env";

type PromotionCodeDiscountType = "percent" | "amount";

type CreateStripePromotionCodeInput = {
  amountOffPence?: number;
  code?: string;
  discountType: PromotionCodeDiscountType;
  duration?: "once" | "forever";
  maxRedemptions?: number | null;
  name?: string;
  percentOff?: number;
  validDays?: number | null;
};

type StripePromotionCodeResponse = {
  code?: string;
  coupon?: {
    id?: string;
  };
  promotion?: {
    coupon?: string | { id?: string };
    type?: string;
  };
  expires_at?: number | null;
  id?: string;
};

function normalisePromoCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function generatedPromoCode() {
  const token = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase();
  return `LDA-${token}`;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) {
    return fallback;
  }

  return number;
}

async function postStripeForm<T>(path: string, params: URLSearchParams, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Stripe promotion code request failed.");
  }

  return data as T;
}

function getPromotionCouponId(promotion: StripePromotionCodeResponse, fallbackCouponId: string) {
  const promotionCoupon = promotion.promotion?.coupon;
  if (typeof promotionCoupon === "string") {
    return promotionCoupon;
  }

  return promotionCoupon?.id ?? promotion.coupon?.id ?? fallbackCouponId;
}

async function createPromotionCodeWithCoupon(
  couponId: string,
  promotionParams: URLSearchParams,
  secretKey: string
) {
  const modernParams = new URLSearchParams(promotionParams);
  modernParams.set("promotion[type]", "coupon");
  modernParams.set("promotion[coupon]", couponId);

  try {
    return await postStripeForm<StripePromotionCodeResponse>("promotion_codes", modernParams, secretKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("unknown parameter") || !message.toLowerCase().includes("promotion")) {
      throw error;
    }

    const legacyParams = new URLSearchParams(promotionParams);
    legacyParams.set("coupon", couponId);
    return postStripeForm<StripePromotionCodeResponse>("promotion_codes", legacyParams, secretKey);
  }
}

export async function createStripePromotionCode(input: CreateStripePromotionCodeInput) {
  const stripeSecret = getStripeSecretKey();

  if (!stripeSecret.value) {
    throw new Error(`Stripe promotion codes need ${stripeSecret.envName} in ${stripeSecret.modeLabel} Stripe mode.`);
  }

  const name = safeText(input.name, "LDA promotional offer", 80);
  const code = normalisePromoCode(input.code || "") || generatedPromoCode();
  const couponParams = new URLSearchParams({
    name,
    duration: input.duration === "forever" ? "forever" : "once"
  });

  if (input.discountType === "amount") {
    couponParams.set("amount_off", String(clampInteger(input.amountOffPence, 500, 100, 100000)));
    couponParams.set("currency", "gbp");
  } else {
    couponParams.set("percent_off", String(clampInteger(input.percentOff, 10, 1, 95)));
  }

  const coupon = await postStripeForm<{ id: string }>("coupons", couponParams, stripeSecret.value);
  const promotionParams = new URLSearchParams({ code });
  const validDays = input.validDays ? clampInteger(input.validDays, 30, 1, 365) : null;
  const maxRedemptions = input.maxRedemptions ? clampInteger(input.maxRedemptions, 1, 1, 100000) : null;

  if (validDays) {
    promotionParams.set("expires_at", String(Math.floor(Date.now() / 1000) + validDays * 24 * 60 * 60));
  }

  if (maxRedemptions) {
    promotionParams.set("max_redemptions", String(maxRedemptions));
  }

  const promotion = await createPromotionCodeWithCoupon(coupon.id, promotionParams, stripeSecret.value);

  return {
    code: promotion.code ?? code,
    couponId: getPromotionCouponId(promotion, coupon.id),
    expiresAt: promotion.expires_at ? new Date(promotion.expires_at * 1000).toISOString() : null,
    id: promotion.id
  };
}
