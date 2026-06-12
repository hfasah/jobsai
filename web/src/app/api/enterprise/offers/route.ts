import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .select("id,candidate_name,candidate_email,job_title,salary,start_date,content,notes,status,sign_token,signed_at,declined_at,created_at,job_id,application_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { candidate_name, candidate_email, job_title, salary, start_date, notes, job_id, application_id, generate } = body;

  if (!candidate_name?.trim() || !candidate_email?.trim() || !job_title?.trim()) {
    return NextResponse.json({ error: "candidate_name, candidate_email, and job_title are required." }, { status: 400 });
  }

  let content: string = body.content ?? "";

  if (generate || !content) {
    try {
      const prompt = `Write a professional, warm offer letter in HTML (no <html>/<body> tags, just the body content).
Company: ${org.name}
Candidate: ${candidate_name}
Role: ${job_title}
${salary ? `Compensation: ${salary}` : ""}
${start_date ? `Start date: ${start_date}` : ""}
${notes ? `Additional context: ${notes}` : ""}

Use <p> tags for paragraphs. Include: warm opening, role confirmation, compensation (if provided), start date (if provided), next steps (sign this letter), and a welcoming close. Keep it under 400 words. Sign off as "The ${org.name} Team".`;

      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      });
      content = resp.choices[0]?.message?.content?.trim() ?? "";
    } catch {
      content = `<p>Dear ${candidate_name},</p>
<p>We are delighted to offer you the position of <strong>${job_title}</strong> at <strong>${org.name}</strong>.</p>
${salary ? `<p><strong>Compensation:</strong> ${salary}</p>` : ""}
${start_date ? `<p><strong>Start date:</strong> ${start_date}</p>` : ""}
<p>Please review this offer and sign below to confirm your acceptance. We look forward to welcoming you to the team.</p>
<p>Warm regards,<br/>The ${org.name} Team</p>`;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .insert({
      org_id: org.id,
      created_by: userId,
      candidate_name: candidate_name.trim(),
      candidate_email: candidate_email.trim().toLowerCase(),
      job_title: job_title.trim(),
      salary: salary?.trim() || null,
      start_date: start_date?.trim() || null,
      content,
      notes: notes?.trim() || null,
      job_id: job_id ?? null,
      application_id: application_id ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
