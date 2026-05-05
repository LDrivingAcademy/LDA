export function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: process.env.STRIPE_DEFAULT_CURRENCY?.toUpperCase() || "GBP"
  }).format(pence / 100);
}

export function calculatePlatformFee(totalPence: number) {
  const commission = Number(process.env.LDA_PLATFORM_COMMISSION_PERCENT || 12);
  return Math.round(totalPence * (commission / 100));
}
