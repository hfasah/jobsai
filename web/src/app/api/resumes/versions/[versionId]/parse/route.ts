import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";

export const maxDuration = 60;

// POST /api/resumes/versions/[versionId]/parse — run text extraction + OpenAI parse
// Called by the client immediately after upload, runs independently so the user
// can navigate away while it completes.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  // Verify ownership and get storage key
  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("id, document_id, storage_key, file_mime, parse_status, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: skip if already parsed
  if (version.parse_status === "parsed" || version.parse_status === "partial") {
    return NextResponse.json({ ok: true, status: version.parse_status });
  }

  // Download file from storage
  const { data: fileData, error: dlError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(version.storage_key);

  if (dlError || !fileData) {
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mimeType: string = version.file_mime ?? "application/pdf";

  // ── Text extraction ──────────────────────────────────────────────────────────
  await supabaseAdmin.from("resume_versions").update({ parse_status: "extracting_text" }).eq("id", versionId);

  let plainText = "";
  let pages: number | null = null;
  let ocrUsed = false;

  try {
    const extracted = await extractText(buffer, mimeType);
    plainText = extracted.text;
    pages = extracted.pages;
    ocrUsed = extracted.ocrUsed;

    await supabaseAdmin.from("resume_versions")
      .update({ pages_count: pages, ocr_used: ocrUsed })
      .eq("id", versionId);

    if (!plainText) {
      await supabaseAdmin.from("resume_versions").update({
        parse_status: "failed",
        parse_error_code: "NO_TEXT_DETECTED",
        parse_error_msg: "No readable text found. Try a DOCX or text-based PDF.",
      }).eq("id", versionId);
      return NextResponse.json({ error: "No text detected." }, { status: 422 });
    }

    await supabaseAdmin.from("resume_texts").upsert({
      version_id: versionId,
      plain_text: plainText,
      tokens_count: Math.ceil(plainText.length / 4),
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "EXTRACTION_FAILED";
    await supabaseAdmin.from("resume_versions").update({ parse_status: "failed", parse_error_code: code }).eq("id", versionId);
    return NextResponse.json({ error: code }, { status: 500 });
  }

  // ── OpenAI parse ─────────────────────────────────────────────────────────────
  try {
    const parsed = await parseResumeText(plainText);
    const isPartial = !parsed.name && !parsed.email && (!parsed.experience || parsed.experience.length === 0);

    await supabaseAdmin.from("resume_parsed_profile").upsert({
      version_id: versionId,
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
      await supabaseAdmin.from("resume_experiences").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_experiences").insert(
        parsed.experience.map((exp, idx) => ({
          version_id: versionId, idx,
          title: exp.title ?? null, company: exp.company ?? null,
          employment_type: exp.employment_type ?? null, location: exp.location ?? null,
          start_date: exp.start_date ?? null, end_date: exp.end_date ?? null,
          is_current: exp.is_current ?? false, description: exp.description ?? null,
        }))
      );
    }

    if (parsed.education?.length) {
      await supabaseAdmin.from("resume_educations").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_educations").insert(
        parsed.education.map((edu, idx) => ({
          version_id: versionId, idx,
          school: edu.school ?? null, degree: edu.degree ?? null,
          field_of_study: edu.field_of_study ?? null,
          start_date: edu.start_date ?? null, end_date: edu.end_date ?? null,
          grade: edu.grade ?? null, description: edu.description ?? null,
        }))
      );
    }

    if (parsed.skills?.length) {
      await supabaseAdmin.from("resume_skills").delete().eq("version_id", versionId);
      await supabaseAdmin.from("resume_skills").insert(
        parsed.skills.map((s) => ({
          version_id: versionId, skill: s.skill,
          category: s.category ?? null, confidence: s.confidence ?? null,
        }))
      );
    }

    await supabaseAdmin.from("resume_versions").update({
      parse_status: isPartial ? "partial" : "parsed",
      processed_at: new Date().toISOString(),
      text_char_count: plainText.length,
    }).eq("id", versionId);

    return NextResponse.json({ ok: true, status: isPartial ? "partial" : "parsed" });
  } catch (err) {
    await supabaseAdmin.from("resume_versions").update({
      parse_status: "failed",
      parse_error_code: "STRUCTURE_EXTRACTION_FAILED",
      parse_error_msg: err instanceof Error ? err.message : "Unknown error",
    }).eq("id", versionId);
    return NextResponse.json({ error: "Parse failed." }, { status: 500 });
  }
}
