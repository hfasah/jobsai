// JobsAI Enterprise referral economics — single source of truth for the public
// partner page and the in-guide explainer.
//
// There are TWO distinct programs for two different audiences:
//   1. Customer Referral Program — for existing customers. Reward = account
//      CREDITS applied to their invoice. No cash leaves the bank.
//   2. Partner Program — for consultants, agencies, fractional CHROs, podcast
//      guests, and influencers. Reward = real CASH commission, paid out monthly.
// Keep that split crystal clear everywhere — partners building a business expect
// money, not credits.

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
  earns: string; // at the entry rate
};

// ── Partner Program (cash) ──────────────────────────────────────────────────
export const PARTNER_BASE_RATE = 20; // standard entry rate
export const FOUNDING_PARTNER_RATE = 25; // locked rate for early partners
export const FOUNDING_PARTNER_LIMIT = 25; // first N partners
export const PARTNER_COMMISSION_MONTHS = 12;
export const PARTNER_ATTRIBUTION_DAYS = 90;
export const PARTNER_PAYOUT_HOLD_DAYS = 30;
export const PARTNER_MIN_PAYOUT = "$500"; // accrue, then pay out past this threshold

// ── Customer Referral Program (credits) ─────────────────────────────────────
export const REFERRAL_CREDIT_MIN = "$100";
export const REFERRAL_CREDIT_MAX = "$500";

// The two-program comparison shown up top so visitors self-select.
export const PROGRAM_COMPARISON: {
  name: string;
  audience: string;
  reward: string;
  rewardType: "Cash" | "Credits";
  detail: string;
}[] = [
  {
    name: "Partner Program",
    audience: "Consultants, agencies, fractional CHROs, podcast guests & influencers",
    reward: `${PARTNER_BASE_RATE}–30% recurring commission for ${PARTNER_COMMISSION_MONTHS} months`,
    rewardType: "Cash",
    detail: "Real money, paid out monthly to your bank via Stripe. Built for people who can send multiple customers.",
  },
  {
    name: "Customer Referral Program",
    audience: "Existing JobsAI Enterprise customers",
    reward: `${REFERRAL_CREDIT_MIN}–${REFERRAL_CREDIT_MAX} account credit per referral`,
    rewardType: "Credits",
    detail: "A credit applied to your next invoice when a company you refer becomes a customer. No payout to set up.",
  },
];

export const PARTNER_BENEFITS: { title: string; desc: string }[] = [
  { title: "Real cash commissions", desc: `Earn ${PARTNER_BASE_RATE}–30% of collected revenue, in cash, for ${PARTNER_COMMISSION_MONTHS} months on every customer you refer.` },
  { title: "Monthly payouts to your bank", desc: "Get paid via Stripe — not platform credits. Onboard once and payouts run automatically." },
  { title: "Partner dashboard", desc: "Track referrals, conversions, earnings, and payout status in real time." },
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
    perks: ["Everything in Recruiting", "25% commission rate", "Priority partner support", "Co-selling on demos"],
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

// The rules that keep credits, cash, and the Lifetime Offer from over-discounting.
export const PARTNER_RULES: { label: string; detail: string }[] = [
  {
    label: "Partners are paid in cash, customers earn credits",
    detail: "The Partner Program pays real money via Stripe. The separate Customer Referral Program rewards existing customers with invoice credits. Different audiences, different rewards.",
  },
  {
    label: "Commission is paid on collected revenue — never list price",
    detail: "If a customer pays a discounted rate (e.g. the Lifetime Offer), your commission is a percentage of what they actually pay, not the sticker price. That's what makes stacking sustainable.",
  },
  {
    label: "The programs stack",
    detail: "A customer you refer can still claim the Lifetime Offer (50% off for life). You earn cash commission on their discounted invoice for 12 months.",
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
    label: `Payouts start at ${PARTNER_MIN_PAYOUT}`,
    detail: `Your earnings accrue in the dashboard and pay out monthly once your cleared balance passes ${PARTNER_MIN_PAYOUT} — so we're not sending dozens of tiny payments.`,
  },
];

// How the customer-side Lifetime Offer and the partner-side cash commission
// interact — using the Founding Partner rate (25%).
export const STACKING_EXAMPLE = {
  plan: "Agency",
  list: "$799",
  customerPays: "$399", // Lifetime Offer, 50% off
  rate: FOUNDING_PARTNER_RATE,
  partnerMonthly: "$99.75", // 25% of $399
  partnerTotal: "$1,197", // × 12 months
};

export const PARTNER_FAQ: { q: string; a: string }[] = [
  {
    q: "Who is the Partner Program for?",
    a: "Recruiting consultants, HR advisors, agency owners, fractional CHROs, recruiter coaches, podcasters, and anyone with an audience of people who hire. You don't need to be a customer.",
  },
  {
    q: "Cash or credits?",
    a: "Cash. The Partner Program pays real money to your bank via Stripe. (Existing customers who refer a company earn invoice credits through the separate Customer Referral Program.)",
  },
  {
    q: "How and when do I get paid?",
    a: `Commissions accrue as your referred customers pay, clear after a ${PARTNER_PAYOUT_HOLD_DAYS}-day hold, and pay out monthly once your balance passes ${PARTNER_MIN_PAYOUT}.`,
  },
  {
    q: "What's the Founding Partner deal?",
    a: `The first ${FOUNDING_PARTNER_LIMIT} partners lock in a ${FOUNDING_PARTNER_RATE}% commission rate for ${PARTNER_COMMISSION_MONTHS} months — above the standard ${PARTNER_BASE_RATE}% entry rate.`,
  },
  {
    q: "How long do commissions last?",
    a: `${PARTNER_COMMISSION_MONTHS} months per referred customer, for as long as they keep paying within that window.`,
  },
];
