import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { getOrgUsage } from "@/lib/enterprise-limits";

export interface Nudge {
  id: string; // stable-ish id for client dismissal
  message: string;
  cta: string;
  href: string;
  tone: "warn" | "info" | "upsell";
}

// Contextual usage/upgrade nudges from the org's real plan, usage, and trial.
// Ordered by urgency (warn → info → upsell); the banner shows the top one.
export async function getOrgNudges(orgId: string): Promise<Nudge[]> {
  const [ent, usage] = await Promise.all([getOrgEntitlements(orgId), getOrgUsage(orgId)]);
  const warn: Nudge[] = [];
  const info: Nudge[] = [];
  const upsell: Nudge[] = [];

  // Payment failed (grace period — Stripe retrying)
  if (ent.accessStatus === "past_due") {
    warn.push({ id: "past-due", message: "Your last payment failed. Update your card to keep your workspace active.", cta: "Update card", href: "/enterprise/billing", tone: "warn" });
  }

  // Trial ending
  if (ent.accessStatus === "trialing" && ent.trialEndsAt) {
    const days = Math.ceil((new Date(ent.trialEndsAt).getTime() - Date.now()) / 86_400_000);
    if (days <= 7) {
      (days <= 3 ? warn : info).push({
        id: `trial-${days}`,
        message: `Your trial ends in ${days} day${days === 1 ? "" : "s"}. Upgrade now to avoid interruption.`,
        cta: "Upgrade", href: "/enterprise/billing", tone: days <= 3 ? "warn" : "info",
      });
    }
  }

  // Recruiter seats
  const recLimit = ent.limits.recruiters;
  if (recLimit !== undefined && recLimit > 0) {
    if (usage.recruiters >= recLimit) {
      warn.push({ id: "recruiters-full", message: `You've reached your recruiter limit (${usage.recruiters}/${recLimit}). Add another recruiter for $29/month.`, cta: "Add recruiter", href: "/enterprise/addons", tone: "warn" });
    } else if (usage.recruiters >= Math.ceil(recLimit * 0.8)) {
      info.push({ id: "recruiters-near", message: `You've used ${usage.recruiters} of ${recLimit} recruiter seats.`, cta: "Add seats", href: "/enterprise/addons", tone: "info" });
    }
  }

  // Active jobs
  const jobLimit = ent.limits.jobs;
  if (jobLimit !== undefined && jobLimit > 0 && usage.jobs >= Math.ceil(jobLimit * 0.8)) {
    const over = usage.jobs >= jobLimit;
    (over ? warn : info).push({ id: over ? "jobs-full" : "jobs-near", message: `You've used ${usage.jobs} of ${jobLimit} active jobs.${over ? " Upgrade for more." : ""}`, cta: "Upgrade plan", href: "/enterprise/plans", tone: over ? "warn" : "info" });
  }

  // Candidates
  const candLimit = ent.limits.candidates;
  if (candLimit !== undefined && candLimit > 0 && usage.candidates >= Math.ceil(candLimit * 0.8)) {
    const over = usage.candidates >= candLimit;
    (over ? warn : info).push({ id: over ? "cands-full" : "cands-near", message: `You've used ${usage.candidates.toLocaleString()} of ${candLimit.toLocaleString()} candidates.${over ? " Upgrade for more." : ""}`, cta: "Upgrade plan", href: "/enterprise/plans", tone: over ? "warn" : "info" });
  }

  // Soft add-on upsells (only when not already active)
  if (!ent.features.includes("recruiting_agent")) {
    upsell.push({ id: "upsell-agent", message: "Automate sourcing, outreach, and follow-ups with the Autonomous Recruiting Agent.", cta: "Add for $499/mo", href: "/enterprise/addons", tone: "upsell" });
  }
  if (!ent.features.includes("ai_interviews")) {
    upsell.push({ id: "upsell-interviews", message: "Screen candidates faster with AI voice & avatar interviews and auto-scoring.", cta: "Add for $199/mo", href: "/enterprise/addons", tone: "upsell" });
  }

  return [...warn, ...info, ...upsell];
}
