// Blog content for /enterprise/blog. Data-driven (no MDX dependency) — each post
// is structured sections rendered by the article page. Hand-authored, evergreen
// recruiting/TA content. Add posts to POSTS (newest first).

export type BlogSection = { heading?: string; paragraphs?: string[]; bullets?: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;       // card + meta description
  author: string;
  date: string;          // ISO date published
  readMins: number;
  tag: string;
  intro: string;
  sections: BlogSection[];
  takeaways?: string[];
};

export const POSTS: BlogPost[] = [
  {
    slug: "ai-phone-screening-guide",
    title: "AI phone screening: a practical guide for hiring teams",
    excerpt: "What AI phone screens do well, where to keep humans in the loop, and how to roll them out without hurting candidate experience.",
    author: "The JobsAI Team",
    date: "2026-06-16",
    readMins: 6,
    tag: "AI in hiring",
    intro: "Phone screening is the most repetitive, time-consuming step in recruiting — and the one most ready for automation. Done well, AI phone screens give every applicant a fair, consistent first conversation and free your team to spend time only on the strongest. Done poorly, they feel robotic and cost you good candidates. Here's how to get it right.",
    sections: [
      { heading: "What an AI phone screen actually does", paragraphs: [
        "An AI phone screen calls (or is called by) a candidate, asks a set of role-specific questions, listens to the answers, and produces a scored, transcribed summary. The best systems adapt — asking a relevant follow-up when an answer is thin or interesting — rather than reading a rigid script.",
        "The output isn't a hire/no-hire decision. It's a ranked shortlist with evidence, so a human can make the call faster and with more context.",
      ] },
      { heading: "What to automate, and what to keep human", bullets: [
        "Automate: logistics, basic qualification, consistent role-specific questions, scoring, and scheduling.",
        "Keep human: nuanced judgment, selling the role, answering candidate questions, and any final decision.",
      ] },
      { heading: "Designing good screening questions", paragraphs: [
        "Tie every question to a real requirement of the role. Mix quick qualifiers (logistics, must-haves) with one or two open questions that reveal how someone thinks. Avoid trivia — you're predicting on-the-job performance, not testing memory.",
      ], bullets: [
        "Start with 1–2 qualifiers (availability, location, must-have skills).",
        "Add 2–3 role-specific questions tied to the job's hardest parts.",
        "Finish with one behavioral or situational prompt.",
      ] },
      { heading: "Protecting candidate experience", paragraphs: [
        "Tell candidates an AI will run the first screen and why. Keep it short (under ~10 minutes). Make the transcript and next steps available quickly. A fast, respectful screen beats waiting two weeks for a human to find time.",
      ] },
    ],
    takeaways: [
      "AI phone screens shine at the repetitive top of the funnel — not final decisions.",
      "Anchor questions to real role requirements; keep screens short.",
      "Be transparent with candidates and move fast on next steps.",
    ],
  },
  {
    slug: "write-job-descriptions-that-attract-applicants",
    title: "How to write job descriptions that attract better applicants",
    excerpt: "Most JDs repel the people you want. A simple structure — and a few honest choices — will widen and improve your applicant pool.",
    author: "The JobsAI Team",
    date: "2026-06-12",
    readMins: 5,
    tag: "Sourcing",
    intro: "A job description is a marketing document, not a legal one. Yet most read like a wishlist of requirements that scares off strong-but-humble candidates and attracts the overconfident. A few changes meaningfully improve both the size and quality of your applicant pool.",
    sections: [
      { heading: "Lead with the role, not the company boilerplate", paragraphs: [
        "Candidates skim. Open with what they'll actually do and why it matters, then cover the company. The first two sentences decide whether they keep reading.",
      ] },
      { heading: "Separate must-haves from nice-to-haves", paragraphs: [
        "Long requirement lists shrink your pool — research consistently shows under-represented candidates skip roles when they don't meet every bullet. Keep must-haves to the genuine few; move the rest to 'nice to have.'",
      ] },
      { heading: "Be specific and honest about comp and logistics", bullets: [
        "Include a salary range — it improves application rate and trust (and is required in many places).",
        "State remote/hybrid/onsite and location clearly.",
        "Describe the team, the stack or tools, and what success looks like in 6–12 months.",
      ] },
      { heading: "Cut the clichés", paragraphs: [
        "'Rockstar,' 'ninja,' and 'wear many hats' say nothing. Replace them with concrete responsibilities. Specificity signals a well-run team.",
      ] },
    ],
    takeaways: [
      "Open with the role and impact, not boilerplate.",
      "Trim must-haves; post a salary range; be honest about logistics.",
      "Specifics attract; clichés repel.",
    ],
  },
  {
    slug: "structured-interviews-guide",
    title: "Structured interviews: the highest-ROI change in your hiring process",
    excerpt: "Structured interviews predict performance far better than unstructured chats — and they're easier to run than most teams think.",
    author: "The JobsAI Team",
    date: "2026-06-09",
    readMins: 6,
    tag: "Interviewing",
    intro: "Decades of research point to the same conclusion: structured interviews — same questions, same criteria, scored consistently — predict on-the-job performance far better than free-flowing conversations. They also reduce bias and make decisions defensible. Here's how to adopt them without turning interviews into interrogations.",
    sections: [
      { heading: "Why structure wins", paragraphs: [
        "Unstructured interviews mostly measure how much the interviewer likes the candidate. Structure forces every candidate to be evaluated on the same things, so you're comparing signal, not vibes.",
      ] },
      { heading: "Build a simple scorecard", bullets: [
        "Pick 3–5 competencies that actually matter for the role.",
        "Write 1–2 questions per competency, asked of every candidate.",
        "Define what a weak / solid / strong answer looks like before you interview.",
      ] },
      { heading: "Run it consistently", paragraphs: [
        "Assign competencies across the interview panel so coverage is deliberate, not redundant. Have each interviewer score independently before the debrief — discussing first lets the loudest voice anchor everyone.",
      ] },
      { heading: "Where AI helps", paragraphs: [
        "AI screening enforces structure for free at the top of the funnel: every applicant gets the same questions and a consistent score. That gives your panel a stronger, fairer starting shortlist.",
      ] },
    ],
    takeaways: [
      "Same questions + a scorecard + independent scoring = better predictions.",
      "Define answer quality before interviewing, not after.",
      "AI screening enforces structure consistently at scale.",
    ],
  },
  {
    slug: "reduce-time-to-hire",
    title: "Where teams lose time-to-hire — and how to win it back",
    excerpt: "Time-to-hire is usually lost in the gaps between steps, not the steps themselves. Here's where to look first.",
    author: "The JobsAI Team",
    date: "2026-06-05",
    readMins: 5,
    tag: "Recruiting ops",
    intro: "The best candidates are off the market in days. Yet most hiring processes leak time in predictable places — and it's rarely the interviews themselves. It's the waiting in between. Here's where the delay hides and what to do about it.",
    sections: [
      { heading: "1. Screening backlog", paragraphs: [
        "Applications pile up faster than a recruiter can review them, so strong candidates sit unscreened for days. Automating the first screen clears the backlog and surfaces the best applicants within hours.",
      ] },
      { heading: "2. Scheduling ping-pong", paragraphs: [
        "Coordinating calendars across a panel can add a week per stage. Self-scheduling and calendar integration remove most of it.",
      ] },
      { heading: "3. Slow, scattered feedback", paragraphs: [
        "Decisions stall when scorecards trickle in over days. Set a feedback SLA (e.g. within 24 hours) and make it a one-click step in your pipeline.",
      ] },
      { heading: "4. Approval bottlenecks", paragraphs: [
        "Offer approvals and req sign-offs that bounce between inboxes cost days. Define who approves what up front, and route it automatically.",
      ] },
    ],
    takeaways: [
      "Most lost time is between steps, not in them.",
      "Automate screening and scheduling; set a feedback SLA.",
      "Pre-define approvals so offers don't stall.",
    ],
  },
  {
    slug: "ai-in-recruiting-what-to-automate",
    title: "AI in recruiting: what to automate, and what to keep human",
    excerpt: "A clear-eyed framework for where AI helps in hiring, where it doesn't, and how to adopt it responsibly.",
    author: "The JobsAI Team",
    date: "2026-06-02",
    readMins: 6,
    tag: "AI in hiring",
    intro: "AI is genuinely useful in recruiting — and genuinely overhyped. The teams getting value are clear about which parts of hiring are repetitive and rules-based (great for automation) versus relational and judgment-heavy (keep humans in charge). Here's a framework.",
    sections: [
      { heading: "Automate the repetitive top of the funnel", bullets: [
        "Sourcing and rediscovery — surfacing matches from large candidate pools.",
        "First-pass screening and consistent scoring.",
        "Scheduling, reminders, and status updates.",
        "Drafting outreach and job descriptions (with human review).",
      ] },
      { heading: "Keep humans on judgment and relationships", bullets: [
        "Final hiring decisions.",
        "Selling the role and closing candidates.",
        "Nuanced, high-stakes conversations.",
        "Calibration on what 'good' means for each role.",
      ] },
      { heading: "Adopt it responsibly", paragraphs: [
        "Be transparent with candidates when AI is used. Keep a human in the loop for decisions. Watch for bias, audit outcomes, and make sure your tools respect data-protection rules. AI should widen access and consistency — not quietly filter people out.",
      ] },
    ],
    takeaways: [
      "Automate repetitive, rules-based steps; keep judgment human.",
      "Transparency and a human-in-the-loop are non-negotiable.",
      "Used well, AI makes hiring faster and fairer — not opaque.",
    ],
  },
];

export const POST_BY_SLUG: Record<string, BlogPost> = Object.fromEntries(POSTS.map((p) => [p.slug, p]));

export function getPost(slug: string): BlogPost | undefined {
  return POST_BY_SLUG[slug];
}

// Newest first.
export function sortedPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
