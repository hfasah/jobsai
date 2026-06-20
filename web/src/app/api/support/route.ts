import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = getAIClient(AI_TIERS.fast.provider);
  return _openai;
}

import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// 20 messages per 5 minutes per IP (unchanged behaviour, now using shared lib).
const limiter = createRateLimiter({ limit: 20, windowMs: 5 * 60_000 });

const SYSTEM = `You are the JobsAI support assistant — friendly, helpful, and precise. JobsAI is an AI-powered job-search platform at https://jobsai.work.

## Product knowledge
- **Auto-apply**: JobsAI auto-applies to matching jobs daily on Lever, Greenhouse, Ashby, Workday, SmartRecruiters. Every application gets a tailored resume + cover letter.
- **Plans**: Free (job discovery, resume tools, 1 trial interview), Pro $29/mo, Premium $79/mo, Career Accelerator $199/mo — 20% off annual billing.
- **90-day interview guarantee**: actively use JobsAI and if you don't land an interview within 90 days, you get a refund. Some conditions apply — see the Terms of Service for full details.
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
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

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
      model: AI_TIERS.fast.model,
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
