import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getMyOrg } from "@/lib/enterprise";

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You convert a recruiter's plain-English instruction into a pipeline automation rule (JSON only, no prose).

Available condition fields:
- match_score (number 0-100)
- ats_score (number 0-100)
- ai_recommendation (enum: strong_yes, yes, maybe, no)
- risk_flags (array)
- ats_keywords_matched (array)
- ats_keywords_missing (array)
- stage (enum: applied, screened, interview, offer, hired)

Available operators: gte, lte, gt, lt, eq, neq, in, not_in, contains_all, contains_any, is_empty, not_empty

Available actions:
- move_stage → { stage: "screened"|"interview"|"offer"|"hired" }
- auto_reject → { send_email: true|false }
- add_tag → { tag: "string" }
- notify_hm → {}
- send_interview_invite → {}

Available trigger_event: application_screened, interview_completed, stage_changed, stale_candidate
For stale_candidate include trigger_config: { stale_for_days: N }

Return JSON:
{
  "name": "short descriptive name",
  "trigger_event": "application_screened",
  "trigger_config": {},
  "conditions": [{ "field": "...", "operator": "...", "value": ... }],
  "actions": [{ "action": "...", "action_config": { ... } }]
}`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "recruiting_agent");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { text } = await req.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "text is required." }, { status: 400 });

  const completion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text.trim() },
    ],
  });

  const rule = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  return NextResponse.json({ rule });
}
