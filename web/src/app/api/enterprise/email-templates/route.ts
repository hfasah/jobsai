import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  application_received: {
    subject: "We received your application — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThank you for applying to {{job_title}} at {{org_name}}. We've received your application and will review it shortly.\n\nWe'll be in touch soon.\n\nBest regards,\n{{org_name}} Recruiting Team",
  },
  interview_invited: {
    subject: "Interview invitation — {{job_title}} at {{org_name}}",
    body: "Hi {{candidate_name}},\n\nCongratulations! We'd like to invite you to complete an interview for {{job_title}} at {{org_name}}.\n\nPlease use the link below to complete your interview at your convenience. The link is valid for 7 days.\n\n{{interview_link}}\n\nBest regards,\n{{org_name}} Recruiting Team",
  },
  offer_sent: {
    subject: "Exciting news about your application — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nWe're thrilled to let you know that we'd like to extend an offer for {{job_title}} at {{org_name}}. Our team will be in touch shortly with the full details.\n\nBest regards,\n{{org_name}} Recruiting Team",
  },
  rejected: {
    subject: "Update on your application — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThank you for your interest in {{job_title}} at {{org_name}} and for the time you invested in your application. After careful consideration, we've decided to move forward with other candidates at this time.\n\nWe appreciate your interest and encourage you to apply for future openings.\n\nBest regards,\n{{org_name}} Recruiting Team",
  },
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_email_templates")
    .select("*")
    .eq("org_id", org.id);

  // Merge with defaults for any missing triggers
  const templates = Object.entries(DEFAULTS).map(([trigger, def]) => {
    const saved = (data ?? []).find((t) => t.trigger === trigger);
    return saved ?? { trigger, subject: def.subject, body: def.body, active: true, id: null };
  });

  return NextResponse.json({ data: templates });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { trigger, subject, body: emailBody, active } = body;

  if (!trigger || !subject || !emailBody) {
    return NextResponse.json({ error: "trigger, subject and body required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_email_templates")
    .upsert({ org_id: org.id, trigger, subject, body: emailBody, active: active ?? true }, { onConflict: "org_id,trigger" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
