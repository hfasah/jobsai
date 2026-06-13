// Shared types + helpers for Outreach Campaigns (the multi-step sequence builder).

export const CAMPAIGN_FEATURE_KEY = "outreach_campaigns";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type EnrollmentStatus =
  | "active" | "completed" | "replied" | "unsubscribed" | "bounced" | "removed";

export interface CampaignStepInput {
  delay_days: number;
  subject: string;
  body: string;
  ai_personalize?: boolean;
  ai_prompt?: string | null;
}

export interface CampaignStep extends CampaignStepInput {
  id: string;
  step_order: number;
}

// Tokens recruiters can drop into subject/body. Rendered at send time.
export const CAMPAIGN_VARS = [
  "candidate_name",
  "first_name",
  "job_title",
  "org_name",
  "sender_name",
] as const;

export type CampaignVars = Partial<Record<(typeof CAMPAIGN_VARS)[number], string>>;

// Replace {{token}} with values; unknown tokens are left intact so a typo is
// visible rather than silently blanking the copy.
export function renderTemplate(text: string, vars: CampaignVars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const v = vars[key as keyof CampaignVars];
    return v != null && v !== "" ? v : full;
  });
}

export function firstName(fullName: string): string {
  return (fullName || "").trim().split(/\s+/)[0] || fullName || "there";
}

// Cumulative offset (in days from enrollment) at which a given step fires.
// Each step's delay_days is relative to the previous step.
export function cumulativeOffsetDays(steps: { delay_days: number }[], stepOrder: number): number {
  return steps
    .slice(0, stepOrder + 1)
    .reduce((sum, s) => sum + Math.max(0, s.delay_days || 0), 0);
}

// Validate a step list coming from the builder. Returns an error string or null.
export function validateSteps(steps: CampaignStepInput[]): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return "A campaign needs at least one step.";
  if (steps.length > 12) return "A campaign can have at most 12 steps.";
  for (const [i, s] of steps.entries()) {
    if (!s.subject?.trim()) return `Step ${i + 1} needs a subject line.`;
    if (!s.body?.trim()) return `Step ${i + 1} needs a body.`;
    if (typeof s.delay_days !== "number" || s.delay_days < 0 || s.delay_days > 60) {
      return `Step ${i + 1} delay must be between 0 and 60 days.`;
    }
  }
  return null;
}

// Starter sequences a recruiter can clone in one click, then customize.
export interface CampaignPreset {
  id: string;
  name: string;
  description: string;
  steps: CampaignStepInput[];
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: "passive_nurture",
    name: "Passive Candidate Nurture",
    description: "Warm 3-touch sequence for sourced candidates who haven't engaged yet.",
    steps: [
      {
        delay_days: 0,
        subject: "{{job_title}} at {{org_name}} — worth a quick chat?",
        body: "Hi {{first_name}},\n\nYour background stood out for our {{job_title}} role at {{org_name}}. I'd love to share more about the team and what we're building.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n{{sender_name}}",
        ai_personalize: true,
      },
      {
        delay_days: 3,
        subject: "Following up — {{job_title}}",
        body: "Hi {{first_name}},\n\nJust floating this back to the top of your inbox. Still keen to tell you about the {{job_title}} opportunity at {{org_name}} whenever the timing works.\n\nAre mornings or afternoons easier for you?\n\n{{sender_name}}",
      },
      {
        delay_days: 5,
        subject: "Last note on {{job_title}}",
        body: "Hi {{first_name}},\n\nI'll keep this short — if now isn't the right time, no problem at all. If you'd like to stay on our radar for future {{org_name}} roles, just reply and I'll keep you posted.\n\nThanks either way,\n{{sender_name}}",
      },
    ],
  },
  {
    id: "reengage_silver",
    name: "Re-engage Past Applicants",
    description: "Bring strong silver-medalist candidates back for a new opening.",
    steps: [
      {
        delay_days: 0,
        subject: "We're hiring again, {{first_name}} — {{job_title}}",
        body: "Hi {{first_name}},\n\nYou impressed us when you applied to {{org_name}} previously, and we just opened a {{job_title}} role that looks like a strong fit.\n\nWould you be open to picking the conversation back up?\n\nWarmly,\n{{sender_name}}",
        ai_personalize: true,
      },
      {
        delay_days: 4,
        subject: "Still interested in {{org_name}}?",
        body: "Hi {{first_name}},\n\nWanted to make sure this didn't slip by. The {{job_title}} role is still open and your prior experience with us means we can move quickly.\n\nHappy to find a time that works — just let me know.\n\n{{sender_name}}",
      },
    ],
  },
  {
    id: "event_invite",
    name: "Hiring Event Invite",
    description: "Drive registrations for a webinar, open house, or hiring event.",
    steps: [
      {
        delay_days: 0,
        subject: "You're invited: {{org_name}} hiring event",
        body: "Hi {{first_name}},\n\nWe're hosting a virtual hiring event to introduce candidates to our team and our {{job_title}} openings. Based on your background, I think you'd get a lot out of it.\n\nCan I send you the details?\n\n{{sender_name}}",
      },
      {
        delay_days: 2,
        subject: "Reminder — {{org_name}} hiring event",
        body: "Hi {{first_name}},\n\nQuick reminder about our upcoming hiring event. Spots are limited, so let me know if you'd like me to hold one for you.\n\n{{sender_name}}",
      },
      {
        delay_days: 1,
        subject: "Starting soon: {{org_name}} hiring event",
        body: "Hi {{first_name}},\n\nWe're kicking off shortly. If you'd still like to join and meet the team behind our {{job_title}} roles, reply and I'll send the link right over.\n\n{{sender_name}}",
      },
    ],
  },
];
