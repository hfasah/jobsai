import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { extractText } from "@/lib/resume-extractor";

export const maxDuration = 10; // Don't wait long

// POST /api/resumes/versions/[versionId]/parse — background extraction only
// Fire and forget — return immediately, extraction happens async
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  // Verify ownership
  const { data: version } = await supabaseAdmin
    .from("resume_versions")
    .select("id, document_id, storage_key, file_mime, parse_status, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already extracted, don't re-extract
  if (version.parse_status === "parsed" || version.parse_status === "partial") {
    return NextResponse.json({ ok: true, status: version.parse_status });
  }

  // Return immediately — extraction happens in background
  // Don't wait for extraction to complete
  (async () => {
    try {
      const { data: fileData } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .download(version.storage_key);

      if (!fileData) return;

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const mimeType = version.file_mime ?? "application/pdf";

      const extracted = await extractText(buffer, mimeType);
      const plainText = extracted.text;
      const pages = extracted.pages;
      const ocrUsed = extracted.ocrUsed;

      if (!plainText) {
        await supabaseAdmin.from("resume_versions").update({
          parse_status: "failed",
          parse_error_code: "NO_TEXT_DETECTED",
        }).eq("id", versionId);
        return;
      }

      // Store extracted text
      await supabaseAdmin.from("resume_texts").upsert({
        version_id: versionId,
        plain_text: plainText,
        tokens_count: Math.ceil(plainText.length / 4),
      });

      // Update version with extraction details
      await supabaseAdmin.from("resume_versions").update({
        parse_status: "partial",
        pages_count: pages,
        ocr_used: ocrUsed,
      }).eq("id", versionId);
    } catch (err) {
      console.error("Background extraction error:", err);
      // Silently fail — user has minimal resume already
    }
  })();

  // Return immediately, don't wait for extraction
  return NextResponse.json({ ok: true, status: "partial" });
}
