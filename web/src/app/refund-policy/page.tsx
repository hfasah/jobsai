import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Refund & Credit Policy · ${APP_NAME}`,
  description: `How ${APP_NAME} handles refunds, credits, and compensation for technical or support issues.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Our approach",
    body: [
      `At ${APP_NAME} we want every user to feel taken care of. When something goes wrong — a technical glitch, a confusing experience, or a support issue — our first remedy is to make it right with account credits (tokens), quickly and generously.`,
      "Money refunds are reserved for exceptional cases (see below). For everything else, credits are faster, and you keep using the tools you came for.",
    ],
  },
  {
    heading: "Credits (our default remedy)",
    body: [
      "We may grant account credits (tokens) at our discretion to:",
    ],
    bullets: [
      "Compensate for a technical problem or outage that affected your experience.",
      "Resolve a support issue or a feature that didn't work as expected.",
      "Recognize a loyal customer or simply make things right.",
    ],
  },
  {
    heading: "Credits — the details",
    body: [
      "Credits are added directly to your account balance and can be used across all AI features (résumé tailoring, cover letters, ATS scans, and voice/avatar interview prep).",
      "Credits have no cash value, are non-transferable, and are not redeemable for money. They don't expire while your account is active.",
    ],
  },
  {
    heading: "Free trial",
    body: [
      "New customers get a one-time 7-day free trial (500 credits) with a credit card on file. You are not charged during the trial. Cancel anytime before the trial ends — in one click from Billing — and you pay nothing at all.",
      "If you don't cancel, your selected plan starts automatically when the trial ends and the plan price is charged to your card, as disclosed when you started the trial. Charges after a trial you chose not to cancel are valid charges and are not refundable as \"unwanted trial conversions\" — set a reminder if you're unsure.",
    ],
  },
  {
    heading: "Subscriptions",
    body: [
      "Plans are billed in advance (monthly or yearly). You can cancel anytime — you keep access until the end of the current billing period, and you won't be charged again.",
      "We generally do not provide partial-period refunds for subscriptions. If you were charged in error or hit a serious issue, contact us — we'll make it right, usually with credits and, where warranted, a money refund.",
    ],
  },
  {
    heading: "Token top-ups",
    body: [
      "One-time token purchases are consumable. Once tokens have been used they are non-refundable. Unused tokens from a recent purchase may be refunded as credits at our discretion.",
    ],
  },
  {
    heading: "Exceptional money refunds",
    body: [
      "We may issue a refund to your original payment method in exceptional circumstances, at our discretion, such as:",
    ],
    bullets: [
      "A duplicate or accidental charge.",
      "A billing error on our side.",
      "A significant technical failure we could not resolve with credits.",
    ],
  },
  {
    heading: "How to request help",
    body: [
      "Email support@jobsai.work (or use in-app support) with your account email and a short description of the issue. We aim to respond within 1–2 business days.",
      "Money refunds, when approved, are processed via Stripe to your original payment method and typically appear within 5–10 business days.",
    ],
  },
  {
    heading: "Chargebacks",
    body: [
      "If you have a billing concern, please contact us first — we can almost always resolve it faster than a bank dispute. Initiating a chargeback without contacting us may result in suspension of the account while the dispute is reviewed.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Credit Policy"
      updated="June 2026"
      sections={SECTIONS}
    />
  );
}
