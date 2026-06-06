// Enterprise account templates. Admin picks one, then customizes per client.
export interface OrgTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  brand_color: string;
  tagline: string;
  careers_intro: string;
  email_templates: { trigger: string; subject: string; body: string }[];
  sample_pools?: boolean;
  onboarding_steps: string[];
}

const COMMON_STEPS = [
  "Sign in with the owner email and accept the workspace",
  "Settings → Branding: upload your logo and set your brand color",
  "Post your first job (or sync from your ATS / a job feed)",
  "Settings → Team: invite your recruiters",
  "Job Boards: connect your feed to Indeed / ZipRecruiter / Google for Jobs",
  "Review auto-screened candidates in the pools, then run interviews",
];

export const ORG_TEMPLATES: OrgTemplate[] = [
  {
    id: "tech",
    name: "Tech Company",
    description: "Software, SaaS, engineering-heavy hiring.",
    industry: "Technology",
    brand_color: "#2563EB",
    tagline: "Build the future with us",
    careers_intro: "We're a fast-moving technology team solving hard problems. Explore our open engineering, product, and go-to-market roles below.",
    email_templates: [
      { trigger: "application_received", subject: "We received your application — {{job_title}}", body: "Hi {{candidate_name}},\n\nThanks for applying to {{job_title}} at {{org_name}}. Our team reviews every application carefully and we'll be in touch soon.\n\n{{org_name}} Talent" },
    ],
    sample_pools: true,
    onboarding_steps: COMMON_STEPS,
  },
  {
    id: "staffing",
    name: "Staffing / Recruiting Agency",
    description: "High-volume, multi-client recruiting.",
    industry: "Staffing & Recruiting",
    brand_color: "#7C3AED",
    tagline: "Connecting great people with great companies",
    careers_intro: "We place talented professionals into roles they love. Browse current openings across our client base.",
    email_templates: [
      { trigger: "application_received", subject: "Application received — {{job_title}}", body: "Hi {{candidate_name}},\n\nThank you for your interest in {{job_title}}. One of our recruiters will review your profile and reach out about next steps.\n\n{{org_name}}" },
    ],
    sample_pools: true,
    onboarding_steps: COMMON_STEPS,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Clinical and care-team hiring with compliance needs.",
    industry: "Healthcare",
    brand_color: "#0EA5E9",
    tagline: "Compassionate care starts with great people",
    careers_intro: "Join a team dedicated to exceptional patient care. We're hiring across clinical and support roles.",
    email_templates: [
      { trigger: "application_received", subject: "Thank you for applying — {{job_title}}", body: "Dear {{candidate_name}},\n\nWe've received your application for {{job_title}} at {{org_name}}. Given the importance of these roles, our team reviews each candidate thoroughly.\n\nWarm regards,\n{{org_name}} Recruitment" },
    ],
    onboarding_steps: COMMON_STEPS,
  },
  {
    id: "general",
    name: "General Business",
    description: "A clean, neutral starting point for any org.",
    industry: "",
    brand_color: "#2563EB",
    tagline: "",
    careers_intro: "",
    email_templates: [],
    onboarding_steps: COMMON_STEPS,
  },
];

export function getTemplate(id: string): OrgTemplate {
  return ORG_TEMPLATES.find((t) => t.id === id) ?? ORG_TEMPLATES[ORG_TEMPLATES.length - 1];
}
