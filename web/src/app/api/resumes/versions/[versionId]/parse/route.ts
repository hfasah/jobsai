import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";

export const maxDuration = 70; // Vercel max

const PARSE_TIMEOUT = 60000; // 60 second timeout

// POST /api/resumes/versions/[versionId]/parse — run text extraction + OpenAI parse
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
    console.error("Text extraction error:", err);
    await supabaseAdmin.from("resume_versions").update({
      parse_status: "failed",
      parse_error_code: "EXTRACTION_FAILED",
      parse_error_msg: "Failed to extract text. Try another file format.",
    }).eq("id", versionId);
    return NextResponse.json({ error: "Text extraction failed." }, { status: 500 });
  }

  // ── AI parsing (with timeout) ────────────────────────────────────────────────
  try {
    const parsePromise = parseResumeText(plainText);
    
    // Race: parsing vs timeout
    const parsed = await Promise.race([
      parsePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PARSE_TIMEOUT")), PARSE_TIMEOUT)
      ),
    ]) as any;

    if (!parsed) throw new Error("Empty parse result");

    await supabaseAdmin.from("resume_parsed_profile").upsert({
      version_id: versionId,
      parsed_json: parsed,
      full_name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      links: parsed.links,
    });

    await supabaseAdmin.from("resume_versions").update({
      parse_status: "parsed",
    }).eq("id", versionId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const isTimeout = err.message === "PARSE_TIMEOUT";
    
    console.error(`Parse ${isTimeout ? "timeout" : "error"}:`, err);

    // On timeout or error: mark as partial with extracted text only
    // At least user has basic resume data extracted
    const minimalParse = {
      name: null,
      email: null,
      phone: null,
      location: null,
      headline: null,
      summary: plainText.slice(0, 500), // First 500 chars as summary
      links: {},
      years_experience: null,
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      confidence: { contact: 0, experience: 0, education: 0, skills: 0 },
      warnings: [
        isTimeout 
          ? "Parsing took too long. We've extracted the text, but structure (skills, experience) is incomplete. You can manually add details or try re-uploading."
          : "Parsing failed. We've extracted the text, but structure is incomplete. You can manually add details.",
      ],
    };

    await supabaseAdmin.from("resume_parsed_profile").upsert({
      version_id: versionId,
      parsed_json: minimalParse,
      full_name: null,
      email: null,
      phone: null,
      location: null,
      links: {},
    });

    await supabaseAdmin.from("resume_versions").update({
      parse_status: "partial",
      parse_error_code: isTimeout ? "PARSE_TIMEOUT" : "PARSE_FAILED",
      parse_error_msg: isTimeout
        ? "Parsing took too long, but your resume text is saved."
        : "Parsing failed, but your resume text is saved.",
    }).eq("id", versionId);

    // Don't return error — mark as partial so user can proceed
    return NextResponse.json({ ok: true, status: "partial" });
  }
}
