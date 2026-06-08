import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Simple in-memory IP rate limiter: max 20 requests per 5 minutes
const rl = new Map<string, { count: number; reset: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rl.get(ip);
  if (!entry || now > entry.reset) {
    rl.set(ip, { count: 1, reset: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

const SYSTEM = `You are the JobsAI support assistant — friendly, helpful, and precise. JobsAI is an AI-powered job-search platform at https://jobsai.work.

## Product knowledge
- **Auto-apply**: JobsAI auto-applies to matching jobs daily on Lever, Greenhouse, Ashby, Workday, SmartRecruiters. Every application gets a tailored resume + cover letter.
- **Plans**: Free (job discovery, resume tools, 1 trial interview), Pro $29/mo, Premium $79/mo, Career Accelerator $199/mo — 20% off annual billing.
- **90-day interview guarantee (Career Accelerator only)**: land an interview within 90 days of actively using the Career Accelerator plan or get your subscription refunded. Conditions apply (complete profile, auto-apply running, realistic preferences, attend interviews offered). Full terms at /interview-guarantee.
- **Interview prep**: written coach, AI voice interviewer, AI avatar room — all built from the user's actual resume and the specific job role.
- **Tokens**: monthly allowance on paid plans for heavy AI features (voice/avatar). Top-up packs: 5 000 for $9, 20 000 for $29, 60 000 for $69.
- **ATS Scanner**: 0–100 score with specific keyword fixes before applying.
- **Resume Translator**: 68+ languages.

## App navigation links (use these in answers)
- Dashboard: /dashboard
- Job Search: /dashboard/job-search
- My Jobs / Applications: /dashboard/applications
- Resumes: /dashboard/resumes
- Apply Profile: /dashboard/apply-profile
- Interview Prep: /dashboard/interview
- Billing & Tokens: /dashboard/billing
- Preferences: /dashboard/preferences
- Contact / Support form: /contact

## Response format rules
- Use **bold** for key terms, button names, and UI element names.
- Use numbered lists for step-by-step instructions.
- Use bullet lists for feature lists.
- Include the relevant app link when directing someone to a page — format as [Page Name](/dashboard/page).
- If someone shares a screenshot, describe exactly what you see highlighted and give precise next steps.
- Keep answers concise but complete. Use short paragraphs. Max 150 words unless a step-by-step is genuinely needed.
- For billing/account disputes or anything you can't resolve, say: "For this, please email [support@jobsai.work](mailto:support@jobsai.work) — we reply within one business day."
- Never make up features or prices not listed above.`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!checkRate(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const incoming: Array<{ role: string; content: string; imageDataUrl?: string }> = body.messages ?? [];
  if (!incoming.length) return NextResponse.json({ error: "No messages" }, { status: 400 });

  const messages: ChatCompletionMessageParam[] = incoming.slice(-12).map((m) => {
    if (m.imageDataUrl && m.role === "user") {
      return {
        role: "user" as const,
        content: [
          { type: "text" as const, text: m.content || "I'm sharing a screenshot." },
          { type: "image_url" as const, image_url: { url: m.imageDataUrl, detail: "low" as const } },
        ],
      };
    }
    return {
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    };
  });

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "system" as const, content: SYSTEM }, ...messages],
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "I'm not sure about that. Please email support@jobsai.work.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("support AI error", err);
    return NextResponse.json({ reply: "Something went wrong on my end. Please email support@jobsai.work and we'll help you right away." });
  }
}
