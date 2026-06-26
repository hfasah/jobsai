import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext, labelFor } from "@/lib/enterprise-crm";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 45;

// Per-user rate limit (20/min) — same shape as the recruiting copilot.
const rl = new Map<string, { count: number; reset: number }>();
function allowed(id: string) {
  const now = Date.now(); const e = rl.get(id);
  if (!e || now > e.reset) { rl.set(id, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= 20) return false; e.count++; return true;
}

const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString() : "—");

// Build a compact, factual context block about one client company for the LLM.
async function companyContext(orgId: string, companyId: string): Promise<string | null> {
  const { data: company } = await supabaseAdmin.from("crm_companies").select("*").eq("id", companyId).eq("org_id", orgId).maybeSingle();
  if (!company) return null;
  const [contacts, activities, jobOrders, deals] = await Promise.all([
    supabaseAdmin.from("crm_contacts").select("first_name,last_name,title,contact_type,relationship_status,last_contacted_at").eq("org_id", orgId).eq("company_id", companyId),
    supabaseAdmin.from("crm_activities").select("type,subject,body,outcome,occurred_at").eq("org_id", orgId).eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(20),
    supabaseAdmin.from("crm_job_orders").select("title,status,priority,openings,placement_value").eq("org_id", orgId).eq("company_id", companyId).order("created_at", { ascending: false }),
    supabaseAdmin.from("crm_deals").select("name,stage,value,probability,expected_close_at").eq("org_id", orgId).eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);

  const lines: string[] = [];
  lines.push(`Company: ${company.name}${company.industry ? ` (${company.industry})` : ""} — status: ${labelFor(company.status)}.`);
  if (company.location) lines.push(`Location: ${company.location}.`);
  lines.push(`Last activity: ${fmtDate(company.last_activity_at)}. Next follow-up: ${fmtDate(company.next_follow_up_at)}.`);
  if (company.notes) lines.push(`Notes: ${String(company.notes).slice(0, 600)}`);
  lines.push("");
  lines.push(`Contacts (${contacts.data?.length ?? 0}): ` + (contacts.data ?? []).map((c) => `${c.first_name} ${c.last_name ?? ""} — ${c.title ?? labelFor(c.contact_type)} [${labelFor(c.relationship_status)}, last contacted ${fmtDate(c.last_contacted_at)}]`).join("; "));
  lines.push(`Job orders (${jobOrders.data?.length ?? 0}): ` + (jobOrders.data ?? []).map((j) => `${j.title} [${labelFor(j.status)}, ${labelFor(j.priority)}, ${j.openings} opening(s)${j.placement_value ? `, ~$${j.placement_value}` : ""}]`).join("; "));
  lines.push(`Deals (${deals.data?.length ?? 0}): ` + (deals.data ?? []).map((d) => `${d.name} [${labelFor(d.stage)}${d.value ? `, $${d.value}` : ""}${d.probability != null ? `, ${d.probability}%` : ""}]`).join("; "));
  lines.push("");
  lines.push("Recent activity (newest first):");
  for (const a of activities.data ?? []) lines.push(`- ${fmtDate(a.occurred_at)} ${labelFor(a.type)}${a.subject ? `: ${a.subject}` : ""}${a.outcome ? ` (outcome: ${a.outcome})` : ""}`);
  if (!(activities.data ?? []).length) lines.push("- (no activity logged yet)");
  return lines.join("\n");
}

// Org-wide snapshot for spotting clients that have gone quiet.
async function dormantContext(orgId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("crm_companies")
    .select("name,status,last_activity_at,next_follow_up_at")
    .eq("org_id", orgId)
    .order("last_activity_at", { ascending: true, nullsFirst: true })
    .limit(60);
  return (data ?? []).map((c) => `${c.name} [${labelFor(c.status)}] — last activity ${fmtDate(c.last_activity_at)}, next follow-up ${fmtDate(c.next_follow_up_at)}`).join("\n") || "(no companies yet)";
}

const SYSTEM = (orgName: string, industry?: string | null) =>
  `You are an expert staffing/recruiting account manager working inside ${orgName}'s CRM${industry ? ` (${industry})` : ""}. You help agency recruiters manage client relationships, job orders, and deals. Be specific and practical, grounded ONLY in the provided context — never invent facts, names, numbers, or history. Produce ready-to-use output with no preamble. Emails must include a subject line. Keep it concise and well-structured.`;

// action → instruction. Each is appended to the company/dormant context.
const PROMPTS: Record<string, string> = {
  summarize_company: "Summarize this client relationship: where it stands, open job orders and deals, recent momentum, and any risks. 4–6 sentences.",
  next_best_action: "Recommend the single next best action to move this relationship forward, plus 2–3 alternative actions. Be concrete (who to contact, about what).",
  draft_follow_up: "Write a short, warm follow-up email to this client to re-engage and advance open work. Include a subject line.",
  draft_intake_questions: "Write a focused client intake questionnaire (8–12 questions) to fully scope a new role/job order for this client — covering must-haves, comp/bill rate, process, and timeline.",
  summarize_activity: "Summarize the recent activity timeline into a tight status update (bullets), highlighting outcomes and what's pending.",
  draft_client_update: "Write a professional client update email summarizing current progress on their open roles and next steps. Include a subject line.",
  draft_candidate_submission: "Write a candidate submission email to this client. Use ONLY the candidate details provided in the request; if details are missing, leave clearly-marked [placeholders]. Include a subject line.",
  score_opportunity: "Score this client opportunity from 0–100 based on engagement, responsiveness, open job orders, and deal value/stage. Output: 'Opportunity score: N/100' then 3–5 bullets explaining the score and how to raise it.",
  identify_dormant: "From the list, identify the clients most at risk of going dormant or worth re-engaging now. Return a prioritized list (max 10) with a one-line reason and a suggested next touch for each.",
};

export async function POST(req: NextRequest) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  if (!allowed(ctx.userId)) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const action: string = (body.action ?? "").trim();
  const freeform: string = (body.prompt ?? "").trim();
  const companyId: string | undefined = body.company_id || undefined;

  // Assemble context.
  let context = "";
  if (action === "identify_dormant") {
    context = await dormantContext(ctx.org.id);
  } else if (companyId) {
    const c = await companyContext(ctx.org.id, companyId);
    if (!c) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    context = c;
  }

  const instruction = action === "ask"
    ? (freeform || "Summarize this client relationship.")
    : PROMPTS[action];
  if (!instruction) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (action !== "identify_dormant" && action !== "ask" && !companyId) {
    return NextResponse.json({ error: "A company is required for this action." }, { status: 400 });
  }

  const extra = (body.extra ?? "").trim();
  const userMsg = [
    instruction,
    extra ? `\nAdditional details from the recruiter:\n${extra.slice(0, 2000)}` : "",
    context ? `\n--- CONTEXT ---\n${context.slice(0, 6000)}` : "",
  ].join("");

  const tier = AI_TIERS.fast;
  try {
    const completion = await getAIClient(tier.provider).chat.completions.create({
      model: tier.model,
      max_tokens: 1200,
      messages: [{ role: "system", content: SYSTEM(ctx.org.name, ctx.org.industry) }, { role: "user", content: userMsg }],
    });
    recordUsage({ orgId: ctx.org.id, userId: ctx.userId, feature: "crm_ai", model: tier.model, usage: completion.usage });
    const output = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ output });
  } catch (err) {
    console.error("CRM AI error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
