import type { Metadata } from "next";
import { EnterpriseLegalPage, type LegalSection } from "@/components/enterprise/enterprise-legal-page";

export const metadata: Metadata = {
  title: "JobsAI Enterprise Terms of Service & acceptable use",
  description: "The terms that govern use of the JobsAI Enterprise talent acquisition platform — your account, acceptable use, subscriptions, data, and liability.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "These terms & who they cover",
    body: [
      `These Terms of Service ("Terms") govern access to and use of the JobsAI Enterprise platform, including applicant tracking, recruiting CRM, AI sourcing, AI interviews, outreach campaigns, workflow automation, and analytics (the "Services"). They apply to the organization that subscribes (the "Customer") and to each authorized user the Customer invites. By using the Services you agree to these Terms and to our Privacy Policy.`,
      "Where the Customer and JobsAI have signed a separate written agreement or order form, that agreement controls to the extent it conflicts with these Terms.",
    ],
  },
  {
    heading: "Accounts, users & access",
    body: [
      "The Customer is responsible for its workspace, for the users it invites, for assigning roles and permissions, and for all activity under its account. Users must provide accurate information and keep their credentials secure. The Customer is responsible for ensuring its users comply with these Terms.",
    ],
  },
  {
    heading: "The Services",
    body: [
      "JobsAI Enterprise provides software tools for recruiting teams to source, engage, screen, interview, and hire candidates. JobsAI is a software provider — not an employer, employment agency, recruiter, or background-screening provider — and does not make hiring decisions. The Customer is solely responsible for its hiring decisions and for compliance with employment, anti-discrimination, and data-protection laws applicable to its recruiting.",
    ],
  },
  {
    heading: "Subscriptions, add-ons & billing",
    body: [
      "Paid plans are billed on a recurring basis (monthly or yearly) and renew automatically until cancelled. Some capabilities are sold as add-ons or are metered. Seat, job, and candidate limits depend on the plan. Prices are shown at checkout or on the applicable order form. Cancellation stops future renewals and takes effect at the end of the current billing period.",
    ],
  },
  {
    heading: "Refunds",
    body: [
      "Except where required by law or stated in a signed agreement, subscription and add-on fees are non-refundable once the billing period has started. If something isn't working, contact support@jobsai.work — we review requests case by case and may offer a prorated credit at our discretion.",
    ],
  },
  {
    heading: "Customer data & responsibilities",
    body: [
      "\"Customer Data\" means the data the Customer and its users submit to or generate in the Services, including candidate and contact records, communications, and configurations. The Customer retains ownership of Customer Data and is responsible for: having a lawful basis to collect and process it; the accuracy and content of candidate communications and outreach; honoring opt-out and deletion requests; and obtaining any notices or consents required from candidates.",
      "The Customer grants JobsAI a worldwide, non-exclusive license to host, process, and transmit Customer Data solely to provide, secure, and support the Services. Our handling of personal data within Customer Data is governed by our Privacy Policy and Data Processing Agreement.",
    ],
  },
  {
    heading: "Acceptable use",
    body: ["The Customer and its users agree not to:"],
    bullets: [
      "Use the Services to send unlawful, deceptive, harassing, or unsolicited bulk communications, or to violate anti-spam or marketing laws.",
      "Use candidate data for purposes incompatible with recruiting, or sell or unlawfully share it.",
      "Make hiring or screening decisions that unlawfully discriminate, or rely solely on automated outputs where the law requires human review.",
      "Upload malware, attempt to breach security, reverse engineer the Services, or exceed plan limits through circumvention.",
      "Scrape the Services at scale or use them to build a competing dataset or product.",
    ],
  },
  {
    heading: "AI features & human oversight",
    body: [
      "Features that use AI — candidate scoring and recommendations, AI sourcing, AI-generated outreach and interview content, and AI interviews — may produce inaccurate, incomplete, or unsuitable output. AI output is provided for the Customer's review and is not professional, legal, or employment advice. The Customer is responsible for human review of AI output before relying on it, and for ensuring its use of AI in hiring complies with applicable law. JobsAI makes no guarantee of hiring outcomes.",
    ],
  },
  {
    heading: "Integrations & connected systems",
    body: [
      "The Services may connect to third-party systems the Customer chooses (e.g. an ATS, calendar, or email provider). We do not control those systems and are not responsible for their availability, terms, or data practices. The Customer is responsible for its rights to connect such systems and for the data exchanged.",
    ],
  },
  {
    heading: "Operational safeguards",
    body: [
      "To protect platform health, deliverability, and other customers, we may queue, batch, rate-limit, delay, cap, or decline requests and automated sends, including outreach campaign volume.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "All content and software in the Services, other than Customer Data, belongs to JobsAI or its licensors and is protected by intellectual property laws. The Customer may not copy, modify, distribute, or create derivative works without our written consent. Feedback you provide may be used by us without restriction.",
    ],
  },
  {
    heading: "Confidentiality",
    body: [
      "Each party may receive confidential information from the other. The receiving party will use it only to perform under these Terms and will protect it with reasonable care. This does not apply to information that is public, independently developed, or rightfully obtained without a duty of confidentiality.",
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
      "To the fullest extent permitted by law, neither party is liable for indirect, incidental, consequential, or punitive damages, or for lost profits or data. JobsAI's total liability for any claim is limited to the fees the Customer paid for the Services in the 12 months before the claim, except for liabilities that cannot be limited by law.",
    ],
  },
  {
    heading: "Indemnification",
    body: [
      "The Customer agrees to defend and indemnify JobsAI against claims arising from its use of the Services, its Customer Data, its recruiting and hiring practices, its breach of these Terms, or its violation of a third party's rights or applicable law.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "Either party may terminate as set out in the applicable plan or order form. We may suspend or terminate access for breach of these Terms, risk to the Services or others, or non-payment. On termination, the Customer may export its Customer Data for a reasonable period, after which we may delete it. Provisions that by their nature should survive termination will survive.",
    ],
  },
  {
    heading: "Changes to the Services & to these Terms",
    body: [
      "We may modify or discontinue features, and we may update these Terms. For material changes we will provide notice and update the \"Last updated\" date; continued use after changes take effect means the Customer accepts them.",
    ],
  },
  {
    heading: "Governing law",
    body: [
      "These Terms are governed by the laws applicable where the operator of JobsAI Enterprise is established, without regard to conflict-of-laws rules, and subject to any mandatory protections available to the Customer locally.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these Terms? Contact us at support@jobsai.work."],
  },
];

export default function EnterpriseTermsPage() {
  return (
    <EnterpriseLegalPage
      title="Terms of Service"
      updated="June 13, 2026"
      intro="Please read these Terms carefully. They govern use of the JobsAI Enterprise platform by employers and recruiting teams."
      sections={SECTIONS}
    />
  );
}
