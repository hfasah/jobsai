import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { title, department, location, employment_type, extra_context } = body;
  if (!title) return NextResponse.json({ error: "Job title is required." }, { status: 400 });

  const prompt = `You are an expert technical recruiter. Generate a complete, professional job description for the following role.

Company: ${org.name}${org.industry ? ` (${org.industry})` : ""}
Job Title: ${title}
${department ? `Department: ${department}` : ""}
${location ? `Location: ${location}` : ""}
${employment_type ? `Employment Type: ${employment_type}` : ""}
${extra_context ? `Additional context: ${extra_context}` : ""}

Return a JSON object with exactly these fields:
{
  "description": "2-3 paragraph compelling overview of the role and company",
  "responsibilities": "8-10 key responsibilities, one per line starting with •",
  "qualifications": "6-8 required qualifications, one per line starting with •",
  "nice_to_have": "4-5 nice-to-have skills, one per line starting with •",
  "salary_note": "Brief salary range guidance (e.g. '$80,000 – $110,000 depending on experience')"
}

Make the language inclusive, compelling, and SEO-optimized. Be specific and realistic for ${org.industry ?? "the industry"}.`;

  try {
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("JD generation error:", err);
    return NextResponse.json({ error: "Failed to generate job description." }, { status: 500 });
  }
}
