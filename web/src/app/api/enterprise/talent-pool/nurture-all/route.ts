import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, enterpriseMailMeta } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

export const maxDuration = 60;

// POST { group_id?, subject, message } — nurture everyone in a talent pool with
// one email each (personalised greeting). group_id "none" = ungrouped; omitted =
// the whole talent pool. White-label via enterpriseMailMeta.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { group_id, subject, message } = await req.json().catch(() => ({}));
  if (!message || !String(message).trim()) return NextResponse.json({ error: "Message required." }, { status: 400 });

  let query = supabaseAdmin
    .from("enterprise_talent_pool")
    .select("id, candidate_name, candidate_email")
    .eq("org_id", org.id);
  if (group_id === "none") query = query.is("group_id", null);
  else if (group_id) query = query.eq("group_id", group_id);

  const { data: members, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!members?.length) return NextResponse.json({ error: "No candidates in this pool." }, { status: 400 });

  const subjectLine = (subject && String(subject).trim()) || `New opportunities at ${org.name}`;
  const { from, replyTo } = await enterpriseMailMeta(org.id);

  let sent = 0;
  await Promise.allSettled(members.map(async (m) => {
    const greet = (m.candidate_name as string | null)?.split(/\s+/)[0] || "there";
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <p>Hi ${greet},</p>
      <p style="white-space:pre-wrap;line-height:1.6">${String(message)}</p>
      <p style="margin-top:24px;color:#888;font-size:12px">You are receiving this because you're in ${org.name}'s talent pool. <a href="mailto:support@jobsai.work?subject=Unsubscribe">Unsubscribe</a></p>
    </div>`;
    const res = await resend.emails.send({ from, replyTo, to: m.candidate_email as string, subject: subjectLine, html }).catch(() => null);
    if (res && !("error" in res && res.error)) sent++;
  }));

  await supabaseAdmin
    .from("enterprise_talent_pool")
    .update({ last_contacted: new Date().toISOString(), status: "contacted" })
    .in("id", members.map((m) => m.id as string));

  return NextResponse.json({ data: { sent, total: members.length } });
}
