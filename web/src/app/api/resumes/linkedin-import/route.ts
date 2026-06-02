import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { parseResumeText } from "@/lib/resume-parser";
import { fetchUrlContent } from "@/lib/job-import";

export const maxDuration = 60;

// POST /api/resumes/linkedin-import
// Body: { url?: string; text?: string }
// Returns: { resume_document_id, resume_version_id }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url: string | undefined = body.url?.trim();
  const providedText: string | undefined = body.text?.trim();

  if (!url && !providedText) {
    return NextResponse.json(
      { error: "Provide a LinkedIn URL or paste your profile text." },
      { status: 400 }
    );
  }

  // ── 1. Get raw text ────────────────────────────────────────────────────────
  let rawText = providedText ?? "";

  if (!rawText && url) {
    try {
      rawText = await fetchUrlContent(url);
    } catch {
      return NextResponse.json(
        { error: "Could not fetch the LinkedIn profile. LinkedIn may be blocking the request — try the 'Paste text' option instead." },
        { status: 422 }
      );
    }

    if (rawText.length < 200) {
      return NextResponse.json(
        { error: "Not enough content retrieved from that URL. Please use the 'Paste text' option instead." },
        { status: 422 }
      );
    }
  }

  // ── 2. Parse with GPT-4o ──────────────────────────────────────────────────
  let parsed;
  try {
    parsed = await parseResumeText(rawText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parsing failed." },
      { status: 500 }
    );
  }

  const isPartial =
    !parsed.name && !parsed.email && (!parsed.experience || parsed.experience.length === 0);

  // ── 3. Create resume_document ──────────────────────────────────────────────
  const label = parsed.name ? `${parsed.name} — LinkedIn` : "LinkedIn Profile";

  const { data: doc, error: docError } = await supabaseAdmin
    .from("resume_documents")
    .insert({ user_id: userId, label })
    .select("id")
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Failed to create resume document." }, { status: 500 });
  }

  // ── 4. Create resume_version ───────────────────────────────────────────────
  const checksum = createHash("sha256").update(rawText).digest("hex");
  const fileName = url ?? "LinkedIn Profile";
  const storageKey = `linkedin/${userId}/${doc.id}`;

  const { data: version, error: versionError } = await supabaseAdmin
    .from("resume_versions")
    .insert({
      document_id: doc.id,
      version_number: 1,
      storage_key: storageKey,
      file_name: fileName,
      file_ext: "linkedin",
      file_mime: "text/plain",
      file_size_bytes: rawText.length,
      checksum_sha256: checksum,
      upload_status: "uploaded",
      parse_status: isPartial ? "partial" : "parsed",
      text_char_count: rawText.length,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: "Failed to create version record." }, { status: 500 });
  }

  // ── 5. Set as active version ───────────────────────────────────────────────
  await supabaseAdmin
    .from("resume_documents")
    .update({ active_version_id: version.id })
    .eq("id", doc.id);

  // Make primary if user has no primary resume yet
  const { count: primaryCount } = await supabaseAdmin
    .from("resume_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false);

  if ((primaryCount ?? 0) === 0) {
    await supabaseAdmin
      .from("resume_documents")
      .update({ is_primary: true })
      .eq("id", doc.id);
  }

  // ── 6. Store all parsed data ───────────────────────────────────────────────
  await supabaseAdmin.from("resume_texts").insert({
    version_id: version.id,
    plain_text: rawText,
    tokens_count: Math.ceil(rawText.length / 4),
  });

  await supabaseAdmin.from("resume_parsed_profile").insert({
    version_id: version.id,
    full_name: parsed.name ?? null,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    location: parsed.location ?? null,
    headline: parsed.headline ?? null,
    summary: parsed.summary ?? null,
    links: parsed.links ?? {},
    years_experience: parsed.years_experience ?? null,
    parsed_json: parsed,
  });

  if (parsed.experience?.length) {
    await supabaseAdmin.from("resume_experiences").insert(
      parsed.experience.map((exp, idx) => ({
        version_id: version.id,
        idx,
        title: exp.title ?? null,
        company: exp.company ?? null,
        employment_type: exp.employment_type ?? null,
        location: exp.location ?? null,
        start_date: exp.start_date ?? null,
        end_date: exp.end_date ?? null,
        is_current: exp.is_current ?? false,
        description: exp.description ?? null,
      }))
    );
  }

  if (parsed.education?.length) {
    await supabaseAdmin.from("resume_educations").insert(
      parsed.education.map((edu, idx) => ({
        version_id: version.id,
        idx,
        school: edu.school ?? null,
        degree: edu.degree ?? null,
        field_of_study: edu.field_of_study ?? null,
        start_date: edu.start_date ?? null,
        end_date: edu.end_date ?? null,
        grade: edu.grade ?? null,
        description: edu.description ?? null,
      }))
    );
  }

  if (parsed.skills?.length) {
    await supabaseAdmin.from("resume_skills").insert(
      parsed.skills.map((s) => ({
        version_id: version.id,
        skill: s.skill,
        category: s.category ?? null,
        confidence: s.confidence ?? null,
      }))
    );
  }

  return NextResponse.json(
    { resume_document_id: doc.id, resume_version_id: version.id },
    { status: 201 }
  );
}
