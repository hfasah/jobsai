import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Privacy Policy · ${APP_NAME}`,
  description: `How ${APP_NAME} (jobsai.work) collects, uses, and protects your personal data.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      `${APP_NAME} ("we", "us", "our") operates the website at jobsai.work, the ${APP_NAME} web app, the browser extension, and related tools including Auto-Apply and Interview Buddy. We are the controller of the personal data described in this policy.`,
      "For any privacy question or to exercise your rights, contact us at support@jobsai.work.",
    ],
  },
  {
    heading: "Scope",
    body: [
      "This policy covers personal data we process through our website, apps, browser extension, the Interview Buddy and Auto-Apply features, and our marketing communications. It does not cover third-party sites we link to.",
    ],
  },
  {
    heading: "Data we collect",
    body: ["We collect the following categories of data:"],
    bullets: [
      "Account & contact details — your name and email, managed through our authentication provider (Clerk).",
      "Job-search materials — resumes/CVs you upload or build, parsed profile fields, cover letters, and tailored documents.",
      "Application data — the jobs you save, the answers and materials submitted via Auto-Apply, and application status.",
      "Interview prep data — for voice, avatar, and Interview Buddy sessions: audio you provide and the resulting transcripts and feedback.",
      "Usage & technical data — device, browser, IP, log and diagnostic data used to keep the service reliable and secure.",
      "Billing data — subscription and token-purchase records (card details are handled directly by Stripe; we never store full card numbers).",
      "Preferences — your job targets, locations, and marketing choices.",
    ],
  },
  {
    heading: "How we use your data",
    body: ["We use your data to:"],
    bullets: [
      "Provide and operate the service — parse and tailor resumes, generate cover letters, discover and match jobs, and prepare/submit applications you request.",
      "Power interview prep — run written, voice, avatar, and live Interview Buddy assistance.",
      "Process payments and manage your subscription and token balance.",
      "Improve reliability, security, and product quality.",
      "Send service messages, and — only with your consent — marketing emails.",
      "Detect, prevent, and address fraud, abuse, and security issues, and to comply with law.",
    ],
  },
  {
    heading: "AI processing & model providers",
    body: [
      "Some features send the minimum necessary content (e.g. your resume profile and a job description) to AI providers such as OpenAI to generate outputs. We instruct providers not to use your content to train their models, and outputs are stored only in your account for as long as needed to deliver the feature.",
      "Job listings and salary data are retrieved from third-party job data providers (e.g. Adzuna and other aggregators) based on your searches.",
    ],
  },
  {
    heading: "Automation & Auto-Apply",
    body: [
      "Auto-Apply fills and submits application forms on your behalf, following your saved preferences and the materials you provide. It carries out instructions you configure rather than making independent decisions about you with legal effect. You can keep a human in the loop at all times using the Approval Queue, which holds each application for your review before anything is sent.",
    ],
  },
  {
    heading: "Audio & transcripts (Interview Buddy and voice features)",
    body: [
      "When you use voice, avatar, or live Interview Buddy features, audio is processed to produce a transcript and feedback. Raw audio is used to generate the transcript and is not retained longer than necessary for that purpose; transcripts and scores are kept in your account so you can review them, until you delete them.",
      "The desktop Interview Buddy app captures audio from your interviewer (system audio), not your microphone, to surface real-time guidance.",
    ],
  },
  {
    heading: "“As provided” transmission",
    body: [
      "Application materials are transmitted to job platforms substantially as you provide them; we do not redact them. Please do not include sensitive data (such as government IDs, payment card numbers, or health information) in your resume or answers unless a specific application explicitly requires it.",
    ],
  },
  {
    heading: "How we share data",
    body: [
      "We do not sell or rent your personal data. We share it only as needed to run the service:",
    ],
    bullets: [
      "Service providers (processors) acting on our behalf — e.g. Clerk (authentication), Supabase (database/storage), OpenAI (AI generation), Stripe (payments), Resend (email), and job-data providers such as Adzuna.",
      "Job platforms and employer application systems (ATS) when you apply or auto-apply to a role.",
      "Authorities or third parties when required by law, or to protect our rights, users, or the security of the service.",
    ],
  },
  {
    heading: "International transfers",
    body: [
      "Our providers may process data in the United States and other countries. Where data is transferred across borders, we rely on appropriate safeguards (such as Standard Contractual Clauses) offered by our providers.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "We keep account and job-search data for as long as your account is active. Logs and diagnostics are kept for a limited period (typically up to 12–24 months). Interview transcripts are kept until you delete them or close your account. When you delete data or your account, we remove it from active systems and purge it from backups within a reasonable period.",
    ],
  },
  {
    heading: "Cookies & similar technologies",
    body: [
      "We use cookies and similar technologies for sign-in/session management, remembering preferences, and basic analytics to understand and improve usage. You can control cookies through your browser settings.",
    ],
  },
  {
    heading: "Security",
    body: [
      "We use reasonable technical and organizational measures to protect your data, including encryption in transit and at rest and access controls. Our database/storage provider (Supabase) maintains SOC 2 Type II controls. No method of transmission or storage is 100% secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on where you live, you may have the right to access, correct, delete, restrict, or object to our processing of your data, and to data portability. Where we rely on consent, you can withdraw it at any time. To exercise any right, email support@jobsai.work. You may also have the right to complain to your local data protection authority.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Our services are not directed to children, and we do not knowingly collect data from anyone under the age of digital consent. If you believe a child has provided us data, contact support@jobsai.work and we will delete it.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this policy from time to time. We will revise the “Last updated” date above and, for material changes, provide additional notice where required.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 4, 2026"
      intro={`This Privacy Policy explains how ${APP_NAME} collects, uses, shares, and protects your personal data when you use jobsai.work and our apps and features.`}
      sections={SECTIONS}
    />
  );
}
