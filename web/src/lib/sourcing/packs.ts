// Credit top-up packs (one-time purchases). Client-safe constants — prices in
// USD cents for Stripe price_data. Adjust freely; the checkout route builds
// the Stripe line item from this catalog, no Stripe product setup needed.
export interface CreditPack {
  key: string;
  credits: number;
  amount_cents: number;
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { key: "pack_100", credits: 100, amount_cents: 2900, label: "100 credits" },
  { key: "pack_500", credits: 500, amount_cents: 9900, label: "500 credits" },
  { key: "pack_2000", credits: 2000, amount_cents: 29900, label: "2,000 credits" },
  { key: "pack_10000", credits: 10000, amount_cents: 99900, label: "10,000 credits" },
];

export function getPack(key: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.key === key) ?? null;
}
