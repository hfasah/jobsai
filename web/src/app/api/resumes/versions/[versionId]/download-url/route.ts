import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

// POST /api/resumes/versions/[versionId]/download-url
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { versionId } = await params;

  // Two simple queries instead of an embedded-resource filter (the latter is
  // brittle and was nulling the result → every download 404'd). 1) fetch the
  // version, 2) verify the user owns its document.
  const { data: version, error: vErr } = await supabaseAdmin
    .from("resume_versions")
    .select("storage_key, file_name, document_id")
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (vErr) console.error("download-url version lookup failed:", vErr.message);
  if (!version) return NextResponse.json({ error: "Resume not found." }, { status: 404 });

  const { data: ownerDoc } = await supabaseAdmin
    .from("resume_documents")
    .select("user_id")
    .eq("id", version.document_id)
    .maybeSingle();
  if (!ownerDoc || ownerDoc.user_id !== userId) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  // `download` sets Content-Disposition so the file saves with a real name
  // (e.g. "My Resume.docx") instead of the storage UUID.
  const { data: signed, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(version.storage_key, 300, { download: version.file_name || true }); // 5 min TTL

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return NextResponse.json({ url: signed.signedUrl, expires_at: expiresAt });
}
