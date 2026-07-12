// Subsequence engine — runs a campaign's configured trigger→action rules when a
// trigger fires for a lead. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { moveEmailToPipeline, notifyRecruiters, enrollInCampaign } from "./campaign-actions";

export type SubTrigger = "reply_category" | "sequence_completed";
export interface SubsequenceAction {
  type: "notify_recruiter" | "move_to_pipeline" | "add_to_campaign";
  config?: { campaign_id?: string };
}
interface SubsequenceRow {
  id: string; name: string; trigger_type: string;
  trigger_config: { category?: string } | null;
  actions: SubsequenceAction[] | null;
}

// Fire all matching enabled subsequences for a campaign. Best-effort — an action
// that fails is logged and skipped. Returns the list of actions performed.
export async function runSubsequences(args: {
  orgId: string;
  campaignId: string;
  trigger: SubTrigger;
  category?: string; // for reply_category
  candidateEmail: string;
  candidateName: string | null;
  actingUser?: string;
}): Promise<string[]> {
  const { orgId, campaignId, trigger, category, candidateEmail, candidateName } = args;
  const actingUser = args.actingUser ?? "subsequence";

  const { data } = await supabaseAdmin
    .from("enterprise_campaign_subsequences")
    .select("id, name, trigger_type, trigger_config, actions")
    .eq("org_id", orgId).eq("campaign_id", campaignId).eq("enabled", true).eq("trigger_type", trigger);

  const rows = (data ?? []) as SubsequenceRow[];
  const performed: string[] = [];

  for (const sub of rows) {
    // reply_category rules only fire for their configured category.
    if (trigger === "reply_category" && sub.trigger_config?.category && sub.trigger_config.category !== category) continue;

    for (const action of sub.actions ?? []) {
      try {
        if (action.type === "move_to_pipeline") {
          const id = await moveEmailToPipeline(orgId, candidateEmail, candidateName, actingUser);
          if (id) performed.push(`${sub.name}: moved to pipeline`);
        } else if (action.type === "notify_recruiter") {
          const who = candidateName || candidateEmail;
          const label = trigger === "reply_category" ? `replied (${category})` : "finished the sequence";
          await notifyRecruiters(orgId, `${who} — ${label}`, `<p><strong>${who}</strong> (${candidateEmail}) ${label} in a campaign.</p><p><a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "")}/enterprise/outreach/inbox">Open the inbox →</a></p>`);
          performed.push(`${sub.name}: notified team`);
        } else if (action.type === "add_to_campaign" && action.config?.campaign_id) {
          const id = await enrollInCampaign(orgId, action.config.campaign_id, candidateEmail, candidateName, actingUser);
          if (id) performed.push(`${sub.name}: added to another campaign`);
        }
      } catch (e) {
        console.error("[subsequences] action failed", sub.name, action.type, e);
      }
    }
  }
  return performed;
}
