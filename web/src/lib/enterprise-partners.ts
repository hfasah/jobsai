// JobsAI Enterprise Partner Program — single source of truth for the public
// partner page and the in-guide explainer. The program is the *referrer* side
// (earn commission for sending us customers); the Lifetime Offer is the
// *customer* side (a discount the referred customer receives). They stack, but
// they are different things — keep that separation clear everywhere.

export type PartnerTier = {
  level: number;
  name: string;
  requirement: string;
  rate: number; // percent of collected revenue
  blurb: string;
  perks: string[];
};

export type CommissionRow = {
  plan: string;
  monthly: string;
  earns: string; // at the entry (20%) rate
};

// Standard entry rate and how long commissions recur per referred customer.
export const PARTNER_BASE_RATE = 20;
export const PARTNER_COMMISSION_MONTHS = 12;
export const PARTNER_ATTRIBUTION_DAYS = 90;
export const PARTNER_PAYOUT_HOLD_DAYS = 30;
export const PARTNER_MIN_PAYOUT = "$50";

export const PARTNER_BENEFITS: { title: string; desc: string }[] = [
  { title: "Recurring commissions", desc: `Earn ${PARTNER_BASE_RATE}–30% of collected revenue for ${PARTNER_COMMISSION_MONTHS} months on every customer you refer.` },
  { title: "Partner dashboard", desc: "Track referrals, conversions, MRR generated, and earnings in real time." },
  { title: "Unique referral links", desc: `Share a personal link; we attribute signups to you for ${PARTNER_ATTRIBUTION_DAYS} days.` },
  { title: "Marketing assets", desc: "Ready-to-use decks, one-pagers, demo videos, and email copy." },
  { title: "Priority support", desc: "A direct line for you and the customers you bring on." },
  { title: "Co-selling", desc: "Join us on demos and proposals for larger accounts." },
  { title: "Early access", desc: "Preview and influence new features before general release." },
];

// Commission shown at the entry (20%) rate, on list price, for illustration.
export const COMMISSION_TABLE: CommissionRow[] = [
  { plan: "Professional", monthly: "$299", earns: "$59.80/mo" },
  { plan: "Agency", monthly: "$799", earns: "$159.80/mo" },
  { plan: "Business", monthly: "$1,499", earns: "$299.80/mo" },
];

export const PARTNER_TIERS: PartnerTier[] = [
  {
    level: 1,
    name: "Recruiting Partner",
    requirement: "1–4 active customers",
    rate: 20,
    blurb: "Start earning the moment your first referral converts.",
    perks: ["Unique referral link", "Partner dashboard", "Marketing assets"],
  },
  {
    level: 2,
    name: "Growth Partner",
    requirement: "5+ active customers",
    rate: 25,
    blurb: "A higher rate kicks in as your book of business grows.",
    perks: ["Everything in Referral", "25% commission rate", "Priority partner support", "Co-selling on demos"],
  },
  {
    level: 3,
    name: "Strategic Partner",
    requirement: "20+ active customers",
    rate: 30,
    blurb: "Our top tier, for partners building a real channel with us.",
    perks: ["Everything in Growth", "30% commission rate", "Co-marketing & joint webinars", "Dedicated partner manager"],
  },
];

// The rules that keep Lifetime Offer + Partner Program from over-discounting.
export const PARTNER_RULES: { label: string; detail: string }[] = [
  {
    label: "Commission is paid on collected revenue — never list price",
    detail: "If a customer pays a discounted rate (e.g. the Lifetime Offer), your commission is a percentage of what they actually pay, not the sticker price. This is what makes stacking sustainable for everyone.",
  },
  {
    label: "The two programs stack",
    detail: "A customer you refer can still claim the Lifetime Offer (50% off for life). You earn commission on their discounted invoice for 12 months.",
  },
  {
    label: `${PARTNER_ATTRIBUTION_DAYS}-day attribution`,
    detail: `We credit you when someone signs up within ${PARTNER_ATTRIBUTION_DAYS} days of clicking your link (last-touch). The link survives the trial, so trial-to-paid still counts.`,
  },
  {
    label: "Paid only after the customer pays",
    detail: `Commissions accrue when an invoice is successfully collected and are released after a ${PARTNER_PAYOUT_HOLD_DAYS}-day hold. Refunds or chargebacks reverse the matching commission.`,
  },
  {
    label: "Monthly payouts",
    detail: `We pay out monthly once your cleared balance passes ${PARTNER_MIN_PAYOUT}. Your tier rate applies to commissions earned while you hold that tier.`,
  },
];

// How the customer-side Lifetime Offer and the partner-side commission interact.
export const STACKING_EXAMPLE = {
  plan: "Agency",
  list: "$799",
  customerPays: "$399", // Lifetime Offer, 50% off
  rate: PARTNER_BASE_RATE,
  partnerMonthly: "$79.80", // 20% of $399
  partnerTotal: "$957.60", // × 12 months
};

export const PARTNER_FAQ: { q: string; a: string }[] = [
  {
    q: "Who can become a partner?",
    a: "Recruiting consultants, HR advisors, agency owners, fractional CHROs, recruiter coaches, podcasters, and anyone with an audience of people who hire. You don't need to be a customer.",
  },
  {
    q: "How do customers get the Lifetime Offer?",
    a: "The Lifetime Offer (50% off for life) is applied at checkout for eligible early customers. Your referral doesn't change it — they get the discount, and you still earn commission on what they pay.",
  },
  {
    q: "When and how do I get paid?",
    a: `Commissions accrue as your referred customers pay, clear after a ${PARTNER_PAYOUT_HOLD_DAYS}-day hold, and pay out monthly once your balance passes ${PARTNER_MIN_PAYOUT}.`,
  },
  {
    q: "How long do commissions last?",
    a: `${PARTNER_COMMISSION_MONTHS} months per referred customer, for as long as they keep paying within that window.`,
  },
];
