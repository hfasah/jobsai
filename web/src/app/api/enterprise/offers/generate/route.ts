import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { candidate_name, job_title, salary, start_date, notes } = body;

  if (!candidate_name?.trim() || !job_title?.trim()) {
    return NextResponse.json({ error: "candidate_name and job_title are required." }, { status: 400 });
  }

  const prompt = `Write a professional, warm offer letter in HTML (no <html>/<body> tags, just the body content).
Company: ${org.name}
Candidate: ${candidate_name}
Role: ${job_title}
${salary ? `Compensation: ${salary}` : ""}
${start_date ? `Start date: ${start_date}` : ""}
${notes ? `Additional context: ${notes}` : ""}

Use <p> tags for paragraphs. Include: warm opening, role confirmation, compensation (if provided), start date (if provided), next steps (sign this letter), and a welcoming close. Keep it under 400 words. Sign off as "The ${org.name} Team".`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    });
    const content = resp.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ content });
  } catch {
    const content = `<p>Dear ${candidate_name},</p>
<p>We are delighted to offer you the position of <strong>${job_title}</strong> at <strong>${org.name}</strong>.</p>
${salary ? `<p><strong>Compensation:</strong> ${salary}</p>` : ""}
${start_date ? `<p><strong>Start date:</strong> ${start_date}</p>` : ""}
<p>Please review this offer and sign to confirm your acceptance. We look forward to welcoming you to the team.</p>
<p>Warm regards,<br/>The ${org.name} Team</p>`;
    return NextResponse.json({ content });
  }
}
