import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orgs } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug")
    .limit(200);

  if (!orgs?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

  await Promise.allSettled(orgs.map(async (org) => {
    // Get owner/admin emails
    const { data: members } = await supabaseAdmin
      .from("enterprise_members")
      .select("user_id, role")
      .eq("org_id", org.id)
      .in("role", ["owner", "admin"]);

    if (!members?.length) return;

    // Collect digest data
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrowStr = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

    const [newAppsRes, activeJobsRes, stalledRes, todayInterviewsRes, pendingOffersRes, sourcingRepliesRes] = await Promise.all([
      // New high-score applicants since yesterday
      supabaseAdmin.from("enterprise_applications")
        .select("id,candidate_name,job_id,match_score,ai_recommendation, job:enterprise_jobs(title)")
        .eq("org_id", org.id)
        .gte("created_at", yesterday)
        .gte("match_score", 70)
        .not("stage", "eq", "rejected")
        .order("match_score", { ascending: false })
        .limit(5),

      // Active jobs
      supabaseAdmin.from("enterprise_jobs")
        .select("id,title,application_count")
        .eq("org_id", org.id)
        .eq("status", "active")
        .limit(10),

      // Candidates stuck in applied stage >2 weeks
      supabaseAdmin.from("enterprise_applications")
        .select("id,candidate_name,match_score")
        .eq("org_id", org.id)
        .eq("stage", "applied")
        .lte("created_at", twoWeeksAgo)
        .not("match_score", "is", null)
        .gte("match_score", 60)
        .limit(5),

      // Interviews scheduled for today
      supabaseAdmin.from("enterprise_interview_schedule")
        .select("id,candidate_name,job:enterprise_jobs(title),scheduled_at")
        .eq("org_id", org.id)
        .gte("scheduled_at", `${todayStr}T00:00:00`)
        .lt("scheduled_at", `${tomorrowStr}T00:00:00`)
        .limit(5),

      // Offers awaiting response
      supabaseAdmin.from("enterprise_offers")
        .select("id,candidate_name,job:enterprise_jobs(title),expires_at")
        .eq("org_id", org.id)
        .eq("status", "sent")
        .limit(5),

      // Sourcing replies received since yesterday
      supabaseAdmin.from("enterprise_sourcing_outreach")
        .select("id,candidate_name,job:enterprise_jobs(title)")
        .eq("org_id", org.id)
        .gte("replied_at", yesterday)
        .eq("reply_added_to_pipeline", false)
        .limit(5),
    ]);

    type AppRow = { id: string; candidate_name: string; job_id: string; match_score: number | null; ai_recommendation: string | null; job: unknown };
    type JobRow = { id: string; title: string; application_count: number | null };
    type StalledRow = { id: string; candidate_name: string; match_score: number | null };
    type InterviewRow = { id: string; candidate_name: string; job: unknown; scheduled_at: string };
    type OfferRow = { id: string; candidate_name: string; job: unknown; expires_at: string | null };
    type SourcingRow = { id: string; candidate_name: string; job: unknown };

    const newApps: AppRow[] = newAppsRes.data ?? [];
    const activeJobs: JobRow[] = activeJobsRes.data ?? [];
    const stalled: StalledRow[] = stalledRes.data ?? [];
    const todayInterviews: InterviewRow[] = todayInterviewsRes.data ?? [];
    const pendingOffers: OfferRow[] = pendingOffersRes.data ?? [];
    const sourcingReplies: SourcingRow[] = sourcingRepliesRes.data ?? [];

    // Skip if nothing interesting
    const totalActions = newApps.length + stalled.length + todayInterviews.length + pendingOffers.length + sourcingReplies.length;
    if (totalActions === 0) return;

    // Build HTML sections
    const sections: string[] = [];

    if (newApps.length > 0) {
      sections.push(`
        <h3 style="color:#2563eb;margin:20px 0 8px">⭐ New strong applicants (${newApps.length})</h3>
        <table style="width:100%;border-collapse:collapse">
          ${newApps.map((a) => {
            const jobTitle = (a.job as unknown as { title: string } | null)?.title ?? "Unknown role";
            const rec = a.ai_recommendation === "strong_yes" ? "🟢 Strong yes" : a.ai_recommendation === "yes" ? "🔵 Yes" : a.ai_recommendation === "maybe" ? "🟡 Maybe" : "";
            return `<tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:6px 0;font-weight:600">${a.candidate_name}</td>
              <td style="padding:6px 0;color:#64748b;font-size:13px">${jobTitle}</td>
              <td style="padding:6px 0;font-weight:700;color:${(a.match_score ?? 0) >= 75 ? "#16a34a" : "#d97706"}">${a.match_score}%</td>
              <td style="padding:6px 0;font-size:12px">${rec}</td>
            </tr>`;
          }).join("")}
        </table>
        <p style="margin:8px 0 0"><a href="${appUrl}/enterprise/candidates" style="color:#2563eb;font-size:13px">Review all candidates →</a></p>
      `);
    }

    if (todayInterviews.length > 0) {
      sections.push(`
        <h3 style="color:#7c3aed;margin:20px 0 8px">📅 Interviews today (${todayInterviews.length})</h3>
        <ul style="margin:0;padding-left:16px">
          ${todayInterviews.map((i) => {
            const jobTitle = (i.job as unknown as { title: string } | null)?.title ?? "";
            const time = new Date(i.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return `<li style="padding:3px 0;font-size:14px"><b>${i.candidate_name}</b> · ${jobTitle} · ${time}</li>`;
          }).join("")}
        </ul>
        <p style="margin:8px 0 0"><a href="${appUrl}/enterprise/schedule" style="color:#2563eb;font-size:13px">Open schedule →</a></p>
      `);
    }

    if (sourcingReplies.length > 0) {
      sections.push(`
        <h3 style="color:#0891b2;margin:20px 0 8px">💬 Sourcing replies received (${sourcingReplies.length})</h3>
        <ul style="margin:0;padding-left:16px">
          ${sourcingReplies.map((r) => {
            const jobTitle = (r.job as unknown as { title: string } | null)?.title ?? "Unknown role";
            return `<li style="padding:3px 0;font-size:14px"><b>${r.candidate_name}</b> · ${jobTitle}</li>`;
          }).join("")}
        </ul>
        <p style="margin:8px 0 0"><a href="${appUrl}/enterprise/sourcing" style="color:#2563eb;font-size:13px">Open sourcing →</a></p>
      `);
    }

    if (stalled.length > 0) {
      sections.push(`
        <h3 style="color:#dc2626;margin:20px 0 8px">⚠️ Candidates awaiting action (${stalled.length})</h3>
        <p style="margin:0 0 8px;color:#64748b;font-size:13px">These candidates have been in <b>Applied</b> for over 2 weeks.</p>
        <ul style="margin:0;padding-left:16px">
          ${stalled.map((a) => `<li style="padding:3px 0;font-size:14px"><b>${a.candidate_name}</b> · Score: ${a.match_score}%</li>`).join("")}
        </ul>
        <p style="margin:8px 0 0"><a href="${appUrl}/enterprise/candidates" style="color:#2563eb;font-size:13px">Take action →</a></p>
      `);
    }

    if (pendingOffers.length > 0) {
      sections.push(`
        <h3 style="color:#059669;margin:20px 0 8px">📄 Offers awaiting response (${pendingOffers.length})</h3>
        <ul style="margin:0;padding-left:16px">
          ${pendingOffers.map((o) => {
            const jobTitle = (o.job as unknown as { title: string } | null)?.title ?? "";
            const expires = o.expires_at ? ` · expires ${new Date(o.expires_at).toLocaleDateString()}` : "";
            return `<li style="padding:3px 0;font-size:14px"><b>${o.candidate_name}</b> · ${jobTitle}${expires}</li>`;
          }).join("")}
        </ul>
        <p style="margin:8px 0 0"><a href="${appUrl}/enterprise/offers" style="color:#2563eb;font-size:13px">View offers →</a></p>
      `);
    }

    const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#0f172a">
      <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <h2 style="margin:0;color:#fff;font-size:18px">Good morning, ${org.name}! ☀️</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Your recruiting briefing for ${today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      ${activeJobs.length > 0 ? `
        <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:16px">
          <p style="margin:0;font-size:13px;color:#64748b">
            <b style="color:#0f172a">${activeJobs.length} active job${activeJobs.length !== 1 ? "s" : ""}</b>
            · ${activeJobs.reduce((s: number, j: JobRow) => s + (j.application_count ?? 0), 0)} total applicants
          </p>
        </div>
      ` : ""}

      ${sections.join("")}

      <div style="margin-top:28px;text-align:center">
        <a href="${appUrl}/enterprise/dashboard" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">
          Open recruiting dashboard →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center">
        Powered by <a href="https://jobsai.work" style="color:#2563eb;text-decoration:none">JobsAI.Work</a>
        · <a href="${appUrl}/enterprise/settings" style="color:#94a3b8;text-decoration:none">Manage notifications</a>
      </p>
    </div>`;

    const clerk = await clerkClient();

    // Get emails for each member via Clerk
    await Promise.allSettled(members.map(async (member) => {
      let email: string | undefined;
      try {
        const user = await clerk.users.getUser(member.user_id);
        email = user.emailAddresses[0]?.emailAddress;
      } catch {
        return;
      }
      if (!email) return;

      await resend.emails.send({
        from: `${org.name} Recruiting <support@jobsai.work>`,
        to: email,
        subject: `${org.name} · Daily recruiting briefing — ${today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
        html,
      }).catch(console.error);

      sent++;
    }));
  }));

  return NextResponse.json({ sent });
}
