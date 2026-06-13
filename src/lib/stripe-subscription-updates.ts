type StripeSubscriptionItem = {
  id?: string;
};

type StripeSubscriptionResponse = {
  id?: string;
  status?: string;
  current_period_end?: number | null;
  items?: {
    data?: StripeSubscriptionItem[];
  };
  error?: {
    message?: string;
  };
};

type UpdateStripeSubscriptionOptions = {
  secretKey: string;
  subscriptionId: string;
  priceId: string;
  metadata: Record<string, string>;
};

export type UpdatedStripeSubscription = {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
};

function getStripeHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };
}

function toTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

export async function updateStripeSubscriptionPrice({
  secretKey,
  subscriptionId,
  priceId,
  metadata
}: UpdateStripeSubscriptionOptions): Promise<UpdatedStripeSubscription> {
  const currentResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: getStripeHeaders(secretKey)
  });
  const currentSubscription = (await currentResponse.json()) as StripeSubscriptionResponse;

  if (!currentResponse.ok) {
    throw new Error(currentSubscription.error?.message ?? "Stripe subscription could not be found.");
  }

  const itemId = currentSubscription.items?.data?.[0]?.id;

  if (!itemId) {
    throw new Error("Stripe subscription has no editable subscription item.");
  }

  const params = new URLSearchParams({
    "items[0][id]": itemId,
    "items[0][price]": priceId,
    proration_behavior: "create_prorations"
  });

  Object.entries(metadata).forEach(([key, value]) => {
    params.set(`metadata[${key}]`, value);
  });

  const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: "POST",
    headers: getStripeHeaders(secretKey),
    body: params
  });
  const updatedSubscription = (await updateResponse.json()) as StripeSubscriptionResponse;

  if (!updateResponse.ok || !updatedSubscription.id) {
    throw new Error(updatedSubscription.error?.message ?? "Stripe subscription could not be updated.");
  }

  return {
    id: updatedSubscription.id,
    status: updatedSubscription.status ?? "active",
    currentPeriodEnd: toTimestamp(updatedSubscription.current_period_end)
  };
}

export async function cancelStripeSubscription(secretKey: string, subscriptionId: string): Promise<UpdatedStripeSubscription> {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    headers: getStripeHeaders(secretKey)
  });
  const subscription = (await response.json()) as StripeSubscriptionResponse;

  if (!response.ok || !subscription.id) {
    throw new Error(subscription.error?.message ?? "Stripe subscription could not be cancelled.");
  }

  return {
    id: subscription.id,
    status: subscription.status ?? "canceled",
    currentPeriodEnd: toTimestamp(subscription.current_period_end)
  };
}
