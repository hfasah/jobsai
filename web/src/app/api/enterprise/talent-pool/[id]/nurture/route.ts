import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: candidate } = await supabaseAdmin
    .from("enterprise_talent_pool")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const subject = body.subject ?? `New opportunities at ${org.name}`;
  const message = body.message ?? `Hi ${candidate.candidate_name}, we have exciting new roles that match your profile. We'd love to reconnect.`;

  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: candidate.candidate_email,
    subject,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#2563eb">${subject}</h2>
      <p>${message}</p>
      <p style="margin-top:24px;color:#888;font-size:12px">You are receiving this because you previously applied to ${org.name}. <a href="mailto:support@jobsai.work?subject=Unsubscribe">Unsubscribe</a></p>
    </div>`,
  }).catch(console.error);

  await supabaseAdmin
    .from("enterprise_talent_pool")
    .update({ last_contacted: new Date().toISOString(), status: "contacted" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
