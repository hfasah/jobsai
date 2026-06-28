import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { renderOutreachBody, getRecruiterIdentity, greetingName } from "@/lib/sourcing-email";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";
import { logMessage } from "@/lib/enterprise-messages";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 60;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

type CandidateRef = {
  id: string;
  source: "application" | "pool";
  name: string;
  email: string;
  fit_reason?: string;
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "ai_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { candidates, job_id, message_style = "warm" } = await req.json().catch(() => ({}));

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "candidates array is required." }, { status: 400 });
  }
  if (candidates.length > 50) {
    return NextResponse.json({ error: "Max 50 candidates per outreach batch." }, { status: 400 });
  }

  // Load job context
  let jobTitle = "a new opportunity";
  let jobDesc = "";
  if (job_id) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("title, description, qualifications")
      .eq("id", job_id)
      .eq("org_id", org.id)
      .maybeSingle();
    if (job) {
      jobTitle = job.title;
      jobDesc = `${job.description ?? ""}\nKey requirements: ${(job.qualifications ?? "").slice(0, 300)}`;
    }
  }

  // Load org branding + intake handle (for the Reply-To)
  const { data: orgData } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, show_powered_by, white_label_email_from, slug, intake_email_handle")
    .eq("id", org.id)
    .maybeSingle();
  const orgName = orgData?.name ?? org.name;
  const fromName = emailFromName(orgName, orgData?.white_label_email_from ?? null);

  // Recruiter name for the signature; their email is only a last-resort Reply-To.
  const { name: recruiterName, email: recruiterEmail } = await getRecruiterIdentity(userId);

  // Reply-To = the org's intake address, so candidate replies flow back into the
  // JobsAI inbox (captured by the inbound webhook) and the thread stays in-system.
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug, intake_email_handle: orgData.intake_email_handle }) : null;
  const replyTo = intake ? `${orgName} <${intake}>` : (recruiterEmail ?? undefined);

  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const cand of candidates as CandidateRef[]) {
    try {
      const greet = greetingName(cand.name);
      // Generate personalized message via GPT
      const msgPrompt = `Write a short, ${message_style} outreach email from a recruiter at "${orgName}" to a candidate.

Role we're reaching out about: ${jobTitle}
${jobDesc ? `Role context: ${jobDesc.slice(0, 300)}` : ""}
Why this candidate is a fit: ${cand.fit_reason ?? "strong background that matches our needs"}

Style: conversational, respectful, no fluff. No subject line needed (we add that separately).
Structure the body as a greeting line starting with "Hi ${greet}," then 1-2 short paragraphs (a sentence or two each), separated by a blank line. Do NOT start with "I hope this email finds you well" or similar filler.
End the last paragraph with a clear soft CTA: ask if they're open to a quick call.
Do NOT include any sign-off or signature (no "Best regards", no name, no "— The team") — that is added automatically. Do NOT mention JobsAI or any platform.

Return JSON where "body" uses "\\n\\n" between paragraphs: { "subject": "...", "body": "..." }`;

      let subject = `New opportunity at ${orgName} — ${jobTitle}`;
      let bodyText = `Hi ${greet},\n\nWe came across your profile and think you'd be a great fit for our ${jobTitle} role at ${orgName}.${cand.fit_reason ? ` ${cand.fit_reason}` : ""}\n\nWould you be open to a quick 15-minute call to explore this further?`;

      try {
        const resp = await ai().chat.completions.create({
          model: AI_TIERS.fast.model,
          messages: [{ role: "user", content: msgPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 400,
        });
        const parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) bodyText = parsed.body;
        recordUsage({ userId, feature: "sourcing_outreach", model: AI_TIERS.fast.model, usage: { prompt_tokens: resp.usage?.prompt_tokens, completion_tokens: resp.usage?.completion_tokens } });
      } catch {
        // fall through to default message
      }

      // White-label send: reads as the company's own email (no "Powered by
      // JobsAI"), with Reply-To pointing at the in-system intake address.
      const html = wrapEmail(renderOutreachBody(bodyText, recruiterName, orgName), false);

      await resend.emails.send({
        from: `${fromName} <support@jobsai.work>`,
        to: cand.email,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });

      // Thread the outbound message to the candidate's application so the whole
      // conversation lives in JobsAI.
      await logMessage({
        orgId: org.id,
        applicationId: cand.source === "application" ? cand.id : null,
        direction: "outbound",
        fromEmail: "support@jobsai.work",
        toEmail: cand.email,
        subject,
        body: bodyText,
      });

      // Mark talent pool candidate as contacted
      if (cand.source === "pool") {
        await supabaseAdmin
          .from("enterprise_talent_pool")
          .update({ status: "contacted", last_contacted: new Date().toISOString() })
          .eq("id", cand.id)
          .eq("org_id", org.id);
      }

      // Track outreach send for follow-up sequences
      await supabaseAdmin.from("enterprise_sourcing_outreach").insert({
        org_id: org.id,
        job_id: job_id ?? null,
        candidate_name: cand.name,
        candidate_email: cand.email,
        candidate_source: cand.source,
        source_id: cand.id,
        subject,
        sent_by: userId,
      });

      results.push({ email: cand.email, ok: true });
    } catch (err) {
      results.push({ email: cand.email, ok: false, error: String(err) });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ data: { sent, failed: results.length - sent, results } });
}
