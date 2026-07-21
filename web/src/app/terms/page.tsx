import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Terms of Service · ${APP_NAME}`,
  description: `The terms that govern your use of ${APP_NAME} (jobsai.work).`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are & what these terms cover",
    body: [
      `These Terms of Service ("Terms") govern your use of ${APP_NAME} at jobsai.work, our web app, browser extension, and features including Auto-Apply and Interview Buddy (together, the "Services"). By using the Services you agree to these Terms and to our Privacy Policy.`,
    ],
  },
  {
    heading: "Eligibility & accounts",
    body: [
      "You must meet the age of digital consent in your country to use the Services (with parental consent if required). You agree to provide accurate information, keep your account credentials secure, and are responsible for activity under your account.",
    ],
  },
  {
    heading: "The Services",
    body: [
      `${APP_NAME} provides software tools to help you find jobs and prepare and submit applications, including resume building/optimization, ATS scoring, cover letters, job discovery and matching, Auto-Apply, and interview preparation. ${APP_NAME} is software, not an employment agency, recruiter, or career advisor.`,
    ],
  },
  {
    heading: "Free trial & payment method requirement",
    body: [
      "Using the Services requires a subscription with a valid payment method on file. New customers may be offered a one-time 7-day free trial that includes a limited credit allowance (currently 500 credits). A credit card is required to start the trial; you will not be charged during the trial period.",
      "Unless you cancel before the trial ends, your selected plan starts automatically at the end of the trial and your payment method is charged the plan price shown at checkout. You can cancel during the trial in one click from your billing settings, in which case you pay nothing. Free trials are limited to one per customer; eligibility is verified against prior subscription history.",
    ],
  },
  {
    heading: "Subscriptions, tokens, billing & renewals",
    body: [
      "Paid plans are billed on a recurring basis (monthly or yearly) and renew automatically until cancelled. Some advanced features are metered using tokens included with your plan or purchased as top-ups. Prices are shown at checkout. You can cancel anytime from your billing settings; cancellation stops future renewals and takes effect at the end of the current period.",
    ],
  },
  {
    heading: "Refunds",
    body: [
      "Except where required by law, subscription fees and token purchases are non-refundable once the billing period has started or tokens have been used. If something isn't working, contact support@jobsai.work first. We review refund requests case by case and may offer a prorated refund or credit at our discretion.",
    ],
  },
  {
    heading: "Acceptable use",
    body: ["You agree not to:"],
    bullets: [
      "Infringe others' intellectual property or privacy, or harass, defame, or impersonate anyone.",
      "Upload malware, attempt to breach security, or reverse engineer the Services.",
      "Scrape the Services at scale or use them to build a competing dataset or product.",
      "Misrepresent your identity, qualifications, work authorization, or other facts in applications.",
      "Use the Services for any unlawful purpose or in violation of a third-party platform's terms.",
    ],
  },
  {
    heading: "Fair use & operational safeguards",
    body: [
      "To protect platform health, deliverability, and other users, we may queue, batch, space out, delay, cap, or decline requests and automated submissions.",
    ],
  },
  {
    heading: "Your content & license",
    body: [
      "You retain ownership of the resumes, answers, and other materials you provide (\"User Content\"). You grant us a worldwide, non-exclusive, royalty-free license to host, process, and transmit your User Content solely to operate and improve the Services and to perform the actions you request (such as submitting applications). If you send us feedback, you grant us a perpetual license to use it.",
    ],
  },
  {
    heading: "Auto-Apply & third-party platforms",
    body: [
      "Auto-Apply acts on your instructions to submit applications to job platforms and employer systems. We do not control those platforms, their terms, or their stance on automation, and you are responsible for ensuring your use complies with them. We are not liable for a platform's decision to accept, reject, throttle, or restrict your applications or account.",
    ],
  },
  {
    heading: "Connected accounts & credentials",
    body: [
      "Where you connect a third-party account or provide credentials/tokens, you confirm you are entitled to do so and authorize us to use them only to perform the actions you request. We may revoke or invalidate stored tokens for security or abuse reasons.",
    ],
  },
  {
    heading: "AI output",
    body: [
      "Features that use AI may produce inaccurate, incomplete, or unsuitable output. AI output is provided for your review and is not professional, legal, or career advice. You are responsible for reviewing and approving any materials before they are submitted. Employers may use AI-detection tools, and we make no guarantees about outcomes.",
    ],
  },
  {
    heading: "No guarantee of outcomes",
    body: [
      `${APP_NAME} helps you apply faster and prepare better, but we do not guarantee interviews, offers, hiring outcomes, or timelines, except where a specific written guarantee (such as the 90-day interview guarantee below) applies on its stated terms.`,
    ],
  },
  {
    heading: "90-day interview guarantee",
    body: [
      "The 90-day interview guarantee applies only to the Career Accelerator plan. It does not apply to the Free, Pro, or Premium plans. If you are on Career Accelerator and you do not receive a single interview within 90 days of actively using the platform, we will refund the Career Accelerator subscription fees you paid for that period.",
      "An \"interview\" means a scheduled interview or screening invitation from an employer or their recruiter (a phone/video screen or any later stage). Automated rejections do not count, and neither do interviews you decline or do not attend.",
      "To qualify, during the 90 days you must: keep an active, paid Career Accelerator subscription for the full 90 consecutive days; complete your setup within the first 7 days (at least one résumé, your apply profile, and your job preferences); keep auto-apply enabled and running (at least 5 active days per week, without excessive blocking); keep realistic preferences for your experience level; provide truthful, complete information; and respond to and attend interview invitations you receive.",
      "To claim, email support@jobsai.work within 14 days after the 90-day period ends, including your account email. We may review your activity (applications sent, profile completeness, preferences) to confirm eligibility. We refund the Career Accelerator subscription fees for the qualifying period to your original payment method; one-time token top-ups and coaching sessions are not included. The guarantee does not apply if you cancelled or downgraded early, did not meet these conditions, set preferences so narrow that few or no matching roles existed, declined or missed interviews, or breached these Terms.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      `All content and software in the Services, other than User Content, belongs to ${APP_NAME} or its licensors and is protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written consent.`,
    ],
  },
  {
    heading: "Warranties disclaimer",
    body: [
      "The Services are provided \"as is\" and \"as available\" without warranties of any kind, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, accuracy, and non-infringement, to the fullest extent permitted by law.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the fullest extent permitted by law, we are not liable for indirect, incidental, consequential, or punitive damages, or for lost profits or data. Our total liability for any claim is limited to the greater of the amount you paid us in the 6 months before the claim, or US$100, except for liabilities that cannot be limited by law.",
    ],
  },
  {
    heading: "Indemnification",
    body: [
      "You agree to defend and indemnify us against claims arising from your use of the Services, your User Content, your breach of these Terms, misrepresentations in your applications, or your violation of a third party's rights or terms.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "You can stop using the Services and delete your account at any time. We may suspend or terminate access for breach of these Terms, risk to the Services or others, or non-payment. Provisions that by their nature should survive termination will survive.",
    ],
  },
  {
    heading: "Changes to the Services & to these Terms",
    body: [
      "We may modify or discontinue features, and we may update these Terms. For material changes to these Terms we will provide notice and update the “Last updated” date; continued use after changes take effect means you accept them.",
    ],
  },
  {
    heading: "Governing law",
    body: [
      "These Terms are governed by the laws applicable where the operator of jobsai.work is established, without regard to conflict-of-laws rules, and subject to any mandatory consumer protections available to you locally.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these Terms? Contact us at support@jobsai.work.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="June 4, 2026"
      intro={`Please read these Terms carefully. They govern your use of ${APP_NAME} at jobsai.work.`}
      sections={SECTIONS}
    />
  );
}
