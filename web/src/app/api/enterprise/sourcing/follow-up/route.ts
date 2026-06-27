import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { wrapEmail } from "@/lib/email-utils";

// Vercel Cron: daily at 9am UTC
// Sends follow-up 1 (3 days after initial) and follow-up 2 (7 days after initial)
// to sourced candidates who haven't replied

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Follow-up 1: sent 3 days ago (72h window ±12h)
  const fu1Start = new Date(now.getTime() - 84 * 60 * 60_000).toISOString();
  const fu1End   = new Date(now.getTime() - 60 * 60 * 60_000).toISOString();
  // Follow-up 2: sent 7 days ago (168h window ±12h)
  const fu2Start = new Date(now.getTime() - 180 * 60 * 60_000).toISOString();
  const fu2End   = new Date(now.getTime() - 156 * 60 * 60_000).toISOString();

  const [{ data: fu1Due }, { data: fu2Due }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .select("*, org:enterprise_orgs(name), job:enterprise_jobs(title)")
      .is("replied_at", null)
      .is("follow_up_1_sent_at", null)
      .eq("unsubscribed", false)
      .gte("created_at", fu1Start)
      .lte("created_at", fu1End),
    supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .select("*, org:enterprise_orgs(name), job:enterprise_jobs(title)")
      .is("replied_at", null)
      .not("follow_up_1_sent_at", "is", null)
      .is("follow_up_2_sent_at", null)
      .eq("unsubscribed", false)
      .gte("created_at", fu2Start)
      .lte("created_at", fu2End),
  ]);

  let sent = 0;

  const sendFollowUp = async (
    row: Record<string, unknown>,
    num: 1 | 2,
  ) => {
    const orgName = (row.org as { name: string } | null)?.name ?? "the company";
    const jobTitle = (row.job as { title: string } | null)?.title ?? "our open role";
    const name = row.candidate_name as string;
    const email = row.candidate_email as string;

    const subjects: Record<number, string> = {
      1: `Following up — ${jobTitle} at ${orgName}`,
      2: `Last note — ${jobTitle} at ${orgName}`,
    };
    const bodies: Record<number, string> = {
      1: `Hi ${name},\n\nI wanted to follow up on my previous note about the ${jobTitle} role at ${orgName}. We're still looking for great candidates and your background stood out to us.\n\nWould you be open to a quick 15-minute call this week? Happy to work around your schedule.`,
      2: `Hi ${name},\n\nI'll keep this brief — we're wrapping up our search for the ${jobTitle} role at ${orgName}. If you have any interest, now would be a great time to connect. Otherwise, no worries at all — I'll remove you from my list.\n\nHope to hear from you!`,
    };

    await resend.emails.send({
      from: `${orgName} Recruiting <support@jobsai.work>`,
      to: email,
      subject: subjects[num],
      // Candidate follow-up reads as the company's own email — no JobsAI footer.
      html: wrapEmail(`<p>${bodies[num].replace(/\n/g, "<br>")}</p>`, false),
    });

    const field = num === 1 ? "follow_up_1_sent_at" : "follow_up_2_sent_at";
    await supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .update({ [field]: new Date().toISOString() })
      .eq("id", row.id as string);

    sent++;
  };

  await Promise.allSettled([
    ...(fu1Due ?? []).map((r) => sendFollowUp(r as Record<string, unknown>, 1)),
    ...(fu2Due ?? []).map((r) => sendFollowUp(r as Record<string, unknown>, 2)),
  ]);

  return NextResponse.json({ ok: true, sent });
}
