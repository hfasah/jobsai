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

  "interview-buddy": {
    eyebrow: "Interview Buddy",
    headline: [
      { t: "Ace every interview with " },
      { t: "answers", tone: "gradient" },
      { t: " they " },
      { t: "can't see", tone: "cta" },
    ],
    subtext:
      "Interview Buddy listens to your interviewer and feeds you tailored answers in real time — right on your desktop, and invisible to Zoom, Meet, and Teams screen sharing.",
    ctaLabel: "Get Interview Buddy",
    faqs: [
      {
        q: "How does Interview Buddy stay invisible during screen sharing?",
        a: "It runs as a separate desktop overlay that screen-sharing tools like Zoom, Google Meet, and Teams don't capture. Your interviewer sees your normal screen; only you see your private answers.",
      },
      {
        q: "Does it listen to me or to the interviewer?",
        a: "Only the interviewer. The desktop app captures the system audio of whoever you're talking to and transcribes their questions — it never uses your microphone. (So if you test it alone, it won't pick anything up — that's expected, not a bug.)",
      },
      {
        q: "How fast do the answers appear?",
        a: "In real time. As the interviewer finishes a question, Interview Buddy transcribes it and surfaces tailored talking points within a second or two — fast enough to glance down and keep the conversation flowing.",
      },
      {
        q: "Are the answers tailored to my background and the role?",
        a: "Yes. It builds responses from your resume, the job description, and the company, so the talking points sound like you — not a generic script.",
      },
      {
        q: "Which platforms and devices does it work on?",
        a: "It's a desktop app for macOS and Windows, and works across any video platform — Zoom, Google Meet, Microsoft Teams, and phone or web calls played through your computer.",
      },
      {
        q: "How do I get access?",
        a: "Interview Buddy unlocks on any paid plan. Upgrade, download the macOS or Windows app, sign in, and you're ready for your next call.",
      },
    ],
  },
};
