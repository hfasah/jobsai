// Optional rich marketing content per feature slug. When a slug has an entry,
// the feature page renders a split hero + FAQ; otherwise it uses the simple
// fallback layout. Add more features here over time.

export type HeadlineSeg = { t: string; tone?: "gradient" | "cta" };
export type FAQ = { q: string; a: string };

export type FeatureContent = {
  eyebrow: string;
  headline: HeadlineSeg[];
  subtext: string;
  ctaLabel: string;
  faqs: FAQ[];
};

export const FEATURE_CONTENT: Record<string, FeatureContent> = {
  "auto-apply": {
    eyebrow: "AI-Auto Apply",
    headline: [
      { t: "Apply to " },
      { t: "hundreds", tone: "gradient" },
      { t: " of " },
      { t: "jobs", tone: "cta" },
      { t: " while you " },
      { t: "sleep", tone: "cta" },
    ],
    subtext:
      "JobsAI Auto Apply does the work for you — automatically finding and applying to the best jobs based on your profile, skills, and preferences.",
    ctaLabel: "Start auto applying",
    faqs: [
      {
        q: "How does AI Auto Apply maintain application quality?",
        a: "Every submission is tailored, not blasted. JobsAI reads each job description, rewrites your resume to match it, and writes a role-specific cover letter — so each application reads like you wrote it for that company.",
      },
      {
        q: "Can I control which jobs get applied to automatically?",
        a: "Completely. You set target titles, locations, salary floor, seniority, remote preference, and must-have / exclude keywords. Turn on the approval queue and nothing is sent until you greenlight it.",
      },
      {
        q: "Does automation work across multiple job boards simultaneously?",
        a: "Yes. JobsAI applies across Lever, Ashby, Greenhouse, Workday and more in parallel, and de-duplicates roles that appear on several boards so you never apply twice.",
      },
      {
        q: "How quickly do automated applications get submitted after jobs post?",
        a: "New matches are discovered continuously and queued within hours of a role going live, so you're consistently among the first applicants — when response rates are highest.",
      },
      {
        q: "Will recruiters know my applications were automated?",
        a: "No. Each application is submitted like any candidate's — your tailored resume, screening answers, and a personalized cover letter. There's no automation footprint on the recruiter's end.",
      },
    ],
  },
};
