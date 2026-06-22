import type { Metadata } from "next";
import { EnterpriseLegalPage, type LegalSection } from "@/components/enterprise/enterprise-legal-page";

export const metadata: Metadata = {
  title: "JobsAI Enterprise Privacy Policy & data practices",
  description:
    "How JobsAI Enterprise collects, uses, and protects data for recruiting teams and the candidates they manage.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      `JobsAI Enterprise ("JobsAI", "we", "us", "our") provides an AI-powered talent acquisition platform — applicant tracking, recruiting CRM, AI sourcing, AI interviews, outreach, workflow automation, and analytics — to employers, recruiting agencies, and staffing firms (each a "Customer").`,
      "This policy explains how we handle personal data across the JobsAI Enterprise platform. For any privacy question, contact us at support@jobsai.work.",
    ],
  },
  {
    heading: "Controller and processor roles",
    body: [
      "For the personal data of candidates and contacts that a Customer uploads, sources, or manages in the platform, the Customer is the data controller and JobsAI acts as a data processor, processing that data on the Customer's instructions to provide the service. A Data Processing Agreement (DPA) is available on request and forms part of our agreement with Customers.",
      "For account, billing, and platform-usage data of our Customers and their users, JobsAI is the controller. This policy describes both relationships.",
    ],
  },
  {
    heading: "Data we process",
    body: ["Depending on how the platform is configured, we process:"],
    bullets: [
      "Customer account & user data — recruiter and admin names, work emails, roles and permissions, managed through our authentication provider (Clerk).",
      "Candidate & contact data — names, contact details, resumes/CVs, parsed profile fields, application and pipeline status, notes, scores, and communications managed by the Customer.",
      "Sourcing & outreach data — sourced candidate profiles, outreach campaign enrollments, email subject lines, and send/open/reply tracking.",
      "Interview data — for AI voice and avatar interviews: audio provided by participants and the resulting transcripts, scores, and feedback.",
      "Integration data — information exchanged with connected systems (e.g. ATS, calendar, email) at the Customer's direction.",
      "Billing data — subscription and invoicing records (card details are handled directly by Stripe; we never store full card numbers).",
      "Usage & technical data — device, browser, IP, log and diagnostic data used to keep the service reliable and secure.",
    ],
  },
  {
    heading: "How we use data",
    body: ["We use data to:"],
    bullets: [
      "Provide and operate the platform — tracking, screening, scoring, sourcing, scheduling, interviewing, outreach, and reporting at the Customer's direction.",
      "Power AI features — candidate scoring and recommendations, AI sourcing, AI-generated outreach and interview content, and AI interviews.",
      "Process payments and manage Customer subscriptions and add-ons.",
      "Maintain reliability, security, and product quality.",
      "Send service messages, and — only with consent — marketing emails to Customers.",
      "Detect, prevent, and address fraud, abuse, and security issues, and to comply with law.",
    ],
  },
  {
    heading: "AI processing & model providers",
    body: [
      "Certain features send the minimum necessary content (for example, a job description, a candidate summary, or a draft message) to AI providers to generate outputs. Depending on the feature these include OpenAI (candidate scoring, sourcing relevance, outreach and interview-content generation, and voice processing) and HeyGen/LiveAvatar (the streaming video presenter used in avatar interviews). We instruct providers not to use Customer or candidate content to train their models, and outputs are stored in the Customer's workspace only for as long as needed to deliver the feature.",
      "Outreach Campaigns may use AI to personalize individual emails at send time; this is configurable per step and can be turned off.",
    ],
  },
  {
    heading: "Candidate communications & tracking",
    body: [
      "When a Customer sends outreach or campaign emails through the platform, we deliver those messages and may record delivery, open, and reply signals so the Customer can measure engagement and manage follow-ups. Candidates can ask to be removed, and Customers are responsible for honoring opt-outs and for the lawful basis of their outreach.",
    ],
  },
  {
    heading: "How we share data",
    body: ["We do not sell or rent personal data. We share it only as needed to run the service:"],
    bullets: [
      "Service providers (sub-processors) acting on our behalf — e.g. Clerk (authentication), Supabase (database/storage), OpenAI (AI text and voice generation), HeyGen/LiveAvatar (avatar interviews), Stripe (payments), Resend (transactional email), Merge.dev (ATS integrations, where enabled), and PostHog (product analytics).",
      "Connected systems chosen by the Customer (e.g. their ATS, calendar, or email provider) when integrations are enabled.",
      "Authorities or third parties when required by law, or to protect our rights, our Customers, or the security of the service.",
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
      "We retain Customer workspace data for as long as the Customer's account is active, and according to any retention policies the Customer configures. Logs and diagnostics are kept for a limited period (typically up to 12–24 months). When a Customer deletes data or closes the account, we remove it from active systems and purge it from backups within a reasonable period, subject to legal retention requirements.",
    ],
  },
  {
    heading: "Security",
    body: [
      "We use reasonable technical and organizational measures to protect data, including encryption in transit and at rest, access controls, and role-based permissions. Our database/storage provider (Supabase) maintains SOC 2 Type II controls. No method of transmission or storage is 100% secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "Candidate and individual rights",
    body: [
      "Individuals whose data is processed in the platform may have rights to access, correct, delete, restrict, or object to processing, and to data portability. Because JobsAI typically acts as a processor for candidate data, requests from candidates are generally directed to the Customer that controls that data; we will assist Customers in responding. For data where JobsAI is the controller, email support@jobsai.work to exercise your rights. You may also complain to your local data protection authority.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this policy from time to time. We will revise the \"Last updated\" date above and, for material changes, provide additional notice where required.",
    ],
  },
];

export default function EnterprisePrivacyPage() {
  return (
    <EnterpriseLegalPage
      title="Privacy Policy"
      updated="June 13, 2026"
      intro="This Privacy Policy explains how JobsAI Enterprise collects, uses, shares, and protects personal data when employers and recruiting teams use our platform."
      sections={SECTIONS}
    />
  );
}
