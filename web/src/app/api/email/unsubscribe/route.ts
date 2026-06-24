import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyUnsub } from "@/lib/email-unsub";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

async function unsubscribe(userId: string, token: string): Promise<boolean> {
  if (!verifyUnsub(userId, token)) return false;
  const { error } = await supabaseAdmin
    .from("user_preferences")
    .update({ alert_emails_enabled: false })
    .eq("user_id", userId);
  if (error) console.error("[email/unsubscribe]", error.message);
  return !error;
}

// RFC 8058 one-click: Gmail/Apple POST here directly from the inbox UI.
export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = await unsubscribe(u, t);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

// Footer link click → human confirmation page.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = await unsubscribe(u, t);

  const inner = ok
    ? `<h1 style="margin:0 0 8px;font-size:20px;color:#111827;">You're unsubscribed</h1>
       <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">You won't receive JobsAI job-alert emails anymore. You can turn them back on any time in your notification settings.</p>
       <a href="${APP_URL}/dashboard/preferences" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Notification settings</a>`
    : `<h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Link not valid</h1>
       <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">This unsubscribe link is invalid or expired. You can manage email preferences in your <a href="${APP_URL}/dashboard/preferences" style="color:#4f46e5;">notification settings</a>.</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:64px auto;padding:0 16px;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">${inner}</div>
  </div>
</body></html>`;

  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
