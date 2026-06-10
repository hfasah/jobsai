import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getModel, logModelUsage } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import type { ResumeData } from "@/components/resume/resume-preview-client";
import type { ParsedJson } from "@/types/resume";

export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// POST /api/resumes/translate
// Body: { version_id: string; target_language: string }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const versionId: string = body.version_id ?? "";
  const targetLanguage: string = (body.target_language ?? "").trim();

  if (!versionId || !targetLanguage) {
    return NextResponse.json({ error: "version_id and target_language are required." }, { status: 400 });
  }

  // Verify ownership via resume_documents
  const { data: verifyRow } = await supabaseAdmin
    .from("resume_versions")
    .select("id, document_id, resume_documents!inner(user_id)")
    .eq("id", versionId)
    .maybeSingle();

  type VerifyRow = { id: string; document_id: string; resume_documents: { user_id: string } | { user_id: string }[] };
  const row = verifyRow as VerifyRow | null;
  const owner = row
    ? Array.isArray(row.resume_documents) ? row.resume_documents[0]?.user_id : row.resume_documents?.user_id
    : null;

  if (!row || owner !== userId) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  // Load parsed profile
  const { data: profileRow } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("full_name, email, phone, location, links, parsed_json")
    .eq("version_id", versionId)
    .maybeSingle();

  if (!profileRow?.parsed_json) {
    return NextResponse.json({
      error: "Your resume is still being analyzed. Please wait a moment and try again.",
      reason: "resume_not_ready",
    }, { status: 409 });
  }

  const pj = profileRow.parsed_json as ParsedJson;
  const links = (profileRow.links ?? pj.links ?? {}) as Record<string, string>;

  // Build source data
  const sourceData = {
    headline:   pj.headline   ?? "",
    summary:    pj.summary    ?? "",
    experience: (pj.experience ?? []).map((e) => ({
      title:      e.title,
      company:    e.company,
      start_date: e.start_date,
      end_date:   e.end_date,
      is_current: e.is_current,
      description: e.description ?? "",
    })),
    education: (pj.education ?? []).map((e) => ({
      school:        e.school,
      degree:        e.degree ?? "",
      field_of_study: e.field_of_study ?? "",
    })),
    skills: (pj.skills ?? []).map((s) => s.skill),
  };

  const systemPrompt = `You are a professional resume translator. Translate the provided resume content into ${targetLanguage}.

Rules:
- Translate: headline, summary, experience titles, experience descriptions/bullets, education degree names, field of study, soft skills
- Keep as-is: company names, school names, dates, email addresses, phone numbers, URLs, technical skills and tools (e.g. React, AWS, Python, SQL), certifications, proper nouns
- Match professional register appropriate for ${targetLanguage} job market
- Return ONLY a valid JSON object with this exact shape:
{
  "headline": "<translated>",
  "summary": "<translated>",
  "experience": [
    { "title": "<translated title>", "description": "<translated description, or empty string>" }
  ],
  "education": [
    { "degree": "<translated>", "field_of_study": "<translated>" }
  ],
  "skills": ["<translated or kept as-is>"]
}
- experience and education arrays must have the SAME length and order as the input
- skills: keep technical tools as-is, translate soft/general skills`;

  const userPrompt = JSON.stringify(sourceData, null, 2);

  try {
    const model = getModel("resumeTranslate");
    logModelUsage("resumeTranslate");

    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const translated = JSON.parse(content) as {
      headline: string;
      summary: string;
      experience: { title: string; description: string }[];
      education: { degree: string; field_of_study: string }[];
      skills: string[];
    };

    // Merge translated fields back into original structure
    const name    = profileRow.full_name ?? pj.name ?? "";
    const email   = profileRow.email    ?? pj.email    ?? "";
    const phone   = profileRow.phone    ?? pj.phone    ?? "";
    const location = profileRow.location ?? pj.location ?? "";

    const data: ResumeData = {
      name,
      headline:     translated.headline || sourceData.headline,
      summary:      translated.summary  || sourceData.summary,
      contactParts: [email, phone, location].filter(Boolean),
      linkParts:    Object.entries(links).filter(([, v]) => v).map(([k, v]) => ({ label: k, url: v })),
      experience:   (pj.experience ?? []).map((exp, i) => ({
        title:      translated.experience[i]?.title      ?? exp.title,
        company:    exp.company,
        start_date: exp.start_date,
        end_date:   exp.end_date,
        is_current: exp.is_current,
        bullets:    translated.experience[i]?.description
          ? translated.experience[i].description.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 10)
          : [],
      })),
      education: (pj.education ?? []).map((edu, i) => ({
        school:        edu.school,
        degree:        translated.education[i]?.degree         ?? edu.degree,
        field_of_study: translated.education[i]?.field_of_study ?? edu.field_of_study,
        start_date:    edu.start_date,
        end_date:      edu.end_date,
      })),
      skills: translated.skills.length ? translated.skills : sourceData.skills,
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Translation error:", err);
    return NextResponse.json({ error: "Translation failed. Please try again." }, { status: 500 });
  }
}
