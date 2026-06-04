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

// Heuristic: is this a genuine job-application reply (worth importing)?
// Strict on purpose — newsletters and product notifications must NOT match.
export function looksJobRelated(from: string, subject: string, body: string): boolean {
  const f = from.toLowerCase();
  const head = `${subject} ${body.slice(0, 800)}`.toLowerCase();

  // Strong sender signal: ATS / recruiting domains and mailboxes.
  const atsSender =
    /(greenhouse-mail|greenhouse\.io|lever\.co|hire\.lever|ashbyhq|myworkday|workday|smartrecruiters|bamboohr|icims|jobvite|workable|teamtailor|recruitee|ripplematch|jobs\.|@careers|@talent|@recruit(ing)?|@hr[.@]|no-?reply.*(careers|jobs|talent|recruit))/.test(f);

  // Strong content signal: phrases specific to an application's lifecycle.
  const appPhrase =
    /\b(your application|application (to|for|has been received|was received|status|update|confirmation)|thank you for (applying|your application|your interest in (the|this|our))|we (have )?received your application|regarding your application|your candidacy|you applied (to|for)|we have reviewed your|for the (position|role) (of|you)|invite you to (an? )?interview|schedule (an?|your) interview|interview (invitation|request)|move forward (with|to)|not (be )?moving forward|not selected for)\b/.test(head);

  return atsSender || appPhrase;
}
