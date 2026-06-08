import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `90-Day Interview Guarantee · ${APP_NAME}`,
  description: `Land an interview within 90 days on the Career Accelerator plan, or your money back. Terms and conditions.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "The promise",
    body: [
      `If you're on the Career Accelerator plan and you don't receive a single interview within 90 days of actively using ${APP_NAME}, we'll refund your Career Accelerator subscription fees for that period. We can offer this because the platform applies at a volume and quality that's hard to match by hand.`,
      "The guarantee applies to the Career Accelerator plan only. It does not apply to the Free, Pro, or Premium plans.",
    ],
  },
  {
    heading: "What counts as an interview",
    body: [
      "An \"interview\" means a scheduled interview or screening invitation from an employer or their recruiter — a phone/video screen or any later stage. Automated rejections and generic acknowledgements don't count, and neither do interviews you decline or no-show.",
    ],
  },
  {
    heading: "To qualify, you must",
    body: ["Meet all of the following during the 90 days:"],
    bullets: [
      "Maintain an active, paid Career Accelerator subscription for the full 90 consecutive days (no cancellation or downgrade in that window).",
      "Complete your setup within the first 7 days: at least one résumé uploaded, your Apply Profile completed, and your job Preferences set.",
      "Keep auto-apply enabled and let it run — at least 5 active days per week, with no extended pauses or excessive blocking of companies/roles.",
      "Keep realistic preferences for your experience level (e.g. reasonable salary expectations and a wide enough set of titles, locations, and companies for roles to exist).",
      "Provide truthful, complete résumé and profile information.",
      "Respond to and attend interview invitations you receive.",
    ],
  },
  {
    heading: "How to claim",
    body: [
      "If you met the conditions above and still received no interview within 90 days, email support@jobsai.work within 14 days after the 90-day period ends. Include your account email. We may review your activity (applications sent, profile completeness, preferences) to confirm eligibility.",
    ],
  },
  {
    heading: "What we refund",
    body: [
      "We refund the Career Accelerator subscription fees you paid for the qualifying 90-day period, to your original payment method. One-time token top-ups and coaching sessions are not included.",
    ],
  },
  {
    heading: "Exclusions",
    body: ["The guarantee doesn't apply if:"],
    bullets: [
      "You weren't on the Career Accelerator plan for the full period, or you cancelled/downgraded early.",
      "You didn't complete setup or didn't meet the activity requirements above.",
      "Your preferences were so narrow that few or no matching roles existed.",
      "You declined or didn't attend interview invitations.",
      "You provided false information or otherwise breached our Terms.",
    ],
  },
  {
    heading: "Changes",
    body: [
      `${APP_NAME} may update or withdraw this guarantee for future subscribers; the terms that applied when you subscribed govern your guarantee. Outside of this specific guarantee, ${APP_NAME} does not guarantee interviews, offers, or hiring outcomes.`,
    ],
  },
];

export default function InterviewGuaranteePage() {
  return (
    <LegalPage
      title="90-Day Interview Guarantee"
      updated="June 2026"
      intro="Career Accelerator comes with a 90-day interview guarantee: land an interview within 90 days of actively using JobsAI, or get your money back. Here's exactly how it works."
      sections={SECTIONS}
    />
  );
}
