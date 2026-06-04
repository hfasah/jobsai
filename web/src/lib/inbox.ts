// Provider-agnostic inbox helpers (classification + labels). Ingestion/sending
// live in the provider lib (gmail.ts).

export type InboxClass = "confirmation" | "rejection" | "interview" | "otp" | "update" | "other";

export const CLASS_LABELS: Record<InboxClass, string> = {
  confirmation: "Application received",
  rejection: "Not this time",
  interview: "Interview",
  otp: "Verification",
  update: "Update",
  other: "Other",
};

// Lightweight keyword classifier — fast, free, good enough for triage.
export function classifyEmail(subject: string, body: string): InboxClass {
  const t = `${subject}\n${body}`.toLowerCase();
  if (/\b(verification code|one[-\s]?time|verify your|confirm your email|otp|security code|confirm your identity)\b/.test(t)) return "otp";
  if (/\b(schedule|availability|set up a|book a (call|time)|interview|meet with|phone screen|next steps|invite you to|move forward to)\b/.test(t)) return "interview";
  if (/\b(unfortunately|not (be )?moving forward|not selected|other candidates|regret to inform|will not be moving|decided not to|no longer under consideration|not this time|not be progressing)\b/.test(t)) return "rejection";
  if (/\b(received your application|thank you for applying|application (has been )?received|we have received your|thanks for applying|application confirmation)\b/.test(t)) return "confirmation";
  if (/\b(update|status of your|regarding your application)\b/.test(t)) return "update";
  return "other";
}

// Heuristic: does this email look job-application related (worth importing)?
export function looksJobRelated(from: string, subject: string, body: string): boolean {
  const hay = `${from} ${subject} ${body}`.toLowerCase();
  const sources = /(greenhouse|lever|ashby|workday|smartrecruiters|bamboohr|icims|myworkday|jobvite|workable|recruit|talent|careers|hiring|no-?reply.*jobs)/;
  const terms = /(application|applying|applied|interview|position|role|candidate|recruit|job|opening|opportunity)/;
  return sources.test(hay) || terms.test(`${subject} ${body.slice(0, 400)}`);
}
