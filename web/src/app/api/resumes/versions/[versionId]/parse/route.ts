import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runResumeParse } from "@/lib/resume-parse-pipeline";

export const maxDuration = 60; // extraction + structured LLM parse run via after()

// POST /api/resumes/versions/[versionId]/parse — runs the full parse pipeline
// (extract text → structured LLM parse → persist profile) durably via after(),
// so it completes even on serverless after the response is returned. Returns
// immediately; the client polls the version's parse_status.
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
    .select("id, parse_status, resume_documents!resume_versions_document_id_fkey!inner(user_id)")
    .eq("id", versionId)
    .eq("resume_documents!resume_versions_document_id_fkey.user_id", userId)
    .is("deleted_at", null)
    .single();

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already fully parsed — nothing to do. (A "partial" can still be re-parsed.)
  if (version.parse_status === "parsed") {
    return NextResponse.json({ ok: true, status: "parsed" });
  }

  // Run the full pipeline after the response is sent — survives on serverless.
  after(() => runResumeParse(versionId));

  return NextResponse.json({ ok: true, status: "processing" });
}
