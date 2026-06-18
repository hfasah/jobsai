import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";

export const dynamic = "force-dynamic";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL ?? SUPPORT_EMAIL;

// POST — public: the client accepts the quote from the hosted page.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: q } = await supabaseAdmin
    .from("enterprise_quotes").select("id,status,company,contact_name,contact_email,plan_slug")
    .eq("token", token).maybeSingle();
  if (!q) return NextResponse.json({ error: "Quote not found." }, { status: 404 });

  if (q.status !== "accepted") {
    await supabaseAdmin.from("enterprise_quotes")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", q.id);

    // Notify the back office (best-effort).
    resend.emails.send({
      from: FROM_SUPPORT,
      to: NOTIFY_EMAIL,
      replyTo: (q.contact_email as string | null) || SUPPORT_EMAIL,
      subject: `Quote accepted — ${q.company ?? q.contact_name ?? "client"} (${q.plan_slug})`,
      html: `<div style="font-family:sans-serif"><h2 style="color:#4338ca">Quote accepted 🎉</h2>
        <p><strong>${q.company ?? ""}</strong> — ${q.contact_name ?? ""} &lt;${q.contact_email ?? ""}&gt;</p>
        <p>Plan: <strong>${q.plan_slug}</strong></p>
        <p><a href="${APP_URL}/admin/enterprise/intake">Open the back office →</a></p></div>`,
    }).then(() => {}, (e) => console.error("quote accept notify", e));
  }

  return NextResponse.json({ ok: true });
}
