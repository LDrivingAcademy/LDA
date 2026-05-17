export function applyStripeCheckoutPaymentMethods(params: URLSearchParams) {
  const configuredTypes = (process.env.STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES || "")
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
