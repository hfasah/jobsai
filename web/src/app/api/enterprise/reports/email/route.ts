import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { computeReport, reportEmailHtml } from "@/lib/enterprise-reports";
import { resend } from "@/lib/resend";

export const maxDuration = 30;

// POST — email the current report to recipients
// body: { recipients: string[], note?: string, filters?: {from,to,job,department} }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const recipients: string[] = Array.isArray(body.recipients)
    ? body.recipients.map((e: string) => e.trim()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    : [];
  if (!recipients.length) return NextResponse.json({ error: "Add at least one valid email." }, { status: 400 });

  const report = await computeReport(org.id, body.filters ?? {});
  const html = reportEmailHtml(org.name, report, body.note);

  const { error } = await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: recipients,
    subject: `${org.name} — Hiring Report (${new Date().toLocaleDateString()})`,
    html,
  });

  if (error) return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  return NextResponse.json({ ok: true, sent_to: recipients.length });
}
