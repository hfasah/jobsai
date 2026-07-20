import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";
import { inviteToken, inviteExpiresAt } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";
type Ctx = { params: Promise<{ orgId: string }> };

// POST /api/admin/enterprise/[orgId]/owner — assign / (re)invite the owner email
// on an EXISTING org and provision their login. They join this same workspace on
// first sign-in via claimPendingInvites — no data is recreated. Use to set the
// owner, change the owner, or simply re-send the login invite.
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdminPerm("enterprise.manage");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid owner email is required." }, { status: 400 });
  }

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  // Record as the org's owner/primary contact.
  await supabaseAdmin.from("enterprise_orgs").update({ contact_email: email }).eq("id", orgId);

  // Reuse a pending invite for this org+email, else create one. Either way the
  // link must be alive when it leaves this route: refresh the expiry on reuse —
  // handing back a stale token was exactly how "freshly created" client links
  // arrived dead ("Invalid or expired invitation", 2026-07-19).
  const { data: existing } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("id, token")
    .eq("org_id", orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle();
  let token = existing?.token as string | undefined;
  if (token) {
    const { error: refreshError } = await supabaseAdmin
      .from("enterprise_invitations")
      .update({ expires_at: inviteExpiresAt() })
      .eq("id", existing!.id);
    if (refreshError) console.error("[admin/owner] invite expiry refresh failed:", refreshError.message);
  } else {
    token = inviteToken(org.slug);
    const { error: insertError } = await supabaseAdmin.from("enterprise_invitations").insert({
      org_id: orgId,
      email,
      role: "owner",
      invited_by: admin.userId,
      token,
      expires_at: inviteExpiresAt(),
    });
    if (insertError) return NextResponse.json({ error: `Could not create the invitation: ${insertError.message}` }, { status: 500 });
  }
  const inviteUrl = `${APP_URL}/enterprise/invite/${token}`;

  // Clerk invitation → carries a ticket so the owner sets a password (email is
  // auto-verified, no second email) right on the invite page. We point its
  // redirectUrl at that page and email the ticket URL so one click lands there.
  let clerkInvited = true;
  let acceptUrl = inviteUrl;
  try {
    const client = await clerkClient();
    const inv = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: inviteUrl,
      publicMetadata: { enterprise_org_id: orgId, role: "owner" },
      ignoreExisting: true,
    });
    // Build a clean link on OUR domain that carries the ticket, instead of
    // emailing Clerk's raw clerk.jobsai.work/v1/tickets/accept URL (looks like
    // phishing). Our invite page reads __clerk_ticket and sets the password.
    const tkt = inv.url ? new URL(inv.url).searchParams.get("ticket") : null;
    if (tkt) acceptUrl = `${inviteUrl}?__clerk_ticket=${tkt}`;
  } catch (e) {
    // Most common reason: the email already has a JobsAI account — they can just
    // sign in (claimPendingInvites then joins them). Not an error for the admin.
    clerkInvited = false;
    console.warn("[admin/owner] Clerk invitation skipped:", e instanceof Error ? e.message : e);
  }

  // Branded welcome + invite email, signed by the founder. Keep claims grounded
  // in shipped recruiter capabilities (honesty over polish).
  if (resend) {
    const feat = (emoji: string, title: string, desc: string) => `
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:42px;">
          <div style="width:34px;height:34px;border-radius:9px;background:#eef2ff;font-size:17px;line-height:34px;text-align:center;">${emoji}</div>
        </td>
        <td style="padding:8px 0 8px 10px;vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">${title}</p>
          <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${desc}</p>
        </td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px 40px;">
    <div style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">

      <!-- Brand header -->
      <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#4f46e5 100%);padding:26px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${APP_URL}/brand-emblem.png" width="30" height="30" alt="JobsAI" style="display:block;width:30px;height:30px;border-radius:7px;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">JobsAI</span>
            <span style="font-size:12px;font-weight:700;color:#c7d2fe;letter-spacing:0.08em;text-transform:uppercase;margin-left:8px;">Enterprise</span>
          </td>
        </tr></table>
      </div>

      <div style="padding:32px;">
        <span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:5px 11px;border-radius:999px;">🎉 Workspace activated</span>
        <h1 style="margin:16px 0 12px;font-size:23px;font-weight:800;color:#0f172a;line-height:1.25;">Congratulations — <span style="color:#4f46e5;">${org.name}</span> is live on JobsAI Enterprise</h1>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">Welcome aboard! On behalf of our whole team, I'm thrilled to have <strong>${org.name}</strong> join the recruiters and hiring teams already using JobsAI to hire faster and smarter.</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">You've been set up as the <strong>owner</strong> of your private recruiting workspace. One click below signs you in — you'll create your password on first use and take full ownership.</p>

        <div style="text-align:center;margin:26px 0;">
          <a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 2px 6px rgba(79,70,229,0.35);">Open your workspace →</a>
        </div>

        <!-- What you can do -->
        <p style="margin:24px 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">Everything in your workspace</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${feat("🏢", "Branded careers page", "A polished careers page to showcase your roles and capture applicants.")}
          ${feat("📋", "Post & manage roles", "Publish openings and keep every job organized in one place.")}
          ${feat("🤖", "AI candidate matching", "Surface and rank the strongest candidates for each role automatically.")}
          ${feat("📥", "Effortless candidate intake", "Collect résumés by upload or your dedicated workspace email — parsed for you.")}
          ${feat("📊", "Applicant tracking", "Follow every applicant from first touch to hire, with your team in sync.")}
          ${feat("👥", "Invite your team", "Add colleagues so everyone collaborates in the same workspace.")}
        </table>

        <!-- Premium support -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
          <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">⭐ Priority support, included</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">As a workspace owner you get premium, priority support. Have a question or want a guided walkthrough? Don't hesitate — just reach us at <a href="mailto:support@jobsai.work" style="color:#4f46e5;text-decoration:none;font-weight:600;">support@jobsai.work</a> and we'll jump in.</p>
          </td></tr>
        </table>

        <p style="margin:22px 0 0;font-size:15px;line-height:1.65;color:#334155;">We can't wait to see who you hire. Welcome to JobsAI Enterprise. 🚀</p>

        <!-- Founder signoff -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
          <tr>
            <td width="58" height="58" align="center" valign="middle" style="width:58px;height:58px;background:#4f46e5;border-radius:29px;color:#ffffff;font-size:21px;font-weight:800;text-align:center;line-height:58px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><img src="${APP_URL}/team/hippolyte-asah.jpg" width="58" height="58" alt="HA" style="width:58px;height:58px;border-radius:29px;display:block;object-fit:cover;border:1px solid rgba(255,255,255,0.25);" /></td>
            <td style="width:14px;">&nbsp;</td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:15px;font-weight:800;color:#0f172a;">Hippolyte Asah</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Founder &amp; CEO, JobsAI Enterprise</p>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">Button not working? <a href="${acceptUrl}" style="color:#6366f1;text-decoration:underline;">Open your workspace here</a>.</p>
      </div>

      <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #eef2f7;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">JobsAI Enterprise · Recruiting, accelerated by AI · <a href="https://app.jobsai.work" style="color:#94a3b8;text-decoration:none;">app.jobsai.work</a></p>
      </div>
    </div>
  </div>
</body></html>`;

    await resend.emails.send({
      from: "JobsAI Enterprise <support@jobsai.work>",
      to: email,
      subject: `🎉 Welcome to JobsAI Enterprise — ${org.name} is ready`,
      html,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, invite_url: inviteUrl, clerk_invited: clerkInvited });
}
