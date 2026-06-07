// Rule-based support assistant — intentionally NOT connected to any LLM yet.
// Answers are canned and matched on keywords. To upgrade later, replace the body
// of `botAnswer` with a call to an API route (e.g. POST /api/support) and keep
// this signature. Everything else (chat + voice widgets) stays the same.

interface Entry {
  keywords: string[];
  answer: string;
}

const KB: Entry[] = [
  {
    keywords: ["price", "pricing", "cost", "how much", "plan", "expensive"],
    answer:
      "JobsAI is free to start, no card needed. Paid plans are Pro $29/mo, Premium $79/mo, and Career Accelerator $199/mo — billed monthly or yearly (20% off). You can also top up tokens anytime.",
  },
  {
    keywords: ["guarantee", "refund", "money back", "guaranteed"],
    answer:
      "Every paid plan is backed by our 90-day interview guarantee: land an interview within 90 days of actively using JobsAI, or we refund you — no questions asked.",
  },
  {
    keywords: ["auto", "apply", "applies", "application", "applying"],
    answer:
      "On paid plans, JobsAI auto-applies to matching jobs for you every day — tailoring your resume and cover letter to each role and reaching recruiters directly, so interviews land while you do nothing.",
  },
  {
    keywords: ["interview", "practice", "prep", "voice", "avatar", "mock"],
    answer:
      "Once we land you an interview, you can practice it with AI — written, voice, or a realistic video avatar — with scored feedback built from your resume and the exact role. It is a bonus on top of getting you the interview.",
  },
  {
    keywords: ["free", "trial", "card", "credit"],
    answer:
      "Yes — you can start free with no credit card. Free includes job discovery, resume tailoring, ATS scans, and a trial of interview prep. Upgrade anytime to unlock daily auto-apply.",
  },
  {
    keywords: ["token", "tokens"],
    answer:
      "Tokens cover AI features like résumé tailoring, cover letters, ATS scans, and voice/avatar interview prep. Each paid plan includes a monthly allowance. You can also buy top-up packs (3k/$10, 10k/$30, 25k/$69), but subscribing is the cheaper way to get tokens.",
  },
  {
    keywords: ["start", "begin", "sign up", "signup", "join", "register"],
    answer:
      "Tap Get started at the top (or Start auto applying) to create your free account — it takes under a minute, and no card is required.",
  },
  {
    keywords: ["data", "secure", "security", "privacy", "safe"],
    answer:
      "Your data is encrypted in transit and at rest, stored on SOC 2 Type II infrastructure, and never sold.",
  },
  {
    keywords: ["board", "lever", "greenhouse", "ashby", "workday", "linkedin", "where"],
    answer:
      "JobsAI applies across major boards and ATS platforms including Lever, Greenhouse, Ashby, and Workday, and scans thousands of listings daily to find your best matches.",
  },
  {
    keywords: ["human", "agent", "support", "contact", "email", "help", "talk"],
    answer:
      "I am the JobsAI assistant. For a human, email support@jobsai.app and the team will reply within one business day.",
  },
];

const GREETING =
  "Hi! I am the JobsAI assistant. Ask me about auto-apply, pricing, the 90-day interview guarantee, or getting started.";

const FALLBACK =
  "I am not sure about that one yet. I can help with auto-apply, pricing, the 90-day guarantee, interview prep, tokens, or getting started — or email support@jobsai.app.";

export const SUGGESTED = [
  "How does auto-apply work?",
  "What is the interview guarantee?",
  "How much does it cost?",
  "Is it free to start?",
];

export function botGreeting(): string {
  return GREETING;
}

// Keyword-scored match. Returns the best canned answer, or a safe fallback.
export function botAnswer(input: string): string {
  const q = input.toLowerCase();
  let best: { score: number; answer: string } | null = null;
  for (const entry of KB) {
    const score = entry.keywords.reduce((s, k) => (q.includes(k) ? s + 1 : s), 0);
    if (score > 0 && (best === null || score > best.score)) {
      best = { score, answer: entry.answer };
    }
  }
  return best ? best.answer : FALLBACK;
}
