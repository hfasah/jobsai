import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getMyOrg } from "@/lib/enterprise";
import { recordUsage } from "@/lib/llm-usage";
import { extractText } from "@/lib/resume-extractor";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
let _ai: OpenAI | null = null;
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// POST — parse a pasted or uploaded (PDF/Word) job description / hiring-manager
// request into structured fields, to pre-fill the "Post a new job" form.
// Accepts multipart { file } (PDF/DOC/DOCX) or { text }, or JSON { text }.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  let text = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = form.get("text");
      if (file instanceof File) {
        if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
        const buf = Buffer.from(await file.arrayBuffer());
        text = (await extractText(buf, file.type)).text;
      } else if (typeof pasted === "string") {
        text = pasted;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      text = String(body.text ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Couldn't read that input. Paste text or upload a PDF/Word file." }, { status: 422 });
  }

  text = text.trim();
  if (text.length < 30) {
    return NextResponse.json({ error: "Paste a job description or upload a PDF/Word file." }, { status: 400 });
  }

  const prompt = `Extract structured fields from this job posting or hiring-manager request. Use ONLY information present in the text — leave a field as "" or null if it isn't stated; do NOT invent details.

Return ONLY JSON with exactly these keys:
{
  "title": "string",
  "department": "one of: Engineering, Product, Design, Marketing, Sales, Operations, Finance, HR, Legal, Customer Success, Other — or empty",
  "employment_type": "one of: full-time, part-time, contract, internship",
  "location": "string",
  "salary_min": number or null,
  "salary_max": number or null,
  "description": "2-3 paragraph overview of the role",
  "responsibilities": "key responsibilities, one per line starting with •",
  "qualifications": "required qualifications, one per line starting with •",
  "nice_to_have": "nice-to-have items, one per line starting with • — or empty"
}

Job text:
"""
${text.slice(0, 12000)}
"""`;

  try {
    const completion = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    recordUsage({ orgId: org.id, userId, feature: "job_parse", model: "gpt-4o-mini", usage: completion.usage });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("Job parse error:", err);
    return NextResponse.json({ error: "Couldn't parse that job. Try pasting the text directly." }, { status: 500 });
  }
}
