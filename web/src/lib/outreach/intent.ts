// AI SDR intent classification for inbound replies. One fast-tier call,
// json_object, with a confidence score and short summary. The label drives
// auto-actions (unsubscribe, pause-on-reply, notify on positive intent).
// SERVER-ONLY.
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { recordUsage } from "@/lib/llm-usage";

export type Intent =
  | "interested"
  | "not_interested"
  | "out_of_office"
  | "referral"
  | "unsubscribe"
  | "meeting_requested"
  | "neutral";

export const INTENTS: Intent[] = [
  "interested", "not_interested", "out_of_office", "referral",
  "unsubscribe", "meeting_requested", "neutral",
];

export interface IntentResult {
  intent: Intent;
  confidence: number; // 0..1
  summary: string;
}

// Cheap deterministic pre-check: an explicit unsubscribe/stop should never
// depend on the model (and must be honored even if the LLM is down).
const UNSUB_RE = /\b(unsubscribe|opt[\s-]?out|stop\s+(emailing|contacting)|remove me|take me off|do not (contact|email))\b/i;
const OOO_RE = /\b(out of office|on (vacation|holiday|leave|pto)|away until|automatic reply|auto[\s-]?reply)\b/i;

const SYSTEM_PROMPT = `You classify a candidate's reply to a recruiter's outreach email. Return ONLY JSON:
{"intent": "...", "confidence": 0.0-1.0, "summary": "one short sentence"}

intent must be exactly one of:
- interested: positive, wants to learn more / open to the role
- meeting_requested: explicitly wants a call/meeting or proposes a time
- referral: not for them but points to someone else
- not_interested: declines
- out_of_office: automated away/OOO message
- unsubscribe: asks to stop being contacted / opt out
- neutral: unclear, a question, or none of the above

confidence is your certainty (0-1). summary is a neutral one-line paraphrase — never invent facts.`;

export async function classifyIntent(
  args: { subject: string; body: string; orgId: string },
): Promise<IntentResult> {
  const text = `${args.subject}\n\n${args.body}`.trim();

  // Deterministic overrides first.
  if (UNSUB_RE.test(text)) return { intent: "unsubscribe", confidence: 0.98, summary: "Asked to stop being contacted." };
  if (OOO_RE.test(text) && text.length < 600) return { intent: "out_of_office", confidence: 0.9, summary: "Automated out-of-office reply." };

  try {
    const completion = await getAIClient(AI_TIERS.fast.provider).chat.completions.create({
      model: AI_TIERS.fast.model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 2000) },
      ],
    });
    recordUsage({ orgId: args.orgId, feature: "inbox_intent", model: AI_TIERS.fast.model, usage: completion.usage });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const intent: Intent = INTENTS.includes(parsed.intent) ? parsed.intent : "neutral";
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 240) : "";
    return { intent, confidence, summary };
  } catch {
    return { intent: "neutral", confidence: 0, summary: "" };
  }
}

// Positive intents that should alert the team + surface at the top of the inbox.
export function isPositiveIntent(intent: Intent): boolean {
  return intent === "interested" || intent === "meeting_requested";
}
