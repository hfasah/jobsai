import { NextResponse } from "next/server";

export async function GET() {
  const templates = [
    {
      id: "fast-track-top",
      name: "Fast-track top candidates",
      description: "Move candidates scoring 80%+ straight to interview and tag them.",
      trigger_event: "application_screened",
      conditions: [{ field: "match_score", operator: "gte", value: 80 }],
      actions: [
        { action: "move_stage",  action_config: { stage: "interview" } },
        { action: "add_tag",     action_config: { tag: "top-candidate" } },
      ],
    },
    {
      id: "auto-reject-weak",
      name: "Auto-reject weak applicants",
      description: "Reject candidates below 35% match and send a polite email.",
      trigger_event: "application_screened",
      conditions: [{ field: "match_score", operator: "lt", value: 35 }],
      actions: [
        { action: "auto_reject", action_config: { send_email: true } },
      ],
    },
    {
      id: "interview-invite-strong",
      name: "Send interview invite to strong candidates",
      description: "Automatically send the AI interview link to any 'strong_yes' recommendation.",
      trigger_event: "application_screened",
      conditions: [{ field: "ai_recommendation", operator: "eq", value: "strong_yes" }],
      actions: [
        { action: "send_interview_invite", action_config: {} },
        { action: "add_tag", action_config: { tag: "invited" } },
      ],
    },
    {
      id: "alert-hm-excellent",
      name: "Alert hiring manager on excellent candidates",
      description: "Notify the hiring manager and advance to interview when match ≥ 85%.",
      trigger_event: "application_screened",
      conditions: [{ field: "match_score", operator: "gte", value: 85 }],
      actions: [
        { action: "notify_hm",   action_config: {} },
        { action: "move_stage",  action_config: { stage: "interview" } },
      ],
    },
    {
      id: "flag-risky",
      name: "Flag candidates with risk signals",
      description: "Tag any candidate that has AI-flagged risk factors for recruiter review.",
      trigger_event: "application_screened",
      conditions: [{ field: "risk_flags", operator: "not_empty", value: "" }],
      actions: [
        { action: "add_tag", action_config: { tag: "flagged-review" } },
      ],
    },
    {
      id: "stale-screening",
      name: "Follow up on stale screened candidates",
      description: "Tag candidates stuck in 'screened' for 5+ days so recruiters can act.",
      trigger_event: "stale_candidate",
      trigger_config: { stale_for_days: 5 },
      conditions: [{ field: "stage", operator: "eq", value: "screened" }],
      actions: [
        { action: "add_tag",   action_config: { tag: "needs-review" } },
        { action: "notify_hm", action_config: {} },
      ],
    },
    {
      id: "post-interview-advance",
      name: "Advance high scorers after interview",
      description: "When an AI interview completes with 75%+, automatically move to offer stage.",
      trigger_event: "interview_completed",
      conditions: [{ field: "match_score", operator: "gte", value: 75 }],
      actions: [
        { action: "move_stage",  action_config: { stage: "offer" } },
        { action: "notify_hm",   action_config: {} },
      ],
    },
    {
      id: "stale-interview",
      name: "Nudge candidates stuck in interview",
      description: "Tag and notify hiring manager when a candidate has been in interview stage for 7+ days.",
      trigger_event: "stale_candidate",
      trigger_config: { stale_for_days: 7 },
      conditions: [{ field: "stage", operator: "eq", value: "interview" }],
      actions: [
        { action: "add_tag",   action_config: { tag: "stale-interview" } },
        { action: "notify_hm", action_config: {} },
      ],
    },
  ];

  return NextResponse.json({ data: templates });
}
