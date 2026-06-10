import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";

export const maxDuration = 30;

// POST /api/resumes/versions/[versionId]/parse — text extraction only (no AI)
// Skip AI parsing entirely for speed — users proceed immediately with extracted text
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

  // Skip if already extracted
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

  // ── Text extraction only ──────────────────────────────────────────────────────
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

    // Store extracted text
    await supabaseAdmin.from("resume_texts").upsert({
      version_id: versionId,
      plain_text: plainText,
      tokens_count: Math.ceil(plainText.length / 4),
    });

    // Create minimal parsed profile so user can proceed immediately
    const minimalParse = {
      name: null,
      email: null,
      phone: null,
      location: null,
      headline: null,
      summary: plainText.slice(0, 500),
      links: {},
      years_experience: null,
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      confidence: { contact: 0, experience: 0, education: 0, skills: 0 },
      warnings: ["Resume text extracted. You can manually add skills, experience, and other details to improve matches."],
    };

    await supabaseAdmin.from("resume_parsed_profile").upsert({
      version_id: versionId,
      parsed_json: minimalParse,
    });

    // Mark as ready immediately (not parsed — just extracted)
    await supabaseAdmin.from("resume_versions").update({
      parse_status: "partial",
    }).eq("id", versionId);

    return NextResponse.json({ ok: true, status: "partial" });
  } catch (err) {
    console.error("Text extraction error:", err);
    await supabaseAdmin.from("resume_versions").update({
      parse_status: "failed",
      parse_error_code: "EXTRACTION_FAILED",
      parse_error_msg: "Failed to extract text. Try another file format.",
    }).eq("id", versionId);
    return NextResponse.json({ error: "Text extraction failed." }, { status: 500 });
  }
}
