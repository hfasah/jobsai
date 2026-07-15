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
  | "question"
  | "wrong_person"
  | "neutral";

export const INTENTS: Intent[] = [
  "interested", "not_interested", "out_of_office", "referral",
  "unsubscribe", "meeting_requested", "question", "wrong_person", "neutral",
];

// How warm the reply is, independent of the categorical intent. Lets positive
// replies be ranked by conversion likelihood (Instantly-style interest labels).
export type InterestLevel = "none" | "low" | "medium" | "high" | "very_high";

export const INTEREST_LEVELS: InterestLevel[] = ["none", "low", "medium", "high", "very_high"];

export const INTEREST_LABEL: Record<InterestLevel, string> = {
  none: "No interest",
  low: "Low interest",
  medium: "Medium interest",
  high: "High interest",
  very_high: "Very high interest",
};

export interface IntentResult {
  intent: Intent;
  confidence: number; // 0..1
  summary: string;
  interestScore: number;      // 0..100
  interestLevel: InterestLevel;
  // When intent is "referral", the person they pointed to (if named/emailed).
  referral?: { name: string | null; email: string | null };
}

// Bucket a 0-100 score into a level. Thresholds chosen so "high" and above are
// the replies worth surfacing at the top of the inbox.
export function interestLevelFromScore(score: number): InterestLevel {
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "none";
}

// Reconcile the LLM's raw warmth score with the categorical intent, applying
// deterministic floors/caps so the two signals never contradict (a reply that
// explicitly asks for a meeting can't read as "low interest"; a decline can't
// read as "warm"). Returns the final score + its bucket.
export function deriveInterest(intent: Intent, rawScore: number): { interestScore: number; interestLevel: InterestLevel } {
  let score = Math.max(0, Math.min(100, Math.round(rawScore)));
  switch (intent) {
    case "unsubscribe":
    case "not_interested":
      score = 0;
      break;
    case "out_of_office":
      score = Math.min(score, 20); // an auto-reply carries no real signal
      break;
    case "meeting_requested":
      score = Math.max(score, 80); // explicitly wants to talk → very high
      break;
    case "interested":
      score = Math.max(score, 60); // positive → at least high
      break;
    case "referral":
      score = Math.min(Math.max(score, 40), 59); // warm handoff, but not them → medium
      break;
    case "wrong_person":
      score = 0; // reached the wrong inbox — no signal about the candidate
      break;
    case "question":
      score = Math.min(Math.max(score, 40), 69); // engaged, but not yet a yes → medium/high
      break;
    case "neutral":
      score = Math.min(score, 59); // unclear can't be "high"
      break;
  }
  return { interestScore: score, interestLevel: interestLevelFromScore(score) };
}

// Cheap deterministic pre-check: an explicit unsubscribe/stop should never
// depend on the model (and must be honored even if the LLM is down).
const UNSUB_RE = /\b(unsubscribe|opt[\s-]?out|stop\s+(emailing|contacting)|remove me|take me off|do not (contact|email))\b/i;
const OOO_RE = /\b(out of office|on (vacation|holiday|leave|pto)|away until|automatic reply|auto[\s-]?reply)\b/i;

// Strip quoted history + footers so classification sees ONLY the candidate's
// NEW words. Critical: the quoted original contains our own footer — literally
// the word "Unsubscribe" — which used to trip UNSUB_RE on EVERY reply that
// quoted the email (Gmail's default), auto-suppressing interested candidates.
export function stripQuotedReply(body: string): string {
  let text = body.replace(/\r\n/g, "\n");
  // Cut at the earliest quote-header marker.
  const markers = [
    /^On .{0,300}wrote:\s*$/m,               // Gmail: "On Wed, Jul 15 ... wrote:"
    /^-{2,}\s*Original Message\s*-{2,}/im,   // Outlook
    /^_{5,}\s*$/m,                           // Outlook divider
    /^From:\s.+$/m,                          // forwarded-header block
    /^Le .{0,300}a écrit\s*:\s*$/m,          // Gmail (fr)
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  text = text.slice(0, cut);
  // Drop any remaining quoted lines and our own footer if it leaked unquoted.
  text = text.split("\n").filter((l) => !/^\s*>/.test(l)).join("\n");
  text = text.replace(/Not the right time\?[\s\S]*$/i, "").replace(/Powered by JobsAI[\s\S]*$/i, "");
  return text.trim();
}

const SYSTEM_PROMPT = `You classify a candidate's reply to a recruiter's outreach email. Return ONLY JSON:
{"intent": "...", "confidence": 0.0-1.0, "interest": 0-100, "summary": "one short sentence", "referral": {"name": "...or null", "email": "...or null"}}

referral: ONLY when intent is "referral" and they point to someone else — extract that person's name and email if stated, else null. Otherwise use null for both. Never invent an email.

intent must be exactly one of:
- interested: positive, wants to learn more / open to the role
- meeting_requested: explicitly wants a call/meeting or proposes a time
- referral: not for them but points to someone else
- question: engaged and asking something (comp, location/remote, logistics, role details) rather than saying yes/no
- wrong_person: says they're not who you're looking for / you have the wrong contact
- not_interested: declines
- out_of_office: automated away/OOO message
- unsubscribe: asks to stop being contacted / opt out
- neutral: unclear, or none of the above

interest is how warm/likely-to-convert the reply is, 0-100:
- 80-100: eager — proposes a time, "yes let's talk", strong enthusiasm
- 60-79: clearly positive, wants to learn more
- 40-59: mild or conditional interest, asks a qualifying question, "maybe later"
- 20-39: lukewarm / mostly deflecting
- 0-19: no interest, a decline, or an automated reply

confidence is your certainty about the intent (0-1). summary is a neutral one-line paraphrase — never invent facts.

The text may still contain remnants of quoted earlier emails or footers — classify ONLY the candidate's new words; mentions of "unsubscribe" inside quoted/footer text are NOT an opt-out.`;

export async function classifyIntent(
  args: { subject: string; body: string; orgId: string },
): Promise<IntentResult> {
  // Classify ONLY the new message — never the quoted original (whose footer
  // contains "Unsubscribe"). If stripping leaves nothing (rare), fall back to
  // a short prefix of the raw body so we still classify something.
  const newText = stripQuotedReply(args.body);
  const text = `${args.subject}\n\n${newText || args.body.slice(0, 400)}`.trim();

  // Deterministic overrides first.
  if (UNSUB_RE.test(text))
    return { intent: "unsubscribe", confidence: 0.98, summary: "Asked to stop being contacted.", ...deriveInterest("unsubscribe", 0) };
  if (OOO_RE.test(text) && text.length < 600)
    return { intent: "out_of_office", confidence: 0.9, summary: "Automated out-of-office reply.", ...deriveInterest("out_of_office", 0) };

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
    const rawInterest = typeof parsed.interest === "number" ? parsed.interest : 30;
    const referral =
      intent === "referral" && parsed.referral && typeof parsed.referral === "object"
        ? {
            name: typeof parsed.referral.name === "string" ? parsed.referral.name.slice(0, 120) : null,
            email: typeof parsed.referral.email === "string" && /.+@.+\..+/.test(parsed.referral.email) ? parsed.referral.email.toLowerCase().slice(0, 200) : null,
          }
        : undefined;
    return { intent, confidence, summary, referral, ...deriveInterest(intent, rawInterest) };
  } catch {
    return { intent: "neutral", confidence: 0, summary: "", ...deriveInterest("neutral", 0) };
  }
}

// Positive intents that should alert the team + surface at the top of the inbox.
export function isPositiveIntent(intent: Intent): boolean {
  return intent === "interested" || intent === "meeting_requested";
}
