import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";
import { quoteEmail } from "@/lib/enterprise-email";
import { fmtUSD } from "@/lib/enterprise-quote";
import { logOutboundEmail } from "@/lib/support-log";

export const dynamic = "force-dynamic";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

// PATCH — update a quote's status (e.g. mark accepted/expired from the admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.status === "string") patch.status = b.status;
  const { data, error } = await supabaseAdmin.from("enterprise_quotes").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}

// POST — email the quote to the client and mark it sent.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: q } = await supabaseAdmin.from("enterprise_quotes").select("*").eq("id", id).maybeSingle();
  if (!q) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  if (!q.contact_email) return NextResponse.json({ error: "This quote has no client email." }, { status: 400 });

  const planName = (q.plan_slug as string).charAt(0).toUpperCase() + (q.plan_slug as string).slice(1);
  const email = quoteEmail({
    firstName: (q.contact_name as string | null) || "there",
    company: (q.company as string | null) || "your team",
    planName,
    billingPeriod: q.billing_period as "monthly" | "yearly",
    monthlyLabel: fmtUSD(q.monthly_cents),
    yearlyLabel: fmtUSD(q.yearly_cents),
    firstYearLabel: fmtUSD(q.first_year_cents),
    founding: Boolean(q.founding),
    quoteUrl: `${APP_URL}/enterprise/quote/${q.token}`,
    appUrl: APP_URL,
  });

  await resend.emails.send({
    from: FROM_SUPPORT,
    to: q.contact_email as string,
    replyTo: SUPPORT_EMAIL,
    subject: email.subject,
    html: email.html,
  }).catch((e) => console.error("quote email", e));

  // Surface the sent quote in the admin Support Inbox.
  await logOutboundEmail({
    name: (q.contact_name as string | null) || (q.contact_email as string),
    email: q.contact_email as string,
    category: "quote",
    subject: email.subject,
    body: [
      `Quote sent to ${(q.contact_name as string | null) || q.contact_email}${q.company ? ` (${q.company})` : ""}.`,
      `Plan: ${planName} · ${q.billing_period}`,
      `Monthly ${fmtUSD(q.monthly_cents)} · Yearly ${fmtUSD(q.yearly_cents)} · First year ${fmtUSD(q.first_year_cents)}`,
      `Quote: ${APP_URL}/enterprise/quote/${q.token}`,
    ].join("\n"),
    summary: `Quote sent — ${q.company ?? q.contact_name ?? "client"} (${planName})`,
  });

  const { data } = await supabaseAdmin
    .from("enterprise_quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id).select("*").single();

  return NextResponse.json({ quote: data });
}
