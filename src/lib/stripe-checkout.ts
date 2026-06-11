import { getStripeEnvValue } from "@/lib/stripe-env";

export function applyStripeCheckoutPaymentMethods(params: URLSearchParams) {
  const configuredTypes = (getStripeEnvValue("STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES").value || "")
    .split(",")
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);

  if (!configuredTypes.length) {
    return;
  }

  configuredTypes.forEach((type, index) => {
    params.set(`payment_method_types[${index}]`, type);
  });
}
